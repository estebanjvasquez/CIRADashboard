import { enrichRowsWithIpGeo } from '../../src/etl/geo';
import { buildLocationRanking } from '../../src/etl/metrics';
import { fetchSupabaseRows } from '../../src/etl/supabase';

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_TABLE: string;
  PARSER_VERSION: string;
  SYNC_BATCH_SIZE: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const rawRows = await fetchSupabaseRows(env, {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });
  const rows = await enrichRowsWithIpGeo(env, rawRows);

  const response = Response.json(buildLocationRanking(rows, { parserVersion: env.PARSER_VERSION }), {
    headers: { 'Cache-Control': 'no-store' },
  });
  return response;
};
