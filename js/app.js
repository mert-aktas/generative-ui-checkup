/**
 * Generative UI Check-up: state machine and rendering.
 *
 * Owns the four screens, the answer state and the methodology dialog. It reads copy from
 * ./questions.js and the result object from ./scoring.js, and never composes a public
 * string of its own.
 *
 * Answers live in this module's memory only. Nothing here writes to localStorage,
 * sessionStorage or the URL, and reloading starts over.
 *
 * The Canvas result card, LinkedIn preparation flow, partner links and defensive analytics
 * adapter are wired here. Phase 17 activated GA4 and `D-011` changed the answer contract:
 * this module now sends the selected option index (`answer_value` on `guc_answer`) and the
 * bounded task text (`task_text` on `guc_start`), and the GA4 tag sets two first-party
 * cookies. The answer *labels* and the 0-6 profile scores are the part that stayed local.
 * This header used to call the contract local-only; that was true until activation.
 */

import {
  QUESTIONS,
  PROFILE_NAMES,
  BAND_LABELS,
  ARCHETYPE_CONTENT,
  STRENGTH_COPY,
  RECOMMENDATION_COPY,
  UI_COPY,
  PARTNER_COPY,
  TASK_COPY,
  TASK_LIMITS,
  normalizeTask,
  taskLength,
  isValidTask,
  taskSource
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
  canvasToBlob,
  cardImageUrl,
  buildCardModel,
  shareCard,
  buildLinkedInDraft,
  linkedInComposerUrl,
  prefersNativeShare,
  ShareSheetError,
  CANONICAL_URL,
  CARD_FILENAME
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
   * The same card as a `data:` URL, for the composer hand-off window.
   *
   * Kept beside the Blob rather than derived from it: the hand-off window refuses a `blob:`
   * source under the inherited image policy, and it is built synchronously inside the user
   * gesture, so there is no room to convert one to the other at that point.
   */
  cardImage: null,
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
    // The task rides `guc_start` and no other event. The adapter bounds the text for
    // transport and reports whether it had to; see `boundTaskText` in analytics.js.
    track('guc_start', { variant: 'tr', task_source: taskSource(normalized), task_text: normalized });
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

  // The question that was confirmed and the option index chosen. The option *label* is
  // still never sent: the index answers "which option", the label is the visible sentence.
  track('guc_answer', { question_id: question.id, answer_value: state.answers[question.id] });

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
  share.token += 1;
  dom.shareOpenLinkedIn.hidden = true;
}

function shareBusy(busy) {
  dom.shareOpen.disabled = busy;
  // Releasing the busy lock must not hand back an action the card state says is unavailable.
  // `disabled = busy` did exactly that: a failed render disabled the control and the next
  // `shareBusy(false)` re-enabled it, with no card behind it.
  dom.shareConfirm.disabled = busy || dom.shareConfirm.dataset.state !== 'ready';
}

function setDialogStatus(message, tone) {
  dom.shareDialogStatus.textContent = message || '';
  if (tone) dom.shareDialogStatus.dataset.tone = tone;
  else dom.shareDialogStatus.removeAttribute('data-tone');
}

/**
 * Both share routes start here, so intent is recorded consistently.
 *
 * It fires when the action begins, not when it finishes, so a cancelled sheet, a blocked popup
 * and a successful composer hand-off are all counted as the same intent. The staged address is
 * for the Insight Tag only; the draft carries its own campaign URL and never the staged address.
 *
 * X sharing was removed at Gate 6B: there is no X route, and `analytics.js` accepts only the
 * two methods below.
 *
 * @param {'native'|'linkedin'} method
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
 * on the security detail. The window is opened blank inside the user gesture, because that is
 * what keeps the browser from treating it as an unsolicited popup, and the hand-off window is
 * rendered into it synchronously.
 *
 * **Nothing here navigates the popup.** Reaching the composer is the user's click on the link
 * inside the hand-off window. An earlier version of this comment described the parent sending
 * the window onward by itself, which `AUDIT-LEDGER.md` entry `021` found still shipping after
 * the behaviour had changed in Phase 10. Entry `026` then found the same comment describing a
 * clipboard write Phase 12 had already removed. Two false claims in one paragraph, three gates
 * apart, are why the guards read source prose and not only the prose documents.
 *
 * The guards reject both withdrawn wordings, so this comment reproduces neither. A comment
 * quoting a claim it has withdrawn is indistinguishable, to a scan, from a comment still
 * making it.
 *
 * `noopener` is deliberately *not* in the feature string. Browsers that honour it return `null`
 * instead of a window, which would leave nothing to render the hand-off into. Severing `opener`
 * on the still-same-origin about:blank window, before any authored content exists, achieves the
 * same protection while leaving us a handle to write to.
 *
 * @returns {Window|null} the opened window, or null if it could not be opened or written to
 */
function openComposerPopup(composerUrl) {
  // Wide enough for the two-column layout the window now carries. At the previous 600px it
  // opened below the 760px stacking breakpoint, so the card and the instruction sat on top of
  // each other on a desktop and the card rendered at half the width the user has to right-click.
  const popup = window.open('', '_blank', 'width=1040,height=860');
  if (!popup) return null;
  try {
    // Before anything else, and before any content exists to interact with it.
    popup.opener = null;
    if (!renderHandoffWindow(popup, composerUrl)) {
      // No document we can write to, so the instruction cannot be put in front of the user.
      //
      // Phase 9 navigated straight to the composer here, reasoning that losing the instruction
      // beat stranding the user. That was wrong: it silently delivered the exact behaviour
      // O-014 exists to fix, to a user with no way of knowing, and quietly converted a ruled
      // click-through into the auto-advance Mert did not choose (`AUDIT-LEDGER.md` entry
      // `019`). A share route that cannot carry its instruction reports itself as not opened,
      // and the caller offers the explicit open control instead.
      closeQuietly(popup);
      return null;
    }
    return popup;
  } catch {
    // Authoring threw part-way. Same conclusion as the branch above, and the window still has
    // to go: leaving it open strands the user on a blank popup while the Check-up tab reports
    // the share as blocked. Entry `021` caught this branch skipping the close.
    closeQuietly(popup);
    return null;
  }
}

/** Close a window we are abandoning, without letting the attempt become the failure. */
function closeQuietly(popup) {
  try { popup.close(); } catch { /* already gone; nothing to clean up */ }
}

/** Identifies the instruction line inside the hand-off window. */
const HANDOFF_INSTRUCTION_ID = 'handoff-instruction';

// The aside holds two `handoff__note` paragraphs, so the class alone no longer identifies
// either of them. Each gets an id for the same reason the instruction above has one: a test
// that selects a note by position asserts against whichever paragraph is currently second,
// and a later reorder would silently change the subject of the assertion without failing.
/** Identifies the note beside the download control. */
const HANDOFF_DOWNLOAD_NOTE_ID = 'handoff-download-note';
/** Identifies the note pointing back at the draft in the previous tab. */
const HANDOFF_DRAFT_NOTE_ID = 'handoff-draft-note';

/**
 * Put the paste instruction in the window the user is about to look at.
 *
 * O-014: the instruction used to be written to the Check-up tab at the moment the browser
 * moved focus to a new tab, so it was rendered somewhere the user had already left. Mert
 * missed it entirely on a real desktop run. This is a timing problem, not a wording problem,
 * and the only surface we can still reach after the move is this window: LinkedIn itself is
 * cross-origin and unreachable by design.
 *
 * The window advances on an explicit click, never on a timer. An instruction that removes
 * itself after a few seconds is the same defect in a smaller form.
 *
 * Phase 12 made the card the mechanism: the user takes it with the browser's own right-click
 * menu rather than the application writing to the clipboard. `D-010` added a second path
 * beside it — a download control — because right-click is not a path a keyboard has, which
 * entry `026` raised as a P1. The window therefore describes actions the user performs and
 * claims an outcome for neither: it cannot see what the clipboard holds, and it cannot see
 * where a saved file went. Each line here is written to stay true read on its own, because
 * the guard that polices them reads one line at a time.
 *
 * Three constraints come from the `about:blank` popup inheriting this document's CSP, all
 * measured rather than assumed:
 *
 *   - `style-src 'self'` drops inline `style` attributes and inline `<style>` elements, so
 *     styling comes from the app stylesheet, loaded by URL. It fails silently: the window
 *     would render unstyled rather than error.
 *   - `img-src 'self' data:` refuses a `blob:` source, so the card arrives as a data URL.
 *   - Relative URLs resolve against this document, so the stylesheet href is built from
 *     `location.href` and keeps working under the Pages project path.
 *
 * Navigation is an ordinary link. The parent never sets `location.href` on a cross-origin
 * window, and `opener` is already severed, so the composer opens with no back-reference.
 *
 * @returns {boolean} whether the window could be written to
 */
function renderHandoffWindow(popup, composerUrl) {
  // No card, no window. Every word in here is about the card — the instruction tells the user to
  // right-click it — so rendering without one puts that instruction in front of an empty box.
  // Phase 12 made the image conditional and left the instruction unconditional, which is the
  // shape entry `026` failed. Making the card a precondition removes the state rather than
  // guarding it in two places.
  if (!share.cardImage) return false;

  const doc = popup.document;
  if (!doc || typeof doc.createElement !== 'function' || !doc.body) return false;

  doc.documentElement.lang = 'tr';
  doc.title = UI_COPY.handoffHeading;

  const stylesheet = doc.createElement('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = new URL('css/app.css', location.href).href;
  doc.head.appendChild(stylesheet);

  const main = doc.createElement('main');
  main.className = 'handoff';

  const heading = doc.createElement('h1');
  heading.className = 'handoff__heading';
  heading.textContent = UI_COPY.handoffHeading;
  main.appendChild(heading);

  // Two columns: the card on the left, the words and the way out on the right. The card is
  // the mechanism now, not an illustration, so it gets the larger half.
  const columns = doc.createElement('div');
  columns.className = 'handoff__columns';

  const figure = doc.createElement('figure');
  figure.className = 'handoff__figure';
  const card = doc.createElement('img');
  card.className = 'handoff__card';
  // Full resolution, displayed smaller by CSS. "Copy Image" copies the source bitmap, so a
  // scaled-down source would hand the user a small card to post without telling them.
  card.src = share.cardImage;
  card.alt = UI_COPY.handoffCardAlt;
  figure.appendChild(card);
  columns.appendChild(figure);

  const aside = doc.createElement('div');
  aside.className = 'handoff__aside';

  const instruction = doc.createElement('p');
  instruction.className = 'handoff__instruction';
  instruction.id = HANDOFF_INSTRUCTION_ID;
  instruction.textContent = UI_COPY.handoffInstruction;
  aside.appendChild(instruction);

  // The second way to take the card, added by `D-010` to rule `O-019`.
  //
  // Right-click was the only path Phase 12 left, and entry `026` raised the consequence as a P1:
  // the image is not focusable, no control offered the same outcome, and a keyboard has no
  // dependable way into the context menu — Mac keyboards have no context-menu key and Shift+F10
  // does not reliably target a focused image. A user on the keyboard could reach the draft, the
  // window and the way out, and could not take the one thing the window exists to hand over.
  //
  // An anchor with `href` and `download` is in the tab order and answers to Enter because it is a
  // link, not because anything here made it one. That is the reason to prefer it over a button
  // plus a synthesized click: no `tabindex`, no key handler, no focus management to get wrong.
  //
  // `share.cardImage` is the same data URL the `img` above renders, so the file the user saves is
  // the full-resolution bitmap rather than the displayed size. The comment on that `img` makes
  // the same point about the browser's own copy command, and it holds identically here.
  //
  // No double-quoted prose in this block, deliberately: the undocumented-copy guard pairs quote
  // characters across the whole file, so an unbalanced pair here captures a span of comment and
  // reports it as undeclared Turkish copy. Found by that guard, on this change.
  //
  // Nothing downloads until it is pressed. `PRODUCT-SPEC.md:260` prohibits an *automatic*
  // download and is untouched by `D-010`; this control is the user's, and the prohibition it
  // leaves in place is the one about acting without them.
  const download = doc.createElement('a');
  download.className = 'handoff__download';
  download.href = share.cardImage;
  download.download = CARD_FILENAME;
  download.textContent = UI_COPY.handoffDownloadAction;

  const downloadNote = doc.createElement('p');
  downloadNote.className = 'handoff__note';
  downloadNote.id = HANDOFF_DOWNLOAD_NOTE_ID;
  // Says what the user may do, never that a file arrived or where it landed. The application
  // cannot observe a download's outcome, exactly as it could not observe the clipboard write
  // whose withdrawn success message is the reason that mechanism is gone. The withdrawn wording
  // is deliberately not reproduced here: `:606` records why, and it applies to this line too.
  downloadNote.textContent = UI_COPY.handoffDownloadNote;
  aside.appendChild(downloadNote);
  aside.appendChild(download);

  const draftNote = doc.createElement('p');
  draftNote.className = 'handoff__note';
  draftNote.id = HANDOFF_DRAFT_NOTE_ID;
  draftNote.textContent = UI_COPY.handoffDraftNote;
  aside.appendChild(draftNote);

  // Live from the moment it renders. Gate 9 made this control wait for a clipboard result;
  // there is no longer a clipboard result to wait for, so the reason to withhold it is gone
  // with the mechanism (`AUDIT-LEDGER.md` entry `019`, Track B blocker 2).
  const action = doc.createElement('a');
  action.className = 'handoff__action';
  action.href = composerUrl;
  action.rel = 'noopener';
  action.textContent = UI_COPY.handoffAction;
  aside.appendChild(action);

  columns.appendChild(aside);
  main.appendChild(columns);

  // The same attribution the result screen carries, using the same classes. Nothing new is
  // invented here: `design/` is Codex-owned and read-only.
  main.appendChild(buildPartnerBlock(doc));

  const colophon = doc.createElement('footer');
  colophon.className = 'colophon handoff__colophon';
  const colophonLine = doc.createElement('p');
  colophonLine.textContent = UI_COPY.colophon;
  colophon.appendChild(colophonLine);

  doc.body.className = 'handoff-body';
  doc.body.appendChild(main);
  doc.body.appendChild(colophon);
  return true;
}

/**
 * The two partner boxes, exactly as the result screen builds them.
 *
 * Same classes, same copy source, same destinations and UTMs. They are constructed rather than
 * cloned because this is a different document, and constructing them from `PARTNER_COPY` keeps
 * the one copy source rather than duplicating strings into a second surface.
 */
function buildPartnerBlock(doc) {
  const partners = doc.createElement('aside');
  partners.className = 'partners';

  const title = doc.createElement('h2');
  title.className = 'block__title';
  title.textContent = PARTNER_COPY.heading;
  partners.appendChild(title);

  const grid = doc.createElement('div');
  grid.className = 'partners__grid';

  for (const [href, wordmark, description, modifier] of [
    ['https://www.softcommitment.com/?utm_source=generative_ui_checkup',
      'Soft Commitment', PARTNER_COPY.softCommitment, ''],
    ['https://userguiding.com/?utm_source=generative_ui_checkup',
      'UserGuiding', PARTNER_COPY.userGuiding, ' partner__wordmark--ug']
  ]) {
    const link = doc.createElement('a');
    link.className = 'partner';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';

    const name = doc.createElement('strong');
    name.className = `partner__wordmark${modifier}`;
    name.lang = 'en';
    name.textContent = wordmark;
    link.appendChild(name);

    const text = doc.createElement('span');
    text.textContent = description;
    link.appendChild(text);

    grid.appendChild(link);
  }

  partners.appendChild(grid);
  return partners;
}


/** True when this device should get the OS share sheet rather than the composer. */
function useNativeRoute() {
  return prefersNativeShare(window);
}

/**
 * The route note is route-specific but not blob-dependent, so it is set as soon as the dialog
 * opens rather than after the card resolves.
 *
 * Both notes moved into `UI_COPY` in Phase 13. They were authored in `COPY-TR.md` and then
 * duplicated here as inline literals, which left them outside the labelled-value parity test —
 * so when the desktop note started claiming LinkedIn opens, nothing failed. A user-facing string
 * the copy guard cannot see is a string that can drift, and this one did.
 */
function applyShareNote() {
  dom.shareNote.textContent = useNativeRoute()
    ? UI_COPY.shareNoteNative
    : UI_COPY.shareNoteDesktop;
}

/**
 * The primary share control has three states, not two.
 *
 * `preparing` and `ready` were enough while a card failure still left a usable route. They
 * stopped being enough in Phase 12, when the card became the mechanism rather than an
 * attachment: a failed render landed on `ready`, which enabled the action and sent the user to
 * a hand-off window with no card in it and an unconditional instruction to right-click one.
 * `AUDIT-LEDGER.md` entry `026`, Track UI.
 *
 * Only `ready` is actionable. `failed` keeps the route's own label so the button still says what
 * it would do, and the dialog status line says why it cannot.
 *
 * @param {'preparing'|'ready'|'failed'} state
 */
function setShareAction(state) {
  dom.shareConfirm.dataset.state = state;
  dom.shareConfirm.disabled = state !== 'ready';
  dom.shareConfirm.textContent = state === 'preparing'
    ? UI_COPY.cardPreparing
    : (useNativeRoute() ? UI_COPY.shareNative : UI_COPY.shareLinkedIn);
}

/**
 * Render the card in the background while the user reads and edits the draft.
 *
 * A card failure still opens the dialog and still reports itself there, because the draft is
 * worth showing and the result screen is still on the tab behind it. What it no longer does is
 * leave the share action live. Until Phase 13 this comment read "the text route still works",
 * which was true of Phase 6 and false from Phase 12 onward: both routes now carry the card, the
 * desktop one as the thing the user right-clicks and the native one as a file. There is no
 * text-only route left to fall back to, so `cardError` — which tells the user to screenshot the
 * result screen — is the whole of what this application can honestly offer here.
 */
async function prepareCard() {
  const token = share.token;
  setShareAction('preparing');
  try {
    // One render feeds both outputs: the Blob the native share sheet passes as a file, and the
    // data URL the hand-off window shows. Rendering twice would double the wait the user
    // already sees behind "Karne hazırlanıyor…". `O-012` notes that a ruling against the
    // native sheet would leave the Blob with no consumer at all.
    const canvas = renderCard(state.result);
    const blob = await canvasToBlob(canvas);
    if (token !== share.token) return;
    share.blob = blob;
    share.cardImage = cardImageUrl(canvas);
    setShareAction('ready');
  } catch {
    if (token !== share.token) return;
    share.blob = null;
    share.cardImage = null;
    setShareAction('failed');
    setDialogStatus(UI_COPY.cardError, 'error');
    track('guc_error', { area: 'card' });
  }
}

function openShareDialog() {
  if (!state.result) return;
  share.token += 1;
  share.blob = null;
  share.cardImage = null;
  dom.shareDraft.value = buildLinkedInDraft(state.result, state.task);
  setDialogStatus('');
  dom.shareOpenLinkedIn.hidden = true;
  dom.shareOpenLinkedIn.textContent = UI_COPY.popupBlockedAction;
  applyShareNote();
  setShareAction('preparing');

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
 * Everything that needs the user gesture happens synchronously inside it: the popup is opened
 * blank so the browser still treats it as user-initiated, and the hand-off window is rendered
 * into it in the same tick. Nothing is awaited, because since Phase 12 there is no asynchronous
 * outcome left on this route to wait for.
 *
 * The popup is never navigated from here. Its link is usable the moment the window renders, and
 * the user goes to the composer by clicking it.
 *
 * The composer `text` parameter is undocumented LinkedIn behaviour rather than a supported API,
 * so nothing here depends on it succeeding: the draft stays in the textarea on this tab, and the
 * card stays on screen in the hand-off window, whether or not the parameter was honoured.
 */
function shareToLinkedIn() {
  // The second lock. `setShareAction('failed')` already disables the control that reaches here,
  // so this should be unreachable — but the first version of this route was also meant to be
  // unreachable without a card, and it shipped. Reported as a card error, which is true, and
  // never as a blocked popup, which would be this phase repeating its own subject.
  if (!share.cardImage) {
    setDialogStatus(UI_COPY.cardError, 'error');
    return;
  }

  const composer = linkedInComposerUrl(currentDraft());

  // The popup opens blank inside the gesture and the hand-off window renders into it at once.
  // Nothing is awaited: Phase 12 removed the clipboard write, so there is no asynchronous
  // outcome to wait for and none to report. The card is on screen and the user copies it there.
  const popup = openComposerPopup(composer);
  if (!popup) {
    setDialogStatus(UI_COPY.popupBlocked, 'error');
    dom.shareOpenLinkedIn.hidden = false;
    track('guc_error', { area: 'share' });
    return;
  }

  setDialogStatus(UI_COPY.shareOpened);
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
    if (!sheetFailed) {
      // A card that failed here failed for the same reasons it fails in `prepareCard()`, and
      // leaves the same absence behind. The sheet is different: it can fail with the card
      // intact, and retrying is reasonable, so that route keeps its live control.
      setShareAction('failed');
      track('guc_error', { area: 'card' });
    }
  } finally {
    shareBusy(false);
  }
}

/**
 * Retry only the tab, after the browser blocked the first one.
 *
 * Both routes now produce the same hand-off window with the same card in it, so there is no
 * per-route state to reconcile and nothing to report beyond whether the window opened.
 */
function retryOpenLinkedIn() {
  // Same lock as the primary route, for the same reason: this control is only ever shown after
  // a blocked popup, and a card can fail independently of one.
  if (!share.cardImage) {
    setDialogStatus(UI_COPY.cardError, 'error');
    return;
  }

  const popup = openComposerPopup(linkedInComposerUrl(currentDraft()));
  if (!popup) {
    setDialogStatus(UI_COPY.popupBlocked, 'error');
    return;
  }
  dom.shareOpenLinkedIn.hidden = true;
  setDialogStatus(UI_COPY.shareOpened);
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
