import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Pipeline from './pages/Pipeline';
import IntakePage from './pages/IntakePage';
import Services from './pages/Services';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/intake/:clientId/:token" element={<IntakePage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/:id" element={<LeadDetail />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/clientes/:id" element={<ClientDetail />} />
              <Route path="/servicos" element={<Services />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
