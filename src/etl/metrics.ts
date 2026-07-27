import { parseJsonFields, parseMetadata, parseOutputHtml } from './parsers';
import type {
  ApiQualityResponse,
  ApiRankingResponse,
  ApiSummaryResponse,
  ApiTimeseriesResponse,
  RawLogEntry,
} from '../shared/types';

interface SummaryOptions {
  ipHashSalt: string;
  parserVersion: string;
  reportTimezone: string;
}

export async function buildSummary(
  rows: RawLogEntry[],
  options: SummaryOptions,
): Promise<ApiSummaryResponse> {
  const sessionIds = new Set<string>();
  const userHashes = new Set<string>();
  let totalTokens = 0;
  let ambiguousRows = 0;
  let errorRows = 0;
  let invalidJsonRows = 0;
  let rowsWithWebsite = 0;

  for (const row of rows) {
    if (row.session_id) sessionIds.add(row.session_id);
    totalTokens += Number(row.tokens_usados || 0);
    if (row.error_log) errorRows += 1;

    const parsedIa = parseJsonFields(row.respuesta_ia);
    if (!parsedIa.isValid) invalidJsonRows += 1;

    const parsedMetadata = parseMetadata(row.metadata);
    if (parsedMetadata.ipUsuario) {
      userHashes.add(await hashIp(parsedMetadata.ipUsuario, options.ipHashSalt));
    }

    const parsedHtml = parseOutputHtml(row.output);
    if (parsedHtml.consultaAmbiguaOutput) ambiguousRows += 1;
    if (parsedHtml.tieneWeb) rowsWithWebsite += 1;
  }

  const totalQueries = rows.length;

  return {
    totalQueries,
    uniqueSessions: sessionIds.size,
    uniqueUsers: userHashes.size,
    avgTokens: totalQueries ? round(totalTokens / totalQueries) : 0,
    totalTokens,
    ambiguityRate: ratio(ambiguousRows, totalQueries),
    errorRate: ratio(errorRows, totalQueries),
    invalidJsonRows,
    responsesWithWebsiteRate: ratio(rowsWithWebsite, totalQueries),
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildTimeseries(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion' | 'reportTimezone'>,
): ApiTimeseriesResponse {
  const buckets = new Map<string, { queries: number; tokens: number; errors: number; ambiguous: number }>();

  for (const row of rows) {
    const date = localDate(row.fecha_creacion, options.reportTimezone);
    const html = parseOutputHtml(row.output);
    const current = buckets.get(date) ?? { queries: 0, tokens: 0, errors: 0, ambiguous: 0 };
    current.queries += 1;
    current.tokens += Number(row.tokens_usados || 0);
    if (row.error_log) current.errors += 1;
    if (html.consultaAmbiguaOutput) current.ambiguous += 1;
    buckets.set(date, current);
  }

  return {
    rows: Array.from(buckets.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, values]) => ({ date, ...values })),
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildQuality(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiQualityResponse {
  let ambiguousRows = 0;
  let errorRows = 0;
  let invalidJsonRows = 0;
  let rowsWithWebsite = 0;

  for (const row of rows) {
    const parsedIa = parseJsonFields(row.respuesta_ia);
    const parsedHtml = parseOutputHtml(row.output);
    if (!parsedIa.isValid) invalidJsonRows += 1;
    if (parsedHtml.consultaAmbiguaOutput) ambiguousRows += 1;
    if (parsedHtml.tieneWeb) rowsWithWebsite += 1;
    if (row.error_log) errorRows += 1;
  }

  const totalRows = rows.length;

  return {
    totalRows,
    ambiguousRows,
    ambiguityRate: ratio(ambiguousRows, totalRows),
    errorRows,
    errorRate: ratio(errorRows, totalRows),
    invalidJsonRows,
    invalidJsonRate: ratio(invalidJsonRows, totalRows),
    rowsWithWebsite,
    responsesWithWebsiteRate: ratio(rowsWithWebsite, totalRows),
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildIntentRanking(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiRankingResponse {
  return buildRanking(rows, options, (row) => parseJsonFields(row.respuesta_ia).queryIntent);
}

export function buildCompanyRanking(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiRankingResponse {
  return buildRanking(rows, options, extractCompany);
}

export function buildCategoryRanking(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiRankingResponse {
  return buildRanking(rows, options, (row) => parseOutputHtml(row.output).categoriasDetectadas);
}

export function buildLocationRanking(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiRankingResponse {
  return buildRanking(rows, options, (row) => {
    const parsedHtml = parseOutputHtml(row.output);
    return parsedHtml.estadoDetectado || parsedHtml.ciudadDetectada || parsedHtml.ubicacionDetectada;
  });
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function ratio(value: number, total: number): number {
  return total ? round(value / total) : 0;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function buildRanking(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
  selector: (row: RawLogEntry) => string | string[] | undefined,
): ApiRankingResponse {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const values = selector(row);
    const labels = Array.isArray(values) ? values : [values];
    for (const label of labels) {
      const normalized = normalizeLabel(label);
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  const total = rows.length || 1;
  return {
    rows: Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count, percentage: ratio(count, total) })),
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

function extractCompany(row: RawLogEntry): string | undefined {
  const parsedIa = parseJsonFields(row.respuesta_ia);
  const summaryCompany = parsedIa.humanSummary?.match(/empresa\s+(.+)$/i)?.[1];
  if (summaryCompany) return summaryCompany;

  const whereCompany = parsedIa.whereClause?.match(/%([^%]+)%/)?.[1];
  if (whereCompany) return whereCompany;

  const htmlCompany = parseOutputHtml(row.output).empresaDetectada;
  if (htmlCompany) return htmlCompany;

  return row.pregunta_usuario
    ?.replace(/dame\s+informaci[oó]n\s+sobre\s+la\s+empresa/i, '')
    .trim();
}

function normalizeLabel(label: string | undefined): string | undefined {
  const cleaned = label
    ?.replace(/\s+/g, ' ')
    .replace(/[."']+$/g, '')
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned === 'UNKNOWN') return undefined;
  return cleaned.toUpperCase();
}

function localDate(timestamp: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}
