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
  PROFILE_MAX
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
  /**
   * Where the card has got to: `preparing`, `ready` or `failed`.
   *
   * Tracked explicitly rather than inferred from `cardImage` being null, because since Phase 18
   * the two are no longer the same question. `cardImage === null` is true both while the render
   * is still running and after it failed, and the desktop share control has to tell those apart
   * at the moment it is clicked: the first opens a window that fills itself in, the second opens
   * no window at all.
   */
  cardState: 'preparing',
  /**
   * The hand-off window this run opened, while it is still ours to write to.
   *
   * Set to null the moment it stops being — closed by the user, or navigated to LinkedIn, which
   * makes its document cross-origin and every property access on it a throw on our own tab.
   */
  handoffWindow: null,
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
  resultSummary: byId('result-summary'),
  shareOpen: byId('share-open'),
  shareDialog: byId('share-dialog'),
  shareDialogHeading: byId('share-dialog-heading'),
  shareIntro: byId('share-intro'),
  shareDraftLabel: byId('share-draft-label'),
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
  share.cardImage = null;
  share.cardState = 'preparing';
  share.handoffWindow = null;
  share.token += 1;
  dom.shareOpenLinkedIn.hidden = true;
  dom.shareOpenLinkedIn.textContent = UI_COPY.popupBlockedAction;
  dom.shareConfirm.hidden = false;
  dom.shareDraft.value = buildLinkedInDraft(state.result, state.task);
  applyShareNote();
  setShareAction('preparing');

  // **The render starts here, at the result screen, rather than when the share control is
  // clicked.** This is not a wait on the opener's side and it does not change what the click
  // does: the click still opens the window in the same tick, whatever state the card is in. It
  // moves when the work begins, so that by the time a user has read their result and reached for
  // the share control, the window usually opens straight into `ready`.
  //
  // The `preparing` state stays fully implemented and tested because it is reachable — a slow
  // machine, a fast click — not because it is common.
  prepareCard();
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
function openComposerPopup(seedDraft) {
  // Wide enough for the two-column layout the window now carries. At the previous 600px it
  // opened below the 760px stacking breakpoint, so the card and the instruction sat on top of
  // each other on a desktop and the card rendered at half the width the user has to right-click.
  //
  // **This call is synchronous inside the user's gesture, and nothing may be awaited before it.**
  // A browser that does not see an unbroken line from the click to the `window.open` treats the
  // window as unsolicited and blocks it, and a blocked popup is indistinguishable to the user
  // from a broken button. Since Phase 18 the card may still be rendering at this point; that is
  // what the window's `preparing` state is for. Waiting for the card here would trade a state
  // the user can read for a failure they cannot.
  const popup = window.open('', '_blank', 'width=1040,height=860');
  if (!popup) return null;
  try {
    // Before anything else, and before any content exists to interact with it.
    popup.opener = null;
    if (!renderHandoffWindow(popup, seedDraft)) {
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

// Every element the opener or a test needs to find again gets an id. The aside holds several
// paragraphs with the same class, so the class alone identifies none of them: a selector that
// picks a note by position asserts against whichever paragraph is currently in that slot, and a
// later reorder changes the subject of the assertion without failing it. That is not
// hypothetical here — `D-010` added a second `handoff__note` and broke exactly such a selector.
/** Identifies the note beside the download control. */
const HANDOFF_DOWNLOAD_NOTE_ID = 'handoff-download-note';
/** Marks the window as one this application authored, and still owns. */
const HANDOFF_ROOT_ID = 'handoff-root';
/** The line that says which of the three states the window is in. */
const HANDOFF_STATUS_ID = 'handoff-status';
/** Everything that only makes sense once a card exists: instruction, note, download control. */
const HANDOFF_CARD_ACTIONS_ID = 'handoff-card-actions';
/** The card image itself. */
const HANDOFF_CARD_ID = 'handoff-card';
/** The editable draft, which this phase moved into the window. */
const HANDOFF_DRAFT_ID = 'handoff-draft';
/** The promise that the box's current text is what gets shared, beside the box it is about. */
const HANDOFF_DRAFT_INTRO_ID = 'handoff-draft-intro';
/** The link to the composer, whose href is rebuilt from the draft at click time. */
const HANDOFF_ACTION_ID = 'handoff-action';

/**
 * Build the whole hand-off surface: the card, the instruction, the draft and the way out.
 *
 * **Since Phase 18 this window is the entire desktop share flow, not the second half of one.**
 * It used to be opened from a dialog that held the editable draft, and it had to tell the user
 * so — a window that has to say where the rest of the task is has been split in the wrong place.
 * The draft is authored here now, beside the card, and the sentence about the other tab is gone
 * with the split rather than reworded to survive it.
 *
 * O-014: the instruction used to be written to the Check-up tab at the moment the browser
 * moved focus to a new tab, so it was rendered somewhere the user had already left. Mert
 * missed it entirely on a real desktop run. This is a timing problem, not a wording problem,
 * and the only surface we can still reach after the move is this window: LinkedIn itself is
 * cross-origin and unreachable by design.
 *
 * What goes in the card half is `applyHandoffState()`'s decision, not this function's. The
 * window opens inside the user's gesture and the card may still be rendering, so this builds the
 * frame and that fills it — once now, and again from `updateHandoffWindow()` if the card lands
 * after the user is already looking at the window.
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
 * Navigation is an ordinary link, and since Phase 21 a targeted one: it opens a tab and leaves
 * this window holding the card. The parent never sets `location.href` on a cross-origin window.
 * The composer tab gets no back-reference to this one, by the implicit `noopener` of a targeted
 * link rather than by the `opener` severed above — that one is a different relationship, this
 * window's reference back to the app tab, and it is still needed.
 *
 * @returns {boolean} whether the window could be written to
 */
function renderHandoffWindow(popup, seedDraft) {
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
  // The marker that says this document is ours. `updateHandoffWindow()` checks for it before
  // writing anything, so a window the user has navigated elsewhere is never written into.
  main.id = HANDOFF_ROOT_ID;

  const heading = doc.createElement('h1');
  heading.className = 'handoff__heading';
  heading.textContent = UI_COPY.handoffHeading;
  main.appendChild(heading);

  // Two columns: the card on the left, the words, the draft and the way out on the right. The
  // card is the mechanism, not an illustration, so it gets the larger half.
  const columns = doc.createElement('div');
  columns.className = 'handoff__columns';

  // Left empty here and filled by `applyHandoffState()`. The window opens inside the user's
  // gesture and the card may not exist yet, so what goes in this figure is a question only that
  // function can answer, and it has to be able to answer it again later.
  const figure = doc.createElement('figure');
  figure.className = 'handoff__figure';
  columns.appendChild(figure);

  const aside = doc.createElement('div');
  aside.className = 'handoff__aside';

  // Says which of the three states the window is in. Empty and hidden once there is a card,
  // because at that point the instruction below it is the thing to read.
  const status = doc.createElement('p');
  status.className = 'handoff__status';
  status.id = HANDOFF_STATUS_ID;
  aside.appendChild(status);

  // Everything that only makes sense once a card exists, in one container so it can be present
  // or absent as a unit. Entry `026` failed a window whose image was conditional and whose
  // instruction to right-click it was not; keeping them in one subtree is what makes that
  // mismatch unrepresentable rather than merely avoided in two places.
  const cardActions = doc.createElement('div');
  cardActions.className = 'handoff__card-actions';
  cardActions.id = HANDOFF_CARD_ACTIONS_ID;
  aside.appendChild(cardActions);

  // The draft, which Phase 18 moved here from the dialog on the other tab.
  //
  // It is built once, seeded by the caller, and never rewritten by the opener afterwards. That
  // matters: the card can resolve while the user is part-way through editing, and the fill that
  // follows must not take their sentence away. `applyHandoffState()` touches the figure and the
  // card actions only, and nothing in this file writes to this textarea again.
  const intro = doc.createElement('p');
  intro.className = 'handoff__note';
  intro.id = HANDOFF_DRAFT_INTRO_ID;
  intro.textContent = UI_COPY.draftIntro;
  aside.appendChild(intro);

  const label = doc.createElement('label');
  label.className = 'handoff__label';
  label.htmlFor = HANDOFF_DRAFT_ID;
  label.textContent = UI_COPY.draftLabel;
  aside.appendChild(label);

  const draft = doc.createElement('textarea');
  draft.className = 'handoff__draft';
  draft.id = HANDOFF_DRAFT_ID;
  draft.rows = 10;
  draft.value = seedDraft;
  aside.appendChild(draft);

  // Live from the moment it renders. Gate 9 made this control wait for a clipboard result;
  // there is no longer a clipboard result to wait for, so the reason to withhold it is gone
  // with the mechanism (`AUDIT-LEDGER.md` entry `019`, Track B blocker 2).
  const action = doc.createElement('a');
  action.className = 'handoff__action';
  action.id = HANDOFF_ACTION_ID;
  // A new tab, because this window is the only thing holding the card. Without a target the link
  // navigates *this* document to LinkedIn, and a user who had not pressed the download control
  // first lost the card with no way back except restarting the run. That shipped — and the four
  // tests that clicked this link asserted it, by awaiting the navigation on this window rather
  // than on a tab. Phase 21 corrected them; `PLAN.md` Track ENCODED is why they read as they now do.
  //
  // `noopener` predates the target and was inert without it — written for a behaviour the element
  // did not have. **It is kept, and it is still not what severs the new tab.** Measured in
  // Chromium 151, not assumed: with a target and no `rel` at all the composer tab still reports
  // `window.opener === null`, because a targeted link is implicitly `noopener`; only an explicit
  // `rel="opener"` brings the reference back. Deleting this line changes nothing in either browser
  // this suite runs. It stays for browsers predating that default, where a targeted link does hand
  // over a live reference, and because the intent belongs beside the target — as a declaration,
  // not a mechanism.
  //
  // So do not add an assertion claiming to prove this line load-bearing. One was tried; it passes
  // with the line deleted.
  action.target = '_blank';
  action.rel = 'noopener';
  action.textContent = UI_COPY.handoffAction;

  // `UI_COPY.draftIntro`, rendered directly above this box, promises that the current text in
  // the box is what gets shared. That promise is older than this phase and has to survive the
  // move, so the href is rebuilt from the textarea rather than captured from the value the
  // window opened with. The sentence itself lives in `COPY-TR.md` and is not repeated here:
  // a Turkish string in two places is the drift this project keeps paying for.
  //
  // Both listeners read the same box; neither holds a copy of it. The `click` one is what makes
  // the promise literally true, because it runs before the browser follows the link and so the
  // URL navigated to is built from the box as it stands at that instant. The `input` one keeps
  // the href honest in between, for the user who copies the link address or opens it in a new
  // tab from the context menu rather than clicking it.
  //
  // A draft read once, when the window opened, would break this silently and in the worst
  // possible way: the user's edit stays visible on screen while a stale value is what travels.
  const syncComposerHref = () => { action.href = linkedInComposerUrl(draft.value); };
  syncComposerHref();
  draft.addEventListener('input', syncComposerHref);
  action.addEventListener('click', syncComposerHref);

  aside.appendChild(action);

  columns.appendChild(aside);
  main.appendChild(columns);

  if (!applyHandoffState(doc, share.cardState, main)) return false;

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
 * Draw the state that is true, rather than refusing to draw.
 *
 * Until Phase 18 this window had one state and a precondition: no `share.cardImage`, no window.
 * That was the right call while the modal held the user long enough for `prepareCard()` to
 * finish, because the precondition was then unreachable in practice. Phase 18 removes the modal
 * from the desktop path and with it that buffer, so the window can now legitimately open before
 * the card exists — and a precondition that refuses to draw would turn an ordinary wait into a
 * blocked-popup report.
 *
 * The three states are `preparing`, `ready` and `failed`. **The card, the download control and
 * the instruction to right-click appear only in `ready`, and they appear together.** Entry `026`
 * failed a shipped window whose image was conditional and whose instruction was not; rendering
 * before the card exists reopens that door, so they are built as one subtree that is present or
 * absent as a whole.
 *
 * The draft, its label and its intro are deliberately not touched here. The card can resolve
 * while the user is mid-sentence, and a fill that rewrote the textarea would take their words
 * away at the one moment they are least expecting it.
 *
 * @param {Document} doc the hand-off window's document
 * @param {'preparing'|'ready'|'failed'} cardState
 * @param {Element} [root] subtree to search, for the first render when nothing is attached yet
 * @returns {boolean} whether the window still had the structure this writes into
 */
function applyHandoffState(doc, cardState, root) {
  const scope = root || doc;
  const status = scope.querySelector(`#${HANDOFF_STATUS_ID}`);
  const actions = scope.querySelector(`#${HANDOFF_CARD_ACTIONS_ID}`);
  const figure = scope.querySelector('.handoff__figure');
  if (!status || !actions || !figure) return false;

  // Whatever the previous state left behind goes first, so no element from it can survive into a
  // state that does not include it.
  figure.replaceChildren();
  actions.replaceChildren();
  status.dataset.state = cardState;

  if (cardState !== 'ready') {
    status.hidden = false;
    status.textContent = cardState === 'failed' ? UI_COPY.handoffFailed : UI_COPY.handoffPreparing;
    return true;
  }

  status.hidden = true;
  status.textContent = '';

  const card = doc.createElement('img');
  card.className = 'handoff__card';
  card.id = HANDOFF_CARD_ID;
  // Full resolution, displayed smaller by CSS. The browser's own copy command copies the source
  // bitmap, so a scaled-down source would hand the user a small card to post without telling them.
  card.src = share.cardImage;
  card.alt = UI_COPY.handoffCardAlt;
  figure.appendChild(card);

  const instruction = doc.createElement('p');
  instruction.className = 'handoff__instruction';
  instruction.id = HANDOFF_INSTRUCTION_ID;
  instruction.textContent = UI_COPY.handoffInstruction;
  actions.appendChild(instruction);

  const downloadNote = doc.createElement('p');
  downloadNote.className = 'handoff__note';
  downloadNote.id = HANDOFF_DOWNLOAD_NOTE_ID;
  // Says what the user may do, never that a file arrived or where it landed. The application
  // cannot observe a download's outcome, exactly as it could not observe the clipboard write
  // whose withdrawn success message is the reason that mechanism is gone. The withdrawn wording
  // is deliberately not reproduced here: `:606` records why, and it applies to this line too.
  downloadNote.textContent = UI_COPY.handoffDownloadNote;
  actions.appendChild(downloadNote);

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
  // It stays the first focusable thing in the window, which is why the card actions sit above
  // the draft: the user who needs this control is the user who cannot use the mechanism beside it.
  //
  // No double-quoted prose in this block, deliberately: the undocumented-copy guard pairs quote
  // characters across the whole file, so an unbalanced pair here captures a span of comment and
  // reports it as undeclared Turkish copy. Found by that guard, on an earlier change.
  //
  // Nothing downloads until it is pressed. `PRODUCT-SPEC.md:260` prohibits an *automatic*
  // download and is untouched by `D-010`; this control is the user's, and the prohibition it
  // leaves in place is the one about acting without them.
  const download = doc.createElement('a');
  download.className = 'handoff__download';
  download.href = share.cardImage;
  download.download = CARD_FILENAME;
  download.textContent = UI_COPY.handoffDownloadAction;
  actions.appendChild(download);

  return true;
}

/**
 * Fill in a window that is already open, when the card finally resolves.
 *
 * The opener holds a reference to a window the **user** controls, and by the time this runs they
 * may have closed it or clicked through to LinkedIn. Both are ordinary, and both are fatal if
 * assumed away: reading `document` on a window that has navigated cross-origin throws, and the
 * throw lands on this tab, inside the card-preparation path, where it would look like a card
 * failure rather than a user who simply moved on.
 *
 * Three checks, each for a different way the window stops being ours, and a catch for the one
 * that cannot be checked without risking the throw it is checking for:
 *
 *   - `closed` — the user closed it.
 *   - no `HANDOFF_ROOT_ID` — same-origin, but no longer the document we authored.
 *   - the catch — cross-origin now, so even asking was a SecurityError.
 *
 * In every case the reference is dropped rather than retried. There is nothing to recover: the
 * window that would have received the card no longer exists to receive it.
 */
function updateHandoffWindow() {
  const popup = share.handoffWindow;
  if (!popup) return;
  try {
    if (popup.closed) {
      share.handoffWindow = null;
      return;
    }
    const doc = popup.document;
    if (!doc || !doc.getElementById(HANDOFF_ROOT_ID)) {
      share.handoffWindow = null;
      return;
    }
    applyHandoffState(doc, share.cardState);
  } catch {
    share.handoffWindow = null;
  }
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
  // The model says `preparing` alongside the control that says it. Until the Gate 18
  // remediation only `setShareAction()` was called here, so a render started after a failure
  // left `share.cardState` reading `failed` while it ran — a window opened during that retry
  // would have shown the failed state for a card still on its way, and a second reopen would
  // have started a third render on top of the second.
  share.cardState = 'preparing';
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
    share.cardState = 'ready';
    setShareAction('ready');
  } catch {
    if (token !== share.token) return;
    share.blob = null;
    share.cardImage = null;
    share.cardState = 'failed';
    setShareAction('failed');
    setDialogStatus(UI_COPY.cardError, 'error');
    track('guc_error', { area: 'card' });
  }

  // A window opened before this resolved is still sitting in `preparing`, and it is the surface
  // the user is actually looking at. Both outcomes are delivered to it: `ready` puts the card in,
  // `failed` says so honestly rather than leaving the window preparing for ever.
  updateHandoffWindow();
}

/**
 * Show the preparation dialog.
 *
 * **Since Phase 18 this is the mobile route's first step and the desktop route's fallback, and
 * it is no longer where card preparation begins.** `resetShare()` starts the render when the
 * result screen appears, so by the time anything opens this dialog the card is already on its
 * way or already done. Re-preparing here would restart a render that is in flight, and on the
 * desktop fallback it would do so at the exact moment the user needs the current state reported
 * rather than replaced.
 *
 * The draft and the route note are set by `resetShare()` for the same reason: the dialog is now
 * one of two surfaces that can carry them, so neither surface owns them. **The draft is
 * deliberately not rebuilt here.** Whatever the user has typed is their post, and an open that
 * discarded it would be a worse trade than the stale draft it prevents — `D-015`.
 *
 * **What an open does still own is a clean slate to report into, and a retry.** Opening the
 * dialog is the native route's only recovery from a failed card; the alternative is `restart`,
 * which discards eight answers. Phase 18 removed both along with the unconditional
 * `prepareCard()` and no test went red, because no test reopened the dialog. `D-015`,
 * `AUDIT-LEDGER.md` entry `033`.
 *
 * The two callers that open this dialog *to report a failure* — both in `openHandoffTab()` —
 * set their status after this returns, for that reason.
 */
function openShareDialog() {
  if (!state.result) return;

  setDialogStatus('');

  // Only a card that has already failed is retried. A `ready` card has nothing to re-render, and
  // re-rendering it would flip a live share action back to `preparing` in front of a user who
  // just opened the dialog to use it; a `preparing` card is already on its way.
  if (share.cardState === 'failed') prepareCard();

  try {
    const canvas = renderCard(state.result);
    canvas.setAttribute('aria-hidden', 'true');
    dom.sharePreview.replaceChildren(canvas);
  } catch {
    dom.sharePreview.replaceChildren();
  }

  dom.shareDialog.showModal();
  dom.shareDialogHeading.focus({ preventScroll: true });
}

/**
 * The desktop share control, which now opens the hand-off window directly.
 *
 * One gesture on the result screen, one window, carrying both the card and the editable draft.
 * The dialog is not shown first: a window that had to tell the user their post text was in a box
 * on the tab they just left was split in the wrong place, and closing that split is what this
 * phase is for.
 *
 * Ordering here is the whole risk. `window.open` is called inside the gesture with nothing
 * awaited before it, because a browser that cannot trace the call back to the click blocks the
 * window. The card is not waited for; if it has not arrived, the window opens in `preparing` and
 * `prepareCard()` fills it in when it resolves.
 *
 * The one case that opens no window is a card that has **already** failed. There is nothing for
 * the window to hand over, and entry `026` is what a hand-off window with no card in it costs.
 * That user gets the dialog instead, carrying their draft and an honest reason.
 */
function openHandoffTab() {
  beginShareIntent('linkedin');

  if (share.cardState === 'failed') {
    // Status after the open, not before: opening the dialog now clears its status line and
    // retries the failed card, so a reason written first would be wiped by the surface it was
    // written for. The retry is the same recovery this route had before Phase 18 moved
    // preparation to `resetShare()`.
    openShareDialog();
    setDialogStatus(UI_COPY.cardError, 'error');
    return;
  }

  const popup = openComposerPopup(buildLinkedInDraft(state.result, state.task));
  if (!popup) {
    // The browser refused the window, so the draft needs a surface and the user needs a way out.
    // The dialog is that surface: it already exists, it is already tested, and `popupBlocked` —
    // `Metniniz burada duruyor`, your text is here — is a line written about it, which stays
    // literally true because it is the thing now being shown.
    //
    // `share-confirm` is hidden rather than left live. It would be a second control doing what
    // the retry beside it does, and the retry is the one `popupBlocked` names.
    //
    // `popupBlocked` is written after the open for the same reason as the branch above: the
    // open clears the status line. The card is `ready` on this path — a failed one never
    // reaches here — so the open's retry does not fire and the action state is untouched.
    dom.shareConfirm.hidden = true;
    dom.shareOpenLinkedIn.hidden = false;
    openShareDialog();
    setDialogStatus(UI_COPY.popupBlocked, 'error');
    track('guc_error', { area: 'share' });
    return;
  }

  share.handoffWindow = popup;
  track('guc_share_success', { method: 'linkedin', archetype: state.result.archetype });
}

function closeShareDialog() {
  if (dom.shareDialog.open) dom.shareDialog.close();
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

/**
 * The dialog's primary action, which since Phase 18 is the native sheet and nothing else.
 *
 * The desktop route used to arrive here too, one click after opening this dialog. It no longer
 * passes through the dialog at all — `openHandoffTab()` is the whole of it — so this control is
 * hidden on the desktop fallback and the branch that served it is gone rather than left
 * unreachable behind a condition that can no longer be true.
 */
async function handleShareConfirm() {
  if (!state.result) return;
  shareBusy(true);
  beginShareIntent('native');
  try {
    await shareToNativeSheet();
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
 * **The window it opens is seeded from this dialog's box, not from a fresh draft.** The user got
 * here because their window was blocked, and whatever they have since typed in the box in front
 * of them is their post. Rebuilding the draft would discard it while leaving the promise beside
 * the box — the current text in the box is what gets shared — on screen and false.
 *
 * From there the window's own box takes over: its link is built from its own textarea at click
 * time, exactly as on the unblocked path. Neither surface holds a draft the other reads, so
 * neither can leave a stale one behind for the other to send.
 */
function retryOpenLinkedIn() {
  // Same lock as the primary route, for the same reason: this control is only ever shown after
  // a blocked popup, and a card can fail independently of one.
  if (!share.cardImage) {
    setDialogStatus(UI_COPY.cardError, 'error');
    return;
  }

  const popup = openComposerPopup(currentDraft());
  if (!popup) {
    setDialogStatus(UI_COPY.popupBlocked, 'error');
    return;
  }
  share.handoffWindow = popup;
  dom.shareOpenLinkedIn.hidden = true;
  // `shareOpened` — a new tab opened, follow the steps there — is written here and nowhere else
  // now. It used to be written on the desktop happy path as well, at the moment the window
  // opened, which after this phase would put it in a dialog the user never saw. Here the user is
  // looking at this dialog when the window opens, so the line reports what just happened on the
  // surface they are reading.
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
      // The one result-screen gesture, routed by input capability rather than by user agent.
      // A coarse pointer keeps the dialog it has always had (`D-009`); everything else now goes
      // straight to the hand-off window, which is what this phase is.
      if (useNativeRoute()) openShareDialog();
      else openHandoffTab();
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

  // The two lines that introduce an editable draft, written from the one key each. The hand-off
  // window renders the same two keys into its own surface; authoring either as a literal in
  // index.html and again in JS is the Phase 13 defect, which put a note outside the parity test
  // and let it drift into a false claim.
  dom.shareIntro.textContent = UI_COPY.draftIntro;
  dom.shareDraftLabel.textContent = UI_COPY.draftLabel;

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
