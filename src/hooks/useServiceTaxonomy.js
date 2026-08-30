import { useCallback, useEffect, useMemo, useState } from 'react';
import { serviceProfileAPI } from '../services/api';

const FALLBACK_TAXONOMY = {
  version: 'fallback-2026-08-07',
  prominentCategoryKeys: [
    'carpentry',
    'plumbing',
    'electrical',
    'cleaning',
    'gardening_landscaping',
    'appliance_repair',
    'aircon_refrigeration',
    'beauty_wellness',
  ],
  moreCategoryKeys: [
    'locksmith',
    'laundry',
    'painting',
    'masonry_minor_construction',
    'welding_metalwork',
    'tech_repair',
    'other_services',
  ],
  categories: [
    { key: 'carpentry', label: 'Carpentry', slug: 'carpentry', serviceTypes: [{ key: 'general_carpentry', label: 'General Carpentry' }] },
    { key: 'plumbing', label: 'Plumbing', slug: 'plumbing', serviceTypes: [{ key: 'general_plumbing', label: 'General Plumbing' }] },
    { key: 'electrical', label: 'Electrical', slug: 'electrical', serviceTypes: [{ key: 'general_electrical_work', label: 'General Electrical Work' }] },
    { key: 'cleaning', label: 'Cleaning', slug: 'cleaning', serviceTypes: [{ key: 'general_house_cleaning', label: 'General House Cleaning' }] },
    { key: 'gardening_landscaping', label: 'Gardening & Landscaping', slug: 'gardening-landscaping', serviceTypes: [{ key: 'garden_maintenance', label: 'Garden Maintenance' }] },
    { key: 'appliance_repair', label: 'Appliance Repair', slug: 'appliance-repair', serviceTypes: [{ key: 'general_appliance_repair', label: 'General Appliance Repair' }] },
    { key: 'aircon_refrigeration', label: 'Aircon & Refrigeration', slug: 'aircon-refrigeration', serviceTypes: [{ key: 'aircon_repair', label: 'Aircon Repair' }] },
    { key: 'locksmith', label: 'Locksmith', slug: 'locksmith', serviceTypes: [{ key: 'door_lock_services', label: 'Door Lock Services' }] },
    { key: 'beauty_wellness', label: 'Beauty & Wellness', slug: 'beauty-wellness', serviceTypes: [{ key: 'other_beauty_services', label: 'Other Beauty Services' }] },
    { key: 'laundry', label: 'Laundry', slug: 'laundry', serviceTypes: [{ key: 'wash_and_fold', label: 'Wash & Fold' }] },
    { key: 'other_services', label: 'Other Services', slug: 'other-services', serviceTypes: [{ key: 'other_service_unspecified', label: 'Other Service (Specify in details)' }] },
  ],
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

export default function useServiceTaxonomy() {
  const [taxonomy, setTaxonomy] = useState(FALLBACK_TAXONOMY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTaxonomy = async () => {
      try {
        const response = await serviceProfileAPI.getTaxonomy();
        if (isMounted && response.success && response.data?.categories?.length) {
          setTaxonomy(response.data);
        }
      } catch {
        // Fallback taxonomy is intentionally used on API failure.
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTaxonomy();

    return () => {
      isMounted = false;
    };
  }, []);

  const categoryByLabel = useMemo(() => {
    const map = new Map();
    for (const category of taxonomy.categories || []) {
      map.set(normalizeText(category.label), category);
      map.set(normalizeText(category.key), category);
      map.set(normalizeText(category.slug), category);
      for (const alias of category.aliases || []) {
        map.set(normalizeText(alias), category);
      }
    }
    return map;
  }, [taxonomy.categories]);

  const categoryLabels = useMemo(
    () => ['All', ...(taxonomy.categories || []).map((category) => category.label)],
    [taxonomy.categories]
  );

  const prominentCategories = useMemo(() => {
    const keys = new Set(taxonomy.prominentCategoryKeys || []);
    return (taxonomy.categories || []).filter((category) => keys.has(category.key));
  }, [taxonomy.categories, taxonomy.prominentCategoryKeys]);

  const moreCategories = useMemo(() => {
    const keys = new Set(taxonomy.moreCategoryKeys || []);
    return (taxonomy.categories || []).filter((category) => keys.has(category.key));
  }, [taxonomy.categories, taxonomy.moreCategoryKeys]);

  const getCategory = useCallback(
    (value) => categoryByLabel.get(normalizeText(value)) || null,
    [categoryByLabel]
  );

  const getServiceTypesForCategory = useCallback((categoryValue) => {
    const category = getCategory(categoryValue);
    return Array.isArray(category?.serviceTypes) ? category.serviceTypes : [];
  }, [getCategory]);

  return {
    taxonomy,
    categories: taxonomy.categories || [],
    categoryLabels,
    prominentCategories,
    moreCategories,
    loading,
    getCategory,
    getServiceTypesForCategory,
  };
}
