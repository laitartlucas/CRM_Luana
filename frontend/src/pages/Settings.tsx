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

      {params.get('googleCalendar') === 'connected' && (
        <div className="card" role="status" style={{ borderColor: 'var(--color-success)', marginBottom: '1rem' }}>
          Google Calendar conectado com sucesso!
        </div>
      )}

      <ChangePasswordCard />
      {user && <GoogleCalendarCard userId={user.id} />}
      {canManageWhatsapp && <WhatsappConnectionCard />}
      <MessageTemplatesSection />
      {isAdmin && <WhatsappSimulatorCard />}
      {isAdmin && <DangerZoneCard />}
    </div>
  );
}
