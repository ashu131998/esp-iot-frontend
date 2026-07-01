/**
 * Factory-specific feature flags and custom pages.
 * Each factory lives at /factories/[factoryId] with an isolated shell (no cross-factory nav).
 * Platform admin routes (/overview, /factories) list all factories.
 */

export type FactoryTab =
  | 'overview'
  | 'availability'
  | 'status-timeline'
  | 'energy'
  | 'performance'
  | 'production'
  | 'quality'
  | 'lines'
  | 'configuration'
  | 'scheduling'
  | 'alerts';

export interface FactoryCustomPage {
  slug: string;
  label: string;
  description: string;
}

export interface FactoryConfig {
  name: string;
  tabs: FactoryTab[];
  customPages?: FactoryCustomPage[];
  accentColor: string;
}

const DEFAULT_TABS: FactoryTab[] = [
  'overview',
  'availability',
  'status-timeline',
  'alerts',
  'energy',
  'performance',
  'production',
  'quality',
  'lines',
  'configuration',
  'scheduling',
];

export const FACTORY_REGISTRY: Record<string, FactoryConfig> = {
  'factory-pune-01': {
    name: 'Pune Assembly Plant',
    tabs: DEFAULT_TABS,
    accentColor: 'blue',
  },
  'factory-mumbai-02': {
    name: 'Mumbai Precision Works',
    tabs: DEFAULT_TABS,
    customPages: [
      {
        slug: 'compliance',
        label: 'Compliance',
        description: 'ISO 9001 audit trail and certification status for precision manufacturing.',
      },
    ],
    accentColor: 'violet',
  },
};

export function getFactoryConfig(factoryId: string): FactoryConfig {
  return (
    FACTORY_REGISTRY[factoryId] ?? {
      name: factoryId,
      tabs: DEFAULT_TABS,
      accentColor: 'slate',
    }
  );
}

export function factoryTabs(factoryId: string): Array<{ slug: FactoryTab | string; label: string; href: string }> {
  const config = getFactoryConfig(factoryId);
  const base = `/factories/${factoryId}`;

  const tabLabels: Record<FactoryTab, string> = {
    overview: 'Overview',
    availability: 'Availability',
    'status-timeline': 'Status Timeline',
    alerts: 'Alerts',
    energy: 'Energy',
    performance: 'Performance',
    production: 'Production',
    quality: 'Quality',
    lines: 'Lines',
    configuration: 'Configuration',
    scheduling: 'Scheduling',
  };

  const tabs = config.tabs.map((tab) => ({
    slug: tab,
    label: tabLabels[tab],
    href: tab === 'overview' ? base : `${base}/${tab}`,
  }));

  const custom = (config.customPages ?? []).map((p) => ({
    slug: p.slug,
    label: p.label,
    href: `${base}/${p.slug}`,
  }));

  const team = { slug: 'team', label: 'Team', href: `${base}/team` };

  return [...tabs, team, ...custom];
}
