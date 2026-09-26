import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '@/lib/api';

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves undefined on 204 No Content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api('/modalities/m1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws the API error code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'MODALITY_IN_USE' }), { status: 409 })),
    );
    await expect(api('/modalities/m1', { method: 'DELETE' })).rejects.toThrow('MODALITY_IN_USE');
  });
});
