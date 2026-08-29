const DISCOVERY_ROUTES = new Set([
  '/',
  '/feed',
  '/client-dashboard',
]);

export const isPublicProviderRoute = (pathname = '') => (
  /^\/provider\/[^/]+\/?$/.test(String(pathname || ''))
);

export const shouldShowChatbotForContext = ({ pathname = '/', userType = null } = {}) => {
  const roleAllowed = !userType || userType === 'client';
  if (!roleAllowed) return false;

  return DISCOVERY_ROUTES.has(pathname) || isPublicProviderRoute(pathname);
};
