import { createHash } from 'node:crypto';
import { parseJsonFields, parseMetadata, parseOutputHtml } from './parsers';
import type { ApiSummaryResponse, RawLogEntry } from '../shared/types';

interface SummaryOptions {
  ipHashSalt: string;
  parserVersion: string;
  reportTimezone: string;
}

export function buildSummary(
  rows: RawLogEntry[],
  options: SummaryOptions,
): ApiSummaryResponse {
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
      userHashes.add(hashIp(parsedMetadata.ipUsuario, options.ipHashSalt));
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

function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${ip}${salt}`).digest('hex');
}

function ratio(value: number, total: number): number {
  return total ? round(value / total) : 0;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
