# Security and Operations

## Principios de seguridad

1. Ninguna credencial debe guardarse en el repositorio.
2. La key `service_role` de Supabase solo debe existir en Cloudflare Secrets.
3. Los endpoints administrativos deben protegerse con token.
4. El Worker no debe exponer datos brutos sensibles al publico.
5. La API y el dashboard deben exponer solo datos necesarios para analitica.
6. El subdominio debe estar protegido con Cloudflare Access o autenticacion equivalente.

## Datos sensibles

Campos potencialmente sensibles:

| Campo | Riesgo | Recomendacion |
|---|---|---|
| `ip_usuario` | Dato personal o identificador indirecto | Anonimizar o mostrar solo hash |
| `pregunta_usuario` | Puede contener informacion no esperada | Mantener acceso restringido |
| `output` | Puede contener telefonos/RIF/direcciones | No exponer HTML completo |
| `metadata` | Puede contener origen e IP | Extraer solo lo necesario |
| `SUPABASE_SERVICE_ROLE_KEY` | Acceso privileged | Solo en Cloudflare Secrets |

## Anonimizacion recomendada

Para dashboard gerencial, reemplazar IP por hash:

```text
ip_hash = SHA256(ip_usuario + SALT_PRIVADO)
```

Asi se mantiene conteo de usuarios aproximados sin exponer IP real.

Variable:

```text
IP_HASH_SALT
```

## Permisos Supabase

Opciones:

### Opcion A: Service role en Worker

Mas simple para MVP.

Controles:

- Solo en Cloudflare Secrets.
- Repositorio privado.
- No loguear headers.
- No devolver payloads brutos completos.

### Opcion B: Funcion SQL segura

Crear funcion o vista especifica para exponer solo columnas necesarias.

Mas segura, mas trabajo inicial.

## Autenticacion del dashboard

### Recomendado: Cloudflare Access

Politica sugerida:

- permitir solo emails autorizados,
- requerir OTP o identidad corporativa,
- proteger `metricas.dominio.com/*`,
- proteger tambien rutas `/api/*`.

### Alternativa: login propio

Usar solo si se necesitan roles internos.

## Logs operativos

Registrar en cada ejecucion o request agregada:

| Campo | Descripcion |
|---|---|
| `started_at` | Inicio de ejecucion |
| `finished_at` | Fin de ejecucion |
| `duration_ms` | Duracion |
| `rows_read` | Filas leidas |
| `rows_processed` | Filas procesadas |
| `rows_failed` | Filas con error |
| `cache_hit` | Si se uso cache |
| `parser_version` | Version de parser |
| `status` | `ok`, `partial`, `failed` |

## Monitoreo minimo

MVP:

- Revisar ejecuciones en Cloudflare dashboard.
- Revisar errores en logs del Worker.
- Mostrar card tecnica en el dashboard con estado de API/parser.

Fase posterior:

- Notificacion por email o Teams si `rows_failed > 0`.
- Alerta si Supabase no responde.
- Alerta si no hay datos nuevos en mas de 24 horas.

## Politica de retencion

Recomendacion inicial:

| Dataset | Retencion |
|---|---|
| Supabase logs brutos | Segun necesidad operativa |
| Cache/tabla limpia | 12-24 meses |
| Errores de procesamiento | 90-180 dias |
| Logs de Cloudflare | Segun plan disponible |

## Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Cambio en HTML de `output` rompe parser | Tests con fixtures y versionado |
| JSON invalido en `respuesta_ia` | Capturar error y marcar fila |
| Duplicados en tabla limpia/cache | Usar `log_id` como clave |
| Dashboard lento | Agregar cache, paginacion y endpoints agregados |
| Exposicion de service role | Secrets, no logs, no frontend |
| Dashboard publico por error | Cloudflare Access obligatorio |
| IP visible sin necesidad | Hash con `IP_HASH_SALT` |

## Criterios de operacion estable

El sistema se considera estable si:

1. El dashboard carga correctamente.
2. La API responde `/api/health`.
3. No hay secretos en logs.
4. No hay duplicados por `log_id`.
5. Los errores de parsing son menores al 2%.
6. El dashboard carga metricas sin errores.
