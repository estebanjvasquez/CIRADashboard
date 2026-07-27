# AI Development Best Practices

## Objetivo

Definir como debe trabajarse este proyecto desde un IDE con IA usando Claude, Codex u otro agente de desarrollo, aplicando buenas practicas modernas de Anthropic, OpenAI y Google.

## Principios generales

1. Dar contexto durable al agente en archivos del repositorio.
2. Separar instrucciones de producto, arquitectura, datos, seguridad y tareas.
3. Implementar en pasos pequenos y verificables.
4. Crear tests antes de conectar servicios externos.
5. No exponer secretos.
6. Mantener parsers puros y testeables.
7. Documentar comandos de desarrollo, prueba y despliegue.
8. Usar fixtures anonimizados para reproducir errores.
9. Evitar cambios masivos sin validacion.
10. Priorizar soluciones simples antes de introducir infraestructura pagada.

## Buenas practicas para Claude

### Archivo `CLAUDE.md`

Claude funciona mejor cuando el repositorio contiene un archivo `CLAUDE.md` con:

- Objetivo del proyecto.
- Arquitectura.
- Comandos disponibles.
- Reglas de seguridad.
- Estilo de codigo.
- Como correr tests.
- Que archivos leer antes de modificar.
- Restricciones de coste.

### Prompting recomendado

Usar prompts con bloques claros:

```xml
<context>
Proyecto Cloudflare Pages/Worker para leer Supabase y mostrar un dashboard web propio.
</context>

<task>
Implementa el parser de output HTML.
</task>

<constraints>
- No uses dependencias pesadas.
- Debe tolerar HTML incompleto.
- Debe incluir tests.
</constraints>

<acceptance_criteria>
- Extrae resultados_encontrados.
- Extrae web_detectada.
- Detecta consulta_ambigua_output.
- Tests pasan.
</acceptance_criteria>
```

### Flujo recomendado con Claude

1. Pedir plan corto antes de cambios grandes.
2. Implementar un modulo por vez.
3. Pedir tests junto con el codigo.
4. Pedir que explique decisiones solo cuando sean importantes.
5. Pedir que no toque archivos fuera del alcance.

## Buenas practicas para Codex / Gemini

### Archivo `AGENTS.md`

Codex y Gemini funcionan mejor con instrucciones persistentes del repositorio. El archivo `AGENTS.md` debe indicar:

- Objetivo.
- Stack.
- Estructura de carpetas.
- Comandos de test/lint.
- Reglas de seguridad.
- Como validar cambios.
- Convenciones de codigo.
- Politica de no modificar secretos.

### Flujo recomendado

1. Pedir que inspeccione el repo antes de editar.
2. Pedir que cree o actualice tests.
3. Ejecutar tests despues de cada cambio importante.
4. Mantener cambios pequenos.
5. Confirmar integraciones externas con mocks antes de usar credenciales reales.

## Buenas practicas para dashboards web propios

### Preparacion de datos

El frontend debe recibir datos limpios y tipados desde la API:

- Fechas como fechas.
- Numeros como numeros.
- Booleanos como boolean o `0/1`, pero de forma consistente.
- Evitar HTML bruto.
- Evitar JSON serializado sin procesar.
- Mantener una fila por interaccion.

### Modelado

Crear campos limpios como:

- `fecha_local`
- `hora_local`
- `query_intent`
- `empresa_detectada`
- `categorias_detectadas`
- `resultados_encontrados`
- `consulta_ambigua_output`
- `tiene_error`

### Rendimiento

1. No enviar columnas innecesarias al frontend.
2. Evitar calcular metricas pesadas en componentes React.
3. Precalcular agregados en la API cuando sea posible.
4. Usar filtros de fecha.
5. Si Supabase empieza a ir lento, usar tabla limpia en Supabase, Cloudflare D1 o cache KV.

## Buenas practicas de seguridad

### Secretos

Nunca commitear:

```text
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_PRIVATE_KEY
ADMIN_SYNC_TOKEN
IP_HASH_SALT
```

Usar:

```bash
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GOOGLE_PRIVATE_KEY
wrangler secret put ADMIN_SYNC_TOKEN
```

### Datos personales

La IP puede considerarse dato sensible. Para dashboard gerencial se recomienda:

- Guardar `ip_usuario` solo si es necesario.
- Preferir `ip_hash`.
- No publicar dashboards con IP visible.

## Buenas practicas de implementacion

### Parsers

Los parsers deben ser funciones puras:

```ts
parseJsonFields(raw: string): ParsedJsonResult
parseOutputHtml(html: string): ParsedOutputResult
normalizeLogRow(row: RawLogEntry): CleanMetricRow
```

Ventajas:

- Faciles de testear.
- No dependen de Supabase.
- No dependen del frontend.
- Permiten reprocesar datos historicos.

### Conectores externos

Separar conectores:

```text
supabase.ts
cache.ts
metrics.ts
```

No mezclar parsing con llamadas HTTP.

### Idempotencia

Cada registro limpio debe usar:

```text
log_id
```

como clave de deduplicacion.

### Observabilidad

Cada ejecucion debe producir:

- filas leidas,
- filas escritas,
- filas fallidas,
- duracion,
- ultima fecha procesada,
- version del parser.

## Anti-patrones a evitar

| Anti-patron | Por que evitarlo |
|---|---|
| Mostrar log bruto directamente | Dashboard limitado y fragil |
| Parsear HTML dentro de componentes React | Lento y dificil de mantener |
| Guardar service role en frontend | Riesgo critico |
| Usar una sola funcion enorme | Dificil de testear |
| No versionar parser | Imposible auditar cambios |
| Reprocesar sin control de duplicados | Datos inflados |
| Calcular todo en el navegador | Fragilidad y bajo rendimiento |
