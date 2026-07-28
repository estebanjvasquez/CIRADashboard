import { ParsedIaResponse, ParsedMetadata, ParsedOutputHtml } from '../../shared/types';

/**
 * Pure function to parse serialized JSON from `respuesta_ia`.
 */
export function parseJsonFields(rawJson: string | Record<string, unknown> | null): ParsedIaResponse {
  if (!rawJson) return { isValid: false, queryIntent: 'NO_JSON' };
  try {
    const data = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    return {
      isValid: true,
      whereClause: asString(data.whereClause),
      queryIntent: asString(data.queryIntent) || 'UNKNOWN',
      hasFilter: Boolean(data.hasFilter),
      needsClarification: Boolean(data.needsClarification),
      isSearchReady: Boolean(data.isSearchReady),
      humanSummary: asString(data.humanSummary),
    };
  } catch {
    return { isValid: false, queryIntent: 'NO_JSON' };
  }
}

/**
 * Pure function to parse serialized metadata JSON from `metadata`.
 */
export function parseMetadata(rawMetadata: string | Record<string, unknown> | null): ParsedMetadata {
  if (!rawMetadata) return { isValid: false };
  try {
    const data = typeof rawMetadata === 'string' ? JSON.parse(rawMetadata) : rawMetadata;
    return {
      isValid: true,
      modelo: asString(data.modelo),
      origin: asString(data.origin),
      referer: asString(data.referer),
      ejecucionId: asString(data.ejecucion_id),
      ipUsuario: firstString(data, [
        'x-forwarder-for',
        'x-forwarded-for',
        'x_forwarded_for',
        'cf-connecting-ip',
        'cf_connecting_ip',
        'ip_usuario',
        'ip',
      ]),
      country: firstString(data, ['cf-ipcountry', 'cf_ipcountry', 'country', 'pais', 'geo_country']),
      region: firstString(data, ['region', 'region_name', 'state', 'estado', 'geo_region']),
      city: firstString(data, ['city', 'ciudad', 'geo_city']),
      timezone: firstString(data, ['timezone', 'time_zone', 'tz']),
      longitudCaracteres: asNumber(data.longitud_caracteres),
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
  const text = htmlToText(html);
  const empresaDetectada = extractCompanyFromHtmlText(text);
  const categoriasDetectadas = extractCategories(html);
  const ubicacionDetectada = extractLocation(text);
  const [ciudadDetectada, estadoDetectado] = splitLocation(ubicacionDetectada);

  return {
    resultadosEncontrados,
    consultaAmbiguaOutput,
    tieneWeb,
    webDetectada,
    rifDetectado,
    empresaDetectada,
    ubicacionDetectada,
    ciudadDetectada,
    estadoDetectado,
    categoriasDetectadas,
  };
}

function firstString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(data[key]);
    if (value) return value.split(',')[0].trim();
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCompanyFromHtmlText(text: string): string | undefined {
  const rifIndex = text.search(/\bRIF:/i);
  const head = rifIndex > 0 ? text.slice(0, rifIndex) : text;
  const withoutResults = head.replace(/Encontr[eé]\s+\d+\s+resultado[s]?\.?/i, '').trim();
  const candidate = withoutResults.split(/\s{2,}|\s-\s/)[0]?.trim();
  return candidate && candidate.length > 2 ? candidate : undefined;
}

function extractCategories(html: string): string[] {
  const categories = new Set<string>();
  const spanMatches = html.matchAll(/<span[^>]*>(.*?)<\/span>/gis);
  for (const match of spanMatches) {
    const text = htmlToText(match[1]).trim();
    if (/^[A-ZÁÉÍÓÚÑ0-9 &/.-]{3,}$/.test(text) && !/RIF|HTTP|WWW/.test(text)) {
      categories.add(text);
    }
  }
  return Array.from(categories);
}

function extractLocation(text: string): string | undefined {
  const match = text.match(/\b(?:Ubicaci[oó]n|Direcci[oó]n|Estado|Ciudad):\s*([^|]{3,80})/i);
  return match?.[1]?.trim();
}

function splitLocation(location: string | undefined): [string | undefined, string | undefined] {
  if (!location) return [undefined, undefined];
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return [parts[0], parts[1]];
}
