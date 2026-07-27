import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
