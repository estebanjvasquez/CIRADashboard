# Acceptance Tests and QA

## Objetivo

Definir las pruebas necesarias para asegurar que el dashboard web y la API de metricas funcionan correctamente antes de conectarlos a datos reales de produccion.

## Niveles de prueba

| Nivel | Objetivo |
|---|---|
| Unit tests | Validar parsers, normalizadores y agregadores |
| Integration tests | Validar Supabase client con mocks |
| API tests | Validar endpoints de metricas |
| UI tests | Validar componentes principales del dashboard |
| Manual tests | Validar app local |
| Deployment smoke tests | Validar Cloudflare Pages/Worker desplegado |

## Fixtures requeridos

Crear fixtures anonimizados:

```text
tests/fixtures/
  company-result-1.json
  sector-result-many.json
  invalid-respuesta-ia.json
  missing-metadata.json
  output-without-website.json
  output-with-rif-phone-location.json
```

## Unit tests requeridos

### `parse-json-fields.test.ts`

Casos:

| Caso | Resultado esperado |
|---|---|
| JSON valido en `respuesta_ia` | Extrae `queryIntent`, `humanSummary`, flags |
| JSON invalido en `respuesta_ia` | `json_respuesta_valido = 0` |
| JSON valido en `metadata` | Extrae modelo, origin, IP |
| JSON invalido en `metadata` | `json_metadata_valido = 0` |
| Campos faltantes | No rompe, devuelve vacios/null |

### `parse-output-html.test.ts`

Casos:

| Caso | Resultado esperado |
|---|---|
| HTML con `Encontré <strong>1</strong>` | `resultados_encontrados = 1` |
| HTML con 57 resultados | `resultados_encontrados = 57` |
| HTML con `¿Te refieres` | `consulta_ambigua_output = 1` |
| HTML con link | `tiene_web = 1`, `web_detectada` no vacia |
| HTML sin link | `tiene_web = 0` |
| HTML con RIF | Extrae `rif_detectado` |
| HTML con telefono | Extrae `telefono_detectado` |
| HTML con badges | Extrae `categorias_detectadas` |
| HTML vacio | No falla |

### `normalize-log-row.test.ts`

Casos:

| Caso | Resultado esperado |
|---|---|
| Registro completo | Produce `CleanMetricRow` completa |
| Registro con error_log | `tiene_error = 1` |
| Pregunta con espacios | `pregunta_normalizada` limpia |
| Fecha UTC | Genera fecha local y hora local |
| Parser version | Incluye `parser_version` |

### `metrics.test.ts`

Casos:

| Caso | Resultado esperado |
|---|---|
| 100 filas de muestra | KPIs coinciden con totales esperados |
| Sesiones repetidas | `uniqueSessions` correcto |
| IPs repetidas | `uniqueUsers` correcto o hash correcto |
| Intenciones mixtas | Conteo por intent correcto |
| Tokens | suma y promedio correctos |

## Integration tests con mocks

### Supabase client

Validar:

- Construye URL correcta.
- Usa filtros `from` y `to`.
- Aplica `limit`.
- Ordena ascendente.
- Maneja errores HTTP.
- No incluye service role en respuestas.

## API tests requeridos

| Endpoint | Validacion |
|---|---|
| `/api/health` | Devuelve `status=ok` |
| `/api/summary` | Devuelve KPIs numericos |
| `/api/timeseries` | Devuelve arreglo por fecha |
| `/api/intents` | Devuelve distribucion por intencion |
| `/api/top-companies` | Devuelve ranking |
| `/api/quality` | Devuelve tasas de calidad |
| `/api/logs` | Devuelve paginacion |
| `/api/export.csv` | Devuelve CSV filtrado |

## UI QA

Validar:

| Prueba | Resultado esperado |
|---|---|
| Carga inicial | Muestra KPIs |
| Loading | Skeleton visible |
| Error API | Mensaje claro y boton reintentar |
| Sin datos | Empty state |
| Filtros | Actualizan graficos |
| Mobile | No hay solapes ni clipping |
| Tabla logs | Paginacion funcional |
| Export CSV | Descarga archivo |

## Manual tests locales

Comandos:

```bash
npm run dev
```

Validar:

```bash
curl http://localhost:8787/api/health
curl "http://localhost:8787/api/summary?from=2026-07-22&to=2026-07-27"
curl "http://localhost:8787/api/logs?limit=10"
```

## Smoke tests en Cloudflare

Despues de desplegar:

1. Abrir subdominio.
2. Confirmar Cloudflare Access.
3. Abrir dashboard.
4. Probar `/api/health`.
5. Confirmar KPIs visibles.
6. Confirmar filtros.
7. Confirmar que no hay secretos en bundle ni logs.

## Criterios de aceptacion final

El proyecto esta listo para produccion cuando:

1. El dashboard despliega correctamente.
2. El subdominio esta protegido.
3. `/api/health` responde `ok`.
4. `/api/summary` devuelve metricas correctas.
5. `/api/logs` pagina correctamente.
6. Los endpoints administrativos requieren token.
7. No hay duplicados por `log_id` en cache o tabla limpia.
8. Errores de parsing quedan contabilizados.
9. No hay secretos en logs ni archivos.
10. La UI funciona en desktop y movil.

## Prueba de reconciliacion

Con el archivo de muestra analizado:

| Indicador esperado | Valor observado |
|---|---:|
| Total registros | 100 |
| Sesiones unicas | 2 |
| Modelo | Gemini-3-Flash |
| Errores `error_log` | 0 |
| JSON invalido en `respuesta_ia` | 3 |
| Intencion `COMPANY` | 89 |
| Intencion `SECTOR` | 5 |
| Intencion `SERVICE` | 2 |
| Intencion `MIXED` | 1 |
| Outputs con resultados | 100 |
| Respuestas ambiguas por output | 92 |
| Respuestas con web | 74 |

El parser y los agregadores deben reproducir estos totales usando fixtures derivados del dataset de muestra.
