const db = require('../config/database');
const {
  normalizeCategoryLabels,
  getServiceTypesForProfile,
} = require('../config/serviceTaxonomy');

const LEGACY_DIRECT_CATEGORY_MAP = new Map([
  ['house cleaning', 'Cleaning'],
  ['wiring', 'Electrical'],
  ['beauty', 'Beauty & Wellness'],
  ['others', 'Other Services'],
]);

const REPAIR_KEYWORD_GROUPS = [
  {
    category: 'Locksmith',
    patterns: [/\block\b/, /\bkey\b/, /locksmith/],
  },
  {
    category: 'Appliance Repair',
    patterns: [/appliance/, /refrigerator/, /\bfridge\b/, /washing\s*machine/, /electric\s*fan/],
  },
  {
    category: 'Aircon & Refrigeration',
    patterns: [/aircon/, /air\s*conditioning/, /\bac\b/, /refrigeration/],
  },
  {
    category: 'Tech Repair',
    patterns: [/computer/, /laptop/, /phone/, /mobile/, /electronics?/, /\bit\b/, /technician/],
  },
  {
    category: 'Welding & Metalwork',
    patterns: [/weld/, /welding/, /metal/, /grill/, /gate\s*repair/, /fabrication/],
  },
];

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const inferRepairCategory = ({ profession, skills }) => {
  const corpus = `${String(profession || '').toLowerCase()} ${(skills || []).join(' ').toLowerCase()}`;

  const matches = REPAIR_KEYWORD_GROUPS
    .filter((group) => group.patterns.some((pattern) => pattern.test(corpus)))
    .map((group) => group.category);

  return matches.length === 1 ? matches[0] : null;
};

const dedupe = (items) => Array.from(new Set(items));

const migrateProfileRecord = ({ categories, profession, skills }) => {
  const inputCategories = Array.isArray(categories) ? categories : [];
  const normalizedInput = inputCategories
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const rewritten = [];
  let hadRepair = false;

  for (const category of normalizedInput) {
    const direct = LEGACY_DIRECT_CATEGORY_MAP.get(normalizeText(category));
    if (direct) {
      rewritten.push(direct);
      continue;
    }

    if (normalizeText(category) === 'repair') {
      hadRepair = true;
      const inferred = inferRepairCategory({ profession, skills });
      if (inferred) {
        rewritten.push(inferred);
      } else {
        rewritten.push('Repair');
      }
      continue;
    }

    rewritten.push(category);
  }

  const normalizedCategories = normalizeCategoryLabels(rewritten, { preserveUnknown: true });
  const canonicalCategories = normalizeCategoryLabels(normalizedCategories, { preserveUnknown: false });

  const unknownCategories = normalizedCategories.filter(
    (category) => !canonicalCategories.includes(category)
  );

  const derivedServiceTypes = getServiceTypesForProfile({
    categoryLabels: canonicalCategories,
    serviceTypeKeys: [],
  });

  const serviceTypeKeys = dedupe(derivedServiceTypes.map((item) => item.key));

  const stillHasLegacyRepair = normalizedCategories.includes('Repair');

  const taxonomyNeedsReview = Boolean(
    stillHasLegacyRepair
    || unknownCategories.length > 0
    || serviceTypeKeys.length === 0
  );

  return {
    hadRepair,
    stillHasLegacyRepair,
    categories: normalizedCategories,
    serviceTypes: serviceTypeKeys,
    taxonomyNeedsReview,
  };
};

async function run() {
  const [rows] = await db.query(
    `SELECT sp.id, sp.service_categories, u.profession, u.skills
     FROM service_profiles sp
     JOIN users u ON u.id = sp.user_id`
  );

  let migratedCount = 0;
  let preservedAmbiguousRepairCount = 0;
  let flaggedForReviewCount = 0;

  for (const row of rows) {
    const categories = parseJsonArray(row.service_categories);
    const skills = parseJsonArray(row.skills);

    const migrated = migrateProfileRecord({
      categories,
      profession: row.profession,
      skills,
    });

    if (migrated.hadRepair && migrated.stillHasLegacyRepair) {
      preservedAmbiguousRepairCount += 1;
    }

    if (migrated.taxonomyNeedsReview) {
      flaggedForReviewCount += 1;
    }

    await db.query(
      `UPDATE service_profiles
       SET service_categories = ?,
           service_types = ?,
           taxonomy_needs_review = ?
       WHERE id = ?`,
      [
        JSON.stringify(migrated.categories),
        migrated.serviceTypes.length > 0 ? JSON.stringify(migrated.serviceTypes) : null,
        migrated.taxonomyNeedsReview,
        row.id,
      ]
    );

    migratedCount += 1;
  }

  console.log('Service taxonomy backfill complete');
  console.log(`Profiles processed: ${migratedCount}`);
  console.log(`Ambiguous legacy Repair preserved: ${preservedAmbiguousRepairCount}`);
  console.log(`Profiles flagged for review: ${flaggedForReviewCount}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Backfill failed:', error.message);
    process.exit(1);
  });
