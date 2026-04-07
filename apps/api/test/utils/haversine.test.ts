import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../../src/utils/haversine';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it('calculates short distance accurately', () => {
    const distance = haversineDistance(-23.5505, -46.6333, -23.5515, -46.6333);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(120);
  });

  it('returns distance in meters', () => {
    const distance = haversineDistance(-23.55, -46.63, -22.91, -43.17);
    expect(distance).toBeGreaterThan(350_000);
    expect(distance).toBeLessThan(370_000);
  });

  it('handles negative and positive coordinates', () => {
    const distance = haversineDistance(51.5074, -0.1278, 40.7128, -74.006);
    expect(distance).toBeGreaterThan(5_500_000);
    expect(distance).toBeLessThan(5_600_000);
  });
});
