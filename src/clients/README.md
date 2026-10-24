# Client versions of pages

A client version replaces one factory page for one client, on the same URL.
It is the **last resort**. Every client version must be fixed and tested on
its own when the common page changes, so keep them few.

## Before making one, in this order

1. **Setting.** Can the common page do it with a setting our staff change?
   Units per machine, switching a graph or table off (internal console →
   Pages & branding), colours and logo. Add a setting to the common page if a
   new one is needed.
2. **Module.** Could other clients use it? Then build a new page that any
   factory can switch on (add it to `query-api/src/display.js` and
   `src/lib/display.ts`), and switch it on for this client.
3. **Client version.** Only for a layout that really differs for this client.

## How to make one

1. Create `src/clients/<client>/<page>.tsx`, for example
   `src/clients/acme/production.tsx`. Build it from the same parts as the
   common page (`src/components/factory/...`), so a fix to a chart or table
   reaches this client too. Copy only the layout, not the parts.
2. Export a page component. It receives the same props as the common page
   (`FactoryPageProps`: `params`, `searchParams`):

   ```tsx
   import type { FactoryPageProps } from '@/clients/registry';
   import { ProductionCards } from '@/components/factory/production-cards';
   import { ProductionTable } from '@/components/factory/production-table';

   export async function AcmeProductionPage({ params, searchParams }: FactoryPageProps) {
     const { factoryId } = await params;
     const { from, to } = await searchParams;
     return (
       <div className="space-y-6 p-4 sm:p-6 lg:p-8">
         <ProductionCards factoryId={factoryId} from={from} to={to} />
         <ProductionTable factoryId={factoryId} from={from} to={to} />
       </div>
     );
   }
   ```

3. Register it for each of the client's factories in `registry.ts`:

   ```ts
   'factory-acme-01': { production: AcmeProductionPage },
   ```

## What still applies

- The URL stays `/factories/<id>/<page>`, so links in emails, alerts and
  bookmarks keep working, and no client name appears in a URL.
- If our staff switch the page off for the factory, it shows "not found",
  client version or not.
- Section switches only apply where the version checks them (`useShown()`
  from `@/lib/factory-refs-context`).

## Review

When a second client asks for the same change, turn it into a setting on the
common page and delete the client versions.
