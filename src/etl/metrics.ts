import { parseJsonFields, parseMetadata, parseOutputHtml } from './parsers';
import { getRowIp } from './geo';
import type {
  ApiQualityResponse,
  ApiDiagnosticsResponse,
  ApiNoResultsResponse,
  ApiDemandResponse,
  ApiMetadataCoverageResponse,
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

    if (isRealInvalidJson(row)) invalidJsonRows += 1;

    const parsedMetadata = parseMetadata(row.metadata);
    const userIdentity = row.visitor_id || row.ip || parsedMetadata.ipUsuario;
    if (userIdentity) {
      userHashes.add(row.visitor_id ? userIdentity : await hashIp(userIdentity, options.ipHashSalt));
    }

    if (isRealAmbiguous(row)) ambiguousRows += 1;
    const parsedHtml = parseOutputHtml(row.output);
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
    if (isRealAmbiguous(row)) current.ambiguous += 1;
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
    const parsedHtml = parseOutputHtml(row.output);
    if (isRealInvalidJson(row)) invalidJsonRows += 1;
    if (isRealAmbiguous(row)) ambiguousRows += 1;
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
  return buildRanking(rows, options, (row) => row.query_intent || parseJsonFields(row.respuesta_ia).queryIntent);
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
    // Only use a location when it can be tied to the client IP from v_logs.
    // This prevents company locations in bot output from being counted as visitor locations.
    const ip = getRowIp(row);
    if (!ip) return undefined;

    const flatLocation = [row.geo_ciudad, row.geo_region, row.geo_pais].filter(Boolean).join(', ');
    if (flatLocation) return flatLocation;

    const parsedMetadata = parseMetadata(row.metadata);
    const userLocation = [parsedMetadata.city, parsedMetadata.region, parsedMetadata.country]
      .filter(Boolean)
      .join(', ');
    if (userLocation) return userLocation;

    return 'IP DETECTADA SIN GEOLOCALIZAR';
  });
}

export function buildTimezoneRanking(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiRankingResponse {
  return buildRanking(rows, options, (row) => row.timezone || parseMetadata(row.metadata).timezone);
}

export function buildInvalidJsonDiagnostics(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'> & { limit: number },
): ApiDiagnosticsResponse {
  const matched = rows.filter(isRealInvalidJson);

  return {
    rows: matched.slice(0, options.limit).map((row) => diagnosticRow(row, invalidJsonReason(row))),
    totalMatched: matched.length,
    limit: options.limit,
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildAmbiguousDiagnostics(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'> & { limit: number },
): ApiDiagnosticsResponse {
  const matched = rows.filter(isRealAmbiguous);

  return {
    rows: matched.slice(0, options.limit).map((row) => diagnosticRow(row, ambiguityReason(row))),
    totalMatched: matched.length,
    limit: options.limit,
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildNoResultsDiagnostics(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'> & {
    sectors: string[];
    services: string[];
    limit: number;
  },
): ApiNoResultsResponse {
  const buckets = new Map<string, { count: number; sampleQuestion: string }>();

  for (const row of rows) {
    if (!isNoResultRow(row)) continue;
    const term = normalizeTerm(row.pregunta_usuario);
    if (!term) continue;
    const current = buckets.get(term) ?? { count: 0, sampleQuestion: row.pregunta_usuario };
    current.count += 1;
    buckets.set(term, current);
  }

  const sectorTerms = options.sectors.map(normalizeText);
  const serviceTerms = options.services.map(normalizeText);
  const resultRows = Array.from(buckets.entries())
    .map(([term, data]) => {
      const normalizedTerm = normalizeText(term);
      const coincidesSector = sectorTerms.some((sector) => sector.includes(normalizedTerm));
      const coincidesService = serviceTerms.some((service) => service.includes(normalizedTerm));
      const priority = classifyNoResultTerm(term, coincidesSector || coincidesService);
      return {
        term,
        count: data.count,
        coincidesSector,
        coincidesService,
        priority,
        action: noResultAction(priority),
        sampleQuestion: data.sampleQuestion,
      };
    })
    .sort((left, right) => {
      const priorityOrder = priorityWeight(right.priority) - priorityWeight(left.priority);
      return priorityOrder || right.count - left.count;
    })
    .slice(0, options.limit);

  return {
    rows: resultRows,
    totalMatched: Array.from(buckets.values()).reduce((total, bucket) => total + bucket.count, 0),
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

export function buildDemand(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'> & { limit: number },
): ApiDemandResponse {
  const prospectBuckets = new Map<string, { count: number; lastSeen: string; sampleQuestion: string }>();
  const interestBuckets = new Map<string, { count: number; sampleQuestion: string }>();

  for (const row of rows) {
    const tipo = normalizeText(row.resultado_tipo);
    const intent = normalizeText(row.query_intent);

    // Prospectos: empresa buscada por nombre/RIF que no está afiliada (0 resultados).
    if (tipo === 'sin_resultados' && (intent === 'company' || intent === 'rif')) {
      const term = cleanCompanyTerm(row.pregunta_usuario);
      if (term && term.length >= 2) {
        const prev = prospectBuckets.get(term) ?? {
          count: 0,
          lastSeen: row.fecha_creacion,
          sampleQuestion: row.pregunta_usuario,
        };
        prev.count += 1;
        if (row.fecha_creacion > prev.lastSeen) prev.lastSeen = row.fecha_creacion;
        prospectBuckets.set(term, prev);
      }
    }

    // Intereses: respuestas conversacionales (fuera de búsqueda) categorizadas.
    if (tipo === 'conversation') {
      const category = categorizeInterest(row.pregunta_usuario);
      const prev = interestBuckets.get(category) ?? { count: 0, sampleQuestion: row.pregunta_usuario };
      prev.count += 1;
      interestBuckets.set(category, prev);
    }
  }

  const prospects = Array.from(prospectBuckets.entries())
    .map(([term, data]) => ({ term, count: data.count, lastSeen: data.lastSeen, sampleQuestion: data.sampleQuestion }))
    .sort((left, right) => right.count - left.count || right.lastSeen.localeCompare(left.lastSeen));

  const interests = Array.from(interestBuckets.entries())
    .map(([category, data]) => ({ category, count: data.count, sampleQuestion: data.sampleQuestion }))
    .sort((left, right) => right.count - left.count);

  return {
    prospects: prospects.slice(0, options.limit),
    interests,
    totalProspects: prospects.length,
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
}

function cleanCompanyTerm(value: string | undefined): string {
  return normalizeText(value)
    .replace(/^dame informacion sobre la empresa\s*/, '')
    .replace(/^informacion sobre (la empresa )?/, '')
    .replace(/[.,]+$/, '')
    .trim();
}

function categorizeInterest(value: string | undefined): string {
  const t = normalizeText(value);
  if (/afili|cuota|costo|inscrib|membres/.test(t)) return 'interes_afiliacion';
  if (/curso|evento|taller|capacit|foro|congreso/.test(t)) return 'interes_eventos';
  if (/trabaj|empleo|pasant|\bcv\b|hoja de vida/.test(t)) return 'busqueda_empleo';
  if (/precio|financ|credit|inversion/.test(t)) return 'consulta_economica';
  if (/beneficio|contrasena|perfil/.test(t)) return 'soporte_afiliado';
  return 'otro_fuera_alcance';
}

export function buildMetadataCoverage(
  rows: RawLogEntry[],
  options: Pick<SummaryOptions, 'parserVersion'>,
): ApiMetadataCoverageResponse {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const metadata = parseMetadataObject(row.metadata_raw ?? row.metadata);
    if (!metadata) continue;
    for (const key of Object.keys(metadata)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return {
    rows: Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([field, count]) => ({ field, count })),
    totalRows: rows.length,
    parserVersion: options.parserVersion,
    generatedAt: new Date().toISOString(),
  };
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

function parseMetadataObject(value: string | Record<string, unknown> | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value !== 'string') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
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

function diagnosticRow(row: RawLogEntry, reason: string) {
  const parsedIa = parseJsonFields(row.respuesta_ia);
  const parsedHtml = parseOutputHtml(row.output);
  const resultadosEncontrados =
    typeof row.resultados_encontrados === 'number' ? row.resultados_encontrados : parsedHtml.resultadosEncontrados;

  return {
    logId: row.id,
    fechaCreacion: row.fecha_creacion,
    sessionId: row.session_id,
    preguntaUsuario: truncate(row.pregunta_usuario, 240) ?? '',
    respuestaIaPreview: previewValue(row.respuesta_ia),
    outputPreview: previewHtml(row.output),
    queryIntent: row.query_intent || parsedIa.queryIntent,
    whereClause: truncate(row.where_clause || parsedIa.whereClause, 220),
    humanSummary: truncate(parsedIa.humanSummary, 220),
    resultadosEncontrados,
    needsClarificationAi:
      typeof row.needs_clarification === 'boolean' ? row.needs_clarification : parsedIa.needsClarification,
    consultaAmbiguaOutput: parsedHtml.consultaAmbiguaOutput,
    reason,
  };
}

function invalidJsonReason(row: RawLogEntry): string {
  if (!row.respuesta_ia) return 'respuesta_ia vacio';
  if (typeof row.respuesta_ia !== 'string') return 'respuesta_ia no es string JSON';
  const value = row.respuesta_ia.trim();
  if (!value) return 'respuesta_ia vacio';
  if (/^```/.test(value)) return 'JSON envuelto en Markdown';
  if (!/^[{[]/.test(value)) return 'texto antes del JSON o respuesta en lenguaje natural';
  try {
    JSON.parse(value);
    return 'schema inesperado';
  } catch (error) {
    return error instanceof Error ? truncate(error.message, 120) || 'JSON.parse fallo' : 'JSON.parse fallo';
  }
}

function ambiguityReason(row: RawLogEntry): string {
  if (row.resultado_tipo || typeof row.needs_clarification === 'boolean') {
    return `resultado_tipo=${row.resultado_tipo ?? 'sin_tipo'}, needs_clarification=${String(
      row.needs_clarification ?? false,
    )}`;
  }
  const parsedIa = parseJsonFields(row.respuesta_ia);
  const parsedHtml = parseOutputHtml(row.output);
  const reasons: string[] = [];
  if (parsedIa.needsClarification) reasons.push('needsClarification=true');
  if (hasRawClarificationSignal(row.respuesta_ia)) reasons.push('respuesta_ia contiene aclaracion textual');
  if (parsedHtml.consultaAmbiguaOutput) reasons.push('output contiene "Te refieres"');
  if (parsedHtml.resultadosEncontrados > 1) reasons.push(`${parsedHtml.resultadosEncontrados} resultados encontrados`);
  return reasons.join(', ') || 'ambiguedad detectada';
}

function isRealInvalidJson(row: RawLogEntry): boolean {
  if (row.resultado_tipo) {
    // Solo 'error' es JSON inválido real. 'comando_error' (clave admin errónea) es un
    // comando rechazado, no un JSON malformado; no debe inflar esta métrica.
    if (normalizeText(row.resultado_tipo) !== 'error') return false;
  }
  const parsedIa = parseJsonFields(row.respuesta_ia);
  if (parsedIa.isValid) return false;
  if (isLegacyIntentFormat(row.respuesta_ia)) return false;
  if (isEmptyQuestion(row)) return false;
  if (isLegitimateConversationalResponse(row.respuesta_ia)) return false;
  if (hasRawClarificationSignal(row.respuesta_ia)) return false;
  if (isNoResultRow(row)) return false;
  return true;
}

function isRealAmbiguous(row: RawLogEntry): boolean {
  if (row.resultado_tipo || typeof row.needs_clarification === 'boolean') {
    return normalizeText(row.resultado_tipo) === 'conversation' && row.needs_clarification === true;
  }
  const parsedIa = parseJsonFields(row.respuesta_ia);
  if (isCompanyDetailQuestion(row.pregunta_usuario)) return false;
  if (parsedIa.needsClarification) return true;
  return hasRawClarificationSignal(row.respuesta_ia);
}

function isLegacyIntentFormat(value: string | Record<string, unknown> | null): boolean {
  return typeof value === 'string' && /^\s*\[(intent|needs_clar)/i.test(value);
}

function isEmptyQuestion(row: RawLogEntry): boolean {
  return !row.pregunta_usuario?.trim();
}

function isLegitimateConversationalResponse(value: string | Record<string, unknown> | null): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeText(value);
  return (
    normalized.startsWith('hola') ||
    normalized.includes('soy cira') ||
    normalized.includes('fuera de mi ambito') ||
    normalized.includes('debe limitar su busqueda')
  );
}

function isNoResultRow(row: RawLogEntry): boolean {
  if (row.resultado_tipo) return normalizeText(row.resultado_tipo) === 'sin_resultados';
  if (isEmptyQuestion(row)) return false;
  if (row.pregunta_usuario.trim().startsWith('/')) return false;
  if (isLegitimateConversationalResponse(row.respuesta_ia)) return false;
  const rawResponse = typeof row.respuesta_ia === 'string' ? normalizeText(row.respuesta_ia) : '';
  const output = normalizeText(row.output ?? '');
  return rawResponse.includes('no encontr') || output.includes('no encontramos resultados');
}

function hasRawClarificationSignal(value: string | Record<string, unknown> | null): boolean {
  if (typeof value !== 'string') return false;
  const normalized = normalizeText(value);
  return (
    normalized.includes('[needs_clarification') ||
    /puede (referirse|interpretarse)/i.test(normalized) ||
    /\ba\).*\bb\)/is.test(normalized)
  );
}

function isCompanyDetailQuestion(value: string | undefined): boolean {
  return normalizeText(value).startsWith('dame informacion sobre la empresa');
}

function normalizeText(value: string | undefined | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeTerm(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function classifyNoResultTerm(term: string, catalogMatch: boolean): 'BUG_REAL' | 'SINONIMO' | 'RUIDO' {
  const normalized = normalizeText(term);
  // Ruido primero: términos muy cortos o sin vocales son ruido AUNQUE hagan match parcial
  // de substring contra el catálogo (evita marcar 'a', 'b' como BUG_REAL).
  if (normalized.length <= 3) return 'RUIDO';
  if (!/[aeiou]/.test(normalized)) return 'RUIDO';
  if (catalogMatch) return 'BUG_REAL';
  return 'SINONIMO';
}

function noResultAction(priority: 'BUG_REAL' | 'SINONIMO' | 'RUIDO'): string {
  if (priority === 'BUG_REAL') return 'Revisar whereClause, ChatView o datos del catalogo.';
  if (priority === 'SINONIMO') return 'Candidato a sinonimo o ajuste de vocabulario del prompt.';
  return 'Ignorar salvo repeticion alta.';
}

function priorityWeight(priority: 'BUG_REAL' | 'SINONIMO' | 'RUIDO'): number {
  if (priority === 'BUG_REAL') return 3;
  if (priority === 'SINONIMO') return 2;
  return 1;
}

function previewValue(value: string | Record<string, unknown> | null): string | undefined {
  if (!value) return undefined;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return truncate(text.replace(/\s+/g, ' ').trim(), 300);
}

function previewHtml(html: string | null): string | undefined {
  if (!html) return undefined;
  return truncate(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    300,
  );
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

export function diagnosticsToCsv(rows: ApiDiagnosticsResponse['rows']): string {
  const headers = [
    'log_id',
    'fecha_creacion',
    'session_id',
    'reason',
    'pregunta_usuario',
    'respuesta_ia_preview',
    'output_preview',
    'query_intent',
    'where_clause',
    'human_summary',
    'resultados_encontrados',
    'needs_clarification_ai',
    'consulta_ambigua_output',
  ];
  const lines = rows.map((row) =>
    [
      row.logId,
      row.fechaCreacion,
      row.sessionId,
      row.reason,
      row.preguntaUsuario,
      row.respuestaIaPreview,
      row.outputPreview,
      row.queryIntent,
      row.whereClause,
      row.humanSummary,
      row.resultadosEncontrados,
      row.needsClarificationAi,
      row.consultaAmbiguaOutput,
    ]
      .map(csvCell)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

export function noResultsToCsv(rows: ApiNoResultsResponse['rows']): string {
  const headers = [
    'termino',
    'veces',
    'coincide_sector',
    'coincide_servicio',
    'prioridad',
    'accion',
    'pregunta_ejemplo',
  ];
  const lines = rows.map((row) =>
    [
      row.term,
      row.count,
      row.coincidesSector,
      row.coincidesService,
      row.priority,
      row.action,
      row.sampleQuestion,
    ]
      .map(csvCell)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

export function demandProspectsToCsv(rows: ApiDemandResponse['prospects']): string {
  const headers = ['empresa_buscada', 'veces', 'ultima_vez', 'pregunta_ejemplo'];
  const lines = rows.map((row) =>
    [row.term, row.count, row.lastSeen, row.sampleQuestion].map(csvCell).join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}
