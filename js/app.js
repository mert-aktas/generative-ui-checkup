/**
 * Generative UI Check-up: state machine and rendering.
 *
 * Owns the four screens, the answer state and the methodology dialog. It reads copy from
 * ./questions.js and the result object from ./scoring.js, and never composes a public
 * string of its own.
 *
 * Answers live in this module's memory only. Nothing here writes to localStorage,
 * sessionStorage, cookies, the URL or the network, and reloading starts over.
 *
 * The Canvas result card, LinkedIn preparation flow, partner links and defensive analytics
 * adapter are wired here without changing the local-only answer contract.
 */

import {
  QUESTIONS,
  PROFILE_NAMES,
  BAND_LABELS,
  ARCHETYPE_CONTENT,
  STRENGTH_COPY,
  RECOMMENDATION_COPY,
  UI_COPY
} from './questions.js';

import {
  scoreAnswers,
  QUESTION_IDS,
  PROFILE_DEFINITIONS,
  PROFILE_MAX,
  ARCHETYPE_IDS
} from './scoring.js';

import {
  track,
  stage,
  markStart,
  completionBand,
  resetOnceGuards,
  normalizeStageUrl
} from './analytics.js';

import {
  renderCard,
  buildCardModel,
  downloadCard,
  shareCard,
  buildLinkedInDraft,
  copyText,
  supportsFileShare,
  ShareSheetError,
  CANONICAL_URL,
  LINKEDIN_COMPOSER_URL
} from './share.js';

/* ------------------------------------------------------------------ state */

function emptyAnswers() {
  return Object.fromEntries(QUESTION_IDS.map((questionId) => [questionId, null]));
}

const state = {
  screen: 'landing',
  questionIndex: 0,
  answers: emptyAnswers(),
  result: null
};

/* -------------------------------------------------------------------- dom */

const byId = (id) => document.getElementById(id);

const dom = {
  screens: {
    landing: byId('screen-landing'),
    instructions: byId('screen-instructions'),
    question: byId('screen-question'),
    result: byId('screen-result')
  },
  headings: {
    landing: byId('landing-heading'),
    instructions: byId('instructions-heading'),
    question: byId('question-heading'),
    result: byId('result-heading')
  },
  progressCount: byId('progress-count'),
  progressDimension: byId('progress-dimension'),
  progressTrack: byId('progress-track'),
  form: byId('question-form'),
  choices: byId('question-choices'),
  help: byId('question-help'),
  helpSummary: byId('question-help-summary'),
  helpBody: byId('question-help-body'),
  error: byId('question-error'),
  back: byId('question-back'),
  next: byId('question-next'),
  resultIndex: byId('result-index'),
  resultSummary: byId('result-summary'),
  shareOpen: byId('share-open'),
  shareStatus: byId('share-status'),
  shareDialog: byId('share-dialog'),
  shareDialogHeading: byId('share-dialog-heading'),
  shareDraft: byId('share-draft'),
  shareNote: byId('share-note'),
  shareDialogStatus: byId('share-dialog-status'),
  shareConfirm: byId('share-confirm'),
  sharePreview: byId('share-preview'),
  resultProfiles: byId('result-profiles'),
  resultStrength: byId('result-strength'),
  resultGaps: byId('result-gaps'),
  resultExperiment: byId('result-experiment'),
  methodology: byId('methodology'),
  methodologyHeading: byId('methodology-heading')
};

/* --------------------------------------------------------------- screens */

function showScreen(name) {
  state.screen = name;
  document.documentElement.dataset.screen = name;

  for (const [key, node] of Object.entries(dom.screens)) {
    node.hidden = key !== name;
    node.classList.remove('screen--enter');
  }

  const active = dom.screens[name];
  void active.offsetWidth; // restart the enter animation on repeat visits
  active.classList.add('screen--enter');

  window.scrollTo(0, 0);
  dom.headings[name].focus({ preventScroll: true });
}

/* -------------------------------------------------------------- question */

const GAME = 'generative_ui_checkup';

/** Coarse band payload for the result. Raw 0-6 scores never leave the browser. */
function resultTelemetry(result) {
  const bands = Object.fromEntries(
    PROFILE_DEFINITIONS.map((definition) => [
      `${definition.id.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_band`,
      result.profiles[definition.id].band
    ])
  );
  return {
    archetype: result.archetype,
    ...bands,
    weak_profile_count: Object.values(result.profiles).filter((p) => p.band === 'weak').length
  };
}

/** Choice markers from the locked design system. Decorative; the radio carries meaning. */
const CHOICE_MARKERS = ['A', 'B', 'C', 'D'];

function currentQuestion() {
  return QUESTIONS[state.questionIndex];
}

function buildChoice(question, label, value) {
  const inputId = `${question.id}-option-${value}`;

  const wrapper = document.createElement('label');
  wrapper.className = 'choice';
  wrapper.setAttribute('for', inputId);

  const input = document.createElement('input');
  input.className = 'choice__input';
  input.type = 'radio';
  input.name = 'answer';
  input.id = inputId;
  input.value = String(value);
  input.checked = state.answers[question.id] === value;

  const marker = document.createElement('span');
  marker.className = 'choice__marker';
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = CHOICE_MARKERS[value];

  const text = document.createElement('span');
  text.className = 'choice__text';
  text.textContent = label;

  wrapper.append(input, marker, text);
  if (input.checked) wrapper.setAttribute('data-selected', '');
  return wrapper;
}

/** Mirror the checked radio onto the label so the selected state never depends on :has(). */
function syncSelection() {
  for (const label of dom.choices.querySelectorAll('.choice')) {
    const input = label.querySelector('.choice__input');
    label.toggleAttribute('data-selected', Boolean(input && input.checked));
  }
}

function renderQuestion() {
  const question = currentQuestion();
  const position = state.questionIndex + 1;

  dom.progressCount.textContent = UI_COPY.progress.replace('{current}', String(position));
  dom.progressDimension.textContent = PROFILE_NAMES[question.dimension];
  dom.progressTrack.setAttribute('aria-valuenow', String(position));
  Array.from(dom.progressTrack.children).forEach((step, index) => {
    if (index + 1 < position) step.dataset.state = 'done';
    else if (index + 1 === position) step.dataset.state = 'current';
    else step.removeAttribute('data-state');
  });

  dom.headings.question.textContent = question.text;
  dom.choices.replaceChildren(
    ...question.options.map((label, value) => buildChoice(question, label, value))
  );

  dom.help.open = false;
  if (question.help) {
    dom.helpSummary.textContent = question.help.label;
    dom.helpBody.textContent = question.help.body;
    dom.help.hidden = false;
  } else {
    dom.help.hidden = true;
  }

  dom.back.hidden = state.questionIndex === 0;
  dom.next.textContent = position === QUESTIONS.length ? UI_COPY.finish : UI_COPY.next;

  syncSelection();
  syncNext();
  clearError();
}

function syncNext() {
  dom.next.disabled = state.answers[currentQuestion().id] === null;
}

function showError(message) {
  dom.error.textContent = message;
  dom.error.hidden = false;
}

function clearError() {
  dom.error.textContent = '';
  dom.error.hidden = true;
}

function goToQuestion(index) {
  state.questionIndex = index;
  renderQuestion();
  showScreen('question');
  // Once per visit to a position. Re-renders do not re-fire; navigating away and back does.
  track('guc_question_view', { question_id: QUESTIONS[index].id, position: index + 1 });
}

function advance() {
  const question = currentQuestion();

  if (state.answers[question.id] === null) {
    // Belt and braces: the continue control is disabled until an answer exists, so this
    // path should be unreachable. It stays because "cannot advance" is the hard rule.
    showError(UI_COPY.unansweredError);
    const firstChoice = dom.choices.querySelector('input');
    if (firstChoice) firstChoice.focus();
    return;
  }

  // The question that was confirmed, never the value chosen.
  track('guc_answer', { question_id: question.id });

  if (state.questionIndex < QUESTIONS.length - 1) {
    goToQuestion(state.questionIndex + 1);
    return;
  }

  finish();
}

function goBack() {
  if (state.questionIndex === 0) return;
  goToQuestion(state.questionIndex - 1);
}

/* ---------------------------------------------------------------- result */

function finish() {
  let result;
  try {
    result = scoreAnswers({ ...state.answers });
  } catch {
    showError(UI_COPY.resultError);
    track('guc_error', { area: 'scoring' });
    return;
  }

  state.result = result;
  renderResult();
  showScreen('result');

  // Both are once-per-run; the adapter drops a repeat.
  track('game_complete', {
    game: GAME,
    archetype: result.archetype,
    completion_time_band: completionBand()
  });
  track('guc_result_view', resultTelemetry(result));
  stage('done');
}

function buildProfileRow(definition, profile) {
  const item = document.createElement('li');
  item.className = 'profile';

  // Accessible equivalent of the row, in the exact form COPY-TR.md publishes for a profile
  // readout. The visible split of name on the left and band + score on the right is a
  // layout decision; assistive technology gets the published sentence instead, with the
  // visible name and score marked decorative so nothing is announced twice.
  const label = document.createElement('span');
  label.className = 'visually-hidden';
  label.dataset.profileLabel = definition.id;
  label.textContent = `${PROFILE_NAMES[definition.id]}: ${profile.score}/${PROFILE_MAX}`;

  const head = document.createElement('div');
  head.className = 'profile__head';

  const name = document.createElement('span');
  name.className = 'profile__name';
  name.setAttribute('aria-hidden', 'true');
  name.textContent = PROFILE_NAMES[definition.id];

  const band = document.createElement('span');
  band.className = 'profile__band';
  band.textContent = BAND_LABELS[profile.band];


  const separator = document.createElement('span');
  separator.className = 'profile__sep';
  separator.setAttribute('aria-hidden', 'true');
  separator.textContent = '·';

  const meta = document.createElement('span');
  meta.className = 'profile__meta';

  // Decorative: the score and the band are already stated in text beside it, so the
  // meter never carries meaning on its own and is hidden from assistive technology.
  const meter = document.createElement('span');
  meter.className = 'profile__meter';
  meter.setAttribute('aria-hidden', 'true');
  for (let step = 1; step <= PROFILE_MAX; step += 1) {
    const segment = document.createElement('span');
    segment.className = step <= profile.score ? 'profile__seg profile__seg--on' : 'profile__seg';
    meter.append(segment);
  }

  const score = document.createElement('span');
  score.className = 'profile__score';
  score.setAttribute('aria-hidden', 'true');
  score.textContent = `${profile.score} / ${PROFILE_MAX}`;

  meta.append(band, separator, score);
  head.append(name, meta);
  item.append(label, head, meter);
  return item;
}

function renderResult() {
  const { result } = state;
  const archetype = ARCHETYPE_CONTENT[result.archetype];

  const position = ARCHETYPE_IDS.indexOf(result.archetype) + 1;
  dom.resultIndex.textContent =
    `${String(position).padStart(2, '0')} / ${String(ARCHETYPE_IDS.length).padStart(2, '0')}`;

  dom.headings.result.textContent = archetype.title;
  dom.resultSummary.textContent = archetype.summary;

  dom.resultProfiles.replaceChildren(
    ...PROFILE_DEFINITIONS.map((definition) =>
      buildProfileRow(definition, result.profiles[definition.id]))
  );

  dom.resultStrength.textContent = result.strengthIsFallback
    ? STRENGTH_COPY.fallback
    : STRENGTH_COPY[result.strengthQuestionId];

  dom.resultGaps.replaceChildren(
    ...result.gapQuestionIds.map((questionId) => {
      const item = document.createElement('li');
      item.textContent = RECOMMENDATION_COPY[questionId];
      return item;
    })
  );

  dom.resultExperiment.textContent = archetype.experiment;

  resetShare();
}

/* ----------------------------------------------------------------- sharing */

function setShareStatus(message, tone) {
  dom.shareStatus.textContent = message || '';
  if (tone) dom.shareStatus.dataset.tone = tone;
  else delete dom.shareStatus.dataset.tone;
}

/**
 * Reset the share block for a freshly rendered result.
 *
 * The public result exposes one share action. The dialog then adapts that action to native
 * file sharing or a desktop package of editable text, downloaded card and LinkedIn composer.
 */
function resetShare() {
  setShareStatus('');
  dom.shareOpen.disabled = false;
  dom.shareDialogStatus.textContent = '';
}

function shareBusy(busy) {
  dom.shareOpen.disabled = busy;
  dom.shareConfirm.disabled = busy;
}

/**
 * Both platform-specific share routes start here, so intent is recorded consistently.
 *
 * It fires when the action begins, not when it finishes, so a cancelled sheet, a failed
 * clipboard write and a successful download are all counted as the same intent. The staged
 * address is for the Insight Tag only. The share module builds a separate allowlisted UTM
 * URL and never copies the staged address into the post.
 *
 * @param {'native'|'desktop'} method
 */
function beginShareIntent(method) {
  track('share_click', { game: GAME, method });
  stage('share');
}

function openShareDialog() {
  if (!state.result) return;
  dom.shareDraft.value = buildLinkedInDraft(state.result);
  dom.shareDialogStatus.textContent = '';
  dom.shareDialogStatus.removeAttribute('data-tone');
  const native = supportsFileShare();
  dom.shareConfirm.textContent = native ? 'Paylaşım ekranını aç' : 'Metni ve karneyi hazırla';
  dom.shareNote.textContent = native
    ? "Cihazınız destekliyorsa metin ve sonuç karnesi paylaşım ekranına birlikte aktarılır. LinkedIn'i seçtikten sonra postu düzenleyebilir veya olduğu gibi yayımlayabilirsiniz."
    : "Masaüstü tarayıcıları LinkedIn'e görseli otomatik yükleyemez. Devam ettiğinizde post metni kopyalanır, sonuç karnesi indirilir ve LinkedIn açılır. İndirilen görseli posta eklemeniz gerekir.";

  try {
    const canvas = renderCard(state.result);
    canvas.setAttribute('aria-hidden', 'true');
    dom.sharePreview.replaceChildren(canvas);
  } catch {
    setShareStatus(UI_COPY.cardError, 'error');
    track('guc_error', { area: 'card' });
    return;
  }
  dom.shareDialog.showModal();
  dom.shareDialogHeading.focus({ preventScroll: true });
}

function closeShareDialog() {
  if (dom.shareDialog.open) dom.shareDialog.close();
}

async function handleShareConfirm() {
  if (!state.result) return;
  shareBusy(true);
  const native = supportsFileShare();
  beginShareIntent(native ? 'native' : 'desktop');
  try {
    if (native) {
      const outcome = await shareCard(state.result, dom.shareDraft.value);
      if (outcome === 'shared') {
        dom.shareDialogStatus.textContent = '';
        closeShareDialog();
        setShareStatus('');
        track('guc_share_success', { method: 'native', archetype: state.result.archetype });
      } else {
        dom.shareDialogStatus.textContent = UI_COPY.shareCancelled;
        track('guc_share_cancel', { archetype: state.result.archetype });
      }
      return;
    }

    window.open(LINKEDIN_COMPOSER_URL, '_blank', 'noopener,noreferrer');
    let copied = true;
    try {
      await copyText(dom.shareDraft.value);
    } catch {
      copied = false;
      track('guc_error', { area: 'clipboard' });
    }
    await downloadCard(state.result);
    const message = copied ? UI_COPY.desktopPrepared : UI_COPY.copyFailure;
    dom.shareDialogStatus.textContent = message;
    if (copied) dom.shareDialogStatus.removeAttribute('data-tone');
    else dom.shareDialogStatus.dataset.tone = 'error';
    setShareStatus(message, copied ? undefined : 'error');
    track('guc_card_download', { archetype: state.result.archetype });
    track('guc_share_success', { method: 'desktop', archetype: state.result.archetype });
  } catch (error) {
    const sheetFailed = error instanceof ShareSheetError;
    const message = sheetFailed ? UI_COPY.shareFailure : UI_COPY.cardError;
    dom.shareDialogStatus.textContent = message;
    dom.shareDialogStatus.dataset.tone = 'error';
    if (!sheetFailed) track('guc_error', { area: 'card' });
  } finally {
    shareBusy(false);
  }
}

function restoreShareTrigger() {
  if (dom.shareOpen && document.contains(dom.shareOpen)) {
    dom.shareOpen.focus({ preventScroll: true });
  }
}

function restart() {
  if (state.result) track('guc_restart', { archetype: state.result.archetype });
  resetOnceGuards();
  state.questionIndex = 0;
  state.answers = emptyAnswers();
  state.result = null;

  dom.choices.replaceChildren();
  clearError();
  showScreen('landing');
}

/* ----------------------------------------------------------- methodology */

let methodologyTrigger = null;

function supportsNativeDialog() {
  return typeof dom.methodology.showModal === 'function';
}

function openMethodology(trigger) {
  methodologyTrigger = trigger instanceof HTMLElement ? trigger : null;

  if (supportsNativeDialog()) {
    dom.methodology.showModal();
  } else {
    // Documented fallback for engines without <dialog>. Focus is not trapped there;
    // every browser in the launch matrix supports showModal, so this is a safety net,
    // not the intended path.
    dom.methodology.setAttribute('open', '');
    dom.methodology.setAttribute('role', 'dialog');
    dom.methodology.setAttribute('aria-modal', 'true');
  }

  dom.methodologyHeading.focus({ preventScroll: true });
}

function restoreMethodologyTrigger() {
  if (methodologyTrigger && document.contains(methodologyTrigger)) {
    methodologyTrigger.focus({ preventScroll: true });
  }
  methodologyTrigger = null;
}

function closeMethodology() {
  if (supportsNativeDialog() && dom.methodology.open) {
    dom.methodology.close(); // fires 'close', which restores focus
    return;
  }
  dom.methodology.removeAttribute('open');
  restoreMethodologyTrigger();
}

/* ---------------------------------------------------------------- events */

function handleAction(action, trigger) {
  switch (action) {
    case 'start':
      showScreen('instructions');
      break;
    case 'begin':
      markStart();
      track('game_start', { game: GAME });
      track('guc_start', { variant: 'tr' });
      stage('start');
      goToQuestion(0);
      break;
    case 'back':
      goBack();
      break;
    case 'restart':
      restart();
      break;
    case 'methodology':
      track('guc_methodology_open', { source: trigger.dataset.source });
      openMethodology(trigger);
      break;
    case 'methodology-close':
      closeMethodology();
      break;
    case 'share-open':
      openShareDialog();
      break;
    case 'share-confirm':
      handleShareConfirm();
      break;
    case 'share-close':
      closeShareDialog();
      break;
    case 'partner':
      track('cta_click', {
        destination: trigger.dataset.destination,
        archetype: state.result ? state.result.archetype : undefined
      });
      stage('cta');
      break;
    default:
      break;
  }
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const trigger = event.target.closest('[data-action]');
    if (trigger) handleAction(trigger.dataset.action, trigger);
  });

  dom.choices.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
    state.answers[currentQuestion().id] = Number(input.value);
    syncSelection();
    syncNext();
    clearError();
  });

  dom.form.addEventListener('submit', (event) => {
    event.preventDefault();
    advance();
  });

  dom.methodology.addEventListener('close', restoreMethodologyTrigger);
  dom.shareDialog.addEventListener('close', restoreShareTrigger);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // Native dialogs close themselves on Escape. Only the fallback path needs this.
    if (!supportsNativeDialog() && dom.methodology.hasAttribute('open')) closeMethodology();
  });
}

/* ------------------------------------------------------------------ boot */

/**
 * Test-only surface, exposed on local hosts only.
 *
 * The card export and draw-model hooks exist so the browser suite can check the card
 * against what the screen shows. They are attached only when the page is served from a
 * loopback or .local host, so the production candidate at games.userguiding.com carries no
 * test globals at all.
 */
function isLocalHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
    || hostname === ''
    || hostname.endsWith('.local')
    || hostname.endsWith('.localhost');
}

if (isLocalHost(window.location.hostname)) {
  window.__checkupCardExport = (answers) => renderCard(scoreAnswers(answers)).toDataURL('image/png');
  window.__checkupCardModel = () => (state.result ? buildCardModel(state.result) : null);
  window.__checkupCanonicalUrl = CANONICAL_URL;
}

// A reload of a staged URL must not land on the landing screen still claiming a finished
// run. This drops stage tokens and unknown parameters before anything renders, keeping only
// allowlisted UTMs, and adds no history entry.
normalizeStageUrl();

// The landing screen is authored visible in index.html, so booting does not move focus.
// Reading a freshly loaded page should start at the top, not at a focused heading.
document.documentElement.dataset.screen = state.screen;
bindEvents();
