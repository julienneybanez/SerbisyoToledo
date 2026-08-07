const SERVICE_TAXONOMY_VERSION = '2026-08-07';

const SERVICE_TAXONOMY = [
  {
    key: 'carpentry',
    label: 'Carpentry',
    slug: 'carpentry',
    aliases: ['Carpentry'],
    serviceTypes: [
      { key: 'furniture_repair', label: 'Furniture Repair' },
      { key: 'cabinet_work', label: 'Cabinet Work' },
      { key: 'door_window_repair', label: 'Door & Window Repair' },
      { key: 'furniture_assembly', label: 'Furniture Assembly' },
      { key: 'custom_carpentry', label: 'Custom Carpentry' },
      { key: 'general_carpentry', label: 'General Carpentry' },
    ],
  },
  {
    key: 'plumbing',
    label: 'Plumbing',
    slug: 'plumbing',
    aliases: ['Plumbing'],
    serviceTypes: [
      { key: 'leak_repair', label: 'Leak Repair' },
      { key: 'faucet_repair_installation', label: 'Faucet Repair & Installation' },
      { key: 'pipe_repair_installation', label: 'Pipe Repair & Installation' },
      { key: 'drain_toilet_services', label: 'Drain & Toilet Services' },
      { key: 'general_plumbing', label: 'General Plumbing' },
    ],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    slug: 'electrical',
    aliases: ['Electrical', 'Wiring'],
    serviceTypes: [
      { key: 'electrical_troubleshooting', label: 'Electrical Troubleshooting' },
      { key: 'wiring_rewiring', label: 'Wiring & Rewiring' },
      { key: 'lighting_installation', label: 'Lighting Installation' },
      { key: 'outlet_switch_repair', label: 'Outlet & Switch Repair' },
      { key: 'breaker_panel_service', label: 'Breaker / Electrical Panel Service' },
      { key: 'general_electrical_work', label: 'General Electrical Work' },
    ],
  },
  {
    key: 'cleaning',
    label: 'Cleaning',
    slug: 'cleaning',
    aliases: ['Cleaning', 'House Cleaning'],
    serviceTypes: [
      { key: 'general_house_cleaning', label: 'General House Cleaning' },
      { key: 'deep_cleaning', label: 'Deep Cleaning' },
      { key: 'move_in_move_out_cleaning', label: 'Move-In / Move-Out Cleaning' },
      { key: 'post_construction_cleaning', label: 'Post-Construction Cleaning' },
    ],
  },
  {
    key: 'gardening_landscaping',
    label: 'Gardening & Landscaping',
    slug: 'gardening-landscaping',
    aliases: ['Gardening'],
    serviceTypes: [
      { key: 'lawn_care', label: 'Lawn Care' },
      { key: 'garden_maintenance', label: 'Garden Maintenance' },
      { key: 'tree_plant_trimming', label: 'Tree / Plant Trimming' },
      { key: 'landscaping', label: 'Landscaping' },
    ],
  },
  {
    key: 'appliance_repair',
    label: 'Appliance Repair',
    slug: 'appliance-repair',
    aliases: [],
    serviceTypes: [
      { key: 'refrigerator_repair', label: 'Refrigerator Repair' },
      { key: 'washing_machine_repair', label: 'Washing Machine Repair' },
      { key: 'electric_fan_repair', label: 'Electric Fan Repair' },
      { key: 'small_appliance_repair', label: 'Small Appliance Repair' },
      { key: 'general_appliance_repair', label: 'General Appliance Repair' },
    ],
  },
  {
    key: 'aircon_refrigeration',
    label: 'Aircon & Refrigeration',
    slug: 'aircon-refrigeration',
    aliases: ['Aircon Repair'],
    serviceTypes: [
      { key: 'aircon_cleaning', label: 'Aircon Cleaning' },
      { key: 'aircon_repair', label: 'Aircon Repair' },
      { key: 'aircon_installation', label: 'Aircon Installation' },
      { key: 'refrigeration_repair', label: 'Refrigeration Repair' },
    ],
  },
  {
    key: 'locksmith',
    label: 'Locksmith',
    slug: 'locksmith',
    aliases: [],
    serviceTypes: [
      { key: 'lock_repair', label: 'Lock Repair' },
      { key: 'lock_installation', label: 'Lock Installation' },
      { key: 'key_replacement', label: 'Key Replacement' },
      { key: 'door_lock_services', label: 'Door Lock Services' },
    ],
  },
  {
    key: 'beauty_wellness',
    label: 'Beauty & Wellness',
    slug: 'beauty-wellness',
    aliases: ['Beauty'],
    serviceTypes: [
      { key: 'hair_barber_services', label: 'Hair / Barber Services' },
      { key: 'makeup_services', label: 'Makeup Services' },
      { key: 'nail_services', label: 'Nail Services' },
      { key: 'massage_hilot', label: 'Massage / Hilot' },
      { key: 'other_beauty_services', label: 'Other Beauty Services' },
    ],
  },
  {
    key: 'laundry',
    label: 'Laundry',
    slug: 'laundry',
    aliases: [],
    serviceTypes: [
      { key: 'wash_and_fold', label: 'Wash & Fold' },
      { key: 'ironing', label: 'Ironing' },
      { key: 'laundry_pickup_delivery', label: 'Laundry Pickup / Delivery' },
    ],
  },
  {
    key: 'painting',
    label: 'Painting',
    slug: 'painting',
    aliases: ['Painting'],
    serviceTypes: [
      { key: 'interior_painting', label: 'Interior Painting' },
      { key: 'exterior_painting', label: 'Exterior Painting' },
      { key: 'furniture_painting', label: 'Furniture Painting' },
      { key: 'general_painting', label: 'General Painting' },
    ],
  },
  {
    key: 'masonry_minor_construction',
    label: 'Masonry & Minor Construction',
    slug: 'masonry-minor-construction',
    aliases: ['Masonry'],
    serviceTypes: [
      { key: 'concrete_masonry_repair', label: 'Concrete / Masonry Repair' },
      { key: 'tiling', label: 'Tiling' },
      { key: 'wall_repair', label: 'Wall Repair' },
      { key: 'minor_construction_work', label: 'Minor Construction Work' },
    ],
  },
  {
    key: 'welding_metalwork',
    label: 'Welding & Metalwork',
    slug: 'welding-metalwork',
    aliases: [],
    serviceTypes: [
      { key: 'gate_grill_repair', label: 'Gate / Grill Repair' },
      { key: 'welding_repair', label: 'Welding Repair' },
      { key: 'metal_fabrication', label: 'Metal Fabrication' },
    ],
  },
  {
    key: 'tech_repair',
    label: 'Tech Repair',
    slug: 'tech-repair',
    aliases: [],
    serviceTypes: [
      { key: 'computer_laptop_repair', label: 'Computer / Laptop Repair' },
      { key: 'phone_mobile_repair', label: 'Phone / Mobile Device Repair' },
      { key: 'basic_electronics_repair', label: 'Basic Electronics Repair' },
    ],
  },
  {
    key: 'other_services',
    label: 'Other Services',
    slug: 'other-services',
    aliases: ['Others'],
    serviceTypes: [
      { key: 'other_service_unspecified', label: 'Other Service (Specify in details)' },
    ],
  },
];

const LEGACY_CATEGORY_FILTERS = {
  Repair: ['Repair', 'Appliance Repair', 'Aircon Repair', 'Locksmith', 'Tech Repair'],
  Others: ['Others', 'Other Services', 'Laundry'],
};

const PROMINENT_CATEGORY_KEYS = [
  'carpentry',
  'plumbing',
  'electrical',
  'cleaning',
  'gardening_landscaping',
  'appliance_repair',
  'aircon_refrigeration',
  'beauty_wellness',
];

const MORE_CATEGORY_KEYS = [
  'locksmith',
  'laundry',
  'painting',
  'masonry_minor_construction',
  'welding_metalwork',
  'tech_repair',
  'other_services',
];

const LEGACY_CATEGORY_VALUES = new Set(['repair']);

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const categoryByToken = new Map();
const categoryByKey = new Map();
const serviceTypeByKey = new Map();

for (const category of SERVICE_TAXONOMY) {
  categoryByKey.set(category.key, category);

  const tokens = [category.key, category.label, category.slug, ...(category.aliases || [])];
  for (const token of tokens) {
    if (token) {
      categoryByToken.set(normalizeText(token), category);
    }
  }

  for (const serviceType of category.serviceTypes) {
    serviceTypeByKey.set(serviceType.key, {
      ...serviceType,
      categoryKey: category.key,
      categoryLabel: category.label,
    });
  }
}

const uniqueValues = (values) => Array.from(new Set(values));

const resolveCategory = (value) => categoryByToken.get(normalizeText(value)) || null;

const isLegacyCategoryValue = (value) => LEGACY_CATEGORY_VALUES.has(normalizeText(value));

const normalizeCategoryLabels = (values = [], { preserveUnknown = true } = {}) => {
  const normalized = [];

  for (const rawValue of Array.isArray(values) ? values : []) {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) {
      continue;
    }

    const category = resolveCategory(trimmed);
    if (category) {
      normalized.push(category.label);
    } else if (preserveUnknown) {
      normalized.push(trimmed);
    }
  }

  return uniqueValues(normalized);
};

const toCategoryKey = (value) => {
  const category = resolveCategory(value);
  return category ? category.key : null;
};

const categoryLabelToKey = (value) => {
  const category = resolveCategory(value);
  return category ? category.key : null;
};

const getCategoryByKey = (key) => categoryByKey.get(String(key || '').trim()) || null;

const getServiceTypeByKey = (key) => serviceTypeByKey.get(String(key || '').trim()) || null;

const normalizeServiceTypeKeys = (values = []) => uniqueValues(
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
);

const validateServiceTypeKeysForCategories = ({ categoryLabels = [], serviceTypeKeys = [] }) => {
  const normalizedServiceTypeKeys = normalizeServiceTypeKeys(serviceTypeKeys);
  const categoryKeys = new Set(
    normalizeCategoryLabels(categoryLabels, { preserveUnknown: false })
      .map((label) => categoryLabelToKey(label))
      .filter(Boolean)
  );

  const validKeys = [];
  const invalidKeys = [];
  const categoryMismatchKeys = [];

  for (const key of normalizedServiceTypeKeys) {
    const serviceType = getServiceTypeByKey(key);
    if (!serviceType) {
      invalidKeys.push(key);
      continue;
    }

    if (categoryKeys.size > 0 && !categoryKeys.has(serviceType.categoryKey)) {
      categoryMismatchKeys.push(key);
      continue;
    }

    validKeys.push(key);
  }

  return {
    validKeys,
    invalidKeys,
    categoryMismatchKeys,
  };
};

const getGeneralServiceTypeForCategory = (categoryKey) => {
  const category = getCategoryByKey(categoryKey);
  if (!category) {
    return null;
  }

  return category.serviceTypes.find((serviceType) => serviceType.key.startsWith('general_'))
    || category.serviceTypes[0]
    || null;
};

const getServiceTypesForProfile = ({ categoryLabels = [], serviceTypeKeys = [] }) => {
  const normalizedCategories = normalizeCategoryLabels(categoryLabels, { preserveUnknown: false });
  const categoryKeys = normalizedCategories
    .map((label) => categoryLabelToKey(label))
    .filter(Boolean);

  const explicitKeys = normalizeServiceTypeKeys(serviceTypeKeys)
    .filter((key) => Boolean(getServiceTypeByKey(key)));

  const effectiveKeys = explicitKeys.length > 0
    ? explicitKeys
    : categoryKeys
      .map((key) => getGeneralServiceTypeForCategory(key))
      .filter(Boolean)
      .map((serviceType) => serviceType.key);

  return uniqueValues(effectiveKeys)
    .map((key) => getServiceTypeByKey(key))
    .filter(Boolean)
    .map((serviceType) => ({
      key: serviceType.key,
      label: serviceType.label,
      categoryKey: serviceType.categoryKey,
      categoryLabel: serviceType.categoryLabel,
    }));
};

const getCategoryFilterLabels = (inputCategory) => {
  const raw = String(inputCategory || '').trim();
  if (!raw) {
    return [];
  }

  if (LEGACY_CATEGORY_FILTERS[raw]) {
    return uniqueValues(LEGACY_CATEGORY_FILTERS[raw]);
  }

  const category = resolveCategory(raw);
  if (!category) {
    return [raw];
  }

  return uniqueValues([category.label, ...(category.aliases || [])]);
};

const toPublicTaxonomy = () => ({
  version: SERVICE_TAXONOMY_VERSION,
  prominentCategoryKeys: PROMINENT_CATEGORY_KEYS,
  moreCategoryKeys: MORE_CATEGORY_KEYS,
  categories: SERVICE_TAXONOMY.map((category) => ({
    key: category.key,
    label: category.label,
    slug: category.slug,
    aliases: category.aliases,
    serviceTypes: category.serviceTypes.map((serviceType) => ({
      key: serviceType.key,
      label: serviceType.label,
    })),
  })),
});

module.exports = {
  SERVICE_TAXONOMY_VERSION,
  SERVICE_TAXONOMY,
  toPublicTaxonomy,
  normalizeCategoryLabels,
  toCategoryKey,
  getCategoryByKey,
  getCategoryFilterLabels,
  isLegacyCategoryValue,
  getServiceTypeByKey,
  getServiceTypesForProfile,
  validateServiceTypeKeysForCategories,
};
