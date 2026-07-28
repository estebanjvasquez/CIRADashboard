# Brief para el IDE/IA: filtrar falsos positivos en el diagnóstico de CIRA

## Contexto
La app de diagnóstico exporta dos listados a partir de la tabla de logs del bot:
1. **Respuestas ambiguas** = el `output` contiene el texto `"Te refieres"`.
2. **JSON inválido** = se intentó `JSON.parse(respuesta_ia)` y falló.

**Problema:** ambas heurísticas producen muchos FALSOS POSITIVOS. El bot está diseñado
para responder unas veces con JSON (cuando es una búsqueda) y otras veces con **texto
conversacional a propósito** (saludos, "no encontramos", "fuera de mi ámbito", detalle de
una sola empresa). El diagnóstico actual cuenta esas respuestas correctas como errores.

Objetivo: **excluir los falsos positivos** para tener métricas reales del bot ACTUAL.

## Columnas disponibles en el log
`log_id, fecha_creacion, session_id, reason, pregunta_usuario, respuesta_ia (preview),
output (preview), query_intent, where_clause, human_summary, resultados_encontrados,
needs_clarification_ai`

> Nota: donde diga `respuesta_ia` usar la columna con la salida cruda del agente; si solo
> existe el preview, las reglas por patrón de texto igual funcionan porque el patrón está al inicio.

---

## Reglas de EXCLUSIÓN (falsos positivos a descartar del conteo)

### FP-1 · Formato LEGADO `[INTENT:...]` (arquitectura vieja, no aplica al bot actual)
El bot antiguo devolvía `[INTENT:LIST] [{...}]`. Ese prompt ya no existe (se migró al formato
`whereClause` ~2026-04). No debe contar como error del bot actual.
```sql
respuesta_ia ~* '^\s*\[(intent|needs_clar)'
```
(≈ 267 filas en el set de "JSON inválido")

### FP-2 · Input vacío
No hubo pregunta del usuario; no es un fallo del bot.
```sql
COALESCE(TRIM(pregunta_usuario), '') = ''
```
(≈ 13 filas)

### FP-3 · Respuesta conversacional legítima (el bot respondió en texto a propósito)
Son respuestas CORRECTAS de tipo `conversation`, no JSON roto.
```sql
   respuesta_ia ILIKE 'hola%'                         -- saludo
OR respuesta_ia ILIKE '%soy cira%'
OR respuesta_ia ILIKE '%no encontr%'                  -- "no encontramos empresas..."
OR respuesta_ia ILIKE '%fuera de mi %mbito%'          -- consulta fuera de alcance
OR respuesta_ia ILIKE '%debe limitar su b%squeda%'    -- bloqueo correcto de "listar todo"
```
(≈ 94 filas)

### FP-4 · "Ambigua" que en realidad es DETALLE de una sola empresa
El `"Te refieres"` se dispara aunque haya **1 solo** resultado exacto, o cuando el mensaje
lo generó el propio widget al hacer clic en una tarjeta (`dame información sobre la empresa X`).
Eso NO es ambigüedad.
```sql
   (query_intent = 'COMPANY' AND resultados_encontrados = 1)
OR pregunta_usuario ILIKE 'dame informaci%n sobre la empresa%'
```
(≈ 337–340 filas del set "ambiguas")

---

## Definición CORRECTA de cada métrica (lo que SÍ debe contar)

### Ambigüedad REAL  ⚠️ CORRECCIÓN IMPORTANTE
**La señal `output` contiene `"Te refieres"` es INCORRECTA para medir ambigüedad.**
Ese texto proviene de la tarjeta de empresa (intent COMPANY) y en el histórico el 100 % de
esos casos tenían `resultados_encontrados = 1` → NO son ambigüedades. Por eso, si defines
"ambigua" como `Te refieres` + `resultados > 1`, el resultado es **cero** (no porque no exista
ambigüedad, sino porque está en otro lado).

La ambigüedad real se manifiesta como una **petición de aclaración en texto** (el bot ofrece
un menú "A)/B)" o marca `needs_clarification`). En el histórico eso quedó guardado dentro del
listado de "JSON inválido", no en "ambiguas". Detéctala así:
```sql
   needs_clarification_ai = TRUE
OR respuesta_ia ~* 'puede (referirse|interpretarse)'
OR respuesta_ia ~* '\mA\).*\mB\)'          -- ofrece opciones A) ... B) ...
OR respuesta_ia ILIKE '%[NEEDS_CLARIFICATION%'
```
En el dataset histórico esto da **≈ 25 casos reales** de ambigüedad (todos del comportamiento
de menú "A/B"). Nota: el prompt MEJORADO prohíbe ese menú (regla ANTI-MENÚ + CASO B), así que
esta métrica debería tender a 0 con el bot nuevo — pero se mide con ESTA señal, no con "Te refieres".

### JSON inválido REAL
Solo cuando el agente **intentó** una búsqueda (no fue conversación) y el JSON quedó roto
sin que el parser de respaldo lo recuperara → el usuario recibió resultado vacío/erróneo.
```sql
-- se esperaba búsqueda pero no salió where_clause utilizable
(where_clause IS NULL OR TRIM(where_clause) = '')
AND NOT (   -- y NO es ninguno de los falsos positivos de arriba
      respuesta_ia ~* '^\s*\[(intent|needs_clar)'
   OR COALESCE(TRIM(pregunta_usuario),'') = ''
   OR respuesta_ia ILIKE 'hola%'
   OR respuesta_ia ILIKE '%soy cira%'
   OR respuesta_ia ILIKE '%no encontr%'
   OR respuesta_ia ILIKE '%fuera de mi %mbito%'
   OR respuesta_ia ILIKE '%debe limitar su b%squeda%'
)
```
El caso arquetípico que SÍ cuenta: nombres con apóstrofe (`KALA'S, C.A.`) que generaban
`Bad escaped character` (`reason ILIKE '%escaped%'`).

---

## Consulta final sugerida (aplica todas las exclusiones)
```sql
SELECT *
FROM logs
WHERE fecha_creacion >= '2026-04-17'          -- solo arquitectura actual (whereClause)
  AND respuesta_ia !~* '^\s*\[(intent|needs_clar)'          -- FP-1
  AND COALESCE(TRIM(pregunta_usuario),'') <> ''             -- FP-2
  AND respuesta_ia NOT ILIKE 'hola%'                        -- FP-3
  AND respuesta_ia NOT ILIKE '%soy cira%'
  AND respuesta_ia NOT ILIKE '%no encontr%'
  AND respuesta_ia NOT ILIKE '%fuera de mi %mbito%'
  AND respuesta_ia NOT ILIKE '%debe limitar su b%squeda%'
  AND NOT (query_intent = 'COMPANY' AND resultados_encontrados = 1)   -- FP-4
  AND pregunta_usuario NOT ILIKE 'dame informaci%n sobre la empresa%';
```
> MySQL: `ILIKE` → `LIKE` (ya es case-insensitive por collation) y `~*` → `REGEXP`.

## Validación (números esperados en el dataset histórico)
Al aplicar los filtros deberían quedar EXCLUIDAS aprox.:
- 267 filas `[INTENT:...]` (legado)
- 94 filas conversacionales (saludo / no-resultados / fuera de ámbito)
- 13 filas de input vacío
- ~340 "ambiguas" que eran detalle de 1 empresa
Y sobrevivir como **errores reales** principalmente los casos de apóstrofe/escape (`~3`)
y cualquier búsqueda con `where_clause` vacío no conversacional.

---

## Mejora de fondo (recomendada) — dejar de adivinar con texto
La causa raíz es que el log guarda la salida cruda del agente y el diagnóstico infiere el
tipo por patrones. Es mucho más fiable **registrar el desenlace real** en el logger
(subworkflow `CIRA_log` / nodo `Edit Fields1`). Agregar estas columnas:

| Columna | Valores | Cómo se obtiene |
|---|---|---|
| `resultado_tipo` | `results` \| `conversation` \| `sin_resultados` \| `comando` \| `error` | del campo `type` que ya devuelve cada `Respond*` |
| `parse_ok` | boolean | del nodo `Parse Intent JSON3` (si logró `isSearchReady` o `conversationalText` limpio) |
| `es_error_real` | boolean | `true` solo si el parse falló Y el respaldo también, y el usuario recibió respuesta vacía/rota |

Con eso el dashboard se simplifica a:
```sql
-- métrica de errores reales, sin heurísticas de texto
SELECT * FROM logs WHERE es_error_real = TRUE;

-- métrica de ambigüedad real
SELECT * FROM logs
WHERE resultado_tipo = 'conversation' AND needs_clarification_ai = TRUE
  AND resultados_encontrados > 1;
```

## Resumen para el agente del IDE
1. Añadir los filtros de exclusión FP-1…FP-4 a las consultas que generan ambos listados.
2. Segmentar el formato legado `[INTENT:...]` aparte (o excluirlo por fecha < 2026-04-17).
3. (Ideal) Agregar `resultado_tipo`, `parse_ok`, `es_error_real` al logger y migrar el
   dashboard a filtrar por `es_error_real` en lugar de intentar `JSON.parse` sobre toda salida.
