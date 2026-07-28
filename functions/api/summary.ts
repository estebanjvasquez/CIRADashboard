import { buildSummary } from '../../src/etl/metrics';
import { fetchSupabaseRows } from '../../src/etl/supabase';

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
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const rows = await fetchSupabaseRows(env, { from, to });
  const response = Response.json(
    await buildSummary(rows, {
      ipHashSalt: env.IP_HASH_SALT,
      parserVersion: env.PARSER_VERSION,
      reportTimezone: env.REPORT_TIMEZONE,
    }),
    { headers: { 'Cache-Control': 'no-store' } },
  );

  return response;
};
