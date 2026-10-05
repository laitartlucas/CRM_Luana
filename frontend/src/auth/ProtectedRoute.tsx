import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { loginUrlFor } from '../utils/auth';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="page-loading">Carregando...</div>;
  if (!user) return <Navigate to={loginUrlFor(location.pathname + location.search)} replace />;

  return <Outlet />;
}
