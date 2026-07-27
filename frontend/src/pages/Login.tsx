import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>CRM de Estilo</h1>
        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Entre com seu e-mail e senha.
        </p>
        <label className="field">
          E-mail
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Senha
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <span className="error-text">{error}</span>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <a href="/api/auth/google" style={{ textAlign: 'center', fontSize: '0.85rem' }}>
          ou entrar com Google
        </a>
      </form>
    </div>
  );
}
