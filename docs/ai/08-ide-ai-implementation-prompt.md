# Prompt maestro para desarrollar el proyecto con Claude o Codex en un IDE

## Contexto y rol

Actua como un senior full-stack/serverless engineer. Debes desarrollar una aplicacion web privada de bajo costo para transformar logs de un bot almacenados en Supabase en un dashboard gerencial propio desplegado en Cloudflare.

El proyecto debe priorizar:

- costo operativo minimo,
- seguridad de credenciales,
- dashboard propio en subdominio,
- API propia de metricas,
- mantenibilidad,
- parsing robusto,
- despliegue simple,
- compatibilidad con Cloudflare Pages y Workers.

## Consulta/tarea

Desarrolla un proyecto TypeScript con React + Cloudflare que:

1. Lea la tabla `audit_log_entries` en Supabase.
2. Procese registros usando filtros por fecha y paginacion.
3. Extraiga campos desde JSON serializado en `respuesta_ia`.
4. Extraiga campos desde JSON serializado en `metadata`.
5. Extraiga datos utiles desde HTML en `output`.
6. Genere objetos normalizados para analitica.
7. Exponga endpoints API para KPIs, series, rankings, calidad y logs.
8. Renderice un dashboard web propio.
9. Soporte despliegue en Cloudflare Pages con subdominio.
10. Incluya tests unitarios para parsers y agregadores.

## Especificaciones funcionales

### Fuente de datos

Tabla Supabase:

```text
audit_log_entries
```

Campos esperados:

```text
id
fecha_creacion
session_id
pregunta_usuario
respuesta_ia
tokens_usados
metadata
error_log
output
```

### Campos a extraer

Desde `respuesta_ia`:

- `whereClause`
- `queryIntent`
- `hasFilter`
- `needsClarification`
- `isSearchReady`
- `humanSummary`

Desde `metadata`:

- `modelo`
- `origin`
- `referer`
- `ejecucion_id`
- `x-forwarder-for`
- `longitud_caracteres`

Desde `output`:

- `resultados_encontrados`
- `consulta_ambigua_output`
- `tiene_web`
- `web_detectada`
- `rif_detectado`
- `telefono_detectado`
- `empresa_detectada`
- `ubicacion_detectada`
- `ciudad_detectada`
- `estado_detectado`
- `categorias_detectadas`
- `cantidad_categorias`

### Endpoints

Implementar:

```text
GET /api/health
GET /api/summary
GET /api/timeseries
GET /api/intents
GET /api/top-companies
GET /api/top-categories
GET /api/locations
GET /api/quality
GET /api/logs
GET /api/export.csv
POST /api/admin/rebuild-cache
```

Proteger endpoints administrativos usando:

```http
Authorization: Bearer {ADMIN_SYNC_TOKEN}
```

### Dashboard

Crear pantallas:

- Resumen
- Demanda comercial
- Calidad del bot
- Calidad del directorio
- Tecnico
- Logs

## Especificaciones tecnicas

### Stack

- TypeScript
- React
- Vite
- Cloudflare Pages
- Cloudflare Workers o Pages Functions
- Supabase REST API
- Recharts o Apache ECharts
- Vitest

### Estructura de carpetas

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

## Variables de entorno

Usar Cloudflare Secrets:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_TABLE
ADMIN_SYNC_TOKEN
REPORT_TIMEZONE
PARSER_VERSION
SYNC_BATCH_SIZE
IP_HASH_SALT
```

Variables frontend:

```text
VITE_API_BASE_URL=/api
VITE_APP_NAME=Bot Metrics Dashboard
```

## Criterios de calidad

1. No exponer secretos en logs.
2. No guardar credenciales en el repositorio.
3. El parser debe tolerar JSON invalido.
4. El parser debe tolerar HTML incompleto.
5. Cada respuesta API debe incluir `parserVersion`.
6. La tabla de logs debe ser paginada.
7. Las consultas a Supabase deben tener rango de fecha y limite.
8. El dashboard debe tener estados loading/error/empty.
9. Debe haber tests para:
   - parseo correcto de `respuesta_ia`,
   - JSON invalido,
   - parseo correcto de `metadata`,
   - extraccion de resultados desde HTML,
   - deteccion de ambiguedad,
   - deteccion de web,
   - deteccion de RIF,
   - deteccion de categorias,
   - calculo de KPIs,
   - filtros de API.
10. Debe existir README con instrucciones de despliegue.

## Como debe ser la respuesta del IDE con IA

Entrega:

1. Codigo completo del proyecto.
2. Explicacion breve de arquitectura.
3. Instrucciones para configurar secretos.
4. Instrucciones para configurar subdominio.
5. Instrucciones para activar Cloudflare Access.
6. Comandos de desarrollo y despliegue.
7. Tests implementados.
8. Ejemplo de `.env.example` sin credenciales reales.
9. Checklist final de despliegue.

## Datos pendientes que debe solicitar si no existen

Si no estan disponibles, preguntar:

1. Dominio principal.
2. Subdominio deseado.
3. URL del proyecto Supabase.
4. Nombre exacto de la tabla.
5. Emails autorizados.
6. Frecuencia de actualizacion/cache deseada.
7. Zona horaria del dashboard.
8. Si se debe mostrar IP real o IP anonimizada.

## Primera tarea recomendada

Antes de escribir codigo final:

1. Crear tipos TypeScript para `RawLogEntry`, `CleanMetricRow` y respuestas API.
2. Crear fixtures con 2 o 3 registros reales anonimizados.
3. Implementar parsers puros sin dependencias externas.
4. Agregar tests unitarios.
5. Implementar agregadores de metricas.
6. Luego implementar conectores Supabase y UI.
