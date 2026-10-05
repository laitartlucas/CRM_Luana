import { api } from '../api/client';

export interface DownloadResult {
  /** O servidor cortou o arquivo no limite de linhas — avisar a pessoa. */
  truncated: boolean;
}

/** Nome do arquivo vindo de Content-Disposition (quando o navegador deixa ler), senão o reserva. */
export function filenameFrom(header: string | undefined, fallback: string): string {
  const match = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]) : fallback;
}

/** Baixa um CSV da API (autenticada por cookie) e dispara o "salvar arquivo" do navegador. */
export async function downloadCsv(path: string, params: Record<string, string | undefined>, fallbackName: string): Promise<DownloadResult> {
  const cleanParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const res = await api.get<Blob>(path, { params: cleanParams, responseType: 'blob' });

  const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filenameFrom(res.headers['content-disposition'], fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoga depois: revogar na hora pode cancelar o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);

  return { truncated: res.headers['x-export-truncated'] === 'true' };
}

/** Blob.text() não existe em navegadores mais antigos (Safari < 14); FileReader funciona em todos. */
function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/**
 * Quando a API devolve erro numa chamada de blob, a mensagem vem dentro de um Blob.
 * Lê o JSON para mostrar o texto real (ex.: "O período pode ter no máximo 400 dias.").
 */
export async function blobErrorMessage(err: unknown, fallback: string): Promise<string> {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await readBlobText(data));
      const message = parsed?.message;
      if (Array.isArray(message)) return message.join(' ');
      if (typeof message === 'string' && message) return message;
    } catch {
      /* corpo não era JSON: usa o texto reserva */
    }
  }
  return fallback;
}
