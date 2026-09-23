/**
 * Generative UI Check-up: Brazilian Portuguese content maps.
 *
 * Every public string lives here exactly once. Screen rendering and the Canvas share
 * card both read this module plus the result object from ./scoring.js, so no display
 * string is ever computed twice.
 *
 * Source of truth: ../../COPY-TR.md for public copy, ../../SCORING.md for question and
 * option wording. tests/scoring.test.js re-parses both documents and fails on any drift,
 * so edit the markdown first and mirror it here.
 */

/** Freeze the content maps so a renderer cannot mutate shared copy. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * The eight questions in presentation order. `dimension` matches the profile ids in
 * ./scoring.js; the tests assert the two stay in step. Option index is the answer value.
 * Every question carries a short help disclosure.
 */
export const QUESTIONS = deepFreeze([
  {
    id: "q1",
    dimension: "valueFit",
    text: "Quando usuários diferentes concluem essa tarefa, quanto mudam a tela e os passos de que eles precisam?",
    options: [
      "Não mudam: todo mundo usa os mesmos passos e a mesma tela",
      "A estrutura continua a mesma; só o conteúdo ou a prioridade muda",
      "O papel do usuário ou o estado do produto muda alguns componentes e a ordem dos passos",
      "Exige uma tela de trabalho variável: objetivo, papel e estado atual mudam boa parte da tela"
    ],
    help: {
      label: "O que é uma tela de trabalho variável?",
      body: "Uma tela de trabalho variável é quando a mesma tarefa roda com componentes diferentes conforme o objetivo, o papel ou a situação atual do usuário. Generative UI só gera valor real se essa diferença melhorar de fato a forma como a tarefa é concluída."
    }
  },
  {
    id: "q2",
    dimension: "valueFit",
    text: "Qual é o impacto dessa tarefa no usuário e no resultado de negócio?",
    options: [
      "É feita raramente; o impacto é mais cosmético",
      "Se repete, mas tem impacto baixo no usuário ou no resultado de negócio",
      "É feita com frequência, tem vários passos e afeta um resultado importante",
      "É uma das tarefas críticas do usuário; importa diretamente para activation, retention ou revenue"
    ],
    help: {
      label: "O que é uma tarefa crítica do usuário?",
      body: "Tarefa crítica do usuário é o trabalho que afeta diretamente o valor que a pessoa tira do produto ou um resultado importante do negócio. Concluir a configuração inicial pode afetar activation, gerar relatórios com regularidade pode afetar retention e fazer upgrade de plano pode afetar revenue."
    }
  },
  {
    id: "q3",
    dimension: "systemReadiness",
    text: "O quanto as telas que hoje dão suporte a essa tarefa são feitas de componentes reutilizáveis?",
    options: [
      "As telas foram escritas sob medida para cada página; as partes estão fortemente acopladas",
      "Existem blocos visuais comuns; o comportamento deles ainda depende da página",
      "Existem componentes reutilizáveis e estados definidos",
      "Entradas, estados, permissões e comportamento de erro estão definidos em contratos de componente atualizados"
    ],
    help: {
      label: "O que é um contrato de componente?",
      body: "O contrato de componente define quais dados um componente aceita, em quais estados ele funciona, quem pode usá-lo e o que ele mostra quando algo falha. Para montar uma tela com segurança, o Generative UI precisa conhecer esses limites de forma explícita."
    }
  },
  {
    id: "q4",
    dimension: "systemReadiness",
    text: "Durante essa tarefa, quais sinais de contexto confiáveis seu produto usa para escolher o conteúdo ou o fluxo certo?",
    options: [
      "Fora da página em que o usuário está, nenhum sinal relevante é usado",
      "Papel, plano ou dados da conta podem ser usados",
      "Além disso, o estado atual do produto e as ações recentes do usuário podem ser usados",
      "O objetivo declarado do usuário, o estado atual, o histórico autorizado e as permissões podem ser usados em conjunto"
    ],
    help: {
      label: "O que é um sinal de contexto?",
      body: "Sinal de contexto é a informação que influencia a decisão de tela: o papel do usuário, o plano, o objetivo declarado, as últimas ações ou a situação atual da conta. Para o Generative UI escolher a superfície certa, o sinal precisa estar atualizado, autorizado e com origem conhecida."
    }
  },
  {
    id: "q5",
    dimension: "controlSafety",
    text: "Quando o usuário cai numa tela errada, irrelevante ou inesperada durante essa tarefa, como ele se recupera?",
    options: [
      "Ele não consegue ver por que a tela mudou; não existe um retorno seguro confiável",
      "Ele pode voltar ou recomeçar o fluxo do zero",
      "Ele vê o motivo da mudança e pode trocar a escolha ou voltar para a tela padrão",
      "Existe retorno seguro: o usuário pode pré-visualizar a tela, editar a escolha, resetar ou voltar ao fluxo padrão"
    ],
    help: {
      label: "O que é retorno seguro?",
      body: "Retorno seguro é o caminho confiável para onde o usuário volta quando uma tela inesperada ou um fluxo não funciona. A visualização anterior, a tela padrão do produto, a opção de editar ou a de resetar são o que sustenta essa confiança."
    }
  },
  {
    id: "q6",
    dimension: "controlSafety",
    text: "Quando uma ação crítica como pagamento, exclusão de dados ou mudança de permissão é iniciada durante essa tarefa, quais proteções entram em ação?",
    options: [
      "A ação é executada direto",
      "Uma tela de confirmação padrão é exibida",
      "Há checagem de permissão e resumo da ação; existe a opção de desfazer ou registro da operação",
      "Só ações aprovadas previamente, com pré-visualização, permissão, regra de negócio e registro de auditoria"
    ],
    help: {
      label: "O que é uma ação crítica?",
      body: "Ação crítica é a operação que mexe com dinheiro, dados, acesso ou comunicação com o cliente e pode ser difícil de reverter. No preparo para Generative UI, essas ações não devem ficar a cargo da decisão do modelo; elas precisam ser limitadas por regras de permissão, pré-visualização e auditoria."
    }
  },
  {
    id: "q7",
    dimension: "discoveryResilience",
    text: "Hoje, onde seu time define as funcionalidades e as regras que apoiam essa tarefa?",
    options: [
      "Não existe um inventário atualizado do que o produto consegue fazer",
      "A informação está espalhada pela documentação ou entre os times",
      "Existe um catálogo de funcionalidades atualizado, com dono e usuário-alvo definidos",
      "O catálogo de funcionalidades está atualizado e é pesquisável, ligado a papéis, permissões e pré-requisitos"
    ],
    help: {
      label: "O que é um catálogo de funcionalidades?",
      body: "O catálogo de funcionalidades é o inventário atualizado do que o produto consegue fazer, descrito de forma independente da estrutura de menus. Para o Generative UI escolher as capacidades adequadas, o usuário-alvo, as permissões, os pré-requisitos e o dono de cada funcionalidade precisam estar explícitos ali."
    }
  },
  {
    id: "q8",
    dimension: "discoveryResilience",
    text: "Se uma funcionalidade necessária para essa tarefa não estiver visível na tela naquele momento, como o usuário a encontra hoje?",
    options: [
      "Só busca se souber o nome da funcionalidade, ou pergunta para o time de suporte",
      "Consegue encontrar na documentação ou na busca",
      "Consegue descobrir por uma central dentro do produto, navegável e independente da tela",
      "A descobribilidade vem por mais de um caminho: central navegável no produto, indicação conforme o contexto e volta aos itens usados recentemente"
    ],
    help: {
      label: "O que é descobribilidade?",
      body: "Descobribilidade é o usuário conseguir encontrar uma funcionalidade depois, mesmo que ela não esteja visível na tela naquele momento. Quando o Generative UI monta superfícies personalizadas, o catálogo pesquisável, a central do produto e a volta aos itens recentes ficam ainda mais importantes."
    }
  }
]);

/** Public profile names, keyed by the profile ids in ./scoring.js. */
/* ------------------------------------------------------- the selected task */

/**
 * The one free-text value in the product: the single user task the whole check-up is
 * about. It reaches the DOM and the editable LinkedIn draft as text, and nothing else.
 * See PRODUCT-SPEC.md "Task selection and answering instruction" for the contract.
 */
export const TASK_LIMITS = deepFreeze({ min: 3, max: 80 });

/** C0 and C1 control characters, minus tab, newline and carriage return. */
const TASK_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Unicode bidi overrides and isolates, which can reorder text on screen. */
const TASK_BIDI = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Zero-width and default-ignorable formatting characters.
 *
 * These render as nothing on their own, so they must not count towards the three-character
 * minimum. Without this, a task of three zero-width spaces validates and then displays as an
 * empty pair of quotes.
 *
 * Variation selectors are deliberately *not* in this set, because stripping them would
 * silently rewrite the user's emoji, turning a text-presentation sequence into a different
 * glyph. They are excluded from the count instead: see `TASK_VARIATION_SELECTOR`.
 */
const TASK_INVISIBLE = /[\u00AD\u180E\u200B-\u200D\u2060-\u2064\uFEFF\uFFF9-\uFFFB]/g;

/**
 * Every Unicode variation selector, asked of Unicode rather than listed here.
 *
 * Kept in the string, counted as nothing. O-002, ruled at Gate 8, separated two decisions the
 * original implementation had merged into one. Preserving a selector attached to a base
 * character is right, because removing it changes the glyph the user chose. But a selector
 * renders nothing on its own, and counting it as a character let three of them in a row
 * satisfy the three-character minimum and then display as an empty pair of quotes.
 *
 * The reasoning this replaced \u2014 that a selector "cannot pad a length on its own because it
 * only ever follows a base character" \u2014 described valid text, not the input a validator is
 * handed. Nothing stops a user pasting three bare selectors, and that is what shipped.
 *
 * **Why a property escape and not a range list.** Phase 9 fixed this by enumerating
 * `U+FE00`-`U+FE0F` and `U+E0100`-`U+E01EF`, and silently omitted the Mongolian free
 * variation selectors `U+180B`-`U+180D` and `U+180F`; Gate 9 found three of them still
 * validating and still rendering as nothing. The list was wrong the day it was written and
 * would rot again whenever Unicode adds a selector. `\p{Variation_Selector}` is the same
 * question asked of the standard, so there is no list to keep current.
 *
 * `U+180E`, the Mongolian vowel separator, is deliberately not here. It is a separator rather
 * than a selector, it is not in this property, and `TASK_INVISIBLE` already strips it.
 */
const TASK_VARIATION_SELECTOR = /\p{Variation_Selector}/gu;

/**
 * Normalize a raw task value: drop characters that can lie about their own rendering or occupy
 * no space at all, fold every kind of whitespace into single spaces, and trim.
 *
 * The minimum length is therefore a minimum of *visible* characters: invisible padding is gone
 * before anything is counted.
 *
 * This is not HTML sanitization. Markup is left intact on purpose, because every
 * insertion point writes the value with `textContent` and never parses it.
 */
export function normalizeTask(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(TASK_CONTROL, "")
    .replace(TASK_BIDI, "")
    .replace(TASK_INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Length in *visible* Unicode code points, so one emoji counts as one character.
 *
 * Variation selectors are dropped for counting only; the value itself keeps them, so what the
 * user typed is what gets rendered and shared. This is the one place the O-002 ruling is
 * enforced, which is why both the minimum, the maximum and the on-screen counter agree with
 * each other: they all ask this function.
 */
export function taskLength(value) {
  if (typeof value !== "string") return 0;
  return [...value.replace(TASK_VARIATION_SELECTOR, "")].length;
}

/** True when a raw value normalizes to something inside the documented limits. */
export function isValidTask(raw) {
  const length = taskLength(normalizeTask(raw));
  return length >= TASK_LIMITS.min && length <= TASK_LIMITS.max;
}

/** Instruction-screen copy for choosing the task. Source: COPY-TR.md. */
export const TASK_COPY = deepFreeze({
  heading: "Primeiro, escolha a tarefa que você vai avaliar",
  intro: "Escolha uma única tarefa que os usuários fazem com frequência no seu produto e cujo resultado importa. Nas oito perguntas seguintes, vamos avaliar como seu produto apoia essa tarefa hoje.",
  presetGroupLabel: "Exemplos prontos",
  presets: [
    "Concluir a configuração inicial",
    "Gerar um relatório",
    "Convidar um colega de time",
    "Configurar uma integração",
    "Vou escrever minha própria tarefa"
  ],
  freeWritePreset: "Vou escrever minha própria tarefa",
  inputLabel: "Tarefa a avaliar",
  placeholder: "Exemplo: novo usuário criar o primeiro projeto",
  helper: "Escreva de forma curta e genérica; não inclua nome de cliente ou empresa.",
  counterTemplate: "{count}/80",
  errorTooShort: "Para continuar, escreva uma tarefa com pelo menos 3 caracteres.",
  errorTooLong: "A tarefa pode ter no máximo 80 caracteres."
});

/**
 * The four real presets: the list minus the free-write affordance.
 *
 * `freeWritePreset` is a button that clears the field, not a task anyone is assessing. If it
 * were left in this list, choosing "I'll write my own" and then typing nothing would report
 * a preset, which inverts the one distinction the parameter exists to make.
 *
 * Normalized on the way in so the comparison in `taskSource` is against the same shape the
 * user's input is reduced to.
 */
const REAL_PRESETS = deepFreeze(
  TASK_COPY.presets
    .filter((preset) => preset !== TASK_COPY.freeWritePreset)
    .map(normalizeTask)
);

/**
 * Whether a task is one of the offered presets or the user's own words.
 *
 * Derived by comparison, never remembered: a user who picks a preset and then edits one word
 * is writing a custom task, and any stored "they clicked the preset button" flag would keep
 * claiming otherwise. Stateless and deterministic, so the same task always reports the same
 * source no matter which route reached it.
 *
 * @param {string} raw
 * @returns {"preset"|"custom"}
 */
export function taskSource(raw) {
  return REAL_PRESETS.includes(normalizeTask(raw)) ? "preset" : "custom";
}

export const PROFILE_NAMES = deepFreeze({
  valueFit: "Caso de uso",
  systemReadiness: "Preparo técnico",
  controlSafety: "Controle e segurança",
  discoveryResilience: "Descobribilidade"
});

/** Public band labels, keyed by the band ids in ./scoring.js. */
export const BAND_LABELS = deepFreeze({
  weak: "Fraco",
  partial: "Parcial",
  strong: "Forte"
});

/**
 * Archetype copy, keyed by the archetype ids in ./scoring.js.
 *
 * The A5 summary already carries the "Este resultado nao e uma aprovacao..." sentence that
 * SCORING.md requires appended to every A5 body, so the renderer appends nothing.
 */
export const ARCHETYPE_CONTENT = deepFreeze({
  problem_seeking_genui: {
    title: "ACHE A TAREFA CERTA PRIMEIRO",
    summary: "A ideia de Generative UI existe, mas ainda não está claro em qual tarefa do usuário ela vai gerar valor mensurável.",
    experiment: "Escolha uma única tarefa. Valide em cinco entrevistas se os passos que usuários novos e experientes precisam seguir realmente mudam."
  },
  idea_ready_ground_not: {
    title: "TEM CASO DE USO, FALTA BASE",
    summary: "Você enxerga um caso de uso relevante para Generative UI. Mas o sistema de componentes, os sinais de contexto ou a camada de retorno seguro ainda não bastam para um piloto.",
    experiment: "Escolha uma tarefa sem ação crítica. Monte um protótipo que rode com os componentes atuais e volte para a tela padrão."
  },
  composition_ready_catalog_blind: {
    title: "TELA PRONTA, CATÁLOGO AUSENTE",
    summary: "A base técnica para montar a tela dinamicamente é forte. Mas falta um catálogo de funcionalidades independente do menu, e o que não aparece pode sumir para o usuário.",
    experiment: "Para uma área do produto, monte um catálogo de funcionalidades pesquisável e independente do menu. Depois teste se o usuário reencontra uma funcionalidade oculta."
  },
  pilot_ground_discovery_partial: {
    title: "PILOTO POSSÍVEL, FALTA DESCOBERTA",
    summary: "Um piloto restrito de Generative UI é possível. Mas a descoberta de funcionalidades, ou pelo menos uma das outras áreas de preparo, ainda está incompleta; o piloto não pode ofuscar a navegação permanente.",
    experiment: "Adapte uma única tarefa. No mesmo piloto, meça a conclusão da tarefa, a volta à tela padrão e se as funcionalidades ocultas são encontradas."
  },
  controlled_trial_ground: {
    title: "PRONTO PARA UM PILOTO CONTROLADO",
    summary: "Pelas suas respostas, você tem base para um piloto de Generative UI limitado a uma única tarefa, mensurável e reversível. Este resultado não é uma aprovação para colocar o produto em produção.",
    experiment: "Escolha uma única tarefa e um segmento de usuários. Limite as permissões, preserve a tela padrão e rode o piloto atrás de uma feature flag."
  }
});

/**
 * Strength copy. `fallback` replaces the strength module when the highest answer is 0,
 * which the result object signals with `strengthIsFallback`.
 */
export const STRENGTH_COPY = deepFreeze({
  q1: "Você definiu uma tarefa que realmente varia de um usuário para outro.",
  q2: "A tarefa que você escolheu tem impacto relevante em activation, retention ou revenue.",
  q3: "Seu sistema de componentes está em condições de remontar a tela com segurança.",
  q4: "Você tem sinais de contexto confiáveis e autorizados para escolher a tela certa.",
  q5: "O usuário entende a tela gerada, consegue alterá-la e consegue voltar para a tela padrão.",
  q6: "As ações críticas estão protegidas por permissão, pré-visualização e registro de auditoria.",
  q7: "Seu catálogo de funcionalidades independe do menu principal e pode ser lido pelo sistema.",
  q8: "Mesmo quando o Generative UI não mostra as funcionalidades, o usuário consegue reencontrá-las.",
  fallback: "Seu primeiro passo no preparo para Generative UI está claro: antes de escolher um piloto, defina o problema de uso principal e os limites de segurança."
});

/** Recommendation copy for the two priority gaps. */
/**
 * The two questions the result highlights.
 *
 * Two questions are always selected, including when every answer is the maximum, so these
 * lines must be true at every answer value. Each names a control to establish and verify
 * during the pilot; none of them asserts that the capability is missing.
 */
export const RECOMMENDATION_COPY = deepFreeze({
  q1: "Fixe o piloto em uma única tarefa de usuário e comprove com medição que a tela necessária realmente é outra quando o papel do usuário ou o estado do produto muda.",
  q2: "Amarre o piloto a um único resultado mensurável ligado a activation, retention ou revenue e acompanhe esse resultado durante todo o piloto.",
  q3: "Garanta no piloto que as entradas, os estados, as permissões e o comportamento de erro dos componentes no escopo estejam descritos de forma legível pelo sistema.",
  q4: "Restrinja os sinais de contexto usados no piloto a uma lista atualizada, autorizada e com origem conhecida, e mantenha esse limite durante todo o piloto.",
  q5: "Garanta no piloto a explicação de por que a tela foi exibida e os caminhos de edição, reset e volta ao fluxo padrão.",
  q6: "Garanta no piloto que as ações críticas passem por checagem de permissão, resumo claro, confirmação e registro de auditoria.",
  q7: "Garanta no piloto um catálogo de funcionalidades atualizado, pesquisável e independente do menu, com dono, usuário-alvo, permissões e pré-requisitos.",
  q8: "Garanta no piloto que as funcionalidades não visíveis possam ser encontradas por uma central pesquisável no produto, indicação conforme o contexto e volta aos itens recentes."
});

/**
 * The handful of public strings the renderer produces at runtime. Everything else is
 * authored directly in index.html, so each string still exists exactly once.
 * Share and card copy is added in Phase 3.
 */
export const UI_COPY = deepFreeze({
  progress: "Pergunta {current} / 8",
  next: "Continuar",
  finish: "Ver meu resultado",
  unansweredError: "Para continuar, marque a opção que vale para o seu produto hoje.",
  resultError: "Não foi possível calcular o resultado. Confira suas respostas e tente de novo.",
  begin: "Começar o Check-up",
  taskLabel: "Tarefa avaliada",
  pilotScope: "Limite seu primeiro piloto a uma parte reversível e sem ação crítica da tarefa \u201C{task}\u201D.",
  cardPreparing: "Preparando o cartão de resultado…",
  shareLinkedIn: "Compartilhar no LinkedIn",
  shareNative: "Abrir a tela de compartilhamento",
  // Both surfaces that carry an editable draft read these two. They are keys rather than
  // inline literals in each surface for the reason Phase 13 established: a string authored in
  // COPY-TR.md and duplicated as a literal sits outside the parity test and drifts unnoticed.
  // The hand-off window is built from JS, so a literal there would be exactly that shape again.
  draftIntro: "Edite o texto abaixo como quiser. O compartilhamento usa o texto que estiver na caixa.",
  draftLabel: "Texto do post do LinkedIn",
  // Read only on the fallback surface now. The desktop happy path no longer passes through
  // this dialog, so a note describing what happens next on that path would be read by nobody.
  shareNoteDesktop: "Esta janela é usada quando não dá para abrir uma nova aba. O texto do seu post está na caixa acima.",
  shareNoteNative: "O texto e o cartão de resultado vão juntos para a tela de compartilhamento. Depois de escolher o LinkedIn, você pode editar o post ou publicar do jeito que está.",
  shareOpened: "Uma nova aba foi aberta. Siga os passos por lá.",
  handoffHeading: "Adicione o cartão de resultado ao seu post",
  handoffInstruction: "Clique com o botão direito no cartão, escolha \u201CCopiar imagem\u201D e cole no seu post do LinkedIn.",
  handoffDownloadNote: "Você também pode baixar o cartão e anexá-lo ao post.",
  handoffDownloadAction: "Baixar o cartão",
  // The two states the window can be in before, or instead of, showing a card. Neither names
  // another tab: closing that split is what this phase is for. Neither is rendered beside an
  // instruction to act on a card, because in both of them there is no card to act on.
  handoffPreparing: "Seu cartão de resultado está sendo preparado. Você já pode editar o texto do post.",
  handoffFailed: "Não foi possível preparar seu cartão de resultado. Mesmo assim, você pode compartilhar o texto do post por aqui.",
  handoffAction: "Ir para o LinkedIn",
  handoffCardAlt: "Seu cartão de resultado",
  colophon: "Uma parceria Soft Commitment x UserGuiding.",
  popupBlocked: "O navegador bloqueou a nova aba. Seu texto continua aqui; você pode abrir o LinkedIn pelo botão abaixo.",
  popupBlockedAction: "Abrir o LinkedIn",
  shareCancelled: "O compartilhamento foi cancelado. Seu texto continua aqui; quando quiser, é só tentar de novo.",
  cardError: "Não foi possível preparar o cartão de resultado. Você pode tirar um print da tela de resultado e anexar ao seu post.",
  shareFailure: "Não foi possível abrir a tela de compartilhamento. Seu texto não se perdeu; você pode tentar de novo ou tirar um print da tela de resultado."
});

/**
 * Share-card strings. Every value is derived from COPY-TR.md: the lockup halves and
 * the URL lines are splits of the published attribution and canonical URL, and the
 * next-step label is the published Experiment heading, upper-cased with Turkish
 * casing rules at draw time. No card string is authored here.
 */
export const CARD_COPY = deepFreeze({
  eyebrow: "GENERATIVE UI CHECK-UP",
  lockupLeft: "Soft Commitment",
  lockupRight: "UserGuiding",
  nextLabelSource: "Sugestão de primeiro piloto de Generative UI",
  footerStrong: "Resumo do preparo para Generative UI.",
  footerNote: "Autoavaliação de 8 perguntas.",
  footerUrlTop: "games.userguiding.com/",
  footerUrlBottom: "generative-ui-checkup/pt-br/"
});

/**
 * Editable post copy. `{archetype}`, `{strength}`, `{experiment}` and `{url}` are always
 * replaced; the `{task}` line is dropped whole when no task is available.
 *
 * `{url}` sits in the second block, directly under the headline, and is deliberately neither
 * first nor last.
 *
 * Not last, because LinkedIn's composer strips a trailing URL out of the caption while it
 * builds the link preview, so a draft that ends on the link arrives with the link missing.
 * Copy after the URL is what keeps it. Do not "tidy" the link back to the end.
 *
 * High, because LinkedIn collapses the caption behind "…more" after a couple of lines (O-013).
 * The link used to sit second from last, which satisfied the strip rule while burying the link
 * under the entire post, where a reader who does not expand never sees it.
 *
 * Both positions are pinned by tests, and they bracket the link from either side.
 */
export const SHARE_COPY = deepFreeze({
  title: "Meu resultado no Generative UI Check-up",
  text: "Meu resultado no Generative UI Check-up: {archetype}\n\nO Check-up está aqui: {url}\n\nTarefa que avaliei: {task}\n\nOnde eu já estou bem:\n{strength}\n\nMeu primeiro passo no piloto:\n{experiment}\n\nO quanto você acha que seu produto está pronto para Generative UI?",
  taskLine: "Tarefa que avaliei: {task}",
  url: "https://games.userguiding.com/generative-ui-checkup/pt-br/?utm_source=generative_ui_checkup"
});

export const PARTNER_COPY = deepFreeze({
  heading: "Quem preparou",
  softCommitment: "Newsletter independente sobre AI, startups e a nova economia, publicada a cada duas semanas.",
  userGuiding: "Plataforma de product adoption que permite a times de produto criar onboarding e experiências in-app sem escrever código."
});
