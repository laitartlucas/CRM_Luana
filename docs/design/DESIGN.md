# CRM Luana Laitart Studio — Guia de design para implementação

Este arquivo é a especificação visual do CRM. Antes de mexer em qualquer tela, leia isto e use os tokens de `design-tokens.css`. **Não introduza cores, fontes ou espaçamentos fora dos tokens.**

## 1. Princípios
- **Creme e espresso são a base, o caramelo é ação e o ouro é assinatura.** Proporção aproximada por tela: 70% neutros/creme/branco, 20% espresso, 6–8% caramelo, 2% ouro.
- **Uma função = uma cor**, em todas as telas (tabela na seção 3).
- **A cor nunca é o único sinal:** todo estado tem texto e/ou ícone.
- **Contraste mínimo AA (4,5:1)** em todo texto. `--neutral-500` não é usado em texto comum.

## 2. Tipografia
- Display: **Cormorant Garamond 500** em títulos de página (44px; 36px no celular), títulos de card (24–26px) e números grandes de KPI (40px).
- Corpo: **Karla** 400/500/600/700.
- Números em Cormorant: sempre `font-variant-numeric: lining-nums tabular-nums` (senão o "0" parece "o").
- Rótulos de tabela/KPI: Karla 700, 11px, CAIXA ALTA, `letter-spacing: .14em`, `--neutral-600`.
- Botões: Karla 700, 13px, CAIXA ALTA, `letter-spacing: .08em`.

## 3. Mapa de significado (obrigatório)
| Função | Visual |
|---|---|
| Ação principal (1 por tela/bloco) | fundo `--caramel-600`, texto branco; hover `--caramel-700`; pressionado `--caramel-800` |
| Ação secundária | fundo branco, borda `--neutral-400`, texto `--neutral-900`; hover fundo `--neutral-100` |
| Link / ação em linha ("Mensagem", "Editar", "Ver agenda") | texto `--caramel-600`, sublinhado no hover |
| "Excluir" em listas | texto `--neutral-600`; vira `--danger-fg` só no hover. Botão de confirmação: fundo `--danger-fg` |
| Item ativo do menu lateral | fundo `--side-active`, texto `--side-text-on`, barra de 3px `--brand-gold` à esquerda (no celular: sublinhado de 3px embaixo) |
| Aba / chip / filtro / segmento ativo | fundo `--caramel-100`, borda `--caramel-200`, texto `--caramel-700` 700; aba com sublinhado de 2px `--caramel-600` |
| Linha em hover / selecionada | fundo `--caramel-50` |
| Foco | contorno 2px `--caramel-600` com offset 2px; inputs: borda caramelo + halo `--caramel-100` |
| Desabilitado | fundo `--neutral-200`, texto `--neutral-500` |
| Progresso / barras de gráfico | `--caramel-600` (principal), `--caramel-200`/`300` (secundária), trilho `--neutral-200` |
| Contador de notificação / badge do menu | fundo `--caramel-600`, texto branco |

### Estados semânticos (selos, avisos, status)
Sempre fg + bg (+ borda em avisos):
- **Sucesso** (`--success-*`): Confirmado, Conectado, Concluída, Fechou, Ativo, Salvo.
- **Alerta** (`--warning-*`): Aguardando confirmação, vence hoje, sincronização antiga, alterações não salvas.
- **Erro** (`--danger-*`): No-show, Atrasada, Desconectado, erro de formulário, Zona de risco.
- **Informação** (`--info-*`): Lead nova, dicas, ambiente de teste/simulador.
- **Neutro** (`--neutral-200` / `--neutral-700`): Cancelado, Perdida, Inativo, prazo futuro, sem histórico.
- **Marca** (`--caramel-100` / `--caramel-700`): "No pipeline".

Etapas do funil **não** ganham uma cor cada: o progresso é sempre caramelo e a etapa é escrita em texto. Só "Fechou" usa sucesso.

## 4. Componentes
- **Card:** branco, borda 1px `--neutral-300`, raio 6px, padding 24–28px (20px no celular). Sem sombra.
- **Botão:** altura mínima 44px, raio 4px, padding horizontal 20px. Variante pequena: 36–40px.
- **Input/select:** altura mínima 44px (48px no login), borda `--neutral-400`, raio 4px, fonte 15–16px. Erro: borda `--danger-fg` + halo `--danger-bg` + mensagem com ícone embaixo.
- **Selo (badge):** pílula, padding 4px 10px, Karla 700 12px, sem quebra de linha.
- **Aviso (alert):** fundo bg, borda border, ícone do estado à esquerda, título em negrito na cor fg e texto em `--neutral-700`.
- **Tabela:** cabeçalho `--neutral-50` com rótulos em caixa alta; linhas separadas por `--neutral-200`; hover `--caramel-50`. Nomes de pessoas em `--neutral-900` 600 (caramelo só no hover).
- **KPI:** rótulo em caixa alta + número em Cormorant 40px + barra de progresso ou selo de variação.
- **Kanban:** colunas `--neutral-200`, cards brancos, card arrastado com borda caramelo + `--shadow-drag`.
- **Avatar:** foto redonda com anel duplo (2px espresso + 1px ouro).
- Ícones: traço de 1,8–2px, `currentColor`, nunca emoji. Botões só com ícone precisam de `aria-label`.

## 5. Layout e responsividade
Estrutura do app: `.app` (flex) → `nav.side` (260px) + `main` (flex:1, min-width:0, padding 24px 40px).

| Largura | Comportamento |
|---|---|
| ≤1100px | Grades de 2–3 colunas viram 1; índice de Configurações vira fileira de chips rolável |
| ≤900px | Menu lateral vira **barra superior fixa**: marca + avatar na 1ª linha, navegação horizontal rolável na 2ª (sem ícones, item ativo com sublinhado dourado). `main` com padding 16px. H1 36px. Atalho "Ctrl K" some |
| ≤820px | Agenda: grade semanal some e aparece **faixa de 7 dias + lista do dia** |
| ≤760px | Tabelas viram **cards**: `thead` oculto, cada `td` mostra seu rótulo via `data-label` + `::before`; nome ocupa a linha inteira; ações vão para o rodapé do card |
| ≤560px | Botões do cabeçalho da página ocupam a largura; filtros 2 por linha |

Outras regras: KPIs com `repeat(auto-fit, minmax(min(100%, 230px), 1fr))`; Pipeline com rolagem horizontal e `scroll-snap` (coluna ≈ 84vw no celular); alvo de toque mínimo de 44px; nenhuma rolagem horizontal da página inteira.

## 6. Telas (referência visual no canvas de design)
Login · Painel · Leads · Pipeline · Tarefas · Agenda · Clientes · Serviços · Configurações. Cada uma existe em versão de computador e de celular no canvas "CRM Luana Laitart — Identidade de cor".

## 7. Checklist de revisão por tela
- [ ] Nenhum hex fora de `design-tokens.css`
- [ ] Só um botão principal caramelo por bloco
- [ ] Status usam o selo semântico correto (seção 3)
- [ ] "Excluir" neutro na lista, vermelho só no hover/confirmação
- [ ] Funciona em 390px, 768px, 1280px e 1440px sem rolagem lateral da página
- [ ] Foco visível em todos os elementos interativos
- [ ] Números em Cormorant com `lining-nums`
