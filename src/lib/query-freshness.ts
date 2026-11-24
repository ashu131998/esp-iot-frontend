/**
 * How long figures count as just fetched. A page that arrives with its figures (fetched on the server
 * a moment ago, see each page's HydrationBoundary) does not ask for them again as it opens: with a
 * stale time of 0 every such page fetched everything twice, once on the server and once in the
 * browser a second later (measured 2026-11-24). A page come back to after this long does ask again,
 * and the timed refresh goes on as before.
 */
export const JUST_FETCHED_MS = 10_000;
