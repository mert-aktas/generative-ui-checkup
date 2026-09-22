/**
 * Generative UI Check-up: GA4 loader and bootstrap.
 *
 * `analytics.js` validates and forwards events, but `deliver()` returns early unless
 * `window.gtag` is a function, and nothing in the page ever defined one. Setting
 * `enabled: true` without this file produces a build that looks instrumented and measures
 * nothing, which is the failure Phase 17 exists to prevent.
 *
 * **Why this is a file and not the inline snippet Google publishes.** The CSP in index.html
 * carries `script-src 'self' https://www.googletagmanager.com` with no `'unsafe-inline'`
 * and no nonce, and the policy is delivered by `<meta>`, so a nonce is not available to add.
 * The standard inline bootstrap is blocked outright. A same-origin module is not.
 *
 * **Why the tag is injected here rather than hardcoded in index.html.** The measurement ID
 * then lives in exactly one place, `ANALYTICS_CONFIG`, and `enabled: false` genuinely stops
 * the network rather than merely stopping `deliver()` after the vendor script has already
 * loaded and started its own page_view. The config flag is load-bearing either way; this
 * makes it load-bearing at the only point that costs a request.
 *
 * `page_view` comes free from the `config` call, which is where arrivals are counted. No
 * event defined in ANALYTICS.md is sent from here.
 */

import { ANALYTICS_CONFIG } from './analytics.js';

const GTAG_ORIGIN = 'https://www.googletagmanager.com';

/**
 * Define `window.gtag` and queue the two opening commands.
 *
 * The queue is the whole reason ordering does not matter: `gtag()` pushes onto
 * `window.dataLayer`, and the vendor script drains whatever is already there when it
 * arrives. So this module and the async script can load in either order.
 */
function bootstrap(measurementId) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // `arguments`, not a rest parameter: the vendor script reads the arguments object shape.
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    // Google Signals and ads personalization, both off.
    //
    // Measured, not assumed: with the defaults, a single page load additionally requested
    // `https://stats.g.doubleclick.net/g/collect` and
    // `https://www.google.pt/ads/ga-audiences`, and both were blocked by this page's CSP.
    // The second is the worse of the two — the host carries the *user's* country code, so the
    // set of hosts to permit is not enumerable and no exact allowlist could ever cover it.
    //
    // Turning them off is not a workaround for the CSP. This is a self-assessment tool, not
    // an ad campaign: there is no remarketing audience to build, nothing in ANALYTICS.md asks
    // for one, and shipping advertising identifiers would contradict the privacy posture the
    // rest of this adapter is built around. With both off, the only analytics destinations
    // left are the ones the CSP names.
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const tag = document.createElement('script');
  tag.async = true;
  tag.src = `${GTAG_ORIGIN}/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(tag);
}

// Both conditions, for the same reason `stage()` checks two: a measurement ID without
// `enabled` is a staged configuration, and `enabled` without an ID would request a tag that
// cannot resolve. Neither alone is an instruction to start measuring.
if (ANALYTICS_CONFIG.enabled && ANALYTICS_CONFIG.ga4MeasurementId) {
  try {
    bootstrap(ANALYTICS_CONFIG.ga4MeasurementId);
  } catch {
    // Measurement never interrupts the experience. A blocked or failed bootstrap leaves
    // `window.gtag` undefined, and `deliver()` drops every event rather than queueing it.
  }
}
