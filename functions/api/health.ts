import { supabaseHeaders } from '../../src/etl/supabase';

interface Env {
  PARSER_VERSION: string;
  REPORT_TIMEZONE: string;
  SUPABASE_TABLE: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const supabaseRest = await checkSupabaseRest(env);

  return Response.json({
    status: 'ok',
    parserVersion: env.PARSER_VERSION,
    reportTimezone: env.REPORT_TIMEZONE,
    supabaseTable: env.SUPABASE_TABLE,
    hasSupabaseUrl: Boolean(env.SUPABASE_URL),
    hasSupabaseServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseKeyRole: getJwtRole(env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseRest,
    geoProviderStatus: await checkGeoProvider(),
    timestamp: new Date().toISOString(),
  });
};

async function checkSupabaseRest(env: Env): Promise<Record<string, number | string>> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return { status: 'missing-config' };

  const checks = [
    ['vLogs', `/rest/v1/${env.SUPABASE_TABLE || 'v_logs'}?select=id&limit=1`],
    ['ipGeo', '/rest/v1/ip_geo?select=ip&limit=1'],
  ] as const;

  const results: Record<string, number | string> = {};
  await Promise.all(
    checks.map(async ([name, path]) => {
      try {
        const response = await fetch(new URL(path, env.SUPABASE_URL), {
          headers: supabaseHeaders(env),
        });
        results[name] = response.status;
      } catch {
        results[name] = 'fetch-error';
      }
    }),
  );
  return results;
}

async function checkGeoProvider(): Promise<Record<string, number | string>> {
  const checks = [
    ['ipAddressTo', 'https://ipaddress.to/api/lookup/8.8.8.8'],
  ] as const;
  const results: Record<string, number | string> = {};
  await Promise.all(
    checks.map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        results[name] = response.status;
      } catch {
        results[name] = 'fetch-error';
      }
    }),
  );
  return results;
}

function getJwtRole(token: string | undefined): string {
  if (!token) return 'missing';
  const [, payload] = token.split('.');
  if (!payload) return 'unknown';

  try {
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(decoded) as { role?: unknown };
    return typeof claims.role === 'string' ? claims.role : 'unknown';
  } catch {
    return 'unknown';
  }
}
