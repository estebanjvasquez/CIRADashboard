import type { RawLogEntry } from '../shared/types';
import { parseMetadata } from './parsers';
import { fetchIpGeoRows, upsertIpGeoRows, type IpGeoRow, type SupabaseEnv } from './supabase';

interface IpApiBatchRow {
  status: 'success' | 'fail';
  query?: string;
  country?: string;
  regionName?: string;
  city?: string;
  isp?: string;
}

const IP_API_BATCH_LIMIT = 100;

export async function enrichRowsWithIpGeo(env: SupabaseEnv, rows: RawLogEntry[]): Promise<RawLogEntry[]> {
  try {
    const ips = uniquePublicIps(rows).slice(0, IP_API_BATCH_LIMIT);
    if (!ips.length) return rows;

    const cachedRows = await fetchIpGeoRows(env, ips);
    const cachedByIp = new Map(cachedRows.map((row) => [row.ip, row]));
    const missingIps = ips.filter((ip) => !cachedByIp.has(ip));

    let resolvedRows: IpGeoRow[] = [];
    if (missingIps.length) {
      resolvedRows = await resolveIpApiBatch(missingIps);
      if (resolvedRows.length) await upsertIpGeoRows(env, resolvedRows);
    }

    const geoByIp = new Map<string, IpGeoRow>([
      ...Array.from(cachedByIp.entries()),
      ...resolvedRows.map((row): [string, IpGeoRow] => [row.ip, row]),
    ]);

    return rows.map((row) => {
      if (row.geo_pais || row.geo_region || row.geo_ciudad) return row;
      const ip = getRowIp(row);
      const geo = ip ? geoByIp.get(ip) : undefined;
      if (!geo) return row;
      return {
        ...row,
        geo_pais: geo.pais,
        geo_region: geo.region,
        geo_ciudad: geo.ciudad,
        geo_isp: geo.isp,
      };
    });
  } catch {
    return rows;
  }
}

export function uniquePublicIps(rows: RawLogEntry[]): string[] {
  const ips = new Set<string>();
  for (const row of rows) {
    const ip = getRowIp(row);
    if (!ip || !isPublicIp(ip)) continue;
    ips.add(ip);
  }
  return Array.from(ips);
}

export function getRowIp(row: RawLogEntry): string | undefined {
  const rawIp = row.ip || parseMetadata(row.metadata).ipUsuario;
  return firstIp(rawIp);
}

function firstIp(value: string | undefined): string | undefined {
  const candidate = value
    ?.split(',')
    .map((part) => part.trim())
    .find(Boolean);
  if (!candidate) return undefined;

  const bracketedIpv6 = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6) return bracketedIpv6[1];

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  return ipv4WithPort ? ipv4WithPort[1] : candidate.replace(/^['\"]|['\"]$/g, '');
}

function isPublicIp(value: string): boolean {
  if (value.includes(':')) return isPublicIpv6(value);
  return isPublicIpv4(value);
}

function isPublicIpv4(value: string): boolean {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a >= 224) return false;
  return true;
}

function isPublicIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  return !(
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80:')
  );
}

async function resolveIpApiBatch(ips: string[]): Promise<IpGeoRow[]> {
  const apiUrl = new URL('http://ip-api.com/batch');
  apiUrl.searchParams.set('fields', 'status,query,country,regionName,city,isp');
  apiUrl.searchParams.set('lang', 'es');

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ips),
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as IpApiBatchRow[];
  return rows
    .filter((row) => row.status === 'success' && row.query)
    .map((row) => ({
      ip: row.query as string,
      pais: row.country || null,
      region: row.regionName || null,
      ciudad: row.city || null,
      isp: row.isp || null,
    }));
}
