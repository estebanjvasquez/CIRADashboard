import { defaultCache } from '../../src/etl/cache';
import { buildIntentRanking } from '../../src/etl/metrics';
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
  const cache = defaultCache();
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const rows = await fetchSupabaseRows(env, {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });

  const response = Response.json(buildIntentRanking(rows, { parserVersion: env.PARSER_VERSION }), {
    headers: { 'Cache-Control': 'private, max-age=900' },
  });
  await cache.put(cacheKey, response.clone());
  return response;
};
