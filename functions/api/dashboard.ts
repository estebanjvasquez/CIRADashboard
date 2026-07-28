import {
  buildAmbiguousDiagnostics,
  buildCategoryRanking,
  buildCompanyRanking,
  buildIntentRanking,
  buildInvalidJsonDiagnostics,
  buildNoResultsDiagnostics,
  buildLocationRanking,
  buildTimezoneRanking,
  buildQuality,
  buildSummary,
  buildTimeseries,
} from '../../src/etl/metrics';
import { fetchCatalogTerms, fetchSupabaseRows } from '../../src/etl/supabase';
import { enrichRowsWithIpGeo } from '../../src/etl/geo';
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
  const [rawRows, catalog] = await Promise.all([
    fetchSupabaseRows(env, {
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    }),
    fetchCatalogTerms(env),
  ]);
  const rows = await enrichRowsWithIpGeo(env, rawRows);

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
    timezones: buildTimezoneRanking(rows, sharedOptions),
    quality: buildQuality(rows, sharedOptions),
    invalidJson: buildInvalidJsonDiagnostics(rows, {
      limit: 12,
      parserVersion: env.PARSER_VERSION,
    }),
    ambiguous: buildAmbiguousDiagnostics(rows, {
      limit: 12,
      parserVersion: env.PARSER_VERSION,
    }),
    noResults: buildNoResultsDiagnostics(rows, {
      sectors: catalog.sectors,
      services: catalog.services,
      limit: 12,
      parserVersion: env.PARSER_VERSION,
    }),
    generatedAt: new Date().toISOString(),
  };

  const response = Response.json(responseBody, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return response;
};
