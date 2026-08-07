const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

function resolveSqlFilePath(inputPath) {
  if (!inputPath) {
    throw new Error('Missing SQL file path. Usage: node scripts/run-sql-file.js <sql-file-path>');
  }

  const absolutePath = path.isAbsolute(inputPath)
    ? inputPath
    : path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`SQL file not found: ${absolutePath}`);
  }

  return absolutePath;
}

function getConnectionConfig() {
  const databaseUrl = process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.DB_URL;

  if (databaseUrl) {
    return {
      uri: databaseUrl,
      multipleStatements: true,
      // Railway public MySQL commonly requires TLS over public endpoint.
      ssl: { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'serbisyo_toledo',
    multipleStatements: true,
  };
}

async function run() {
  const args = process.argv.slice(2);
  const shouldPrintResults = args.includes('--print-results');
  const sqlFileArg = args.find((arg) => !arg.startsWith('--'));
  const sqlFilePath = resolveSqlFilePath(sqlFileArg);
  const sql = fs.readFileSync(sqlFilePath, 'utf8');

  if (!sql.trim()) {
    throw new Error(`SQL file is empty: ${sqlFilePath}`);
  }

  let connection;

  try {
    console.log(`Executing SQL file: ${sqlFilePath}`);
    connection = await mysql.createConnection(getConnectionConfig());
    const [rows] = await connection.query(sql);

    if (shouldPrintResults) {
      const resultSets = Array.isArray(rows) ? rows : [rows];
      resultSets.forEach((result, index) => {
        if (!Array.isArray(result)) {
          return;
        }

        // For SELECT statements, mysql2 returns arrays of row objects.
        if (result.length > 0 && typeof result[0] === 'object' && !('affectedRows' in result[0])) {
          console.log(`Result set ${index + 1}:`);
          console.table(result);
        }
      });
    }

    console.log('SQL execution completed successfully.');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run().catch((error) => {
  console.error('SQL execution failed:', error.message);
  process.exit(1);
});
