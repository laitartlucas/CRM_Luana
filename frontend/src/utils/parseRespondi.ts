// Extrai os campos de uma lead a partir do HTML da tela de resposta do
// Respondi (dash.respondi.app/dash/editor/answers/...). Essa tela é uma SPA
// autenticada, então não dá pra buscar pelo link diretamente — o fluxo é
// colar o HTML copiado da página (bloco ".questions-container") aqui.
export interface ParsedRespondiLead {
  name?: string;
  phone?: string;
  instagram?: string;
  city?: string;
  profession?: string;
  painPoints: string[];
  desires: string[];
  objections: string[];
  notes: string[];
}

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(/[:?]/g, '')
    .trim();
}

function normalizePhone(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : undefined;
}

const NAME_KEYS = ['nome completo', 'nome'];
const PHONE_KEYS = ['telefone', 'whatsapp', 'celular'];
const PROFESSION_KEYS = ['profissao', 'profissao atual', 'qual sua profissao'];

export function parseRespondiHtml(html: string): ParsedRespondiLead {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const questions = Array.from(doc.querySelectorAll('.question'));

  const result: ParsedRespondiLead = { painPoints: [], desires: [], objections: [], notes: [] };

  for (const q of questions) {
    const labelEl = q.querySelector('.label');
    const valueEl = q.querySelector('.value');
    const question = labelEl?.textContent?.trim() ?? '';
    const rawAnswer = valueEl?.textContent?.trim() ?? '';
    // Respostas de múltipla escolha vêm como "- Texto da opção".
    const answer = rawAnswer.replace(/^-\s*/, '').trim();
    if (!question || !answer) continue;

    const key = normalizeLabel(question);

    if (NAME_KEYS.includes(key)) {
      result.name = answer;
    } else if (PHONE_KEYS.includes(key)) {
      result.phone = normalizePhone(answer);
    } else if (key === 'instagram') {
      result.instagram = answer;
    } else if (key === 'cidade') {
      result.city = answer;
    } else if (PROFESSION_KEYS.includes(key)) {
      result.profession = answer;
    } else if (/dificuldade|\bdor(es)?\b/.test(key)) {
      result.painPoints.push(`${question}\n${answer}`);
    } else if (/deseja|gostaria/.test(key)) {
      result.desires.push(`${question}\n${answer}`);
    } else if (/custar|medo|receio|objec/.test(key)) {
      result.objections.push(`${question}\n${answer}`);
    } else {
      result.notes.push(`${question}\n${answer}`);
    }
  }

  return result;
}

export function appendText(prev: string, additions: string[]): string {
  if (additions.length === 0) return prev;
  const extra = additions.join('\n\n');
  return prev ? `${prev}\n\n${extra}` : extra;
}

export function hasAnyParsedData(parsed: ParsedRespondiLead): boolean {
  return Boolean(
    parsed.name ||
      parsed.phone ||
      parsed.instagram ||
      parsed.city ||
      parsed.profession ||
      parsed.painPoints.length ||
      parsed.desires.length ||
      parsed.objections.length ||
      parsed.notes.length,
  );
}
