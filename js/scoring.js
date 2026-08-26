/**
 * Generative UI Check-up: scoring engine.
 *
 * Pure, dependency-free, deterministic. No imports, no DOM, no network, no storage.
 * Everything here is specified in ../../SCORING.md; this module is the single
 * authority for the maths and the questionId -> profile mapping. Display strings live
 * in ./questions.js and are never computed here.
 *
 * There is deliberately no aggregate score and no percentage anywhere in this file.
 */

/* --------------------------------------------------------------- constants */

/** The eight answer keys, in the order the questions are asked. */
export const QUESTION_IDS = Object.freeze(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);

/** Every answer is an integer in this inclusive range. */
export const ANSWER_MIN = 0;
export const ANSWER_MAX = 3;

/** Each profile is the sum of its two questions, so it spans 0..6. */
export const PROFILE_MIN = 0;
export const PROFILE_MAX = 6;

/**
 * The four independent profiles. `symbol` matches the F/S/C/D notation used in
 * SCORING.md. The editorial 25% weights in that document describe equal prominence,
 * not arithmetic: profiles are plain sums and are never combined.
 */
export const PROFILE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: 'valueFit', symbol: 'F', questionIds: Object.freeze(['q1', 'q2']) }),
  Object.freeze({ id: 'systemReadiness', symbol: 'S', questionIds: Object.freeze(['q3', 'q4']) }),
  Object.freeze({ id: 'controlSafety', symbol: 'C', questionIds: Object.freeze(['q5', 'q6']) }),
  Object.freeze({ id: 'discoveryResilience', symbol: 'D', questionIds: Object.freeze(['q7', 'q8']) })
]);

/** Profile band thresholds: 0-2 weak, 3-4 partial, 5-6 strong. */
export const BAND_IDS = Object.freeze(['weak', 'partial', 'strong']);

/* ------------------------------------------------------------------ errors */

/**
 * Typed error for every rejected input. Carries a stable `code` and, for value
 * failures, the offending `questionId`. Messages never echo caller-supplied content.
 */
export class ScoringError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ScoringError';
    this.code = code;
    if (details.questionId !== undefined) this.questionId = details.questionId;
  }
}

/* -------------------------------------------------------------- validation */

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Validate an answers object and return a frozen snapshot of it.
 *
 * Throws ScoringError unless the input is a plain object owning exactly q1..q8,
 * each an integer in 0..3. Values are read once, so a getter cannot change an
 * answer between validation and scoring. Nothing is coerced.
 *
 * @param {unknown} answers
 * @returns {Readonly<Record<string, number>>}
 */
export function validateAnswers(answers) {
  if (!isPlainObject(answers)) {
    throw new ScoringError('invalid_input_type', 'Answers must be a plain object.');
  }

  const ownKeys = Reflect.ownKeys(answers);
  if (ownKeys.length !== QUESTION_IDS.length) {
    throw new ScoringError(
      'invalid_answer_keys',
      `Answers must contain exactly the ${QUESTION_IDS.length} keys q1..q8.`
    );
  }
  for (const questionId of QUESTION_IDS) {
    if (!Object.prototype.hasOwnProperty.call(answers, questionId)) {
      throw new ScoringError('invalid_answer_keys', `Answers are missing own key ${questionId}.`);
    }
  }

  const snapshot = {};
  for (const questionId of QUESTION_IDS) {
    const value = answers[questionId];
    if (!Number.isInteger(value) || value < ANSWER_MIN || value > ANSWER_MAX) {
      throw new ScoringError(
        'invalid_answer_value',
        `Answer ${questionId} must be an integer between ${ANSWER_MIN} and ${ANSWER_MAX}.`,
        { questionId }
      );
    }
    snapshot[questionId] = value;
  }

  return Object.freeze(snapshot);
}

/* ------------------------------------------------------------------ bands */

/**
 * Map a 0..6 profile score to its band. Boundaries are 2|3 and 4|5.
 * @param {number} score
 * @returns {'weak' | 'partial' | 'strong'}
 */
export function getBand(score) {
  if (!Number.isInteger(score) || score < PROFILE_MIN || score > PROFILE_MAX) {
    throw new ScoringError('invalid_profile_score', 'Profile score must be an integer between 0 and 6.');
  }
  if (score <= 2) return 'weak';
  if (score <= 4) return 'partial';
  return 'strong';
}

/* --------------------------------------------------------------- profiles */

function buildProfiles(answers) {
  const profiles = {};
  for (const definition of PROFILE_DEFINITIONS) {
    const score = definition.questionIds.reduce((total, questionId) => total + answers[questionId], 0);
    profiles[definition.id] = { score, band: getBand(score) };
  }
  return profiles;
}

/* -------------------------------------------------------------- archetypes */

/** The five archetype ids, in A1..A5 naming order. */
export const ARCHETYPE_IDS = Object.freeze([
  'problem_seeking_genui',
  'idea_ready_ground_not',
  'composition_ready_catalog_blind',
  'pilot_ground_discovery_partial',
  'controlled_trial_ground'
]);

/**
 * Assign one archetype from the four profile totals.
 *
 * The rules are non-compensatory and are transcribed verbatim from SCORING.md, including
 * the evaluation order, which differs from the A1..A5 naming order. `F >= 3` is implicit
 * after the first return.
 *
 * Only the A1 and A2 gates are genuinely order-sensitive. The A5 and A3 tests are disjoint
 * (A3 needs `D <= 2`, A5 needs `D >= 5`), so SCORING.md's "unless A5 already matched" note
 * on A3 is a safety belt rather than a live condition. The published order is kept anyway,
 * so this function reads identically to the spec.
 *
 * @param {{F: number, S: number, C: number, D: number}} totals
 * @returns {string} one of ARCHETYPE_IDS
 */
export function getArchetype({ F, S, C, D }) {
  if (F <= 2) return 'problem_seeking_genui';              // A1
  if (S <= 2 || C <= 2) return 'idea_ready_ground_not';    // A2
  if (S >= 5 && C >= 5 && D >= 5) return 'controlled_trial_ground'; // A5
  if (D <= 2) return 'composition_ready_catalog_blind';    // A3
  return 'pilot_ground_discovery_partial';                 // A4
}

/** Reduce the profile map to the F/S/C/D shape getArchetype expects. */
function profileTotals(profiles) {
  const totals = {};
  for (const definition of PROFILE_DEFINITIONS) {
    totals[definition.symbol] = profiles[definition.id].score;
  }
  return totals;
}

/* ------------------------------------------------- strength and gap selection */

/**
 * Tie order for the strongest question. Ties go to the later, harder-won capabilities
 * first, so discovery and safety answers are credited ahead of intent framing.
 */
export const STRENGTH_TIE_ORDER = Object.freeze(['q8', 'q6', 'q5', 'q7', 'q4', 'q3', 'q2', 'q1']);

/**
 * Tie order for gaps, by risk. Critical-action safety and user control surface before
 * lower-risk optimisation gaps.
 */
export const GAP_RISK_ORDER = Object.freeze(['q6', 'q5', 'q8', 'q7', 'q4', 'q3', 'q2', 'q1']);

/**
 * Pick the highest-scoring question. Walking STRENGTH_TIE_ORDER and improving only on a
 * strictly greater value means the earliest question in that order wins any tie.
 *
 * `isFallback` is true only when the selected value is 0, which can happen only when
 * every answer is 0. The renderer swaps in the no-strength copy; this module never
 * chooses a display string.
 *
 * @param {unknown} answers
 * @returns {{questionId: string, value: number, isFallback: boolean}}
 */
export function selectStrength(answers) {
  const validated = validateAnswers(answers);
  let selected = null;
  for (const questionId of STRENGTH_TIE_ORDER) {
    const value = validated[questionId];
    if (selected === null || value > selected.value) selected = { questionId, value };
  }
  return { questionId: selected.questionId, value: selected.value, isFallback: selected.value === 0 };
}

/**
 * Pick the two lowest-scoring questions. The returned pair is ordered by ascending answer
 * value first, and equal values are broken by GAP_RISK_ORDER, so the riskier gap leads.
 * That is the order the result screen numbers them in. The explicit risk index means the
 * outcome does not depend on sort stability.
 *
 * @param {unknown} answers
 * @returns {string[]} exactly two distinct question ids, lowest value first, ties by risk
 */
export function selectGaps(answers) {
  const validated = validateAnswers(answers);
  const ranked = GAP_RISK_ORDER.map((questionId, riskIndex) => ({
    questionId,
    value: validated[questionId],
    riskIndex
  })).sort((left, right) => left.value - right.value || left.riskIndex - right.riskIndex);

  return [ranked[0].questionId, ranked[1].questionId];
}

/* ------------------------------------------------------------------ result */

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * Score a complete answer set.
 *
 * @param {unknown} answers plain object owning exactly q1..q8, values 0..3
 * @returns {object} frozen result object; see the contract in SCORING.md
 * @throws {ScoringError}
 */
export function scoreAnswers(answers) {
  // selectStrength and selectGaps validate again on the frozen snapshot. That is
  // deliberate: each is a supported entry point on its own, and revalidating a frozen
  // eight-key object costs nothing.
  const validated = validateAnswers(answers);
  const profiles = buildProfiles(validated);
  const strength = selectStrength(validated);

  return deepFreeze({
    profiles,
    archetype: getArchetype(profileTotals(profiles)),
    strengthQuestionId: strength.questionId,
    strengthIsFallback: strength.isFallback,
    gapQuestionIds: selectGaps(validated)
  });
}
