import { pageWindow, rangeText } from '../utils/listParams';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}

/** Navegação entre páginas com a faixa exibida ("Mostrando 26–50 de 134"). */
export function Pagination({ page, pageSize, total, totalPages, disabled, onChange }: Props) {
  return (
    <nav className="pagination" aria-label="Paginação">
      <span className="pagination-range" aria-live="polite">
        {rangeText(page, pageSize, total)}
      </span>
      {totalPages > 1 && (
        <div className="pagination-pages">
          <button className="btn secondary" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
            Anterior
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                className={`btn secondary pagination-number${p === page ? ' current' : ''}`}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Página ${p}`}
                disabled={disabled}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            ),
          )}
          <button className="btn secondary" disabled={disabled || page >= totalPages} onClick={() => onChange(page + 1)}>
            Próxima
          </button>
        </div>
      )}
    </nav>
  );
}
