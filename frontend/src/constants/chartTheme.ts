/**
 * Cores dos gráficos (Recharts precisa de valores, não de var(--...)).
 * Espelham styles/tokens.css — se mudar um token, mude aqui também.
 */
export const CHART = {
  primary: '#8B5A3C', // --caramel-600: série principal
  secondary: '#E6CDB7', // --caramel-200: série de volume / comparação
  grid: '#EEE6DB', // --neutral-200
  axis: '#6E5F52', // --neutral-600
  axisLine: '#CDBFAE', // --neutral-400
  cursor: '#FAF3EC', // --caramel-50
  success: '#4F6B3A', // --success-fg: etapa "Fechou"
};

export const CHART_TOOLTIP_STYLE = {
  borderRadius: 4,
  border: '1px solid #E2D8CB',
  fontSize: '0.85rem',
  fontFamily: "'Karla', system-ui, sans-serif",
  color: '#2A221C',
  boxShadow: '0 8px 24px rgba(42, 34, 29, 0.12)',
};
