/**
 * Generative UI Check-up: defensive analytics adapter.
 *
 * One entry point, `track(eventName, parameters)`. Everything it forwards is checked
 * against the allowlist and per-event schemas in ../../ANALYTICS.md first: unknown event
 * names are dropped, unknown parameters are dropped, and out-of-range values are dropped.
 *
 * What never leaves the browser: raw answer values, answer labels, the 0-6 profile scores,
 * an exact duration, any company or identity field, and any query parameter that is not an
 * allowlisted, well-formed UTM.
 *
 * The adapter cannot break the experience. Every public call is wrapped so a missing,
 * blocked or throwing tracker is swallowed. Nothing is queued for retry: an event that
 * cannot be sent right now is simply dropped.
 *
 * `enabled` is false until Mert confirms that this campaign belongs in the existing GA4
 * and LinkedIn properties. Until then the adapter validates and, in debug mode, reports
 * sanitized events locally, and sends nothing anywhere.
 */

/**
 * Launch configuration. The identifiers are the ones ../../ANALYTICS.md records for the
 * existing games; they are kept here as configuration rather than scattered through the
 * application, and they stay inert while `enabled` is false.
 */
export const ANALYTICS_CONFIG = {
  ga4MeasurementId: 'G-EP331KDLPN',
  linkedInPartnerId: '2295498',
  enabled: false,
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

/* --------------------------------------------------------------- value checks */

const oneOf = (values) => (value) => values.includes(value);
const intBetween = (min, max) => (value) => Number.isInteger(value) && value >= min && value <= max;

const isArchetype = oneOf(ARCHETYPES);
const isBand = oneOf(BANDS);

/**
 * Allowlisted events and their exact parameter schemas.
 *
 * `utm` marks the one event that may additionally carry allowlisted campaign parameters.
 * Every other parameter name is dropped, whatever it contains.
 */
const SCHEMA = Object.freeze({
  game_start: { params: { game: oneOf([GAME]) }, utm: true },
  guc_start: { params: { variant: oneOf(['tr']) } },
  guc_question_view: { params: { question_id: oneOf(QUESTION_IDS), position: intBetween(1, 8) } },
  guc_answer: { params: { question_id: oneOf(QUESTION_IDS) } },
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
  guc_card_download: { params: { archetype: isArchetype } },
  share_click: { params: { game: oneOf([GAME]), method: oneOf(['native', 'desktop']) } },
  guc_share_success: { params: { method: oneOf(['native', 'desktop']), archetype: isArchetype } },
  guc_share_cancel: { params: { archetype: isArchetype } },
  cta_click: { params: { destination: oneOf(['soft_commitment', 'userguiding']), archetype: isArchetype } },
  guc_restart: { params: { archetype: isArchetype } },
  guc_error: { params: { area: oneOf(['scoring', 'card', 'clipboard']) } }
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
