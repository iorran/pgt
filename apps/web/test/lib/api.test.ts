import { describe, it, expect, vi, afterEach } from 'vitest';
import { api } from '@/lib/api';
import { setActingAs, clearProfile } from '@/lib/profile';

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

  it('sends x-acting-as while acting as a Dependent, and not otherwise', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await api('/payments/my-status');
    expect(fetchMock.mock.calls[0][1].headers['x-acting-as']).toBeUndefined();

    setActingAs({ id: 'd1', name: 'Livia', belt: 'white', image: null });
    await api('/payments/my-status', { method: 'POST', body: '{}' });
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ 'x-acting-as': 'd1', 'Content-Type': 'application/json' });
    clearProfile();
  });
});
