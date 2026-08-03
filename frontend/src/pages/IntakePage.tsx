import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { IntakeApi } from '../api/endpoints';

export default function IntakePage() {
  const { clientId, token } = useParams<{ clientId: string; token: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [bodyType, setBodyType] = useState('');
  const [colorPalette, setColorPalette] = useState('');
  const [predominantStyle, setPredominantStyle] = useState('');
  const [averageBudget, setAverageBudget] = useState('');
  const [preferredBrands, setPreferredBrands] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId || !token) return;
    IntakeApi.getForm(clientId, token)
      .then((res) => {
        setName(res.data.name);
        setBodyType(res.data.bodyType ?? '');
        setColorPalette(res.data.colorPalette ?? '');
        setPredominantStyle(res.data.predominantStyle ?? '');
        setAverageBudget(res.data.averageBudget != null ? String(res.data.averageBudget) : '');
        setPreferredBrands(res.data.preferredBrands.join(', '));
        setRestrictions(res.data.restrictions ?? '');
        setSubmitted(res.data.alreadySubmitted);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [clientId, token]);

  async function handleSubmit() {
    if (!clientId || !token) return;
    setSaving(true);
    setError(null);
    try {
      await IntakeApi.submit(clientId, token, {
        bodyType: bodyType || undefined,
        colorPalette: colorPalette || undefined,
        predominantStyle: predominantStyle || undefined,
        averageBudget: averageBudget ? Number(averageBudget) : undefined,
        preferredBrands: preferredBrands
          ? preferredBrands.split(',').map((b) => b.trim()).filter(Boolean)
          : undefined,
        restrictions: restrictions || undefined,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Não foi possível enviar o formulário.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="centered-page">Carregando...</div>;
  if (notFound) return <div className="centered-page">Link inválido ou expirado.</div>;

  return (
    <div className="centered-page">
      <div className="card login-card" style={{ width: 'min(480px, 92vw)' }}>
        <h1>Ficha de estilo{name ? ` — ${name}` : ''}</h1>
        {submitted ? (
          <p>Formulário já recebido — obrigada! A consultora já tem acesso às suas respostas.</p>
        ) : (
          <>
            <label className="field">
              Tipo de corpo
              <input value={bodyType} onChange={(e) => setBodyType(e.target.value)} />
            </label>
            <label className="field">
              Paleta de cores que mais gosta
              <input value={colorPalette} onChange={(e) => setColorPalette(e.target.value)} />
            </label>
            <label className="field">
              Estilo predominante
              <input value={predominantStyle} onChange={(e) => setPredominantStyle(e.target.value)} />
            </label>
            <label className="field">
              Orçamento médio para roupas/acessórios
              <input type="number" value={averageBudget} onChange={(e) => setAverageBudget(e.target.value)} />
            </label>
            <label className="field">
              Marcas preferidas (separadas por vírgula)
              <input value={preferredBrands} onChange={(e) => setPreferredBrands(e.target.value)} />
            </label>
            <label className="field">
              Restrições (tecidos, cores, modelagens a evitar)
              <textarea rows={3} value={restrictions} onChange={(e) => setRestrictions(e.target.value)} />
            </label>
            {error && <span className="error-text">{error}</span>}
            <button className="btn" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Enviando...' : 'Enviar'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
