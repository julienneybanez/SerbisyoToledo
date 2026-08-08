import { Navigate, useLocation } from 'react-router-dom';
import { getUser, isAuthenticated } from '../../services/api';

const HOME_BY_ROLE = {
  admin: '/admin/dashboard',
  tradesperson: '/dashboard',
  client: '/feed',
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation();
  const authenticated = isAuthenticated();
  const user = getUser();

  if (!authenticated || !user) {
    const redirectPath = `${location.pathname}${location.search || ''}`;
    sessionStorage.setItem('redirectAfterLogin', redirectPath);
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(user.userType)) {
    const fallback = HOME_BY_ROLE[user.userType] || '/';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
