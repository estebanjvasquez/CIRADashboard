/**
 * CIRADashboard Core TypeScript Domain Models
 */

/**
 * Raw audit log entry from Supabase `audit_log_entries` table.
 */
export interface RawLogEntry {
  id: string;
  fecha_creacion: string;
  session_id: string;
  pregunta_usuario: string;
  respuesta_ia: string | Record<string, unknown> | null;
  tokens_usados: number;
  metadata: string | Record<string, unknown> | null;
  error_log: string | null;
  output: string | null;
}

/**
 * Parsed output fields extracted from `respuesta_ia` JSON string.
 */
export interface ParsedIaResponse {
  isValid: boolean;
  whereClause?: string;
  queryIntent?: 'COMPANY' | 'SECTOR' | 'SERVICE' | 'MIXED' | 'NO_JSON' | string;
  hasFilter?: boolean;
  needsClarification?: boolean;
  isSearchReady?: boolean;
  humanSummary?: string;
}

/**
 * Parsed metadata fields extracted from `metadata` JSON string.
 */
export interface ParsedMetadata {
  isValid: boolean;
  modelo?: string;
  origin?: string;
  referer?: string;
  ejecucionId?: string;
  ipUsuario?: string;
  ipHash?: string;
  longitudCaracteres?: number;
}

/**
 * Parsed output fields extracted from `output` HTML string.
 */
export interface ParsedOutputHtml {
  resultadosEncontrados: number;
  consultaAmbiguaOutput: boolean;
  tieneWeb: boolean;
  webDetectada?: string;
  rifDetectado?: string;
  telefonoDetectado?: string;
  empresaDetectada?: string;
  ubicacionDetectada?: string;
  ciudadDetectada?: string;
  estadoDetectado?: string;
  categoriasDetectadas: string[];
}

/**
 * Clean, normalized analytics metric row.
 */
export interface CleanMetricRow {
  log_id: string;
  fecha_creacion_utc: string;
  fecha_local: string;
  hora_local: number;
  dia_semana: string;
  session_id: string;
  pregunta_usuario: string;
  pregunta_normalizada: string;
  tokens_usados: number;
  query_intent: string;
  where_clause?: string;
  human_summary?: string;
  has_filter: boolean;
  needs_clarification_ai: boolean;
  is_search_ready: boolean;
  modelo?: string;
  origin?: string;
  referer?: string;
  ejecucion_id?: string;
  ip_hash?: string;
  tiene_error: boolean;
  error_log?: string;
  json_respuesta_valido: boolean;
  json_metadata_valido: boolean;
  resultados_encontrados: number;
  consulta_ambigua_output: boolean;
  tiene_web: boolean;
  web_detectada?: string;
  rif_detectado?: string;
  telefono_detectado?: string;
  empresa_detectada?: string;
  ubicacion_detectada?: string;
  ciudad_detectada?: string;
  estado_detectado?: string;
  categorias_detectadas: string;
  cantidad_categorias: number;
  procesado_en: string;
  parser_version: string;
}

/**
 * API Executive Summary Response contract.
 */
export interface ApiSummaryResponse {
  totalQueries: number;
  uniqueSessions: number;
  uniqueUsers: number;
  avgTokens: number;
  totalTokens: number;
  ambiguityRate: number;
  errorRate: number;
  invalidJsonRows: number;
  responsesWithWebsiteRate: number;
  parserVersion: string;
  generatedAt: string;
}

export interface ApiTimeseriesRow {
  date: string;
  queries: number;
  tokens: number;
  errors: number;
  ambiguous: number;
}

export interface ApiTimeseriesResponse {
  rows: ApiTimeseriesRow[];
  parserVersion: string;
  generatedAt: string;
}

export interface ApiQualityResponse {
  totalRows: number;
  ambiguousRows: number;
  ambiguityRate: number;
  errorRows: number;
  errorRate: number;
  invalidJsonRows: number;
  invalidJsonRate: number;
  rowsWithWebsite: number;
  responsesWithWebsiteRate: number;
  parserVersion: string;
  generatedAt: string;
}

export interface ApiRankingRow {
  label: string;
  count: number;
  percentage: number;
}

export interface ApiRankingResponse {
  rows: ApiRankingRow[];
  parserVersion: string;
  generatedAt: string;
}

export interface ApiDiagnosticRow {
  logId: string;
  fechaCreacion: string;
  sessionId: string;
  preguntaUsuario: string;
  respuestaIaPreview?: string;
  outputPreview?: string;
  queryIntent?: string;
  whereClause?: string;
  humanSummary?: string;
  resultadosEncontrados: number;
  needsClarificationAi?: boolean;
  consultaAmbiguaOutput: boolean;
  reason: string;
}

export interface ApiDiagnosticsResponse {
  rows: ApiDiagnosticRow[];
  totalMatched: number;
  limit: number;
  parserVersion: string;
  generatedAt: string;
}

export interface ApiDashboardResponse {
  summary: ApiSummaryResponse;
  timeseries: ApiTimeseriesResponse;
  intents: ApiRankingResponse;
  companies: ApiRankingResponse;
  categories: ApiRankingResponse;
  locations: ApiRankingResponse;
  quality: ApiQualityResponse;
  invalidJson: ApiDiagnosticsResponse;
  ambiguous: ApiDiagnosticsResponse;
  noResults: ApiNoResultsResponse;
  generatedAt: string;
}

export interface ApiNoResultsRow {
  term: string;
  count: number;
  coincidesSector: boolean;
  coincidesService: boolean;
  priority: 'BUG_REAL' | 'SINONIMO' | 'RUIDO';
  action: string;
  sampleQuestion: string;
}

export interface ApiNoResultsResponse {
  rows: ApiNoResultsRow[];
  totalMatched: number;
  parserVersion: string;
  generatedAt: string;
}
