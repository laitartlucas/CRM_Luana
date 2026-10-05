import { useState } from 'react';
import { ClientsApi } from '../../api/endpoints';
import { useConfirm } from '../ui/ConfirmDialog';
import { errorMessage, useToast } from '../ui/Toast';

export const WIPE_CONFIRMATION_PHRASE = 'APAGAR TUDO';

/** Apagar todos os cadastros. Só ADMIN; exige digitar a frase e ainda confirma numa segunda etapa. */
export function DangerZoneCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [phrase, setPhrase] = useState('');
  const [wiping, setWiping] = useState(false);

  async function handleWipeAll() {
    if (phrase.trim() !== WIPE_CONFIRMATION_PHRASE) return;
    const ok = await confirm({
      title: 'Apagar TODAS as clientes e leads?',
      message: 'Isso apaga também agendamentos e conversas ligados a elas. Não tem volta.',
      confirmLabel: 'Apagar tudo',
      danger: true,
    });
    if (!ok) return;
    setWiping(true);
    try {
      const res = await ClientsApi.removeAll(phrase.trim());
      toast.success(`Pronto — ${res.data.deletedClients} registro(s) apagado(s).`);
      setPhrase('');
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível apagar os cadastros.'));
    } finally {
      setWiping(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.25rem', borderColor: 'var(--color-danger)' }}>
      <h3 style={{ marginTop: 0, color: 'var(--color-danger)' }}>Zona de risco</h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        Apaga permanentemente TODAS as clientes e leads cadastradas, junto com agendamentos, conversas e mensagens ligados a
        elas. Não existe "desfazer". Para confirmar, digite <strong>{WIPE_CONFIRMATION_PHRASE}</strong> abaixo.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          aria-label="Frase de confirmação"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={WIPE_CONFIRMATION_PHRASE}
          style={{ maxWidth: 220 }}
        />
        <button className="btn danger" disabled={wiping || phrase.trim() !== WIPE_CONFIRMATION_PHRASE} onClick={handleWipeAll}>
          {wiping ? 'Apagando...' : 'Apagar todos os clientes e leads'}
        </button>
      </div>
    </div>
  );
}
