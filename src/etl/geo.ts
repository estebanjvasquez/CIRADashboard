import type { RawLogEntry } from '../shared/types';
import { parseMetadata } from './parsers';
import { fetchIpGeoRows, upsertIpGeoRows, type IpGeoRow, type SupabaseEnv } from './supabase';

interface IpWhoIsRow {
  success: boolean;
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  connection?: { isp?: string };
}

interface FreeIpApiRow {
  ipAddress?: string;
  countryName?: string;
  regionName?: string;
  cityName?: string;
  asnOrganization?: string;
}

interface IpAddressToRow {
  success: boolean;
  ip?: string;
  location?: {
    country?: string;
    state?: string;
    city?: string;
  };
  asn?: {
    org?: string;
    descr?: string;
  };
  company?: {
    name?: string;
  };
}

const IP_API_BATCH_LIMIT = 50;
const GEO_LOOKUP_CONCURRENCY = 4;

export async function enrichRowsWithIpGeo(env: SupabaseEnv, rows: RawLogEntry[]): Promise<RawLogEntry[]> {
  try {
    const allIps = uniquePublicIps(rows);
    if (!allIps.length) return rows;

    const cachedRows = await fetchIpGeoRows(env, allIps);
    const cachedByIp = new Map(cachedRows.map((row) => [row.ip, row]));
    // Apply the per-request lookup cap after removing cached IPs. Otherwise,
    // a filled first page of cache entries can starve all later addresses.
    const missingIps = allIps.filter((ip) => !cachedByIp.has(ip)).slice(0, IP_API_BATCH_LIMIT);

    let resolvedRows: IpGeoRow[] = [];
    if (missingIps.length) {
      resolvedRows = await resolveIpGeo(missingIps);
      // The dashboard must still show newly resolved locations when the optional
      // Supabase cache is unavailable or its table has not been created yet.
      if (resolvedRows.length) {
        await upsertIpGeoRows(env, resolvedRows).catch((error: unknown) => {
          console.warn('Unable to persist IP geolocation cache', error);
        });
      }
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
  } catch (error) {
    console.warn('Unable to enrich rows with IP geolocation', error);
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

async function resolveIpGeo(ips: string[]): Promise<IpGeoRow[]> {
  const resolved = await mapWithConcurrency(ips, GEO_LOOKUP_CONCURRENCY, async (ip) => {
    const ipAddressToRow = await resolveIpAddressTo(ip);
    if (ipAddressToRow) return ipAddressToRow;
    const freeIpApiRow = await resolveFreeIpApi(ip);
    if (freeIpApiRow) return freeIpApiRow;
    return resolveIpWhoIs(ip);
  });

  return resolved.filter((row): row is IpGeoRow => Boolean(row));
}

async function resolveIpAddressTo(ip: string): Promise<IpGeoRow | undefined> {
  try {
    const response = await fetch(`https://ipaddress.to/api/lookup/${encodeURIComponent(ip)}`);
    if (!response.ok) return undefined;
    const row = (await response.json()) as IpAddressToRow;
    if (!row.success || !row.ip) return undefined;
    return {
      ip: row.ip,
      pais: row.location?.country || null,
      region: row.location?.state || null,
      ciudad: row.location?.city || null,
      isp: row.asn?.org || row.company?.name || row.asn?.descr || null,
    };
  } catch {
    return undefined;
  }
}

async function resolveFreeIpApi(ip: string): Promise<IpGeoRow | undefined> {
  try {
    const response = await fetch(`https://free.freeipapi.com/api/json/${encodeURIComponent(ip)}`);
    if (!response.ok) return undefined;
    const row = (await response.json()) as FreeIpApiRow;
    if (!row.ipAddress) return undefined;
    return {
      ip: row.ipAddress,
      pais: row.countryName || null,
      region: row.regionName || null,
      ciudad: row.cityName || null,
      isp: row.asnOrganization || null,
    };
  } catch {
    return undefined;
  }
}

async function resolveIpWhoIs(ip: string): Promise<IpGeoRow | undefined> {
    try {
      const response = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (!response.ok) return undefined;
      const row = (await response.json()) as IpWhoIsRow;
      if (!row.success || !row.ip) return undefined;
      return {
        ip: row.ip,
        pais: row.country || null,
        region: row.region || null,
        ciudad: row.city || null,
        isp: row.connection?.isp || null,
      };
    } catch {
      return undefined;
    }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}
