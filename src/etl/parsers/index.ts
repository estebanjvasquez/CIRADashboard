import { ParsedIaResponse, ParsedMetadata, ParsedOutputHtml } from '../../shared/types';

/**
 * Pure function to parse serialized JSON from `respuesta_ia`.
 */
export function parseJsonFields(rawJson: string | null): ParsedIaResponse {
  if (!rawJson) return { isValid: false, queryIntent: 'NO_JSON' };
  try {
    const data = JSON.parse(rawJson);
    return {
      isValid: true,
      whereClause: data.whereClause,
      queryIntent: data.queryIntent || 'UNKNOWN',
      hasFilter: Boolean(data.hasFilter),
      needsClarification: Boolean(data.needsClarification),
      isSearchReady: Boolean(data.isSearchReady),
      humanSummary: data.humanSummary,
    };
  } catch {
    return { isValid: false, queryIntent: 'NO_JSON' };
  }
}

/**
 * Pure function to parse serialized metadata JSON from `metadata`.
 */
export function parseMetadata(rawMetadata: string | null): ParsedMetadata {
  if (!rawMetadata) return { isValid: false };
  try {
    const data = JSON.parse(rawMetadata);
    return {
      isValid: true,
      modelo: data.modelo,
      origin: data.origin,
      referer: data.referer,
      ejecucionId: data.ejecucion_id,
      ipUsuario: data['x-forwarder-for'],
      longitudCaracteres: data.longitud_caracteres,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Pure function to extract structured indicators from `output` HTML string.
 */
export function parseOutputHtml(html: string | null): ParsedOutputHtml {
  if (!html) {
    return {
      resultadosEncontrados: 0,
      consultaAmbiguaOutput: false,
      tieneWeb: false,
      categoriasDetectadas: [],
    };
  }

  const matchResults = html.match(/Encontr[eé]\s*<strong>(\d+)<\/strong>/i);
  const resultadosEncontrados = matchResults ? parseInt(matchResults[1], 10) : 0;
  const consultaAmbiguaOutput = /Te refieres/i.test(html);
  const tieneWeb = /href=/i.test(html);

  const hrefMatch = html.match(/href=["'](https?:\/\/[^"']+)["']/i);
  const webDetectada = hrefMatch ? hrefMatch[1] : undefined;

  const rifMatch = html.match(/RIF:\s*([A-Z]-?[0-9\-]+)/i);
  const rifDetectado = rifMatch ? rifMatch[1] : undefined;

  return {
    resultadosEncontrados,
    consultaAmbiguaOutput,
    tieneWeb,
    webDetectada,
    rifDetectado,
    categoriasDetectadas: [],
  };
}
