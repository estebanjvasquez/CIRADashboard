# CLAUDE.md - Development Context & Guidelines

## Project Purpose
**CIRADashboard** is a private, low-cost analytics dashboard and ETL processing pipeline for bot audit logs. It reads raw logs from Supabase, parses serialized JSON (`respuesta_ia`, `metadata`) and HTML (`output`), exposes a typed metrics API, and renders an executive React web dashboard on Cloudflare.

## Architecture Overview
- **Data Source**: Supabase PostgreSQL table (`audit_log_entries`)
- **API & ETL Layer**: Cloudflare Workers / Pages Functions (Edge Serverless API)
- **Frontend Dashboard**: React + Vite + Tailwind CSS / Vanilla CSS + Recharts
- **Hosting & Security**: Cloudflare Pages + Cloudflare Access (Subdomain protection)

## Repository Structure
```text
CIRADashboard/
├── CLAUDE.md                   # Anthropic Claude operational context & guidelines
├── AGENTS.md                   # Google / Codex multi-agent instructions
├── README.md                   # Main project entrypoint and navigation
├── .gitignore                  # Git exclusions (secrets, builds, node_modules)
├── docs/                       # Project documentation categorized by domain
│   ├── specs/                  # Product, architecture, data model & ETL specs
│   ├── deployment/             # Infrastructure & Cloudflare setup guide
│   ├── operations/             # Security, IP hashing, logging & monitoring
│   ├── ai/                     # AI development prompts & templates
│   └── qa/                     # Acceptance testing & QA benchmarks
├── src/                        # Source code
│   ├── etl/                    # ETL parsers (pure functions) & connectors
│   │   ├── parsers/            # HTML & JSON parser logic
│   │   └── connectors/         # Supabase REST client & cache handlers
│   ├── dashboard/              # React frontend views & visual components
│   └── shared/                 # Shared TypeScript interfaces & types
├── tests/                      # Testing framework
│   ├── unit/                   # Vitest unit tests for parsers & metric aggregators
│   └── fixtures/               # Anonymized log JSON/HTML test data
└── scripts/                    # Maintenance, backfill, and utility scripts
```

## Key Architectural Rules & Guidelines

### 1. Pure Functional Parsers
- Keep HTML and JSON parsing code as pure functions (e.g., `parseJsonFields`, `parseOutputHtml`).
- Parsers must be deterministic, highly performant, and 100% test-covered using fixtures.
- Gracefully handle invalid JSON or truncated HTML without throwing uncaught exceptions.

### 2. Strict Security & Zero Leakage
- **Secrets**: Never commit or log `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SYNC_TOKEN`, or `IP_HASH_SALT`.
- **Client Safety**: Keep `service_role` keys exclusively in Cloudflare Secrets.
- **Privacy**: Anonymize user IP addresses using SHA-256 with a private salt (`IP_HASH_SALT`).

### 3. TypeScript & Data Integrity
- Maintain strict typing in `src/shared/types/index.ts`.
- Every API endpoint response must include `parserVersion` metadata.
- Perform heavy metric aggregations in the API layer, avoiding costly compute in React components.

## Development & Test Commands
```bash
npm install        # Install dependencies
npm run dev        # Run local dev server (frontend + worker)
npm run test       # Execute Vitest suite
npm run typecheck  # Validate TypeScript types
npm run build      # Build production bundle
npm run deploy     # Deploy to Cloudflare Pages
```

## Before Editing Code
Read the corresponding specification in `docs/`:
1. `docs/specs/02-technical-architecture.md`
2. `docs/specs/03-data-model.md`
3. `docs/specs/04-etl-processing-spec.md`
4. `docs/specs/05-web-dashboard-spec.md`
5. `docs/qa/11-acceptance-tests-and-qa.md`
