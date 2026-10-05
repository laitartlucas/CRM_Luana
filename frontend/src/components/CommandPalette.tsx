import { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchApi } from '../api/endpoints';
import type { SearchResults } from '../api/types';
import { flattenResults, MIN_QUERY_LENGTH, moveActive, SECTION_LABELS } from '../utils/search';

/** Busca global (Ctrl+K): leads, clientes, agendamentos e tarefas, com navegação por teclado. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const latestRequest = useRef(0);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState(0);

  const flat = useMemo(() => flattenResults(results), [results]);
  const term = query.trim();
  const searchable = term.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    inputRef.current?.focus();
    // Devolve o foco a quem abriu a paleta ao fechar.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const requestId = ++latestRequest.current; // respostas antigas não sobrescrevem as novas
    setActive(0);
    setError(false);
    if (!searchable) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      SearchApi.search(term)
        .then((res) => requestId === latestRequest.current && setResults(res.data))
        .catch(() => requestId === latestRequest.current && setError(true))
        .finally(() => requestId === latestRequest.current && setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [term, searchable]);

  function open(index: number) {
    const item = flat[index];
    if (!item) return;
    onClose();
    navigate(item.hit.href);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => moveActive(i, e.key === 'ArrowDown' ? 1 : -1, flat.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(active);
    }
  }

  let lastSection: string | null = null;

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className="palette-input"
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls="palette-list"
          aria-activedescendant={flat.length > 0 ? `palette-option-${active}` : undefined}
          aria-label="Buscar leads, clientes, agendamentos e tarefas"
          placeholder="Buscar por nome, telefone, Instagram, tarefa…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />

        <div className="palette-body" id="palette-list" role="listbox" aria-label="Resultados">
          {!searchable && <p className="palette-hint">Digite pelo menos {MIN_QUERY_LENGTH} letras para buscar.</p>}
          {searchable && loading && flat.length === 0 && <p className="palette-hint">Buscando…</p>}
          {error && (
            <p className="palette-hint error-text" role="alert">
              Não foi possível buscar agora. Tente novamente.
            </p>
          )}
          {searchable && !loading && !error && results && flat.length === 0 && (
            <p className="palette-hint">Nada encontrado para “{term}”.</p>
          )}

          {flat.map(({ section, hit }, index) => {
            const heading = section !== lastSection ? SECTION_LABELS[section] : null;
            lastSection = section;
            return (
              <div key={`${section}-${hit.id}`}>
                {heading && <div className="palette-section">{heading}</div>}
                <div
                  id={`palette-option-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={`palette-option${index === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => open(index)}
                >
                  <span className="palette-title">{hit.title}</span>
                  {hit.subtitle && <span className="palette-subtitle">{hit.subtitle}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="palette-footer" aria-hidden="true">
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
}
