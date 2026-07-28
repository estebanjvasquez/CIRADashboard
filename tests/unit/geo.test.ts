import { afterEach, describe, expect, it, vi } from 'vitest';
import { enrichRowsWithIpGeo, uniquePublicIps } from '../../src/etl/geo';
import sampleLogs from '../fixtures/sample_log.json';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  SUPABASE_TABLE: 'v_logs',
  SYNC_BATCH_SIZE: '1000',
};

describe('geo enrichment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts explicit public IPs and skips private ranges', () => {
    const ips = uniquePublicIps([
      { ...sampleLogs[0], ip: '8.8.8.8' },
      { ...sampleLogs[0], ip: '10.0.0.1' },
      { ...sampleLogs[0], ip: '172.20.0.1' },
      { ...sampleLogs[0], ip: '1.1.1.1, 10.0.0.1' },
      { ...sampleLogs[0], ip: '8.8.4.4:443' },
    ]);

    expect(ips).toEqual(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
  });

  it('resolves missing IP geolocation and enriches rows in memory', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(
        Response.json([
          {
            success: true,
            ip: '8.8.8.8',
            country: 'Estados Unidos',
            region: 'Virginia',
            city: 'Ashburn',
            connection: { isp: 'Google' },
          },
        ][0]),
      )
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await enrichRowsWithIpGeo(env, [{ ...sampleLogs[0], ip: '8.8.8.8' }]);

    expect(rows[0]).toMatchObject({
      geo_pais: 'Estados Unidos',
      geo_region: 'Virginia',
      geo_ciudad: 'Ashburn',
      geo_isp: 'Google',
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://ipwho.is/8.8.8.8');
  });
});
