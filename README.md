# ESP IoT Frontend

Production-grade B2B SaaS dashboard for multi-factory industrial IoT monitoring.

## Architecture

```
src/
├── app/
│   ├── (platform)/          # Common pages (all factories)
│   │   ├── overview/        # Cross-factory summary
│   │   ├── factories/       # Factory listing
│   │   ├── alerts/          # Alert center
│   │   └── settings/        # Platform settings
│   └── factories/[factoryId]/  # Factory-scoped routes
│       ├── page.tsx         # Factory overview
│       ├── availability/    # Uptime / downtime
│       ├── energy/          # Energy consumption
│       ├── performance/     # OEE-like metrics
│       ├── production/      # Units produced
│       ├── quality/         # QA records (+ manual entry)
│       ├── configuration/   # Machine config (+ manual entry)
│       └── compliance/      # Factory-specific (Mumbai only)
├── components/              # Reusable UI
└── lib/
    ├── api.ts               # Query API client
    ├── factory-config.ts    # Per-factory tabs & custom pages
    └── types.ts             # Shared TypeScript types
```

## Setup

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Requires the backend query API running at `http://localhost:8001`:

```bash
cd ../backend && make up
```

## Factory-specific pages

Add custom pages per factory in `src/lib/factory-config.ts` without changing core routes.

## Tech stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- TanStack Query
- Recharts
