# Deployment Spec: Cloudflare + Supabase + Dashboard Web

## Objetivo

Desplegar una aplicacion web privada de costo minimo que lea Supabase, calcule metricas y muestre un dashboard propio en un subdominio del dominio principal.

## Servicios necesarios

| Servicio | Uso | Costo inicial |
|---|---|---|
| Supabase | Fuente de logs | Existente |
| Cloudflare Pages | Hosting del frontend | 0 EUR |
| Cloudflare Workers / Pages Functions | API serverless | 0 EUR |
| Cloudflare DNS | Subdominio | 0 EUR si el dominio ya usa Cloudflare |
| Cloudflare Access | Acceso privado recomendado | 0 EUR segun uso/equipo |
| Cloudflare KV/D1 | Cache opcional | 0 EUR inicial segun limites |

## Subdominio

Opciones recomendadas:

```text
metricas.dominio.com
dashboard.dominio.com
analytics.dominio.com
```

Recomendacion:

```text
metricas.dominio.com
```

## Variables de entorno

Configurar como secretos en Cloudflare:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_TABLE=audit_log_entries
REPORT_TIMEZONE=Europe/Dublin
PARSER_VERSION=1.0.0
SYNC_BATCH_SIZE=1000
ADMIN_SYNC_TOKEN
IP_HASH_SALT
```

Variables publicas del frontend:

```text
VITE_API_BASE_URL=/api
VITE_APP_NAME=Bot Metrics Dashboard
```

## Seguridad de Supabase

Recomendacion:

- Usar `service_role` solo dentro del Worker.
- No exponer la key en frontend, repositorio ni logs.
- Limitar el Worker a operaciones de lectura sobre la tabla bruta.
- Si es posible, crear una vista o funcion SQL de solo lectura para analitica.

## Autenticacion recomendada

### MVP recomendado: Cloudflare Access

Ventajas:

- No hay que desarrollar login.
- Permite limitar por email.
- Protege todo el subdominio.
- Reduce errores de seguridad.

Configuracion:

1. Crear aplicacion en Cloudflare Zero Trust.
2. Dominio: `metricas.dominio.com`.
3. Politica: permitir solo emails autorizados.
4. Metodo: OTP por email, Google Workspace o Microsoft Entra ID.

### Alternativa: Login propio

Solo recomendable si se necesita:

- roles internos,
- auditoria avanzada,
- permisos por pantalla,
- usuarios externos sin Cloudflare Access.

## Endpoints del Worker

### `GET /api/health`

Devuelve estado basico.

```json
{
  "status": "ok",
  "parserVersion": "1.0.0",
  "timestamp": "2026-07-27T00:00:00.000Z"
}
```

### `GET /api/summary`

Devuelve KPIs ejecutivos.

### `GET /api/timeseries`

Devuelve series de consultas, tokens, errores y ambiguedad.

### `GET /api/logs`

Devuelve filas limpias paginadas.

### `GET /api/export.csv`

Exporta registros filtrados en CSV.

### `POST /api/admin/rebuild-cache`

Reprocesa cache o tabla limpia.

Debe requerir:

```http
Authorization: Bearer {ADMIN_SYNC_TOKEN}
```

## Cron opcional

Para precalcular cache:

```text
0 */6 * * *
```

Ejecucion cada 6 horas.

Si el volumen es bajo, el MVP puede funcionar sin Cron y calcular bajo demanda con cache de 5-15 minutos.

## Estrategia de cache

### MVP

- Cache de respuestas agregadas.
- TTL 5-15 minutos.
- Cache key por endpoint + filtros + parser version.

### Fase posterior

- Cloudflare KV para summaries.
- Cloudflare D1 para tabla limpia.
- Supabase `bot_metrics_clean` si se quiere mantener todo en la base principal.

## Estructura recomendada del repositorio

```text
CIRADashboard/
  README.md
  AGENTS.md
  CLAUDE.md
  docs/
    specs/
    deployment/
    operations/
    ai/
    qa/
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
```

## Comandos esperados

```bash
npm install
npm run dev
npm run test
npm run typecheck
npm run build
npm run deploy
```

## Wrangler

Ejemplo base:

```toml
name = "bot-metrics-dashboard"
compatibility_date = "2026-07-27"
pages_build_output_dir = "dist"

[vars]
SUPABASE_TABLE = "audit_log_entries"
REPORT_TIMEZONE = "Europe/Dublin"
PARSER_VERSION = "1.0.0"
SYNC_BATCH_SIZE = "1000"

[triggers]
crons = ["0 */6 * * *"]
```

## Checklist de despliegue

1. Crear repositorio.
2. Agregar `AGENTS.md` y `CLAUDE.md`.
3. Crear proyecto Cloudflare Pages.
4. Conectar repositorio.
5. Configurar build command.
6. Configurar secretos.
7. Configurar subdominio.
8. Activar Cloudflare Access.
9. Probar `/api/health`.
10. Probar `/api/summary`.
11. Validar dashboard en desktop.
12. Validar dashboard en movil.
13. Activar Cron si se usa cache precomputado.

## Plan de rollback

1. Mantener ultimo deploy estable en Cloudflare Pages.
2. Si falla el deploy, revertir a version anterior desde Cloudflare.
3. Si falla API, mostrar estado de error controlado en frontend.
4. Si falla Supabase, no borrar cache anterior.
