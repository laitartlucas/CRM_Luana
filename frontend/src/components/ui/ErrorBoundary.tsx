import { Component, ErrorInfo, ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Erros de carregamento de arquivo (deploy novo: o navegador pede um arquivo antigo que não existe mais). */
export function isChunkLoadError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed/i.test(
    `${error.name} ${error.message}`,
  );
}

/**
 * Última rede de segurança da interface: em vez de tela em branco, mostra uma mensagem e um botão para
 * recarregar. Para erro de carregamento de arquivo (comum logo depois de uma atualização do sistema) a
 * mensagem explica o motivo — recarregar a página resolve.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Erro na interface:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isChunkLoadError(error);
    return (
      <div className="error-boundary" role="alert">
        <h1 className="section-title">{stale ? 'O sistema foi atualizado' : 'Algo deu errado'}</h1>
        <p>
          {stale
            ? 'Há uma versão nova disponível. Recarregue a página para continuar.'
            : 'Não foi possível mostrar esta tela. Recarregar a página costuma resolver; se o problema continuar, avise quem cuida do sistema.'}
        </p>
        <button className="btn" onClick={() => window.location.reload()}>
          Recarregar a página
        </button>
      </div>
    );
  }
}
