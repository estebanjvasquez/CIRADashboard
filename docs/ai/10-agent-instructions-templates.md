# Agent Instructions Templates

Este documento contiene plantillas listas para crear archivos de instrucciones dentro del repositorio del proyecto.

## Plantilla `AGENTS.md` para Codex / Gemini

Crear en la raiz del repositorio:

```markdown
# AGENTS.md

## Project

This repository contains a private Cloudflare-hosted analytics dashboard for bot audit logs. It reads raw logs from Supabase, normalizes structured and semi-structured fields, exposes a metrics API, and renders a React dashboard on a protected subdomain.

## Goals

- Keep operating cost as close to zero as possible.
- Preserve Supabase as the source of truth.
- Build a private dashboard controlled by this application.
- Keep credentials secure.
- Make parsers deterministic, tested, and easy to change.
- Keep API responses clean and typed.

## Stack

- TypeScript
- React
- Vite
- Cloudflare Pages
- Cloudflare Workers or Pages Functions
- Supabase REST API
- Recharts or Apache ECharts
- Vitest

## Repository Structure

```text
src/
  etl/
    parsers/
    connectors/
  dashboard/
  shared/
    types/
tests/
  unit/
  fixtures/
scripts/
docs/
```

## Commands

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
npm run deploy
```

## Rules

- Do not commit secrets.
- Do not print secrets in logs.
- Do not expose Supabase service role to clients.
- Do not modify production integrations without tests.
- Keep parser functions pure.
- Add or update tests for parser changes.
- Use `log_id` for idempotency in cache or clean tables.
- Include `parser_version` in API metadata.
- Prefer small, focused changes.
- Keep expensive aggregation in the API, not in React components.

## Validation

Before considering work complete:

1. Run unit tests.
2. Run typecheck.
3. Run production build.
4. Test `/api/health`.
5. Test `/api/summary`.
6. Test dashboard loading, error and empty states.
7. Confirm no secrets are exposed in frontend bundle.

## Security

Secrets must be configured via Cloudflare:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ADMIN_SYNC_TOKEN
wrangler secret put IP_HASH_SALT
```

If a task requires real credentials and they are missing, stop and ask the user.
```

## Plantilla `CLAUDE.md` para Claude

Crear en la raiz del repositorio:

```markdown
# CLAUDE.md

## Purpose

Build and maintain a low-cost private web dashboard for bot metrics.

The app reads `audit_log_entries` from Supabase, extracts structured data from JSON text fields and HTML output, exposes a typed metrics API, and renders a React dashboard on a protected Cloudflare subdomain.

## Important Context

Raw Supabase logs include:

- `respuesta_ia`: serialized JSON with query intent and classifier fields.
- `metadata`: serialized JSON with model, origin, referer, IP and response length.
- `output`: HTML containing result counts, company cards, RIF, phone, website, location and categories.

The frontend must consume clean JSON from the API, not raw JSON strings or HTML.

## Development Style

- Work incrementally.
- Prefer simple TypeScript.
- Keep parsing code deterministic and covered by tests.
- Use fixtures from real anonymized logs.
- Do not add heavy dependencies unless justified.
- Do not change deployment configuration casually.
- Keep dashboard components responsive and accessible.

## Security Rules

- Never expose Supabase service role outside Cloudflare.
- Never commit `.env`, private keys or tokens.
- Avoid logging raw headers.
- Treat IP addresses as sensitive.
- Prefer hashed IPs for dashboard display.
- Protect the subdomain with Cloudflare Access.

## Before Coding

Read:

1. `docs/specs/01-product-spec.md`
2. `docs/specs/03-data-model.md`
3. `docs/specs/04-etl-processing-spec.md`
4. `docs/specs/05-web-dashboard-spec.md`
5. `docs/operations/07-security-and-operations.md`

## Done Means

- Code compiles.
- Tests pass.
- Parser handles invalid JSON.
- Parser handles incomplete HTML.
- `/api/health` works.
- `/api/summary` returns KPIs.
- Dashboard renders KPIs and charts.
- Admin endpoints require token.
- README documents deployment.
```
