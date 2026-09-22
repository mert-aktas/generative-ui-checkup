/**
 * Generative UI Check-up: defensive analytics adapter.
 *
 * One entry point, `track(eventName, parameters)`. Everything it forwards is checked
 * against the allowlist and per-event schemas in ../../ANALYTICS.md first: unknown event
 * names are dropped, unknown parameters are dropped, and out-of-range values are dropped.
 *
 * What never leaves the browser: answer *labels*, the 0-6 profile scores, an exact duration,
 * any company or identity field, and any query parameter that is not an allowlisted,
 * well-formed UTM.
 *
 * What does, as of Phase 17 and decision D-011: the selected option index on `guc_answer`,
 * and the user's task as free text on `guc_start`, bounded for transport by `boundTaskText`
 * below. The header used to list "raw answer values" and free text among the things that
 * never leave; both are now sent by decision, and the list above is the part that did not
 * change. The contract widened by exactly two parameters and must not be read as open.
 *
 * The adapter cannot break the experience. Every public call is wrapped so a missing,
 * blocked or throwing tracker is swallowed. Nothing is queued for retry: an event that
 * cannot be sent right now is simply dropped.
 *
 * `enabled` is true and GA4 is live. `deliver()` still requires `window.gtag` to be a
 * function, which `ga4-bootstrap.js` supplies; without that file this adapter validates
 * everything and sends nothing, which is the state it shipped in through Phase 16.
 */

/**
 * Launch configuration.
 *
 * **GA4 is active as of Phase 17**, ruled by Mert on 2026-09-15 and recorded in `D-011`:
 * launch week happens once, and an unmeasured launch cannot be recovered afterwards. The
 * destination is property `343135392` / `G-EP331KDLPN`. `games.userguiding.com` is already
 * in that property and `/generative-ui-checkup/` is a distinct path, so isolating this
 * check-up's data needed no configuration.
 *
 * `ga4MeasurementId` is now the single source of truth for the identifier: `ga4-bootstrap.js`
 * reads it to build the tag URL, so there is no second copy in index.html to fall out of step.
 *
 * **`linkedInPartnerId` stays empty, and that is deliberate rather than pending.** The
 * LinkedIn pixel is out of scope for this phase; `snap.licdn.com` is absent from the CSP for
 * the same reason. The empty value is what keeps `stage()` inert now that `enabled` is true —
 * see the two guards at the bottom of this file, which this phase makes load-bearing for the
 * first time. D-004 removed the identifier; nothing here restores it.
 */
export const ANALYTICS_CONFIG = {
  ga4MeasurementId: 'G-EP331KDLPN',
  linkedInPartnerId: '',
  enabled: true,
  debug: false
};

/** No confirmed LinkedIn conversion ids at MVP launch. */
export const LI_CONVERSIONS = {};

/* ------------------------------------------------------------------ vocabulary */

const ARCHETYPES = Object.freeze([
  'problem_seeking_genui',
  'idea_ready_ground_not',
  'composition_ready_catalog_blind',
  'pilot_ground_discovery_partial',
  'controlled_trial_ground'
]);

const BANDS = Object.freeze(['weak', 'partial', 'strong']);
const QUESTION_IDS = Object.freeze(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
const GAME = 'generative_ui_checkup';

export const UTM_KEYS = Object.freeze([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term'
]);

/** Conservative UTM shape. Anything else is rejected rather than forwarded. */
const UTM_PATTERN = /^[\w.\-~+% ]{1,100}$/;
const UTM_MAX = 100;

/** LinkedIn funnel stages. These are the only values ever written to the address bar. */
export const STAGES = Object.freeze({
  start: 'gucstart',
  done: 'gucdone',
  share: 'gucshare',
  cta: 'guccta'
});

/* ------------------------------------------------- free-text transport bound */

/**
 * GA4 documents its parameter-value cap as "100 characters" and does not name the unit. A
 * value over that cap is truncated silently, which is exactly the WOE2 defect: `utm_campaign`
 * was sheared off a `link_url` and the data looked complete while it was not.
 *
 * The product's 80-character task limit is not this bound and never was. Three different
 * units were being compared as one:
 *
 *   - `taskLength()` counts visible Unicode code points, excluding variation selectors.
 *     That is the right unit for the on-screen counter and the O-002 ruling, and the wrong
 *     one for a wire budget.
 *   - `maxlength="200"` counts UTF-16 code units.
 *   - GA4 counts something it declines to specify.
 *
 * Measured: a task that passes `isValidTask` reaches 200 UTF-16 units and 440 UTF-8 bytes.
 * Eighty astral emoji are 80 by `taskLength`, 160 units and 320 bytes. Eighty ordinary
 * Turkish characters are already 160 bytes.
 *
 * So the transport carries its own bound, enforced here where the event is built rather
 * than at the input where a different question is being answered. Raising or lowering the
 * input limit would not fix this and is not the remedy: the 80 is a product decision about
 * what a good task looks like, and this is a transport constraint that happens to collide
 * with it. Both plausible units are bounded, because picking one is a bet on undocumented
 * behaviour and bounding both is not.
 *
 * The prefix is taken on code-point boundaries. `slice(0, 100)` on an emoji string cuts a
 * surrogate pair in half and leaves a lone surrogate, which is not valid UTF-8; that mangles
 * a value rather than shortening it.
 */
export const TASK_TEXT_MAX_UTF16 = 100;
export const TASK_TEXT_MAX_BYTES = 100;

/** The two ways a task can arrive. Compared against the presets, so it needs no state. */
export const TASK_SOURCES = Object.freeze(['preset', 'custom']);

/** UTF-8 cost of a single code point, without allocating an encoder per character. */
function utf8Cost(codePoint) {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

/**
 * The longest code-point-boundary prefix of `value` that is within both bounds.
 *
 * Returns the truncation outcome rather than just the text, so the caller can report it.
 * A silent truncation is the defect; a declared one is data.
 *
 * @param {string} value
 * @returns {{text: string, truncated: boolean}}
 */
export function boundTaskText(value) {
  if (typeof value !== 'string') return { text: '', truncated: false };

  let units = 0;
  let bytes = 0;
  let end = 0;

  // for..of over a string iterates code points, so `end` never lands inside a pair.
  for (const character of value) {
    const nextUnits = units + character.length;
    const nextBytes = bytes + utf8Cost(character.codePointAt(0));
    if (nextUnits > TASK_TEXT_MAX_UTF16 || nextBytes > TASK_TEXT_MAX_BYTES) {
      return { text: value.slice(0, end), truncated: true };
    }
    units = nextUnits;
    bytes = nextBytes;
    end += character.length;
  }

  return { text: value, truncated: false };
}

/* --------------------------------------------------------------- value checks */

const oneOf = (values) => (value) => values.includes(value);
const intBetween = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;

const isArchetype = oneOf(ARCHETYPES);
const isBand = oneOf(BANDS);

/**
 * The one free-text parameter in the product.
 *
 * This only decides whether the value is the right *kind* of thing; the length question is
 * settled by `boundTaskText` in `sanitize`, after validation, because a long task should be
 * shortened and flagged rather than dropped entirely.
 */
const isTaskText = (value) => typeof value === 'string' && value.length > 0;

/**
 * Allowlisted events and their exact parameter schemas.
 *
 * `utm` marks the one event that may additionally carry allowlisted campaign parameters.
 * Every other parameter name is dropped, whatever it contains.
 */
const SCHEMA = Object.freeze({
  game_start: { params: { game: oneOf([GAME]) }, utm: true },
  guc_start: {
    params: {
      variant: oneOf(['pt-br']),
      task_source: oneOf(TASK_SOURCES),
      task_text: isTaskText
    },
    // Names the free-text parameter so `sanitize` bounds it for transport and reports the
    // outcome. Declared here rather than done by the caller: the adapter's guarantee is that
    // nothing reaches a payload without passing through this file.
    freeText: 'task_text'
  },
  guc_question_view: { params: { question_id: oneOf(QUESTION_IDS), position: intBetween(1, 8) } },
  // The option index is the answer value, so the range is the four options of every question.
  guc_answer: { params: { question_id: oneOf(QUESTION_IDS), answer_value: intBetween(0, 3) } },
  game_complete: {
    params: {
      game: oneOf([GAME]),
      archetype: isArchetype,
      // Coarse band only. An exact duration is never sent.
      completion_time_band: oneOf(['under_60', '60_90', '91_120', 'over_120'])
    },
    once: true
  },
  guc_result_view: {
    params: {
      archetype: isArchetype,
      value_fit_band: isBand,
      system_readiness_band: isBand,
      control_safety_band: isBand,
      discovery_resilience_band: isBand,
      weak_profile_count: intBetween(0, 4)
    },
    once: true
  },
  guc_methodology_open: { params: { source: oneOf(['landing', 'result']) } },
  share_click: { params: { game: oneOf([GAME]), method: oneOf(['native', 'linkedin']) } },
  guc_share_success: { params: { method: oneOf(['native', 'linkedin']), archetype: isArchetype } },
  guc_share_cancel: { params: { archetype: isArchetype } },
  cta_click: { params: { destination: oneOf(['soft_commitment', 'userguiding']), archetype: isArchetype } },
  guc_restart: { params: { archetype: isArchetype } },
  guc_error: { params: { area: oneOf(['scoring', 'card', 'clipboard', 'share']) } }
});

export const EVENT_NAMES = Object.freeze(Object.keys(SCHEMA));

/* ----------------------------------------------------------------- utm intake */

/**
 * Read allowlisted campaign parameters off the current URL.
 *
 * Unknown keys are ignored entirely. Values are trimmed to 100 characters and must match
 * the conservative pattern; anything else is dropped rather than forwarded.
 *
 * @param {string} [search] query string, defaults to the live one
 * @returns {Record<string, string>}
 */
export function readCampaignParams(search) {
  const out = {};
  try {
    const query = typeof search === 'string'
      ? search
      : (typeof location === 'undefined' ? '' : location.search);
    const params = new URLSearchParams(query);
    for (const key of UTM_KEYS) {
      if (!params.has(key)) continue;
      const value = String(params.get(key)).slice(0, UTM_MAX);
      if (UTM_PATTERN.test(value)) out[key] = value;
    }
  } catch {
    return {};
  }
  return out;
}

/* ------------------------------------------------------------------ sanitising */

/**
 * Reduce a caller's parameters to exactly what the event's schema allows.
 * Returns null when the event name itself is not allowlisted.
 */
export function sanitize(eventName, parameters = {}) {
  const schema = SCHEMA[eventName];
  if (!schema) return null;

  const clean = {};
  const source = parameters && typeof parameters === 'object' && !Array.isArray(parameters)
    ? parameters
    : {};

  for (const [key, accept] of Object.entries(schema.params)) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];
    if (accept(value)) clean[key] = value;
  }

  if (schema.freeText && typeof clean[schema.freeText] === 'string') {
    const { text, truncated } = boundTaskText(clean[schema.freeText]);
    clean[schema.freeText] = text;
    // Emitted with the text every time, not only when the bound bit. In BigQuery an absent
    // parameter cannot be told apart from a false one, and the point of the flag is that a
    // shortened value is never read as a complete one.
    clean.task_truncated = truncated;
  }

  if (schema.utm) {
    for (const [key, value] of Object.entries(readCampaignParams())) clean[key] = value;
  }

  return clean;
}

/* --------------------------------------------------------------------- sending */

const sent = new Set();
const debugLog = [];

function deliver(eventName, parameters) {
  if (!ANALYTICS_CONFIG.enabled) return;
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return; // blocked or not loaded: drop, never queue
  window.gtag('event', eventName, parameters);
}

/**
 * The single measurement entry point.
 *
 * Never throws. Returns the sanitized payload that was accepted, or null when the event
 * was dropped, which makes the adapter directly testable.
 *
 * @param {string} eventName
 * @param {object} [parameters]
 * @returns {object|null}
 */
export function track(eventName, parameters) {
  try {
    const clean = sanitize(eventName, parameters);
    if (clean === null) return null;

    const schema = SCHEMA[eventName];
    if (schema.once) {
      if (sent.has(eventName)) return null;
      sent.add(eventName);
    }

    if (ANALYTICS_CONFIG.debug) {
      debugLog.push({ event: eventName, params: clean });
      // Sanitized only, and local only. Nothing is transmitted in debug mode.
      if (typeof console !== 'undefined' && typeof console.info === 'function') {
        console.info('[checkup analytics]', eventName, clean);
      }
      return clean;
    }

    deliver(eventName, clean);
    return clean;
  } catch {
    return null; // measurement never interrupts the experience
  }
}

/** Allow a once-per-run event to fire again after a restart. */
export function resetOnceGuards() {
  sent.clear();
}

/** Sanitized debug record. Empty unless debug mode is on. */
export function debugEvents() {
  return debugLog.slice();
}

/* ------------------------------------------------------- completion time band */

let startedAt = null;

/** Mark the beginning of a run. Kept in memory; never sent. */
export function markStart(now) {
  startedAt = typeof now === 'number' ? now : Date.now();
}

/**
 * Coarse completion band. An exact millisecond duration is never produced.
 * @returns {string|null}
 */
export function completionBand(now) {
  if (startedAt === null) return null;
  const seconds = ((typeof now === 'number' ? now : Date.now()) - startedAt) / 1000;
  if (seconds < 60) return 'under_60';
  if (seconds <= 90) return '60_90';
  if (seconds <= 120) return '91_120';
  return 'over_120';
}

/* ------------------------------------------------------- linkedin stage urls */

/**
 * Reflect a funnel stage in the address bar for the LinkedIn Insight Tag.
 *
 * Uses replaceState only, so the eight questions never become eight history entries.
 * Allowlisted UTMs are preserved and everything else is dropped, which also means an
 * unknown parameter someone appended cannot survive into a later request. Answers,
 * scores, bands, archetype and identity are never written here.
 *
 * The share module builds its own allowlisted campaign URL, so a staged address can never
 * become the post link.
 */
/**
 * Strip stale analytics state from the address bar on boot.
 *
 * A reload of `?s=gucdone` would otherwise land on the landing screen while the URL still
 * claims the run finished. This rebuilds the query from allowlisted, well-formed UTMs and
 * nothing else, so stage tokens and unknown parameters both disappear.
 *
 * It uses replaceState, so no history entry is created, and it only reads the URL: nothing
 * here infers or restores answers, scores or a result from it. A URL that already carries
 * only valid UTMs is left untouched.
 *
 * This runs whether or not analytics is enabled. It is address-bar hygiene, not tracking.
 *
 * @returns {string|null} the rewritten URL, or null when nothing needed changing
 */
export function normalizeStageUrl() {
  try {
    if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return null;

    const current = [...new URLSearchParams(location.search).entries()];
    if (current.length === 0) return null;

    const campaign = readCampaignParams();
    const alreadyClean = current.length === Object.keys(campaign).length
      && current.every(([key, value]) => campaign[key] === value);
    if (alreadyClean) return null;

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(campaign)) params.set(key, value);

    const query = params.toString();
    const next = `${location.pathname}${query ? `?${query}` : ''}${location.hash}`;
    window.history.replaceState(null, '', next);
    return next;
  } catch {
    return null;
  }
}

export function stage(stageName) {
  try {
    // The partner ID is empty since the identifiers were removed (D-004), and that alone is
    // what keeps the LinkedIn stage inert. The `enabled` guard below is no longer the reason:
    // Phase 17 set `enabled` to true, so the second guard is now the only one doing the work —
    // which is exactly the case D-004 said it had to cover, and now does.
    if (!ANALYTICS_CONFIG.enabled) return null;
    if (!ANALYTICS_CONFIG.linkedInPartnerId) return null;
    if (typeof window === 'undefined' || !window.history || !window.history.replaceState) return null;

    const value = STAGES[stageName];
    if (!value) return null;

    const params = new URLSearchParams();
    params.set('s', value);
    for (const [key, campaign] of Object.entries(readCampaignParams())) params.set(key, campaign);

    const next = `${location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', next);

    if (typeof window.lintrk === 'function') window.lintrk('track', {});
    return next;
  } catch {
    return null;
  }
}
