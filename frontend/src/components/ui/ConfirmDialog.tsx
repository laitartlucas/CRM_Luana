import { createContext, KeyboardEvent, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Ação destrutiva: botão de confirmação em vermelho. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

interface Pending extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

/**
 * Substitui window.confirm: resolve true/false, fecha com Esc ou clique fora
 * (= cancelar), mantém o Tab dentro do diálogo e devolve o foco a quem abriu.
 * O foco inicial vai para "Cancelar", para um Enter distraído não confirmar uma exclusão.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = useCallback(
    (result: boolean) => {
      pending?.resolve(result);
      setPending(null);
    },
    [pending],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog {...pending} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger, onClose }: ConfirmOptions & { onClose: (result: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose(false);
    } else if (e.key === 'Tab') {
      // Só há dois botões: alterna entre eles em vez de deixar o foco escapar do diálogo.
      e.preventDefault();
      const target = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current;
      target?.focus();
    }
  }

  return (
    <div className="modal-backdrop" onClick={() => onClose(false)}>
      <div
        className="card modal-card confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 id="confirm-title" style={{ marginTop: 0 }}>
          {title}
        </h3>
        {message && (
          <p id="confirm-message" style={{ color: 'var(--color-text-soft)' }}>
            {message}
          </p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button ref={cancelRef} className="btn secondary" onClick={() => onClose(false)}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} className={`btn${danger ? ' danger' : ''}`} onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>');
  return ctx;
}
