import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSupabaseRows } from '../../src/etl/supabase';

describe('supabase connector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches latest log rows first', async () => {
    const fetchMock = vi.fn(async () => Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    await fetchSupabaseRows({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-key',
      SUPABASE_TABLE: 'v_logs',
      SYNC_BATCH_SIZE: '1000',
    });

    expect(fetchMock).toHaveBeenCalled();
    const firstCall = fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit?];
    const url = new URL(String(firstCall[0]));
    expect(url.pathname).toBe('/rest/v1/v_logs');
    expect(url.searchParams.get('order')).toBe('fecha_creacion.desc');
    expect(url.searchParams.get('limit')).toBe('1000');
  });
});
