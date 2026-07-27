# Data Model

## Tabla fuente

Nombre esperado:

```text
audit_log_entries
```

> Confirmar el nombre exacto en Supabase antes de implementar.

## Campos fuente

| Campo | Tipo esperado | Descripcion |
|---|---|---|
| `id` | uuid/text | Identificador unico del log |
| `fecha_creacion` | timestamp | Fecha y hora de creacion |
| `session_id` | text | Identificador de conversacion |
| `pregunta_usuario` | text | Mensaje original del usuario |
| `respuesta_ia` | text/json | JSON generado por el clasificador |
| `tokens_usados` | integer | Tokens usados por la respuesta/clasificador |
| `metadata` | text/json | Metadata tecnica |
| `error_log` | text/null | Error tecnico si existe |
| `output` | text/html | Respuesta HTML generada por el bot |

## JSON esperado en `respuesta_ia`

Ejemplo:

```json
{
  "whereClause": "LOWER(name) LIKE LOWER('%taller comercio , c.a%')",
  "queryIntent": "COMPANY",
  "hasFilter": true,
  "needsClarification": false,
  "isSearchReady": true,
  "humanSummary": "Informacion sobre la empresa TALLER COMERCIO , C.A"
}
```

## JSON esperado en `metadata`

Ejemplo:

```json
{
  "modelo": "Gemini-3-Flash",
  "origin": "https://camarapetrolera.org",
  "referer": "https://camarapetrolera.org/",
  "ejecucion_id": "9338",
  "x-forwarder-for": "190.122.223.131",
  "longitud_caracteres": 224
}
```

## Modelo limpio interno

El dashboard debe trabajar con objetos normalizados, aunque inicialmente no se guarden en una tabla fisica. En el MVP se pueden generar bajo demanda desde Supabase. En una fase posterior se puede persistir el mismo modelo en una tabla analitica.

Nombre recomendado si se decide persistir:

```text
bot_metrics_clean
```

## Campos limpios requeridos para API/dashboard

| Campo | Tipo | Regla |
|---|---|---|
| `log_id` | text | `id` fuente |
| `fecha_creacion_utc` | datetime | `fecha_creacion` |
| `fecha_local` | date | Convertida a zona horaria de reporte |
| `hora_local` | number | Hora local 0-23 |
| `dia_semana` | text | Lunes, martes, etc. |
| `session_id` | text | Fuente |
| `pregunta_usuario` | text | Fuente |
| `pregunta_normalizada` | text | Lowercase, trim, espacios normalizados |
| `tokens_usados` | number | Fuente |
| `query_intent` | text | `respuesta_ia.queryIntent` |
| `where_clause` | text | `respuesta_ia.whereClause` |
| `human_summary` | text | `respuesta_ia.humanSummary` |
| `has_filter` | boolean/number | `respuesta_ia.hasFilter` |
| `needs_clarification_ai` | boolean/number | `respuesta_ia.needsClarification` |
| `is_search_ready` | boolean/number | `respuesta_ia.isSearchReady` |
| `modelo` | text | `metadata.modelo` |
| `origin` | text | `metadata.origin` |
| `referer` | text | `metadata.referer` |
| `ejecucion_id` | text | `metadata.ejecucion_id` |
| `ip_usuario` | text | `metadata.x-forwarder-for` |
| `longitud_caracteres` | number | `metadata.longitud_caracteres` |
| `tiene_error` | number | 1 si `error_log` no esta vacio |
| `error_log` | text | Fuente |
| `json_respuesta_valido` | number | 1 si parseo correcto |
| `json_metadata_valido` | number | 1 si parseo correcto |
| `resultados_encontrados` | number | Regex sobre HTML |
| `consulta_ambigua_output` | number | 1 si HTML contiene "Te refieres" |
| `tiene_web` | number | 1 si HTML contiene enlace |
| `web_detectada` | text | Primer link detectado |
| `rif_detectado` | text | Regex RIF |
| `telefono_detectado` | text | Regex telefono |
| `empresa_detectada` | text | Nombre en tarjeta HTML o humanSummary |
| `ubicacion_detectada` | text | Texto de ubicacion completo |
| `ciudad_detectada` | text | Extraccion desde ubicacion |
| `estado_detectado` | text | Extraccion desde ubicacion |
| `categorias_detectadas` | text | Badges separados por coma |
| `cantidad_categorias` | number | Numero de categorias extraidas |
| `procesado_en` | datetime | Momento del ETL |
| `parser_version` | text | Version del parser |

## Modelo de respuesta agregada

### Summary metrics

```json
{
  "totalQueries": 100,
  "uniqueSessions": 2,
  "uniqueUsers": 3,
  "avgTokens": 60.38,
  "totalTokens": 6038,
  "ambiguityRate": 0.92,
  "errorRate": 0,
  "invalidJsonRows": 3,
  "responsesWithWebsiteRate": 0.74
}
```

### Ranking rows

```json
{
  "label": "FABRICANTES",
  "count": 67,
  "percentage": 0.67
}
```

### Time series rows

```json
{
  "date": "2026-07-27",
  "queries": 19,
  "tokens": 1147,
  "errors": 0,
  "ambiguous": 19
}
```

## Tabla de errores de procesamiento

Nombre recomendado si se decide persistir errores:

```text
etl_errors
```

Campos:

| Campo | Tipo |
|---|---|
| `error_id` | text |
| `log_id` | text |
| `fecha_error` | datetime |
| `etapa` | text |
| `mensaje_error` | text |
| `payload_resumido` | text |
| `parser_version` | text |

## Tabla de estado/cache

Nombre recomendado si se decide precalcular cache:

```text
etl_state
```

Campos:

| Campo | Tipo |
|---|---|
| `process_name` | text |
| `last_processed_at` | datetime |
| `last_log_id` | text |
| `last_run_at` | datetime |
| `last_status` | text |
| `rows_processed` | number |
| `rows_failed` | number |
