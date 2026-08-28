/**
 * Generative UI Check-up: 1080 x 1350 result card, download and sharing.
 *
 * The card is drawn with native Canvas from the same frozen result object the result
 * screen renders, and from the same content maps in ./questions.js. No display string is
 * computed twice and no answer value ever reaches this module.
 *
 * Drawing is two steps on purpose. `buildCardModel()` turns a result into a list of typed
 * draw operations with their text, box, font and colour; `paintCardModel()` puts that list
 * on a canvas. Tests read the model directly, so card content is verified against what is
 * actually drawn rather than against a second copy of the same arithmetic.
 *
 * Geometry is transcribed from the revised Codex export master at design/card-export.html,
 * read back through getBoundingClientRect. Codex owns the art direction; this file only
 * reproduces it.
 *
 * Nothing here contacts the network. Sharing uses a campaign URL with only the coarse
 * archetype id; answers, profile scores and identity are never serialised into it.
 */

import {
  PROFILE_NAMES,
  BAND_LABELS,
  ARCHETYPE_CONTENT,
  STRENGTH_COPY,
  CARD_COPY,
  SHARE_COPY
} from './questions.js';

import { ARCHETYPE_IDS, PROFILE_DEFINITIONS, PROFILE_MAX } from './scoring.js';

/** The only URL this application ever shares. It carries no state, ever. */
export const CANONICAL_URL = 'https://games.userguiding.com/generative-ui-checkup/';

/** LinkedIn composer. The post draft itself carries the tracked Check-up URL. */
export const LINKEDIN_COMPOSER_URL = 'https://www.linkedin.com/feed/?shareActive=true';

/** Deterministic, safe download name. */
export const CARD_FILENAME = 'generative-ui-checkup-sonucum.png';

/** A result-specific campaign URL that contains no answer, score or identity data. */
export function trackedShareUrl(result) {
  if (!ARCHETYPE_CONTENT[result.archetype]) throw new Error('unknown archetype');
  return SHARE_COPY.url.replace('{archetype_id}', result.archetype);
}

/** Editable LinkedIn draft built only from public result copy and a coarse archetype id. */
export function buildLinkedInDraft(result) {
  const archetype = ARCHETYPE_CONTENT[result.archetype];
  if (!archetype) throw new Error('unknown archetype');
  const strength = result.strengthIsFallback
    ? STRENGTH_COPY.fallback
    : STRENGTH_COPY[result.strengthQuestionId];
  return SHARE_COPY.text
    .replace('{archetype}', archetype.title)
    .replace('{strength}', strength)
    .replace('{experiment}', archetype.experiment)
    .replace('{url}', trackedShareUrl(result));
}

/* ------------------------------------------------------------------ geometry */

const CARD = { w: 1080, h: 1350 };

/** Locked safe area. Nothing is drawn outside it. */
export const SAFE_AREA = 72;

const CONTENT_W = CARD.w - SAFE_AREA * 2;
const RIGHT = SAFE_AREA + CONTENT_W;
const GRID = 39.96;

/**
 * Minimum type size per role, from DESIGN-SYSTEM.md.
 *
 * `micro` covers labels and the compact band/score pair; `body` covers result-bearing and
 * explanatory copy; `footer` covers the preparation note and canonical URL, which must stay
 * readable rather than becoming legal dust.
 */
export const TYPE_FLOORS = Object.freeze({ micro: 20, body: 32, footer: 28 });

export const ROLE_FLOOR = Object.freeze({
  lockup: 'micro',
  eyebrow: 'micro',
  index: 'micro',
  nextLabel: 'micro',
  profileMeta: 'micro',
  title: 'body',
  summary: 'body',
  profileName: 'body',
  nextText: 'body',
  footerStrong: 'footer',
  footerNote: 'footer',
  footerUrl: 'footer'
});

/*
 * The partnership lockup is the one place this file departs from the master's literal
 * value. The master leaves `.brand-lockup` at its 11px reference size, which renders at
 * roughly 4px in a 390px feed preview: the exact failure Gate 3 rejected. It is raised to
 * the 20px micro-label floor the design system states. Everything else is ported verbatim.
 */
const LOCKUP = { top: 77, line: 23, size: 20, tracking: 2.4, gap: 10, ruleW: 28 };
const EYEBROW = { top: 72, line: 23, size: 20, tracking: 1.8 };
const RULE = { y: 129.63, h: 7 };
const BODY_TOP = 178.73;

const INDEX = { size: 20, tracking: 2.4, padX: 13.1, padY: 7.49, line: 23 };
const TITLE = { weight: 700, size: 76, line: 70.68, tracking: -3.8, maxWidth: 767.52, gapAfter: 18.72 };
const SUMMARY = { size: 34, line: 45.9, maxWidth: 823.67, gapAfter: 20 };

const PANEL = {
  pad: 30,
  rowH: 64,
  rowGap: 18,
  nameLine: 38,
  nameSize: 32,
  metaSize: 30,
  railY: 46,
  railH: 18,
  cellGap: 5
};

const NEXT = {
  gapBefore: 18,
  padY: 22,
  padX: 30,
  labelSize: 20,
  labelLine: 23,
  labelTracking: 2.2,
  gap: 10,
  textSize: 32,
  textLine: 41.6
};

const FOOTER = { ruleY: 1188.33, lineOne: 1212, lineTwo: 1245, line: 33, size: 28 };

const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const COLOR = {
  paper: '#F4F0E7',
  paperHi: '#FFFCF5',
  ink: '#172033',
  inkSoft: '#596174',
  body: '#3E4659',
  blue: '#4169F0',
  blueDeep: '#2849B8',
  yellow: '#F2D85D',
  line: '#D6D0C3',
  cell: '#AEB5C2',
  grid: 'rgba(23, 32, 51, 0.04)'
};

/* -------------------------------------------------------------------- text */

function font(weight, size) {
  return `${weight} ${size}px ${FONT_STACK}`;
}

const hasNativeTracking = (ctx) => 'letterSpacing' in ctx;

function applyTracking(ctx, tracking) {
  if (hasNativeTracking(ctx)) ctx.letterSpacing = `${tracking || 0}px`;
}

/** Width of a run, measured with the same tracking it will be drawn with. */
function trackedWidth(ctx, text, tracking = 0) {
  if (!tracking || hasNativeTracking(ctx)) {
    applyTracking(ctx, tracking);
    const width = ctx.measureText(text).width;
    applyTracking(ctx, 0);
    return width;
  }
  return Array.from(text).reduce((total, glyph) => total + ctx.measureText(glyph).width + tracking, 0);
}

/** Greedy word wrap. Copy is never shortened to fit; the block grows instead. */
function wrap(ctx, text, maxWidth, tracking = 0) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && trackedWidth(ctx, candidate, tracking) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Narrowest measure that still uses the same number of lines. */
function wrapBalanced(ctx, text, maxWidth, tracking = 0) {
  const greedy = wrap(ctx, text, maxWidth, tracking);
  if (greedy.length < 2) return greedy;

  let low = 0;
  let high = maxWidth;
  let best = greedy;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    const candidate = wrap(ctx, text, middle, tracking);
    if (candidate.length <= greedy.length) {
      best = candidate;
      high = middle;
    } else {
      low = middle;
    }
  }
  return best;
}

/**
 * Line breaking for the archetype title.
 *
 * The published titles are written around a comma, and every Codex master breaks there:
 * the export authors a break after the comma and lets each phrase wrap on its own. That is
 * what this reproduces, which is also why the A3 title runs to three lines rather than two
 * even though a tighter fill exists. Titles without a comma fall back to a balanced wrap.
 * Copy is never altered.
 */
function wrapDisplay(ctx, text, maxWidth, tracking = 0) {
  const commaIndex = text.indexOf(',');
  if (commaIndex > 0 && commaIndex < text.length - 1) {
    const head = text.slice(0, commaIndex + 1);
    const tail = text.slice(commaIndex + 1).trim();
    if (tail) {
      return [
        ...wrapBalanced(ctx, head, maxWidth, tracking),
        ...wrapBalanced(ctx, tail, maxWidth, tracking)
      ];
    }
  }
  return wrapBalanced(ctx, text, maxWidth, tracking);
}

/**
 * Alphabetic baseline for a CSS line box, reproducing half-leading exactly:
 * baseline = boxTop + (lineHeight - (ascent + descent)) / 2 + ascent.
 */
function baselineIn(ctx, boxTop, lineHeight) {
  const metrics = ctx.measureText('Hg');
  return boxTop + (lineHeight - (metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent)) / 2
    + metrics.fontBoundingBoxAscent;
}

/* --------------------------------------------------------------- draw model */

function measuringContext() {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  return canvas.getContext('2d');
}

/**
 * Turn a result into the ordered list of draw operations that make the card.
 *
 * Every text operation records its role, its exact string, its box and its font, so a test
 * can assert on what the card says without redoing the layout. Text boxes also carry the
 * measured width, which is what the safe-area and overlap guards read.
 *
 * @param {object} result frozen result object from scoreAnswers()
 * @returns {{width:number,height:number,safeArea:number,ops:object[]}}
 */
export function buildCardModel(result) {
  const content = ARCHETYPE_CONTENT[result.archetype];
  if (!content) throw new Error('unknown archetype');

  const ctx = measuringContext();
  const ops = [];

  const rect = (x, y, w, h, fill) => ops.push({ kind: 'rect', x, y, w, h, fill });

  const text = (role, value, options) => {
    const { x, boxTop, lineHeight, size, weight, color, align = 'left', tracking = 0 } = options;
    ctx.font = font(weight, size);
    const width = trackedWidth(ctx, value, tracking);
    const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
    ops.push({
      kind: 'text',
      role,
      text: value,
      x,
      left,
      right: left + width,
      width,
      boxTop,
      bottom: boxTop + lineHeight,
      lineHeight,
      size,
      weight,
      color,
      align,
      tracking
    });
  };

  const block = (role, lines, options) => {
    lines.forEach((line, index) => {
      text(role, line, { ...options, boxTop: options.boxTop + options.lineHeight * index });
    });
  };

  ops.push({ kind: 'ground', fill: COLOR.paper });
  ops.push({ kind: 'grid', step: GRID, fill: COLOR.grid });

  /* header ------------------------------------------------------------- */
  const lockLeft = CARD_COPY.lockupLeft.toUpperCase();
  const lockRight = CARD_COPY.lockupRight.toUpperCase();
  const lockupOptions = {
    x: SAFE_AREA,
    boxTop: LOCKUP.top,
    lineHeight: LOCKUP.line,
    size: LOCKUP.size,
    weight: 800,
    color: COLOR.inkSoft,
    tracking: LOCKUP.tracking
  };
  text('lockup', lockLeft, lockupOptions);

  ctx.font = font(800, LOCKUP.size);
  const ruleX = SAFE_AREA + trackedWidth(ctx, lockLeft, LOCKUP.tracking) + LOCKUP.gap;
  rect(ruleX, LOCKUP.top + LOCKUP.line / 2 - 0.5, LOCKUP.ruleW, 1, COLOR.line);
  text('lockup', lockRight, { ...lockupOptions, x: ruleX + LOCKUP.ruleW + LOCKUP.gap });

  text('eyebrow', CARD_COPY.eyebrow, {
    x: RIGHT,
    boxTop: EYEBROW.top,
    lineHeight: EYEBROW.line,
    size: EYEBROW.size,
    weight: 700,
    color: COLOR.ink,
    align: 'right',
    tracking: EYEBROW.tracking
  });

  /* tri-colour rule ---------------------------------------------------- */
  const blueEnd = SAFE_AREA + CONTENT_W * 0.57;
  const yellowEnd = SAFE_AREA + CONTENT_W * 0.75;
  rect(SAFE_AREA, RULE.y, blueEnd - SAFE_AREA, RULE.h, COLOR.blue);
  rect(blueEnd, RULE.y, yellowEnd - blueEnd, RULE.h, COLOR.yellow);
  rect(yellowEnd, RULE.y, RIGHT - yellowEnd, RULE.h, COLOR.ink);

  /* archetype index ---------------------------------------------------- */
  const position = ARCHETYPE_IDS.indexOf(result.archetype) + 1;
  const indexLabel = `${String(position).padStart(2, '0')} / ${String(ARCHETYPE_IDS.length).padStart(2, '0')}`;
  ctx.font = font(900, INDEX.size);
  const indexW = trackedWidth(ctx, indexLabel, INDEX.tracking) + INDEX.padX * 2 + 2;
  const indexH = INDEX.line + INDEX.padY * 2 + 2;
  ops.push({
    kind: 'strokeRect',
    x: RIGHT - indexW,
    y: BODY_TOP,
    w: indexW,
    h: indexH,
    stroke: COLOR.ink
  });
  text('index', indexLabel, {
    x: RIGHT - indexW / 2,
    boxTop: BODY_TOP + INDEX.padY + 1,
    lineHeight: INDEX.line,
    size: INDEX.size,
    weight: 900,
    color: COLOR.ink,
    align: 'center',
    tracking: INDEX.tracking
  });

  /* title and summary --------------------------------------------------- */
  ctx.font = font(TITLE.weight, TITLE.size);
  const titleLines = wrapDisplay(ctx, content.title, TITLE.maxWidth, TITLE.tracking);
  block('title', titleLines, {
    x: SAFE_AREA,
    boxTop: BODY_TOP,
    lineHeight: TITLE.line,
    size: TITLE.size,
    weight: TITLE.weight,
    color: COLOR.ink,
    tracking: TITLE.tracking
  });

  const summaryTop = BODY_TOP + TITLE.line * titleLines.length + TITLE.gapAfter;
  ctx.font = font(400, SUMMARY.size);
  const summaryLines = wrap(ctx, content.summary, SUMMARY.maxWidth);
  block('summary', summaryLines, {
    x: SAFE_AREA,
    boxTop: summaryTop,
    lineHeight: SUMMARY.line,
    size: SUMMARY.size,
    weight: 400,
    color: COLOR.body
  });

  /* four diagnostic rails ------------------------------------------------ */
  const panelTop = summaryTop + SUMMARY.line * summaryLines.length + SUMMARY.gapAfter;
  const panelH = PANEL.pad * 2 + 2 + PANEL.rowH * 4 + PANEL.rowGap * 3;
  rect(SAFE_AREA, panelTop, CONTENT_W, panelH, COLOR.paperHi);
  ops.push({ kind: 'strokeRect', x: SAFE_AREA, y: panelTop, w: CONTENT_W, h: panelH, stroke: COLOR.line });

  const innerX = SAFE_AREA + PANEL.pad + 1;
  const innerW = CONTENT_W - (PANEL.pad + 1) * 2;
  const cellW = (innerW - PANEL.cellGap * 5) / 6;

  PROFILE_DEFINITIONS.forEach((definition, index) => {
    const profile = result.profiles[definition.id];
    const rowTop = panelTop + PANEL.pad + 1 + (PANEL.rowH + PANEL.rowGap) * index;

    text('profileName', PROFILE_NAMES[definition.id], {
      x: innerX,
      boxTop: rowTop,
      lineHeight: PANEL.nameLine,
      size: PANEL.nameSize,
      weight: 700,
      color: COLOR.ink
    });

    text('profileMeta', `${BAND_LABELS[profile.band]} · ${profile.score}/${PROFILE_MAX}`, {
      x: innerX + innerW,
      boxTop: rowTop,
      lineHeight: PANEL.nameLine,
      size: PANEL.metaSize,
      weight: 750,
      color: COLOR.inkSoft,
      align: 'right'
    });

    for (let cell = 0; cell < PROFILE_MAX; cell += 1) {
      ops.push({
        kind: 'cell',
        x: innerX + (cellW + PANEL.cellGap) * cell,
        y: rowTop + PANEL.railY,
        w: cellW,
        h: PANEL.railH,
        on: cell < profile.score,
        profileId: definition.id
      });
    }
  });

  /* yellow next-step strip ----------------------------------------------- */
  const stripTop = panelTop + panelH + NEXT.gapBefore;
  const stripInnerW = CONTENT_W - NEXT.padX * 2;
  ctx.font = font(700, NEXT.textSize);
  const nextLines = wrap(ctx, content.experiment, stripInnerW);
  const stripH = NEXT.padY * 2 + NEXT.labelLine + NEXT.gap + NEXT.textLine * nextLines.length;
  rect(SAFE_AREA, stripTop, CONTENT_W, stripH, COLOR.yellow);

  text('nextLabel', CARD_COPY.nextLabelSource.toLocaleUpperCase('tr-TR'), {
    x: SAFE_AREA + NEXT.padX,
    boxTop: stripTop + NEXT.padY,
    lineHeight: NEXT.labelLine,
    size: NEXT.labelSize,
    weight: 900,
    color: COLOR.inkSoft,
    tracking: NEXT.labelTracking
  });

  block('nextText', nextLines, {
    x: SAFE_AREA + NEXT.padX,
    boxTop: stripTop + NEXT.padY + NEXT.labelLine + NEXT.gap,
    lineHeight: NEXT.textLine,
    size: NEXT.textSize,
    weight: 700,
    color: COLOR.ink
  });

  /* footer ---------------------------------------------------------------- */
  rect(SAFE_AREA, FOOTER.ruleY, CONTENT_W, 1, COLOR.ink);
  const footerOptions = { lineHeight: FOOTER.line, size: FOOTER.size, weight: 700 };
  text('footerStrong', CARD_COPY.footerStrong, {
    ...footerOptions, x: SAFE_AREA, boxTop: FOOTER.lineOne, color: COLOR.ink
  });
  text('footerNote', CARD_COPY.footerNote, {
    ...footerOptions, weight: 400, x: SAFE_AREA, boxTop: FOOTER.lineTwo, color: COLOR.inkSoft
  });
  text('footerUrl', CARD_COPY.footerUrlTop, {
    ...footerOptions, x: RIGHT, boxTop: FOOTER.lineOne, color: COLOR.blueDeep, align: 'right'
  });
  text('footerUrl', CARD_COPY.footerUrlBottom, {
    ...footerOptions, x: RIGHT, boxTop: FOOTER.lineTwo, color: COLOR.blueDeep, align: 'right'
  });

  const contentBottom = stripTop + stripH;
  if (contentBottom > FOOTER.ruleY - 24) {
    throw new Error(`card overflow: content bottom ${contentBottom.toFixed(1)} reaches the footer rule`);
  }

  return {
    width: CARD.w,
    height: CARD.h,
    safeArea: SAFE_AREA,
    archetype: result.archetype,
    contentBottom,
    ops
  };
}

/* ------------------------------------------------------------------ painting */

function paintText(ctx, op) {
  ctx.font = font(op.weight, op.size);
  ctx.fillStyle = op.color;
  ctx.textBaseline = 'alphabetic';
  const y = baselineIn(ctx, op.boxTop, op.lineHeight);

  if (!op.tracking || hasNativeTracking(ctx)) {
    applyTracking(ctx, op.tracking);
    ctx.textAlign = op.align;
    ctx.fillText(op.text, op.x, y);
    ctx.textAlign = 'left';
    applyTracking(ctx, 0);
    return;
  }

  ctx.textAlign = 'left';
  let cursor = op.left;
  for (const glyph of Array.from(op.text)) {
    ctx.fillText(glyph, cursor, y);
    cursor += ctx.measureText(glyph).width + op.tracking;
  }
}

/** Paint a model onto a 2d context. */
export function paintCardModel(ctx, model) {
  for (const op of model.ops) {
    switch (op.kind) {
      case 'ground':
        ctx.fillStyle = op.fill;
        ctx.fillRect(0, 0, model.width, model.height);
        break;
      case 'grid':
        ctx.fillStyle = op.fill;
        for (let x = 0; x < model.width; x += op.step) ctx.fillRect(Math.round(x), 0, 1, model.height);
        for (let y = 0; y < model.height; y += op.step) ctx.fillRect(0, Math.round(y), model.width, 1);
        break;
      case 'rect':
        ctx.fillStyle = op.fill;
        ctx.fillRect(op.x, op.y, op.w, op.h);
        break;
      case 'strokeRect':
        ctx.strokeStyle = op.stroke;
        ctx.lineWidth = 1;
        ctx.strokeRect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1);
        break;
      case 'cell':
        ctx.beginPath();
        ctx.roundRect(op.x + 0.5, op.y + 0.5, op.w - 1, op.h - 1, 2);
        if (op.on) {
          ctx.fillStyle = COLOR.blue;
          ctx.fill();
        }
        ctx.strokeStyle = op.on ? COLOR.blue : COLOR.cell;
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      case 'text':
        paintText(ctx, op);
        break;
      default:
        break;
    }
  }
}

/**
 * Draw the complete card for one result.
 *
 * @param {object} result frozen result object from scoreAnswers()
 * @returns {HTMLCanvasElement} an off-document 1080 x 1350 canvas
 */
export function renderCard(result) {
  const model = buildCardModel(result);
  const canvas = document.createElement('canvas');
  canvas.width = model.width;
  canvas.height = model.height;
  paintCardModel(canvas.getContext('2d'), model);
  return canvas;
}

/** Render the card and resolve to a PNG blob. */
export function renderCardBlob(result) {
  return new Promise((resolve, reject) => {
    let canvas;
    try {
      canvas = renderCard(result);
    } catch (error) {
      reject(error);
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas produced no blob'));
    }, 'image/png');
  });
}

/* -------------------------------------------------------------------- share */

/** Thrown when the share sheet itself fails, as opposed to the card failing to draw. */
export class ShareSheetError extends Error {
  constructor(cause) {
    super('share sheet failed');
    this.name = 'ShareSheetError';
    this.cause = cause;
  }
}

/** True when this browser can share the generated PNG as a file. */
export function supportsFileShare() {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  if (typeof navigator.share !== 'function' || typeof File !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([new Blob([])], CARD_FILENAME, { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/** Download the card as a PNG. Resolves once the download has been handed to the browser. */
export async function downloadCard(result) {
  const blob = await renderCardBlob(result);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = CARD_FILENAME;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Share the card through the native sheet.
 *
 * A rejected share is not a failed card. AbortError is an ordinary cancellation; anything
 * else becomes a ShareSheetError so the caller can say the right thing and keep the
 * editable draft available for another attempt.
 *
 * @returns {Promise<'shared' | 'cancelled'>}
 */
export async function shareCard(result, draft = buildLinkedInDraft(result)) {
  const blob = await renderCardBlob(result);
  const file = new File([blob], CARD_FILENAME, { type: 'image/png' });
  try {
    await navigator.share({
      files: [file],
      title: SHARE_COPY.title,
      text: draft
    });
    return 'shared';
  } catch (error) {
    if (error && error.name === 'AbortError') return 'cancelled';
    throw new ShareSheetError(error);
  }
}

/** Copy the canonical URL. Never the staged or current URL. */
export async function copyText(value) {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) {
    throw new Error('clipboard unavailable');
  }
  await navigator.clipboard.writeText(value);
}

/** Copy the canonical URL. Retained for staged-link sanitation tests and compatibility. */
export async function copyCanonicalUrl() {
  await copyText(CANONICAL_URL);
}
