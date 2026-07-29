-- Añade parse_status y parse_ok (observabilidad de parseo del JSON del agente)
-- a la vista v_logs. Requiere haber aplicado 001 primero.
CREATE OR REPLACE VIEW public.v_logs AS
SELECT
  l.id,
  l.fecha_creacion,
  l.session_id,
  l.pregunta_usuario,
  l.respuesta_ia,
  l.output,
  l.error_log,
  l.tokens_usados,
  l.metadata->>'resultado_tipo' AS resultado_tipo,
  l.metadata->>'parse_status' AS parse_status,
  NULLIF(l.metadata->>'parse_ok','')::boolean AS parse_ok,
  NULLIF(l.metadata->>'needs_clarification','')::boolean AS needs_clarification,
  l.metadata->>'query_intent' AS query_intent,
  l.metadata->>'where_clause' AS where_clause,
  NULLIF(l.metadata->>'resultados_encontrados','')::int AS resultados_encontrados,
  NULLIF(l.metadata->>'tiempo_respuesta_ms','')::int AS tiempo_respuesta_ms,
  COALESCE(l.metadata->>'ip', l.metadata->>'x-forwarder-for') AS ip,
  l.metadata->>'user_agent' AS user_agent,
  l.metadata->>'accept_language' AS accept_language,
  l.metadata->>'sec_ch_ua_platform' AS ua_platform,
  l.metadata->>'sec_ch_ua_mobile' AS ua_mobile,
  l.metadata->'ua_hints' AS ua_hints,
  l.metadata->>'origin' AS origin,
  COALESCE(l.metadata->>'referer', l.metadata->>'referrer') AS referer,
  l.metadata->>'page_url' AS page_url,
  l.metadata->>'page_title' AS page_title,
  l.metadata->>'utm_source' AS utm_source,
  l.metadata->>'utm_medium' AS utm_medium,
  l.metadata->>'utm_campaign' AS utm_campaign,
  l.metadata->>'visitor_id' AS visitor_id,
  NULLIF(l.metadata->>'msg_index','')::int AS msg_index,
  l.metadata->>'widget_mode' AS widget_mode,
  l.metadata->>'screen' AS screen,
  l.metadata->>'viewport' AS viewport,
  l.metadata->>'timezone' AS timezone,
  l.metadata->>'connection' AS connection,
  NULLIF(l.metadata->>'wp_user_id','')::int AS wp_user_id,
  l.metadata->>'wp_user_role' AS wp_user_role,
  g.pais AS geo_pais,
  g.region AS geo_region,
  g.ciudad AS geo_ciudad,
  g.isp AS geo_isp,
  g.actualizado AS geo_actualizado,
  l.metadata AS metadata_raw,
  l.metadata AS metadata
FROM public.audit_log_entries l
LEFT JOIN public.ip_geo g
  ON g.ip = COALESCE(l.metadata->>'ip', l.metadata->>'x-forwarder-for');

GRANT SELECT ON public.v_logs TO service_role;
