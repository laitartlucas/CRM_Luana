import { useState } from 'react';
import { blobErrorMessage, downloadCsv } from '../utils/download';
import { useToast } from './ui/Toast';

interface Props {
  label: string;
  /** Rota da API, ex.: /reports/leads.csv */
  path: string;
  /** Filtros enviados como query string; valores vazios são ignorados. */
  params?: Record<string, string | undefined>;
  /** Nome do arquivo caso o navegador não consiga ler o do servidor. */
  fallbackName: string;
  className?: string;
}

/** Baixa um relatório em CSV, com estado de "gerando…" e avisos de sucesso, erro e arquivo cortado. */
export function ExportButton({ label, path, params = {}, fallbackName, className = 'btn secondary' }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const { truncated } = await downloadCsv(path, params, fallbackName);
      if (truncated) {
        toast.info('Arquivo gerado, mas cortado no limite de linhas. Use filtros ou um período menor para ver o restante.');
      } else {
        toast.success('Planilha gerada.');
      }
    } catch (err) {
      toast.error(await blobErrorMessage(err, 'Não foi possível gerar a planilha. Tente novamente.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={className} onClick={handleClick} disabled={busy}>
      {busy ? 'Gerando…' : label}
    </button>
  );
}
