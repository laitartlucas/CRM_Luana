/** Score de 0 a 100 com barra curta: caramelo forte a partir de 60, claro abaixo disso. */
export function ScoreMeter({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
      <strong className="num" style={{ minWidth: '1.6rem' }}>{v}</strong>
      <span className="meter" style={{ width: 64 }} aria-hidden="true">
        <span style={{ width: `${v}%`, background: v >= 60 ? 'var(--caramel-600)' : 'var(--caramel-300)' }} />
      </span>
    </span>
  );
}
