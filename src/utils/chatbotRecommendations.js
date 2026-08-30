const SERVICE_KEYWORDS = [
  { keyword: 'plumber', category: 'Plumbing' },
  { keyword: 'plumbing', category: 'Plumbing' },
  { keyword: 'tubero', category: 'Plumbing' },
  { keyword: 'electrician', category: 'Electrical' },
  { keyword: 'electrical', category: 'Electrical' },
  { keyword: 'elektrisyan', category: 'Electrical' },
  { keyword: 'carpenter', category: 'Carpentry' },
  { keyword: 'carpentry', category: 'Carpentry' },
  { keyword: 'karpintero', category: 'Carpentry' },
  { keyword: 'cleaning', category: 'Cleaning' },
  { keyword: 'cleaner', category: 'Cleaning' },
  { keyword: 'limpyo', category: 'Cleaning' },
  { keyword: 'gardening', category: 'Gardening & Landscaping' },
  { keyword: 'landscaping', category: 'Gardening & Landscaping' },
  { keyword: 'aircon', category: 'Aircon & Refrigeration' },
  { keyword: 'air conditioning', category: 'Aircon & Refrigeration' },
  { keyword: 'refrigeration', category: 'Aircon & Refrigeration' },
  { keyword: 'massage', category: 'Beauty & Wellness' },
  { keyword: 'hilot', category: 'Beauty & Wellness' },
  { keyword: 'laundry', category: 'Laundry' },
  { keyword: 'phone repair', category: 'Tech Repair' },
  { keyword: 'mobile repair', category: 'Tech Repair' },
  { keyword: 'laptop repair', category: 'Tech Repair' },
  { keyword: 'computer repair', category: 'Tech Repair' },
  { keyword: 'tech repair', category: 'Tech Repair' },
  { keyword: 'electronics repair', category: 'Tech Repair' },
  { keyword: 'locksmith', category: 'Locksmith' },
];

export const buildRecommendationFilters = (rawInput, locale) => {
  const source = String(rawInput || '');
  const input = source.toLowerCase();
  const serviceMatch = SERVICE_KEYWORDS.find((item) => input.includes(item.keyword));
  const category = serviceMatch?.category;
  const locationMatch = source.match(/(?:in|near|around|sa|duol sa)\s+([a-z\s.-]{3,40})/i);
  const location = locationMatch ? locationMatch[1].trim() : undefined;
  const budgetMatch = input.match(/(?:under|below|max|budget|hangtod)\s*(?:p|php|₱)?\s*(\d{3,6})/i);
  const maxPrice = budgetMatch ? Number(budgetMatch[1]) : undefined;
  const ratingMatch = input.match(/(\d(?:\.\d)?)\s*(?:\+)?\s*(?:stars?|rating)/i);
  const minRating = ratingMatch ? Number(ratingMatch[1]) : undefined;
  const requestedLanguage = input.includes('cebuano') || input.includes('bisaya')
    ? 'ceb'
    : input.includes('filipino') || input.includes('tagalog')
      ? 'fil'
      : input.includes('english')
        ? 'en'
        : undefined;
  let availabilityDate;
  const now = new Date();
  if (input.includes('tomorrow') || input.includes('ugma')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    availabilityDate = tomorrow.toISOString().slice(0, 10);
  } else if (input.includes('today') || input.includes('karon')) {
    availabilityDate = now.toISOString().slice(0, 10);
  }

  return {
    category,
    location,
    maxPrice,
    minRating,
    language: requestedLanguage || (locale === 'ceb' ? undefined : requestedLanguage),
    availabilityDate,
    search: undefined,
    limit: 3,
  };
};