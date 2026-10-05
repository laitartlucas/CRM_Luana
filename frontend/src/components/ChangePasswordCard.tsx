import { FormEvent, useState } from 'react';
import { UsersApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

const MIN_LENGTH = 8;

/**
 * Troca da própria senha. O backend encerra todas as sessões ao trocar, então
 * em caso de sucesso a usuária é levada de volta ao login.
 */
export function ChangePasswordCard() {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_LENGTH) {
      setError(`A nova senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
      return;
    }
    if (next !== confirm) {
      setError('A confirmação não confere com a nova senha.');
      return;
    }
    setSaving(true);
    try {
      await UsersApi.changeOwnPassword(current, next);
      await logout().catch(() => undefined);
      window.location.href = '/login';
    } catch (err: any) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? 'Senha atual incorreta.'
          : (err?.response?.data?.message?.toString() ?? 'Não foi possível alterar a senha agora. Tente novamente.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ marginTop: 0 }}>Alterar senha</h3>
      <p style={{ marginTop: 0, color: "var(--color-text-muted)" }}>
        Ao trocar a senha você será desconectada de todos os dispositivos e precisará entrar de novo.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.75rem', maxWidth: 360 }}>
        <label className="field">
          Senha atual
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label className="field">
          Nova senha
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={MIN_LENGTH} />
        </label>
        <label className="field">
          Confirmar nova senha
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        {error && (
          <span className="error-text" role="alert">
            {error}
          </span>
        )}
        <div>
          <button type="submit" className="btn" disabled={saving || !current || !next || !confirm}>
            {saving ? 'Salvando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </div>
  );
}
