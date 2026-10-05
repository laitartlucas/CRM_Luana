import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { PageTitle } from './components/PageTitle';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';

// Cada tela vira um arquivo próprio, baixado só quando a pessoa a abre. Sem isso o navegador baixava de
// uma vez gráficos (recharts) e calendário (FullCalendar) — mais de 1 MB — já na tela de login.
const Login = lazy(() => import('./pages/Login'));
const IntakePage = lazy(() => import('./pages/IntakePage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const Pipeline = lazy(() => import('./pages/Pipeline'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Clients = lazy(() => import('./pages/Clients'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Services = lazy(() => import('./pages/Services'));
const Settings = lazy(() => import('./pages/Settings'));

export default function App() {
  return (
    <BrowserRouter>
      <PageTitle />
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <ErrorBoundary>
              <Suspense fallback={<div className="page-loading">Carregando...</div>}>
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
                      <Route path="/tarefas" element={<Tasks />} />
                      <Route path="/clientes" element={<Clients />} />
                      <Route path="/clientes/:id" element={<ClientDetail />} />
                      <Route path="/servicos" element={<Services />} />
                      <Route path="/configuracoes" element={<Settings />} />
                    </Route>
                  </Route>
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
