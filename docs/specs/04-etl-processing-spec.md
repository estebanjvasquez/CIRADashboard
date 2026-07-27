# Processing and Metrics API Spec

## Objetivo

Definir la logica que debe implementar la aplicacion para transformar registros brutos del bot en objetos limpios y metricas agregadas consumidas directamente por el dashboard web.

## Entradas

Registros desde Supabase:

```text
audit_log_entries
```

## Salidas

Respuestas JSON desde la API:

```text
/api/summary
/api/timeseries
/api/intents
/api/top-companies
/api/top-categories
/api/locations
/api/quality
/api/logs
```

Opcionalmente, tabla analitica cacheada:

```text
bot_metrics_clean
```

## Modo de ejecucion

La API debe soportar:

| Modo | Endpoint/evento | Uso |
|---|---|---|
| Bajo demanda | APIs `/api/*` | Dashboard interactivo |
| Programado | Cron Trigger | Precalcular cache |
| Manual | `POST /api/admin/rebuild-cache` | Reprocesar metricas |
| Salud | `GET /api/health` | Validar configuracion |
| Vista previa | `GET /api/preview?limit=10` | Ver registros procesados |

## Algoritmo principal bajo demanda

1. Validar autenticacion mediante Cloudflare Access o token.
2. Leer filtros de query string.
3. Consultar cache si aplica.
4. Consultar Supabase por registros del rango solicitado.
5. Transformar cada fila.
6. Calcular metricas agregadas.
7. Devolver JSON al dashboard.
8. Guardar cache temporal si aplica.

## Consulta a Supabase

Usar REST API:

```http
GET /rest/v1/audit_log_entries?fecha_creacion=gte.{from}&fecha_creacion=lte.{to}&order=fecha_creacion.asc&limit=1000
```

Headers:

```http
apikey: {SUPABASE_SERVICE_ROLE_KEY}
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json
```

> La key de service role solo debe estar en Cloudflare Secrets. Nunca debe exponerse en el frontend.

## Paginacion

Si existen mas de 1000 filas:

1. Consultar con `limit=1000`.
2. Procesar lote.
3. Usar la ultima `fecha_creacion` recibida como cursor.
4. Continuar hasta recibir menos de `limit`.

## Transformacion por fila

### 1. Fechas

- `fecha_creacion_utc`: timestamp original.
- `fecha_local`: convertir a zona horaria definida.
- `hora_local`: extraer hora.
- `dia_semana`: nombre del dia.

Zona horaria inicial recomendada:

```text
Europe/Dublin
```

Confirmar si gerencia requiere Venezuela, Espana o UTC.

### 2. Parseo de `respuesta_ia`

Intentar `JSON.parse`.

Si falla:

- `json_respuesta_valido = 0`
- `query_intent = "NO_JSON"`
- registrar error interno de parsing.

Si funciona:

- `json_respuesta_valido = 1`
- extraer:
  - `whereClause`
  - `queryIntent`
  - `hasFilter`
  - `needsClarification`
  - `isSearchReady`
  - `humanSummary`

### 3. Parseo de `metadata`

Intentar `JSON.parse`.

Si falla:

- `json_metadata_valido = 0`
- registrar error interno.

Si funciona:

- `json_metadata_valido = 1`
- extraer:
  - `modelo`
  - `origin`
  - `referer`
  - `ejecucion_id`
  - `x-forwarder-for`
  - `longitud_caracteres`

### 4. Extraccion desde HTML `output`

Reglas iniciales:

| Campo | Regla |
|---|---|
| `resultados_encontrados` | Regex `Encontr[eé]\\s*<strong>(\\d+)</strong>` |
| `consulta_ambigua_output` | HTML contiene `Te refieres` |
| `tiene_web` | HTML contiene `href=` |
| `web_detectada` | Primer URL en `href="..."` |
| `rif_detectado` | Regex `RIF:\\s*([A-Z]-?[0-9\\-]+)` |
| `telefono_detectado` | Regex cercana a icono telefono o patron telefonico |
| `categorias_detectadas` | Extraer badges `<span>` con texto mayusculo |
| `ubicacion_detectada` | Texto del span con icono de ubicacion o patron ciudad/pais/estado |

### 5. Normalizacion de pregunta

Crear:

```text
pregunta_normalizada
```

Reglas:

1. Convertir a minusculas.
2. Remover espacios dobles.
3. Trim.
4. Mantener acentos inicialmente.
5. Opcional: crear version sin acentos en fase 2.

### 6. Empresa detectada

Prioridad:

1. Nombre dentro de tarjeta HTML.
2. `humanSummary` eliminando prefijos como `Informacion sobre la empresa`.
3. Texto de `pregunta_usuario` eliminando frases como `dame informacion sobre la empresa`.

## Respuestas API esperadas

### `/api/summary`

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

### `/api/timeseries`

```json
{
  "rows": [
    {
      "date": "2026-07-27",
      "queries": 19,
      "tokens": 1147,
      "errors": 0,
      "ambiguous": 19
    }
  ]
}
```

### `/api/logs`

```json
{
  "rows": [],
  "limit": 100,
  "offset": 0,
  "total": 100
}
```

## Idempotencia y cache

Para cache precomputado usar:

```text
cache_key = hash(endpoint + filters + parser_version)
```

TTL recomendado:

| Tipo | TTL |
|---|---|
| Summary | 5-15 minutos |
| Timeseries | 15 minutos |
| Rankings | 15 minutos |
| Logs paginados | 5 minutos |

## Manejo de errores

Errores que no deben detener todo el procesamiento:

- JSON invalido en una fila.
- HTML con estructura diferente.
- Campo faltante.
- Telefono o RIF no detectable.

Errores que deben devolver respuesta de error controlada:

- Credenciales Supabase invalidas.
- Supabase no responde.
- Filtro de fecha invalido.
- Usuario no autorizado.

## Versionado del parser

Cada respuesta debe incluir metadata:

```json
{
  "parserVersion": "1.0.0",
  "generatedAt": "2026-07-27T00:00:00.000Z"
}
```

Cuando se cambien reglas de extraccion, incrementar version:

- `1.0.0`: JSON basico + resultados + web + ambiguedad
- `1.1.0`: RIF, telefono, ubicacion, categorias
- `1.2.0`: normalizacion avanzada de empresas
