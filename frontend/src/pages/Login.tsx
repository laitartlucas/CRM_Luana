import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setError('Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.');
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
      <div className="login-brand-panel">
        <div className="login-brand-eyebrow">LUANA LAITART</div>
        <div className="login-brand-center">
          <img src="/logo.png" alt="Luana Laitart" />
          <div>
            <div className="login-brand-title">
              Consultoria de imagem
              <br />
              &amp; estilo pessoal
            </div>
            <div className="login-brand-subtitle">Elegância que começa na organização.</div>
          </div>
        </div>
        <div className="login-brand-footer">
          <span>© {new Date().getFullYear()} Luana Laitart</span>
          <span>luanalaitart.com</span>
        </div>
      </div>
      <div className="login-form-panel">
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
          {error && <span className="error-text">{error}</span>}
          <button className="btn" type="submit" disabled={loading} style={{ height: 52 }}>
            {loading ? 'ENTRANDO...' : 'ENTRAR'}
          </button>
          <a href="/api/auth/google" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
            ou entrar com Google
          </a>
        </form>
      </div>
    </div>
  );
}
