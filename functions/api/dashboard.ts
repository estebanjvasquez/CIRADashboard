import { defaultCache } from '../../src/etl/cache';
import {
  buildAmbiguousDiagnostics,
  buildCategoryRanking,
  buildCompanyRanking,
  buildIntentRanking,
  buildInvalidJsonDiagnostics,
  buildLocationRanking,
  buildQuality,
  buildSummary,
  buildTimeseries,
} from '../../src/etl/metrics';
import { fetchSupabaseRows } from '../../src/etl/supabase';
import type { ApiDashboardResponse } from '../../src/shared/types';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_TABLE: string;
  REPORT_TIMEZONE: string;
  PARSER_VERSION: string;
  SYNC_BATCH_SIZE: string;
  IP_HASH_SALT: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const cache = defaultCache();
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const rows = await fetchSupabaseRows(env, {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });

  const sharedOptions = { parserVersion: env.PARSER_VERSION };
  const responseBody: ApiDashboardResponse = {
    summary: await buildSummary(rows, {
      ipHashSalt: env.IP_HASH_SALT,
      parserVersion: env.PARSER_VERSION,
      reportTimezone: env.REPORT_TIMEZONE,
    }),
    timeseries: buildTimeseries(rows, {
      parserVersion: env.PARSER_VERSION,
      reportTimezone: env.REPORT_TIMEZONE,
    }),
    intents: buildIntentRanking(rows, sharedOptions),
    companies: buildCompanyRanking(rows, sharedOptions),
    categories: buildCategoryRanking(rows, sharedOptions),
    locations: buildLocationRanking(rows, sharedOptions),
    quality: buildQuality(rows, sharedOptions),
    invalidJson: buildInvalidJsonDiagnostics(rows, {
      limit: 12,
      parserVersion: env.PARSER_VERSION,
    }),
    ambiguous: buildAmbiguousDiagnostics(rows, {
      limit: 12,
      parserVersion: env.PARSER_VERSION,
    }),
    generatedAt: new Date().toISOString(),
  };

  const response = Response.json(responseBody, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
  await cache.put(cacheKey, response.clone());
  return response;
};
