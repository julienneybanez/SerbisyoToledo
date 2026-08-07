const fs = require('fs');
const path = require('path');
const db = require(path.resolve('./config/database.js'));

function canEmptyString(columnType) {
  const t = String(columnType || '').toLowerCase();
  return t.includes('char') || t.includes('text') || t.includes('enum') || t.includes('set');
}

function isLowCardinalityType(columnType) {
  const t = String(columnType || '').toLowerCase();
  return !t.includes('blob') && !t.includes('json');
}

const readMetaField = (row, snakeName) => {
  const upper = snakeName.toUpperCase();
  return row?.[snakeName] ?? row?.[upper] ?? null;
};

(async () => {
  try {
    const [dbNameRows] = await db.query('SELECT DATABASE() AS dbName');
    const dbName = dbNameRows[0]?.dbName;

    const [tables] = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const [columns] = await db.query(`
      SELECT
        table_name,
        ordinal_position,
        column_name,
        column_type,
        data_type,
        is_nullable,
        column_default,
        extra
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
      ORDER BY table_name, ordinal_position
    `);

    const [pkRows] = await db.query(`
      SELECT kcu.table_name, kcu.column_name, kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = DATABASE()
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.table_name, kcu.ordinal_position
    `);

    const [fkRows] = await db.query(`
      SELECT
        kcu.table_name,
        kcu.column_name,
        kcu.constraint_name,
        kcu.referenced_table_name,
        kcu.referenced_column_name
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE kcu.table_schema = DATABASE()
        AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position
    `);

    const [uniqueRows] = await db.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = DATABASE()
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
    `);

    const [checkRows] = await db.query(`
      SELECT tc.table_name, tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc
        ON tc.constraint_schema = cc.constraint_schema
       AND tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = DATABASE()
        AND tc.constraint_type = 'CHECK'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    const columnsByTable = new Map();
    for (const col of columns) {
      const tableName = readMetaField(col, 'table_name');
      if (!tableName) {
        continue;
      }

      if (!columnsByTable.has(tableName)) columnsByTable.set(tableName, []);
      columnsByTable.get(tableName).push(col);
    }

    const tableStats = {};

    for (const tableRow of tables) {
      const table_name = readMetaField(tableRow, 'table_name');
      if (!table_name) {
        continue;
      }

      const [countRows] = await db.query(`SELECT COUNT(*) AS totalRows FROM \`${table_name}\``);
      const totalRows = Number(countRows[0]?.totalRows || 0);
      tableStats[table_name] = { totalRows, columns: {} };

      const cols = columnsByTable.get(table_name) || [];
      for (const col of cols) {
        const colName = readMetaField(col, 'column_name');
        if (!colName) {
          continue;
        }

        const colRef = `\`${colName}\``;

        const [nullRows] = await db.query(`SELECT COUNT(*) AS c FROM \`${table_name}\` WHERE ${colRef} IS NULL`);
        const nullCount = Number(nullRows[0]?.c || 0);

        let emptyCount = null;
        if (canEmptyString(readMetaField(col, 'column_type'))) {
          const [emptyRows] = await db.query(`SELECT COUNT(*) AS c FROM \`${table_name}\` WHERE ${colRef} = ''`);
          emptyCount = Number(emptyRows[0]?.c || 0);
        }

        const [distinctRows] = await db.query(`SELECT COUNT(DISTINCT ${colRef}) AS c FROM \`${table_name}\``);
        const distinctCount = Number(distinctRows[0]?.c || 0);

        let topValues = [];
        if (isLowCardinalityType(readMetaField(col, 'column_type')) && distinctCount <= 50) {
          const [topRows] = await db.query(`
            SELECT ${colRef} AS v, COUNT(*) AS c
            FROM \`${table_name}\`
            GROUP BY ${colRef}
            ORDER BY c DESC
            LIMIT 10
          `);
          topValues = topRows.map(r => ({ value: r.v, count: Number(r.c) }));
        }

        tableStats[table_name].columns[colName] = {
          nullCount,
          emptyCount,
          distinctCount,
          topValues,
        };
      }
    }

    const output = {
      generatedAt: new Date().toISOString(),
      database: dbName,
      tables,
      columns,
      primaryKeys: pkRows,
      foreignKeys: fkRows,
      uniqueConstraints: uniqueRows,
      checkConstraints: checkRows,
      tableStats,
    };

    const outPath = path.resolve('./db_audit_live.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log('DB live audit written to', outPath);
  } catch (error) {
    console.error('DB audit failed:', error && (error.stack || error.message || error));
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
