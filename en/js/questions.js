/**
 * Generative UI Check-up: English content maps.
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
    text: "When different users complete this task, how much do the screens and steps they need change?",
    options: [
      "They do not: everyone uses the same steps and the same screen",
      "The structure stays the same; only the content or the priority changes",
      "Role or product state changes some components and the order of the steps",
      "A variable working screen is needed: intent, role and live state change most of the screen"
    ],
    help: {
      label: "What is a variable working screen?",
      body: "A variable working screen is when the same task runs with different components depending on the user's intent, role or current state. Generative UI only creates real value if that difference genuinely improves how the task gets done."
    }
  },
  {
    id: "q2",
    dimension: "valueFit",
    text: "What impact does this task have on the user and on the business outcome?",
    options: [
      "It is done rarely, and the impact is mostly cosmetic",
      "It repeats, but its impact on the user or on the business outcome is low",
      "It is done often, takes several steps, and affects an outcome that matters",
      "This is one of the critical user tasks: it matters directly for activation, retention or revenue"
    ],
    help: {
      label: "What counts as a critical user task?",
      body: "A critical user task is work that directly affects whether the user gets value out of the product, or that moves an outcome the business cares about. Finishing the first setup can affect activation, preparing a regular report can affect retention, and upgrading a plan can affect revenue."
    }
  },
  {
    id: "q3",
    dimension: "systemReadiness",
    text: "How much of the product UI behind this task is built from reusable components?",
    options: [
      "Screens are written per page, and the parts are tightly coupled to each other",
      "There are shared visual blocks, but their behavior is still tied to the page",
      "There are reusable components with defined states",
      "Component inputs, states, permissions and error behavior are defined in current component contracts"
    ],
    help: {
      label: "What is a component contract?",
      body: "A component contract defines what data a component accepts, which states it works in, who is allowed to use it, and what it shows when something fails. Generative UI has to know those limits explicitly before it can assemble a screen safely."
    }
  },
  {
    id: "q4",
    dimension: "systemReadiness",
    text: "During this task, which reliable context signals does your product use to pick the right content or flow?",
    options: [
      "Nothing meaningful beyond the page the user is on",
      "Role, plan or account information can be used",
      "On top of that, live product state and recent user activity can be used",
      "Stated user intent, live state, consented history and permissions can all be used together"
    ],
    help: {
      label: "What is a context signal?",
      body: "A context signal is any information that shapes the screen decision: the user's role, plan, stated intent, recent activity or the current state of the account. For Generative UI to pick the right surface, the signal has to be current, permitted, and traceable to a known source."
    }
  },
  {
    id: "q5",
    dimension: "controlSafety",
    text: "When a user lands on a wrong, irrelevant or unexpected screen during this task, how do they recover?",
    options: [
      "They cannot see why the screen changed, and there is no reliable way back",
      "They can back out or start the flow over",
      "They can see why it changed, and can change their choice or return to the standard screen",
      "There is a safe fallback: the user can preview the screen, edit their choice, reset it, or return to the standard flow"
    ],
    help: {
      label: "What is a safe fallback?",
      body: "A safe fallback is the dependable route back when an unexpected screen or flow does not work out. The previous view, the standard product screen, an edit option or a reset is what makes that route trustworthy."
    }
  },
  {
    id: "q6",
    dimension: "controlSafety",
    text: "When a critical action starts during this task, such as a payment, a data deletion or a permission change, which protections kick in?",
    options: [
      "The action just runs",
      "A standard confirmation screen is shown",
      "A permission check and a summary of the action are shown, with an undo or a record of the action",
      "Only pre-approved actions run, and they run with a preview, a permission check, business rules and an audit log"
    ],
    help: {
      label: "What counts as a critical action?",
      body: "A critical action is one that touches money, data, access or customer communication, and can be hard to reverse. In Generative UI readiness these actions should not be left to a model's judgement: they belong behind permission, preview and audit rules."
    }
  },
  {
    id: "q7",
    dimension: "discoveryResilience",
    text: "Where does your team define the features and rules behind this task today?",
    options: [
      "There is no current inventory of what the product can actually do",
      "The knowledge sits scattered across documentation and across teams",
      "There is a current feature catalog with an owner and a target user for each entry",
      "A feature catalog that is current and searchable, and linked to roles, permissions and prerequisites"
    ],
    help: {
      label: "What is a feature catalog?",
      body: "A feature catalog is a current inventory of what the product can do, described independently of the menu structure. For Generative UI to pick the right capabilities, each feature's target user, permissions, prerequisites and owner have to be explicit there."
    }
  },
  {
    id: "q8",
    dimension: "discoveryResilience",
    text: "If a feature this task needs is not visible on screen at that moment, how does a user find it today?",
    options: [
      "Only if they already know the feature's name, or by asking the support team",
      "They can find it in the documentation or through search",
      "They can discover it from a browsable in-product hub that is independent of the screen",
      "Discoverability comes through several routes: a browsable product hub, contextual pointers, and a way back to recently used items"
    ],
    help: {
      label: "What is discoverability?",
      body: "Discoverability is whether a user can still find a feature later, even when it is not on screen right now. Once Generative UI starts building personalized surfaces, a searchable catalog, a product hub and a way back to recently used items matter even more."
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
  heading: "First, pick the task you want to assess",
  intro: "Pick one task your users do often and whose outcome matters. The next eight questions look at how your product supports that task today.",
  presetGroupLabel: "Ready-made examples",
  presets: [
    "Completing the first setup",
    "Preparing a report",
    "Inviting a teammate",
    "Setting up an integration",
    "I will write my own task"
  ],
  freeWritePreset: "I will write my own task",
  inputLabel: "Task to assess",
  placeholder: "Example: a new user creating their first project",
  helper: "Keep it short and generic; do not include a customer or company name.",
  counterTemplate: "{count}/80",
  errorTooShort: "To continue, write a task of at least 3 characters.",
  errorTooLong: "A task can be at most 80 characters."
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
  valueFit: "Use case fit",
  systemReadiness: "Technical readiness",
  controlSafety: "Control and safety",
  discoveryResilience: "Discoverability"
});

/** Public band labels, keyed by the band ids in ./scoring.js. */
export const BAND_LABELS = deepFreeze({
  weak: "Weak",
  partial: "Partial",
  strong: "Strong"
});

/**
 * Archetype copy, keyed by the archetype ids in ./scoring.js.
 *
 * The A5 summary already carries the "This result is not approval to ship to production."
 * sentence that SCORING.md requires appended to every A5 body, so the renderer appends nothing.
 */
export const ARCHETYPE_CONTENT = deepFreeze({
  problem_seeking_genui: {
    title: "FIND THE RIGHT TASK FIRST",
    summary: "The Generative UI idea is there, but it is not yet clear which user task it would measurably improve.",
    experiment: "Pick one task. Run five user interviews to confirm that the steps new and experienced users need are genuinely different."
  },
  idea_ready_ground_not: {
    title: "USE CASE CLEAR, FOUNDATION NOT YET",
    summary: "You can see a real use case for Generative UI. But the component system, the context signals or the safe fallback layer is not yet enough for a pilot.",
    experiment: "Pick one task with no critical actions. Build a prototype that runs on existing components and can fall back to the standard screen."
  },
  composition_ready_catalog_blind: {
    title: "UI READY, NO FEATURE CATALOG",
    summary: "The technical ground for assembling a screen dynamically is strong. The system does not know every feature independently of the menu, though, so work the user cannot see may as well not exist.",
    experiment: "Build a searchable feature catalog for one product area, independent of the menu, then test whether a hidden feature can be found again."
  },
  pilot_ground_discovery_partial: {
    title: "PILOT POSSIBLE, DISCOVERY THIN",
    summary: "A narrow Generative UI pilot is possible. Feature discovery, or at least one of the other readiness areas, is still incomplete, so the pilot should not overshadow your permanent navigation.",
    experiment: "Adapt a single task. In the same pilot, measure task success, returns to the standard screen, and whether hidden features get found."
  },
  controlled_trial_ground: {
    title: "READY FOR A CONTROLLED PILOT",
    summary: "Based on your answers, you have the foundation for a Generative UI pilot that is limited to one task, measurable and reversible. This result is not approval to ship to production.",
    experiment: "Pick one task and one user segment. Limit permissions, keep the standard screen in place, and run the pilot behind a feature flag."
  }
});

/**
 * Strength copy. `fallback` replaces the strength module when the highest answer is 0,
 * which the result object signals with `strengthIsFallback`.
 */
export const STRENGTH_COPY = deepFreeze({
  q1: "You have defined a user task that genuinely differs from user to user, which is what Generative UI needs.",
  q2: "The task you picked has a real impact on activation, retention or revenue.",
  q3: "Your component system is in a state where a screen can be reassembled safely.",
  q4: "You have reliable, permitted context signals for choosing the right screen.",
  q5: "Users can understand a generated screen, change it, and get back to the standard screen.",
  q6: "Critical actions are protected by permissions, a preview and an audit log.",
  q7: "Your feature catalog is independent of the main menu and readable by a system.",
  q8: "Users can find features again even when Generative UI does not surface them.",
  fallback: "Your first job on Generative UI readiness is clear: define the underlying use case and the safety limits before you pick a pilot."
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
  q1: "Pin the pilot to a single user task, and verify by measurement that the screen it needs really does change when role or product state changes.",
  q2: "Tie the pilot to one measurable outcome connected to activation, retention or revenue, and track that outcome for the length of the pilot.",
  q3: "During the pilot, pin down the inputs, states, permissions and error behavior of every component in scope, in a form the system can read.",
  q4: "Restrict the context signals the pilot may use to a list that is current, permitted and traceable to a source, and hold that limit for the whole pilot.",
  q5: "Make sure the pilot explains why a screen was shown, and that the user can edit it, reset it or return to the standard flow.",
  q6: "Keep critical actions in the pilot behind a permission check, a clear summary, a confirmation and an audit log.",
  q7: "Keep the feature catalog current, searchable and independent of the menu through the pilot, with the owner, target user, permission and prerequisite for each entry.",
  q8: "Through the pilot, keep features findable when they are off screen, with a searchable product hub, contextual pointers and a way back to recently used items."
});

/**
 * The handful of public strings the renderer produces at runtime. Everything else is
 * authored directly in index.html, so each string still exists exactly once.
 * Share and card copy is added in Phase 3.
 */
export const UI_COPY = deepFreeze({
  progress: "Question {current} / 8",
  next: "Continue",
  finish: "Show my result",
  unansweredError: "To continue, pick the option that is true for your product today.",
  resultError: "The result could not be calculated. Check your answers and try again.",
  begin: "Start the questions",
  taskLabel: "Assessed task",
  pilotScope: "Limit your first pilot to a reversible part of \u201C{task}\u201D that carries no critical actions.",
  cardPreparing: "Preparing your result card…",
  shareLinkedIn: "Share on LinkedIn",
  shareNative: "Open the share sheet",
  // Both surfaces that carry an editable draft read these two. They are keys rather than
  // inline literals in each surface for the reason Phase 13 established: a string authored in
  // COPY-TR.md and duplicated as a literal sits outside the parity test and drifts unnoticed.
  // The hand-off window is built from JS, so a literal there would be exactly that shape again.
  draftIntro: "Edit the text below however you like. Whatever is in the box when you share is what gets used.",
  draftLabel: "LinkedIn post text",
  // Read only on the fallback surface now. The desktop happy path no longer passes through
  // this dialog, so a note describing what happens next on that path would be read by nobody.
  shareNoteDesktop: "This window is used when a new tab could not be opened. Your post text is in the box above.",
  shareNoteNative: "The text and the result card go to the share sheet together. Once you pick LinkedIn you can edit the post or publish it as it is.",
  shareOpened: "A new tab opened. Follow the steps there.",
  handoffHeading: "Add the result card to your post",
  handoffInstruction: "Right-click the card, choose \u201CCopy image\u201D, then paste it into your LinkedIn post.",
  handoffDownloadNote: "You can also download the card and attach it to your post.",
  handoffDownloadAction: "Download the card",
  // The two states the window can be in before, or instead of, showing a card. Neither names
  // another tab: closing that split is what this phase is for. Neither is rendered beside an
  // instruction to act on a card, because in both of them there is no card to act on.
  handoffPreparing: "Your result card is being prepared. You can start editing your post text now.",
  handoffFailed: "Your result card could not be prepared. You can still share your post text from here.",
  handoffAction: "Go to LinkedIn",
  handoffCardAlt: "Your result card",
  colophon: "A Soft Commitment x UserGuiding collaboration.",
  popupBlocked: "The browser blocked the new tab. Your text is still here, and you can open LinkedIn with the button below.",
  popupBlockedAction: "Open LinkedIn",
  shareCancelled: "Sharing was cancelled. Your text is still here, and you can try again when you are ready.",
  cardError: "The result card could not be prepared. You can take a screenshot of the result screen and add it to your post.",
  shareFailure: "The share sheet could not be opened. Your text is not lost, so you can try again or take a screenshot of the result screen."
});

/**
 * Share-card strings. Every value is derived from COPY-TR.md: the lockup halves and
 * the URL lines are splits of the published attribution and canonical URL, and the
 * next-step label is the published Experiment heading, upper-cased at draw time.
 * No card string is authored here.
 */
export const CARD_COPY = deepFreeze({
  eyebrow: "GENERATIVE UI CHECK-UP",
  lockupLeft: "Soft Commitment",
  lockupRight: "UserGuiding",
  nextLabelSource: "Suggested first Generative UI pilot",
  footerStrong: "Generative UI readiness summary.",
  footerNote: "An 8-question self-assessment.",
  footerUrlTop: "games.userguiding.com/",
  footerUrlBottom: "generative-ui-checkup/en/"
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
  title: "My Generative UI Check-up result",
  text: "My Generative UI Check-up result: {archetype}\n\nThe Check-up is here: {url}\n\nThe task I assessed: {task}\n\nWhere I'm already strong:\n{strength}\n\nMy first pilot step:\n{experiment}\n\nHow ready do you think your product is for Generative UI?",
  taskLine: "The task I assessed: {task}",
  url: "https://games.userguiding.com/generative-ui-checkup/en/?utm_source=generative_ui_checkup"
});

export const PARTNER_COPY = deepFreeze({
  heading: "Made by",
  softCommitment: "An independent newsletter on AI, startups and the new economy, published every two weeks.",
  userGuiding: "A product adoption platform that lets product teams build onboarding and in-app experiences without writing code."
});
