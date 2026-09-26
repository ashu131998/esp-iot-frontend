/**
 * Per-factory page/feature toggles.
 *
 * Stored server-side as a `features` JSONB map on the factory row and toggled by
 * a super-admin in the /admin console. The factory shell reads it to decide which
 * feature-gated tabs to show. Keys mirror the backend allowlist in
 * query-api `src/admin/routes.js` (TOGGLABLE_FEATURES).
 */

export type FeatureSlug = 'energy' | 'vibration' | 'temperature';

export type FactoryFeatures = Partial<Record<FeatureSlug, boolean>>;

/**
 * Visibility of each gated tab when the factory has no explicit flag set.
 * - energy: on by default (the page predates feature flags; existing factories keep it).
 * - vibration / temperature: off by default — REV B sensors, opt-in per factory
 *   as hardware is deployed.
 */
export const FEATURE_DEFAULTS: Record<FeatureSlug, boolean> = {
  energy: true,
  vibration: false,
  temperature: false,
};

export const FEATURE_SLUGS = Object.keys(FEATURE_DEFAULTS) as FeatureSlug[];

/** Human labels for the admin toggle UI. */
export const FEATURE_LABELS: Record<FeatureSlug, string> = {
  energy: 'Energy',
  vibration: 'Vibration',
  temperature: 'Temperature',
};

export function isFeatureSlug(slug: string): slug is FeatureSlug {
  return slug in FEATURE_DEFAULTS;
}

/**
 * Whether a tab is visible for a factory. Non-gated tabs (overview, alerts, …)
 * are always visible; gated tabs fall back to FEATURE_DEFAULTS when unset.
 */
export function isFeatureEnabled(
  features: FactoryFeatures | undefined,
  slug: string,
): boolean {
  if (!isFeatureSlug(slug)) return true;
  return features?.[slug] ?? FEATURE_DEFAULTS[slug];
}

/** Drop feature-gated tabs the factory has disabled. */
export function filterTabsByFeatures<T extends { slug: string }>(
  tabs: T[],
  features: FactoryFeatures | undefined,
): T[] {
  return tabs.filter((tab) => isFeatureEnabled(features, tab.slug));
}
