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
  UI_COPY,
  TASK_COPY,
  TASK_LIMITS,
  normalizeTask,
  taskLength,
  isValidTask
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
  renderCardBlob,
  buildCardModel,
  shareCard,
  buildLinkedInDraft,
  copyImage,
  linkedInComposerUrl,
  prefersNativeShare,
  ShareSheetError,
  CANONICAL_URL
} from './share.js';

/* ------------------------------------------------------------------ state */

function emptyAnswers() {
  return Object.fromEntries(QUESTION_IDS.map((questionId) => [questionId, null]));
}

const state = {
  screen: 'landing',
  /** The normalized user task the whole run is about. Never persisted, never in a URL. */
  task: '',
  questionIndex: 0,
  answers: emptyAnswers(),
  result: null
};

/** Share-dialog working state. Cleared whenever a fresh result is rendered. */
const share = {
  /** The prepared PNG, or null while it is still rendering or after it failed. */
  blob: null,
  /**
   * Whether the PNG actually reached the clipboard.
   *
   * Deliberately separate from `blob`. A prepared Blob says the card was drawn, not that the
   * browser accepted a clipboard write, and the two fail independently: a popup can be blocked
   * while the clipboard also refuses. Inferring one from the other is how the user ends up being
   * told to paste an image that was never copied.
   */
  imageCopied: false,
  /** Guards against two overlapping preparations for different results. */
  token: 0
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
  taskPresets: byId('task-presets'),
  taskInput: byId('task-input'),
  taskCounter: byId('task-counter'),
  taskError: byId('task-error'),
  begin: document.querySelector('[data-action="begin"]'),
  questionTaskValue: byId('question-task-value'),
  resultTaskValue: byId('result-task-value'),
  resultPilotScope: byId('result-pilot-scope'),
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
  shareDialog: byId('share-dialog'),
  shareDialogHeading: byId('share-dialog-heading'),
  shareDraft: byId('share-draft'),
  shareNote: byId('share-note'),
  shareDialogStatus: byId('share-dialog-status'),
  shareConfirm: byId('share-confirm'),
  shareRetryCopy: byId('share-retry-copy'),
  shareOpenLinkedIn: byId('share-open-linkedin'),
  sharePreview: byId('share-preview'),
  resultProfiles: byId('result-profiles'),
  resultStrength: byId('result-strength'),
  resultGaps: byId('result-gaps'),
  resultExperiment: byId('result-experiment'),
  methodology: byId('methodology'),
  methodologyHeading: byId('methodology-heading')
};

/* ------------------------------------------------------------------ task */

/**
 * The instruction screen collects the one task the whole check-up is about.
 *
 * The value is normalized on every read, so control characters, bidi overrides and stray
 * whitespace never reach the DOM, the draft, or the length counter. It is written with
 * `textContent` everywhere and is deliberately kept out of URLs, storage and the card.
 */
function currentTaskInput() {
  return normalizeTask(dom.taskInput.value);
}

function renderTaskPresets() {
  dom.taskPresets.replaceChildren(...TASK_COPY.presets.map((label) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'taskpick__preset';
    button.textContent = label;
    button.dataset.preset = label;
    return button;
  }));
}

/** Keep the counter, the CTA and the error message in step with the field. */
function syncTaskInput() {
  const normalized = currentTaskInput();
  const length = taskLength(normalized);
  const valid = isValidTask(dom.taskInput.value);

  dom.taskCounter.textContent = TASK_COPY.counterTemplate.replace('{count}', String(length));
  if (length > TASK_LIMITS.max) dom.taskCounter.dataset.over = 'true';
  else delete dom.taskCounter.dataset.over;

  dom.begin.disabled = !valid;
  if (valid) hideTaskError();
}

function showTaskError(message) {
  dom.taskError.textContent = message;
  dom.taskError.hidden = false;
}

function hideTaskError() {
  dom.taskError.textContent = '';
  dom.taskError.hidden = true;
}

function applyPreset(label) {
  if (label === TASK_COPY.freeWritePreset) dom.taskInput.value = '';
  else dom.taskInput.value = label;
  syncTaskInput();
  dom.taskInput.focus();
}

/** Show the instruction screen, restoring whatever task the run already has. */
function openInstructions() {
  dom.taskInput.value = state.task;
  syncTaskInput();
  hideTaskError();
  showScreen('instructions');
}

/**
 * Leave the instruction screen for Q1.
 *
 * Existing answers survive a task edit on purpose: the user is renaming the subject of the
 * run, not restarting it.
 */
function beginRun() {
  const normalized = currentTaskInput();
  if (!isValidTask(normalized)) {
    showTaskError(taskLength(normalized) > TASK_LIMITS.max
      ? TASK_COPY.errorTooLong
      : TASK_COPY.errorTooShort);
    dom.taskInput.focus();
    return;
  }

  const firstRun = state.task === '';
  state.task = normalized;
  hideTaskError();

  if (firstRun) {
    markStart();
    track('game_start', { game: GAME });
    track('guc_start', { variant: 'tr' });
    stage('start');
  }
  goToQuestion(state.questionIndex);
}

/** Paint the task context block on a screen. Text only, never markup. */
function renderTaskContext(node) {
  node.textContent = state.task ? `\u201C${state.task}\u201D` : '';
}

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

  renderTaskContext(dom.questionTaskValue);

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

  // Back is available on Q1 as well: it is the route back to editing the task.
  dom.back.hidden = false;
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
  if (state.questionIndex === 0) {
    openInstructions();
    dom.headings.instructions.focus({ preventScroll: true });
    return;
  }
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

  renderTaskContext(dom.resultTaskValue);
  dom.resultPilotScope.textContent = state.task
    ? UI_COPY.pilotScope.replace('{task}', state.task)
    : '';
  dom.resultPilotScope.hidden = !state.task;
  dom.resultExperiment.textContent = archetype.experiment;

  resetShare();
}

/* ----------------------------------------------------------------- sharing */

/**
 * Reset the share block for a freshly rendered result.
 *
 * The public result exposes one share action. The dialog then adapts that action to the
 * native sheet on a touch device, or to the LinkedIn composer route everywhere else.
 */
function resetShare() {
  dom.shareOpen.disabled = false;
  setDialogStatus('');
  share.blob = null;
  share.imageCopied = false;
  share.token += 1;
  dom.shareRetryCopy.hidden = true;
  dom.shareOpenLinkedIn.hidden = true;
}

function shareBusy(busy) {
  dom.shareOpen.disabled = busy;
  dom.shareConfirm.disabled = busy;
}

function setDialogStatus(message, tone) {
  dom.shareDialogStatus.textContent = message || '';
  if (tone) dom.shareDialogStatus.dataset.tone = tone;
  else dom.shareDialogStatus.removeAttribute('data-tone');
}

/**
 * Both share routes start here, so intent is recorded consistently.
 *
 * It fires when the action begins, not when it finishes, so a cancelled sheet, a refused
 * clipboard and a successful composer hand-off are all counted as the same intent. The
 * staged address is for the Insight Tag only; the draft carries its own campaign URL and
 * never the staged address.
 *
 * @param {'native'|'linkedin'|'x'} method
 */
function beginShareIntent(method) {
  track('share_click', { game: GAME, method });
  stage('share');
}

/** The text the user will actually post: whatever is in the box right now. */
function currentDraft() {
  return dom.shareDraft.value;
}

/**
 * Open the LinkedIn composer in a popup with no usable opener back-reference.
 *
 * Both the primary share and the blocked-popup retry go through here, so they cannot drift apart
 * on the security detail. The window is opened blank and navigated afterwards: that keeps the
 * open inside the user gesture on the primary path and lets the clipboard write share the same
 * gesture.
 *
 * `noopener` is deliberately *not* in the feature string. Browsers that honour it return `null`
 * instead of a window, which would make the blank-then-navigate sequence impossible. Severing
 * `opener` on the still-same-origin about:blank window, before the cross-origin navigation is
 * started, achieves the same protection while leaving us a handle to navigate.
 *
 * @returns {boolean} whether the composer was opened and navigated
 */
function openComposerPopup(composerUrl) {
  const popup = window.open('', '_blank', 'width=600,height=600');
  if (!popup) return false;
  try {
    popup.opener = null;
    popup.location.href = composerUrl;
    return true;
  } catch {
    return false;
  }
}

/** True when this device should get the OS share sheet rather than the composer. */
function useNativeRoute() {
  return prefersNativeShare(window);
}

/** The route note is route-specific but not blob-dependent, so it is set as soon as the
 * dialog opens rather than after the card resolves. */
function applyShareNote() {
  dom.shareNote.textContent = useNativeRoute()
    ? "Metin ve sonuç karnesi paylaşım ekranına birlikte aktarılır. LinkedIn'i seçtikten sonra postu düzenleyebilir veya olduğu gibi yayımlayabilirsiniz."
    : "Devam ettiğinizde LinkedIn yeni bir sekmede post metninizle açılır ve sonuç karneniz panonuza kopyalanır. Görseli gönderiye kendiniz yapıştırırsınız.";
}

/** Show the preparing state until the Blob resolves, then enable the real action. */
function setPreparing(preparing) {
  dom.shareConfirm.disabled = preparing;
  dom.shareConfirm.dataset.state = preparing ? 'preparing' : 'ready';
  dom.shareConfirm.textContent = preparing
    ? UI_COPY.cardPreparing
    : (useNativeRoute() ? UI_COPY.shareNative : UI_COPY.shareLinkedIn);
}

/**
 * Render the card in the background while the user reads and edits the draft.
 *
 * A card failure is reported but does not block the run: the text route still works, and
 * saying so is more useful than refusing to open the dialog.
 */
async function prepareCard() {
  const token = share.token;
  setPreparing(true);
  try {
    const blob = await renderCardBlob(state.result);
    if (token !== share.token) return;
    share.blob = blob;
    setPreparing(false);
  } catch {
    if (token !== share.token) return;
    share.blob = null;
    setPreparing(false);
    setDialogStatus(UI_COPY.cardError, 'error');
    track('guc_error', { area: 'card' });
  }
}

function openShareDialog() {
  if (!state.result) return;
  share.token += 1;
  share.blob = null;
  // Every newly opened dialog starts with nothing on the clipboard.
  share.imageCopied = false;
  dom.shareDraft.value = buildLinkedInDraft(state.result, state.task);
  setDialogStatus('');
  dom.shareRetryCopy.hidden = true;
  dom.shareOpenLinkedIn.hidden = true;
  dom.shareRetryCopy.textContent = UI_COPY.clipboardRetry;
  dom.shareOpenLinkedIn.textContent = UI_COPY.popupBlockedAction;
  applyShareNote();
  setPreparing(true);

  try {
    const canvas = renderCard(state.result);
    canvas.setAttribute('aria-hidden', 'true');
    dom.sharePreview.replaceChildren(canvas);
  } catch {
    dom.sharePreview.replaceChildren();
  }

  dom.shareDialog.showModal();
  dom.shareDialogHeading.focus({ preventScroll: true });
  prepareCard();
}

function closeShareDialog() {
  if (dom.shareDialog.open) dom.shareDialog.close();
}

/**
 * The LinkedIn route, modelled on the two live Worst Onboarding games.
 *
 * Everything that needs the user gesture happens synchronously inside it: the popup is
 * opened blank first so the browser still treats it as user-initiated, the clipboard write
 * is *called* (not awaited) in the same tick, and only then is the popup navigated. The
 * awaits come afterwards, once the privileged work has been requested.
 *
 * The composer `text` parameter is undocumented LinkedIn behaviour rather than a supported
 * API, so nothing here depends on it succeeding: the draft stays in the textarea and the
 * card stays on the clipboard either way.
 */
async function shareToLinkedIn() {
  const draft = currentDraft();
  const composer = linkedInComposerUrl(draft);

  // Everything privileged is requested inside the gesture: the popup opens blank first, the
  // clipboard write is called (not awaited) next, and only then do we wait for results.
  const opened = openComposerPopup(composer);
  const copying = share.blob ? copyImage(share.blob, window) : Promise.reject(new ShareSheetError('no card'));
  // Swallow the rejection here so an unawaited promise never becomes an unhandled error.
  const wrote = await copying.then(() => true, () => false);

  share.imageCopied = wrote;

  if (!opened) {
    setDialogStatus(UI_COPY.popupBlocked, 'error');
    dom.shareOpenLinkedIn.hidden = false;
    if (!wrote) dom.shareRetryCopy.hidden = false;
    track('guc_error', { area: 'share' });
    return;
  }

  if (wrote) {
    setDialogStatus(UI_COPY.shareOpened);
    dom.shareRetryCopy.hidden = true;
  } else {
    setDialogStatus(UI_COPY.clipboardFailure, 'error');
    dom.shareRetryCopy.hidden = false;
    track('guc_error', { area: 'clipboard' });
  }
  track('guc_share_success', { method: 'linkedin', archetype: state.result.archetype });
}

/** The native sheet, used only on a genuinely coarse-pointer device. */
async function shareToNativeSheet() {
  const outcome = await shareCard(state.result, currentDraft(), share.blob);
  if (outcome === 'shared') {
    setDialogStatus('');
    closeShareDialog();
    track('guc_share_success', { method: 'native', archetype: state.result.archetype });
  } else {
    setDialogStatus(UI_COPY.shareCancelled);
    track('guc_share_cancel', { archetype: state.result.archetype });
  }
}

async function handleShareConfirm() {
  if (!state.result) return;
  const native = useNativeRoute();
  shareBusy(true);
  beginShareIntent(native ? 'native' : 'linkedin');
  try {
    if (native) await shareToNativeSheet();
    else await shareToLinkedIn();
  } catch (error) {
    const sheetFailed = error instanceof ShareSheetError;
    setDialogStatus(sheetFailed ? UI_COPY.shareFailure : UI_COPY.cardError, 'error');
    if (!sheetFailed) track('guc_error', { area: 'card' });
  } finally {
    shareBusy(false);
  }
}

/** Retry only the image copy. It must never open a second LinkedIn tab. */
async function retryCopyImage() {
  try {
    await copyImage(share.blob, window);
    share.imageCopied = true;
    setDialogStatus(UI_COPY.clipboardRetrySuccess);
    dom.shareRetryCopy.hidden = true;
  } catch {
    share.imageCopied = false;
    setDialogStatus(UI_COPY.clipboardRetryFailure, 'error');
    track('guc_error', { area: 'clipboard' });
  }
}

/**
 * Retry only the tab, after the browser blocked the first one.
 *
 * Opening a window says nothing about the clipboard, so this reports `share.imageCopied` rather
 * than guessing from the Blob. If the clipboard refused earlier, the message must stay a failure
 * message and the copy retry must stay on screen, even though LinkedIn is now open.
 */
function retryOpenLinkedIn() {
  const opened = openComposerPopup(linkedInComposerUrl(currentDraft()));
  if (!opened) {
    setDialogStatus(UI_COPY.popupBlocked, 'error');
    return;
  }
  dom.shareOpenLinkedIn.hidden = true;
  if (share.imageCopied) {
    setDialogStatus(UI_COPY.shareOpened);
    dom.shareRetryCopy.hidden = true;
  } else {
    setDialogStatus(UI_COPY.clipboardFailure, 'error');
    dom.shareRetryCopy.hidden = false;
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
  state.task = '';
  state.questionIndex = 0;
  state.answers = emptyAnswers();
  state.result = null;
  dom.taskInput.value = '';
  syncTaskInput();
  hideTaskError();

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
      openInstructions();
      break;
    case 'begin':
      beginRun();
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
    case 'share-retry-copy':
      retryCopyImage();
      break;
    case 'share-open-linkedin':
      retryOpenLinkedIn();
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

  renderTaskPresets();
  syncTaskInput();

  dom.taskPresets.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const preset = event.target.closest('[data-preset]');
    if (preset) applyPreset(preset.dataset.preset);
  });

  dom.taskInput.addEventListener('input', syncTaskInput);
  dom.taskInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    beginRun();
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
