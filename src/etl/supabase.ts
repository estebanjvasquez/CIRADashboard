import type { RawLogEntry } from '../shared/types';

export interface SupabaseEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_TABLE: string;
  SYNC_BATCH_SIZE: string;
}

export interface SupabaseQueryOptions {
  from: string | null;
  to: string | null;
  limit: number;
}

export async function fetchSupabaseRows(
  env: SupabaseEnv,
  options: Partial<SupabaseQueryOptions> = {},
): Promise<RawLogEntry[]> {
  const limit = options.limit ?? Number(env.SYNC_BATCH_SIZE || 1000);
  const apiUrl = new URL(`/rest/v1/${env.SUPABASE_TABLE}`, env.SUPABASE_URL);
  apiUrl.searchParams.set('select', '*');
  apiUrl.searchParams.set('order', 'fecha_creacion.asc');
  apiUrl.searchParams.set('limit', String(limit));

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
    throw new Error(`Supabase request failed with ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchCatalogTerms(env: SupabaseEnv): Promise<{
  sectors: string[];
  services: string[];
}> {
  const [sectors, services] = await Promise.all([
    fetchNameColumn(env, 'sectors'),
    fetchNameColumn(env, 'services'),
  ]);
  return { sectors, services };
}

async function fetchNameColumn(env: SupabaseEnv, table: string): Promise<string[]> {
  const apiUrl = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  apiUrl.searchParams.set('select', 'name');
  apiUrl.searchParams.set('limit', '5000');

  const response = await fetch(apiUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ name?: string }>;
  return rows.map((row) => row.name).filter((name): name is string => Boolean(name));
}
