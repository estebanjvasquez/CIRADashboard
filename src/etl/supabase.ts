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

export interface IpGeoRow {
  ip: string;
  pais: string | null;
  region: string | null;
  ciudad: string | null;
  isp: string | null;
}

export async function fetchSupabaseRows(
  env: SupabaseEnv,
  options: Partial<SupabaseQueryOptions> = {},
): Promise<RawLogEntry[]> {
  const limit = options.limit ?? Number(env.SYNC_BATCH_SIZE || 1000);
  const primaryTable = env.SUPABASE_TABLE || 'audit_log_entries';
  const response = await fetchRowsFromTable(env, primaryTable, options, limit);

  if (!response.ok && primaryTable !== 'audit_log_entries' && isMissingRelationResponse(response.status)) {
    const fallback = await fetchRowsFromTable(env, 'audit_log_entries', options, limit);
    if (fallback.ok) return fallback.json();
    throw new Error(`Supabase fallback request failed with ${fallback.status} ${fallback.statusText}`);
  }

  if (!response.ok) {
    throw new Error(`Supabase request failed with ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchRowsFromTable(
  env: SupabaseEnv,
  table: string,
  options: Partial<SupabaseQueryOptions>,
  limit: number,
): Promise<Response> {
  const apiUrl = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  apiUrl.searchParams.set('select', '*');
  apiUrl.searchParams.set('order', 'fecha_creacion.desc');
  apiUrl.searchParams.set('limit', String(limit));

  if (options.from) apiUrl.searchParams.set('fecha_creacion', `gte.${options.from}`);
  if (options.to) apiUrl.searchParams.append('fecha_creacion', `lte.${options.to}`);

  return fetch(apiUrl, {
    headers: supabaseHeaders(env),
  });
}

function isMissingRelationResponse(status: number): boolean {
  return status === 400 || status === 404 || status === 406;
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

export async function fetchIpGeoRows(env: SupabaseEnv, ips: string[]): Promise<IpGeoRow[]> {
  if (!ips.length) return [];
  const apiUrl = new URL('/rest/v1/ip_geo', env.SUPABASE_URL);
  apiUrl.searchParams.set('select', 'ip,pais,region,ciudad,isp');
  apiUrl.searchParams.set('ip', `in.(${ips.map(escapePostgrestInValue).join(',')})`);

  const response = await fetch(apiUrl, { headers: supabaseHeaders(env) });
  if (!response.ok) return [];
  return response.json();
}

export async function upsertIpGeoRows(env: SupabaseEnv, rows: IpGeoRow[]): Promise<void> {
  if (!rows.length) return;
  const apiUrl = new URL('/rest/v1/ip_geo', env.SUPABASE_URL);
  apiUrl.searchParams.set('on_conflict', 'ip');
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(env),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase ip_geo upsert failed with ${response.status} ${response.statusText}: ${body}`);
  }
}

async function fetchNameColumn(env: SupabaseEnv, table: string): Promise<string[]> {
  const apiUrl = new URL(`/rest/v1/${table}`, env.SUPABASE_URL);
  apiUrl.searchParams.set('select', 'name');
  apiUrl.searchParams.set('limit', '5000');

  const response = await fetch(apiUrl, {
    headers: supabaseHeaders(env),
  });

  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ name?: string }>;
  return rows.map((row) => row.name).filter((name): name is string => Boolean(name));
}

export function supabaseHeaders(env: { SUPABASE_SERVICE_ROLE_KEY?: string }): Record<string, string> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const headers: Record<string, string> = {
    apikey: key,
    'Content-Type': 'application/json',
  };

  if (isJwtKey(key)) {
    headers.Authorization = `Bearer ${key}`;
  }

  return headers;
}

function isJwtKey(key: string): boolean {
  return key.split('.').length === 3;
}

export const __test = {
  supabaseHeaders,
};

function escapePostgrestInValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}
