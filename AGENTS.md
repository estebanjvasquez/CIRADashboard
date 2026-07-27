# AGENTS.md - Multi-Agent & IDE Guidelines (Google & OpenAI Codex Standards)

## Project Overview
This repository contains a private, Cloudflare-hosted analytics dashboard and serverless ETL pipeline for bot audit logs. It reads raw logs from Supabase, normalizes structured/semi-structured fields, exposes a typed metrics API, and renders a React executive dashboard on a protected subdomain.

## Core Operational Principles

### 1. Repository Context & Incremental Execution
- Always inspect the codebase and relevant specifications in `docs/` before proposing changes.
- Implement features in small, self-contained, verifiable modules.
- Ensure every code modification is accompanied by matching unit tests in `tests/unit/`.

### 2. Security & Compliance
- **No Credentials in Code**: Never hardcode API keys, service roles, or connection strings.
- **Environment Secrets**: Secrets are injected securely via Cloudflare Secrets (`wrangler secret put`).
- **Data Protection**: User IP addresses must be hashed using SHA-256 with `IP_HASH_SALT` before rendering in analytics.

### 3. Modular Code Architecture
```text
src/
  etl/
    parsers/        # Pure parsing logic (HTML regex, JSON extractors)
    connectors/     # Supabase REST client & cache handlers
  dashboard/        # React components, pages, and charts
  shared/           # Shared TypeScript interfaces & models
tests/
  unit/             # Unit tests for parsers & metric math
  fixtures/         # Anonymized sample data for testing
docs/               # Technical specs & operations guides
```

## Standard Commands

```bash
npm install         # Install project dependencies
npm run dev         # Start local dev environment
npm run test        # Execute unit test suite (Vitest)
npm run typecheck   # Type-check TypeScript files
npm run build       # Build frontend and worker bundles
npm run deploy      # Deploy worker and pages to Cloudflare
```

## Validation & Definition of Done

Before marking any task complete:
1. All unit tests must pass (`npm run test`).
2. TypeScript compilation must pass without errors (`npm run typecheck`).
3. Production build must succeed (`npm run build`).
4. Ensure no secret or environment token is bundled into client-side assets.
5. Verify `/api/health` and `/api/summary` endpoint contracts.
