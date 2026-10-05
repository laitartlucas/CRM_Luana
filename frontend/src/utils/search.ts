import type { SearchHit, SearchResults } from '../api/types';

export const MIN_QUERY_LENGTH = 2;

export const SECTION_LABELS: Record<keyof SearchResults, string> = {
  leads: 'Leads',
  clients: 'Clientes',
  appointments: 'Agendamentos',
  tasks: 'Tarefas',
};

const SECTION_ORDER: Array<keyof SearchResults> = ['leads', 'clients', 'appointments', 'tasks'];

export interface FlatHit {
  section: keyof SearchResults;
  hit: SearchHit;
}

/** Resultados na ordem em que aparecem na tela — a mesma usada pela navegação por teclado. */
export function flattenResults(results: SearchResults | null): FlatHit[] {
  if (!results) return [];
  return SECTION_ORDER.flatMap((section) => results[section].map((hit) => ({ section, hit })));
}

/** Move o item ativo com as setas, dando a volta nas pontas. */
export function moveActive(current: number, delta: 1 | -1, length: number): number {
  if (length === 0) return 0;
  return (current + delta + length) % length;
}

/** Teclas de atalho como "/" não podem roubar a digitação em campos de texto. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
