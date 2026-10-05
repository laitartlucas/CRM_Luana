import { useEffect, useState } from 'react';
import {
  Period,
  PERIOD_PRESETS,
  PeriodPreset,
  PeriodSelection,
  periodForPreset,
  periodLabel,
  validateCustomPeriod,
} from '../utils/period';

interface Props {
  selection: PeriodSelection;
  onChange: (selection: PeriodSelection) => void;
}

/** Seletor de período: atalhos prontos ou datas livres (aplicadas só quando válidas). */
export function PeriodPicker({ selection, onChange }: Props) {
  const [draft, setDraft] = useState<Period>(selection.period);
  const [error, setError] = useState<string | null>(null);

  // Mantém os campos de data alinhados quando o período muda por fora (atalho, link, voltar).
  useEffect(() => {
    setDraft(selection.period);
    setError(null);
  }, [selection.period.from, selection.period.to]);

  function handlePreset(value: PeriodPreset) {
    if (value === 'custom') {
      // Entra em modo personalizado partindo do período que já estava na tela.
      onChange({ preset: 'custom', period: selection.period });
    } else {
      onChange({ preset: value, period: periodForPreset(value) });
    }
  }

  function applyCustom() {
    const problem = validateCustomPeriod(draft.from, draft.to);
    setError(problem);
    if (!problem) onChange({ preset: 'custom', period: draft });
  }

  return (
    <div className="period-picker">
      <label className="period-field">
        <span className="visually-hidden">Período</span>
        <select value={selection.preset} onChange={(e) => handlePreset(e.target.value as PeriodPreset)} aria-label="Período">
          {PERIOD_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {selection.preset === 'custom' && (
        <>
          <label className="period-field">
            <span className="visually-hidden">Data inicial</span>
            <input type="date" aria-label="Data inicial" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </label>
          <label className="period-field">
            <span className="visually-hidden">Data final</span>
            <input type="date" aria-label="Data final" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </label>
          <button className="btn secondary" onClick={applyCustom}>
            Aplicar
          </button>
        </>
      )}

      <span className="period-range" aria-live="polite">
        {periodLabel(selection.period)}
      </span>
      {error && (
        <span className="error-text" role="alert" style={{ flexBasis: '100%' }}>
          {error}
        </span>
      )}
    </div>
  );
}
