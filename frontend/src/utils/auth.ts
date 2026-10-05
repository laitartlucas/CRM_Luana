/**
 * Destino pós-login vindo de ?next=. Só aceita caminhos internos do app —
 * "//evil.com" e "https://evil.com" seriam redirecionamento aberto — e nunca
 * volta para a própria tela de login.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  if (next === '/login' || next.startsWith('/login?') || next.startsWith('/login/')) return '/';
  return next;
}

/** Link para o login que lembra onde a pessoa estava (ex.: sessão expirou em /tarefas?x=1). */
export function loginUrlFor(path: string): string {
  const next = safeNextPath(path);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
