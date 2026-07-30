import { buildDemand, demandProspectsToCsv } from '../../src/etl/metrics';
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
  const limit = boundedLimit(url.searchParams.get('limit'));
  const rows = await fetchSupabaseRows(env, {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });

  const demand = buildDemand(rows, { limit, parserVersion: env.PARSER_VERSION });
  return new Response(demandProspectsToCsv(demand.prospects), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="prospectos-demanda.csv"',
      'Cache-Control': 'no-store',
    },
  });
};

function boundedLimit(value: string | null): number {
  const parsed = Number(value || 500);
  if (!Number.isFinite(parsed)) return 500;
  return Math.min(Math.max(parsed, 1), 5000);
}
