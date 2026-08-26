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
 * Phase 3 adds the Canvas result card and sharing; Phase 4 adds analytics. Neither is
 * wired up here yet.
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
  copyCanonicalUrl,
  supportsFileShare,
  ShareSheetError,
  CANONICAL_URL
} from './share.js';

/**
 * Launch-time configuration. COPY-TR.md deliberately leaves the Soft Commitment
 * destination unset and forbids guessing it, so the outbound block stays out of the
 * document until a real URL is supplied here. An unset value renders no link at all
 * rather than a dead one.
 */
const SOFT_COMMITMENT_URL = null;

/* ------------------------------------------------------------------ state */

function emptyAnswers() {
  return Object.fromEntries(QUESTION_IDS.map((questionId) => [questionId, null]));
}

const state = {
  screen: 'landing',
  questionIndex: 0,
  answers: emptyAnswers(),
  result: null,
  feedback: null
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
  shareNative: byId('share-native'),
  shareDownload: byId('share-download'),
  shareCopy: byId('share-copy'),
  shareStatus: byId('share-status'),
  resultProfiles: byId('result-profiles'),
  resultStrength: byId('result-strength'),
  resultGaps: byId('result-gaps'),
  resultExperiment: byId('result-experiment'),
  feedbackChoices: byId('feedback-choices'),
  feedbackThanks: byId('feedback-thanks'),
  outbound: byId('result-outbound'),
  outboundLink: byId('result-outbound-link'),
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
  state.feedback = null;
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

  resetFeedback();
  resetShare();
  renderOutbound();
}

function resetFeedback() {
  dom.feedbackChoices.hidden = false;
  dom.feedbackThanks.hidden = true;
}

function renderOutbound() {
  const configured = typeof SOFT_COMMITMENT_URL === 'string' && SOFT_COMMITMENT_URL.length > 0;
  if (configured) {
    dom.outboundLink.href = SOFT_COMMITMENT_URL;
  } else {
    dom.outboundLink.removeAttribute('href');
  }
  dom.outbound.hidden = !configured;
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
 * Native file sharing leads when the browser supports it, and download drops to the quiet
 * treatment. Where it is unsupported, download leads. Copy-link is always present, so no
 * route ever ends at a dead button.
 */
function resetShare() {
  setShareStatus('');
  const native = supportsFileShare();
  dom.shareNative.hidden = !native;
  dom.shareDownload.classList.toggle('button--primary', !native);
  dom.shareDownload.classList.toggle('button--quiet', native);
  for (const button of [dom.shareNative, dom.shareDownload, dom.shareCopy]) button.disabled = false;
}

function shareBusy(busy) {
  for (const button of [dom.shareNative, dom.shareDownload, dom.shareCopy]) button.disabled = busy;
}

/**
 * Every share route starts here, so intent is recorded identically for all three.
 *
 * It fires when the action begins, not when it finishes, so a cancelled sheet, a failed
 * clipboard write and a successful download are all counted as the same intent. The staged
 * address is for the Insight Tag only; the share module keeps its own fixed canonical URL,
 * so nothing here can leak into what gets shared.
 *
 * @param {'native'|'download'|'copy'} method
 */
function beginShareIntent(method) {
  track('share_click', { game: GAME, method });
  stage('share');
}

async function handleDownload() {
  if (!state.result) return;
  shareBusy(true);
  beginShareIntent('download');
  try {
    await downloadCard(state.result);
    setShareStatus('');
    track('guc_card_download', { archetype: state.result.archetype });
  } catch {
    setShareStatus(UI_COPY.cardError, 'error');
    track('guc_error', { area: 'card' });
  } finally {
    shareBusy(false);
  }
}

async function handleNativeShare() {
  if (!state.result) return;
  shareBusy(true);
  beginShareIntent('native');
  try {
    const outcome = await shareCard(state.result);
    // A cancelled sheet is an ordinary outcome and says nothing to the reader.
    setShareStatus('');
    if (outcome === 'shared') {
      track('guc_share_success', { method: 'native', archetype: state.result.archetype });
    } else {
      track('guc_share_cancel', { archetype: state.result.archetype });
    }
  } catch (error) {
    // The sheet refusing the card is a different failure from the card not being drawn,
    // so it gets the share-specific message. Download and copy-link stay available either
    // way; shareBusy(false) below re-enables every route.
    const sheetFailed = error instanceof ShareSheetError;
    setShareStatus(sheetFailed ? UI_COPY.shareFailure : UI_COPY.cardError, 'error');
    // ANALYTICS.md allows guc_error only for scoring, card and clipboard, so a refused
    // sheet is not reported as an error event.
    if (!sheetFailed) track('guc_error', { area: 'card' });
  } finally {
    shareBusy(false);
  }
}

async function handleCopy() {
  shareBusy(true);
  beginShareIntent('copy');
  try {
    await copyCanonicalUrl();
    setShareStatus(UI_COPY.copySuccess);
    track('guc_share_success', {
      method: 'copy',
      archetype: state.result ? state.result.archetype : undefined
    });
  } catch {
    setShareStatus(UI_COPY.copyFailure, 'error');
    track('guc_error', { area: 'clipboard' });
  } finally {
    shareBusy(false);
  }
}

function restart() {
  if (state.result) track('guc_restart', { archetype: state.result.archetype });
  resetOnceGuards();
  state.questionIndex = 0;
  state.answers = emptyAnswers();
  state.result = null;
  state.feedback = null;

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
    case 'share-download':
      handleDownload();
      break;
    case 'share-native':
      handleNativeShare();
      break;
    case 'share-copy':
      handleCopy();
      break;
    case 'outbound':
      track('cta_click', {
        destination: 'soft_commitment',
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

  dom.feedbackChoices.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const choice = event.target.closest('[data-feedback]');
    if (!choice) return;
    state.feedback = choice.dataset.feedback;
    track('guc_feedback', {
      rating: choice.dataset.feedback,
      archetype: state.result ? state.result.archetype : undefined
    });
    dom.feedbackChoices.hidden = true;
    dom.feedbackThanks.hidden = false;
    dom.feedbackThanks.focus({ preventScroll: true });
  });

  dom.methodology.addEventListener('close', restoreMethodologyTrigger);

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
renderOutbound();
