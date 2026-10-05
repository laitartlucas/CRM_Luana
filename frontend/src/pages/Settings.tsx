import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ChangePasswordCard } from '../components/ChangePasswordCard';
import { DangerZoneCard } from '../components/settings/DangerZoneCard';
import { GoogleCalendarCard } from '../components/settings/GoogleCalendarCard';
import { MessageTemplatesSection } from '../components/settings/MessageTemplatesSection';
import { WhatsappConnectionCard } from '../components/settings/WhatsappConnectionCard';
import { WhatsappSimulatorCard } from '../components/settings/WhatsappSimulatorCard';

/**
 * Cada seção cuida do próprio estado. O que aparece depende do papel, espelhando o backend:
 * conexão do WhatsApp (ADMIN/MANAGER), simulador e zona de risco (ADMIN).
 */
export default function Settings() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const canManageWhatsapp = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div>
      <h1>Configurações</h1>

      <div className="settings-stack">
      {params.get('googleCalendar') === 'connected' && (
        <div className="alert success" role="status">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
          </svg>
          <strong>Google Agenda conectado com sucesso.</strong>
        </div>
      )}

      <ChangePasswordCard />
      {user && <GoogleCalendarCard userId={user.id} />}
      {canManageWhatsapp && <WhatsappConnectionCard />}
      <MessageTemplatesSection />
      {isAdmin && <WhatsappSimulatorCard />}
      {isAdmin && <DangerZoneCard />}
      </div>
    </div>
  );
}
