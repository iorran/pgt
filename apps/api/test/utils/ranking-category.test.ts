import { describe, it, expect } from 'vitest';
import { rankingCategory } from '../../src/gamification/ranking-category';

const today = new Date('2026-09-27T12:00:00');

describe('rankingCategory', () => {
  it('adult belts rank with Adultos, even if tagged Kids (teen blue belt)', () => {
    expect(rankingCategory({ belt: 'blue', dateOfBirth: null, modalities: ['Kids'] }, today)).toBe('adults');
    expect(rankingCategory({ belt: 'black', dateOfBirth: null, modalities: [] }, today)).toBe('adults');
  });

  it('kids belts rank with Kids', () => {
    expect(rankingCategory({ belt: 'orange-white', dateOfBirth: null, modalities: [] }, today)).toBe('kids');
    expect(rankingCategory({ belt: 'grey', dateOfBirth: null, modalities: ['Jiu-Jitsu'] }, today)).toBe('kids');
  });

  it('white belts: under 16 by birth date → Kids, else Adultos', () => {
    expect(rankingCategory({ belt: 'white', dateOfBirth: '2012-03-01', modalities: [] }, today)).toBe('kids');
    expect(rankingCategory({ belt: 'white', dateOfBirth: '2000-03-01', modalities: ['Kids'] }, today)).toBe('adults');
  });

  it('white belts without birth date: Kids modality → Kids, else Adultos', () => {
    expect(rankingCategory({ belt: 'white', dateOfBirth: null, modalities: ['Kids'] }, today)).toBe('kids');
    expect(rankingCategory({ belt: 'white', dateOfBirth: null, modalities: ['Jiu-Jitsu', 'MMA'] }, today)).toBe('adults');
  });
});
