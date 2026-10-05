import { ReactNode } from 'react';

/** Estados padrão de uma área de dados: carregando, vazio e erro (com "tentar de novo"). */

export function LoadingState({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className="state-view" role="status">
      {label}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="state-view">{children}</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="state-view error-text" role="alert">
      {message}
      {onRetry && (
        <>
          {' '}
          <button className="btn-link" onClick={onRetry}>
            Tentar de novo
          </button>
        </>
      )}
    </p>
  );
}

/** Mesmos estados dentro de uma tabela: ocupam a linha toda. */
export function TableState({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
}
