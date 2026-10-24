/**
 * Static display fallbacks for a factory (name before the API answers, accent).
 * Each factory lives at /factories/[factoryId] with an isolated shell (no cross-factory nav).
 * Platform admin routes (/overview, /factories) list all factories.
 *
 * Which pages and page sections a factory shows is not configured here: our
 * staff switch them per factory in the internal console (see lib/display.ts).
 */

export interface FactoryConfig {
  name: string;
  accentColor: string;
}

export const FACTORY_REGISTRY: Record<string, FactoryConfig> = {
  'factory-pune-01': {
    name: 'Pune Assembly Plant',
    accentColor: 'blue',
  },
  'factory-mumbai-02': {
    name: 'Mumbai Precision Works',
    accentColor: 'violet',
  },
};

export function getFactoryConfig(factoryId: string): FactoryConfig {
  return (
    FACTORY_REGISTRY[factoryId] ?? {
      name: factoryId,
      accentColor: 'slate',
    }
  );
}
