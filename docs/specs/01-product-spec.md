# Product Spec: Dashboard gerencial del bot

## Vision

Construir una aplicacion ligera que convierta los logs tecnicos del bot en informacion gerencial accionable para entender uso, demanda comercial, calidad de respuestas, errores y oportunidades de mejora del directorio.

## Problema actual

Looker Studio puede conectarse a datos tabulares, pero el log actual contiene informacion importante dentro de:

- JSON serializado en `respuesta_ia`
- JSON serializado en `metadata`
- HTML en `output`

Si Looker Studio consume la tabla bruta, el dashboard queda limitado a metricas basicas como cantidad de filas, tokens y fechas. Para obtener un dashboard gerencial real se necesita una capa de transformacion.

## Usuarios objetivo

| Usuario | Necesidad |
|---|---|
| Gerencia | Ver uso, interes comercial, sectores consultados y calidad general |
| Equipo tecnico | Detectar errores, JSON invalido, costo por tokens y problemas de parsing |
| Equipo comercial | Identificar empresas, sectores, ciudades y categorias mas consultadas |
| Administrador del bot | Mejorar prompts, filtros, busquedas ambiguas y calidad del directorio |

## Objetivos funcionales

1. Automatizar la lectura de logs desde Supabase.
2. Procesar los campos estructurados y semiestructurados.
3. Generar una tabla limpia para Looker Studio.
4. Calcular metricas de gerencia, calidad y demanda.
5. Evitar costos recurrentes siempre que sea posible.
6. Permitir escalamiento futuro hacia BigQuery o una tabla analitica en Supabase.

## Metricas principales

| Metrica | Descripcion |
|---|---|
| Total de consultas | Numero total de mensajes procesados |
| Sesiones unicas | Conversaciones distintas por `session_id` |
| Usuarios aproximados | IPs distintas desde `metadata.x-forwarder-for` |
| Consultas por dia | Tendencia diaria de uso |
| Consultas por hora | Horarios de mayor actividad |
| Intencion de consulta | `COMPANY`, `SECTOR`, `SERVICE`, `MIXED`, otros |
| Empresas mas consultadas | Ranking de empresas solicitadas |
| Sectores/categorias mas consultadas | Demanda por actividad comercial |
| Estados/ciudades consultadas | Distribucion geografica |
| Resultados promedio | Cantidad de resultados devueltos por busqueda |
| Tasa de ambiguedad | Respuestas tipo "Te refieres a..." |
| Tasa de error | Filas con `error_log` |
| Tasa de JSON invalido | Fallos de parsing en `respuesta_ia` o `metadata` |
| Respuestas con web | Empresas con link web detectado |
| Respuestas con telefono | Empresas con telefono detectado |
| Respuestas con RIF | Empresas con RIF detectado |
| Tokens promedio | Consumo promedio por interaccion |
| Tokens totales | Consumo acumulado |

## Criterios de exito

El proyecto se considera exitoso cuando:

1. El pipeline se ejecuta automaticamente sin carga manual.
2. Looker Studio muestra datos actualizados desde una tabla limpia.
3. El dashboard permite responder:
   - cuantas consultas hubo,
   - que empresas se buscan mas,
   - que sectores generan mas interes,
   - donde hay friccion por ambiguedad,
   - que errores tecnicos existen,
   - que informacion del directorio esta incompleta.
4. El costo operativo mensual inicial es 0 EUR o cercano a 0 EUR.
5. El sistema permite reprocesar registros si cambia la logica de extraccion.

## Fuera de alcance inicial

- Reentrenar el bot.
- Modificar la aplicacion actual del chat.
- Crear un sistema completo de BI propietario.
- Reemplazar Supabase.
- Crear dashboards embebidos en la web publica.
- Usar IA adicional para clasificar cada fila, salvo fase futura.

## Fases recomendadas

| Fase | Alcance | Resultado |
|---|---|---|
| 1 | ETL basico desde Supabase a Google Sheets | Dashboard inicial |
| 2 | Extraccion avanzada de HTML y campos de calidad | Dashboard gerencial completo |
| 3 | Tabla historica en Supabase o Cloudflare D1 | Mejor robustez |
| 4 | BigQuery opcional | Escalabilidad analitica |
