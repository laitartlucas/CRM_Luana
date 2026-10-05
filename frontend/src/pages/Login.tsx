import { FormEvent, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { safeNextPath } from '../utils/auth';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [searchParams] = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={safeNextPath(searchParams.get('next'))} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setError(err?.response?.data?.message ?? 'Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.');
      } else if (status === 401) {
        setError('Usuário ou senha inválidos.');
      } else {
        setError('Não foi possível entrar agora. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <aside className="login-brand-panel" aria-label="Luana Laitart">
        <div className="login-brand-top">
          <span className="login-brand-eyebrow">LUANA LAITART</span>
          <img src="/logo.png" alt="" />
        </div>
        <div className="login-brand-body">
          <figure className="login-photo">
            <img src="/luana.jpg" alt="Luana Laitart, consultora de imagem" />
          </figure>
          <div className="login-brand-text">
            <p className="login-brand-title">Consultoria de imagem &amp; estilo pessoal</p>
            <span className="login-brand-rule" aria-hidden="true" />
            <p className="login-brand-subtitle">Elegância que começa na organização.</p>
          </div>
        </div>
        <div className="login-brand-footer">
          <span>© {new Date().getFullYear()} Luana Laitart</span>
          <span>luanalaitart.com</span>
        </div>
      </aside>
      <main className="login-form-panel">
        <form className="login-form-card" onSubmit={handleSubmit}>
          <div>
            <h1>Bem-vinda de volta</h1>
            <p className="subtitle">Acesse seu ateliê de clientes e consultorias.</p>
          </div>
          <label className="field">
            <span>Usuário</span>
            <input
              type="text"
              required
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Senha</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <div className="alert danger" role="alert">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 16.5v.5" />
              </svg>
              <strong>{error}</strong>
            </div>
          )}
          <button className="btn login-submit" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
}
