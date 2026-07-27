import { buildSummary } from '../../src/etl/metrics';
import type { RawLogEntry } from '../../src/shared/types';

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
  const limit = Number(env.SYNC_BATCH_SIZE || 1000);

  const rows = await fetchSupabaseRows(env, { from, to, limit });
  return Response.json(
    buildSummary(rows, {
      ipHashSalt: env.IP_HASH_SALT,
      parserVersion: env.PARSER_VERSION,
      reportTimezone: env.REPORT_TIMEZONE,
    }),
  );
};

async function fetchSupabaseRows(
  env: Env,
  options: { from: string | null; to: string | null; limit: number },
): Promise<RawLogEntry[]> {
  const apiUrl = new URL(`/rest/v1/${env.SUPABASE_TABLE}`, env.SUPABASE_URL);
  apiUrl.searchParams.set('select', '*');
  apiUrl.searchParams.set('order', 'fecha_creacion.asc');
  apiUrl.searchParams.set('limit', String(options.limit));

  if (options.from) apiUrl.searchParams.set('fecha_creacion', `gte.${options.from}`);
  if (options.to) apiUrl.searchParams.append('fecha_creacion', `lte.${options.to}`);

  const response = await fetch(apiUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return Promise.reject(
      new Error(`Supabase request failed with ${response.status} ${response.statusText}`),
    );
  }

  return response.json();
}
