import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AderenciaChart } from '@/pages/owner/components/aderencia-chart';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  // jsdom has no layout: give the chart a fixed size so the SVG renders.
  const ResponsiveContainer = ({ children }: { children: React.ReactElement }) =>
    React.cloneElement(children, { width: 360, height: 200 });
  return { ...actual, ResponsiveContainer };
});

const row = (classId: string, name: string, totalCheckins: number) => ({
  classId, name, type: 'gi', totalCheckins, uniqueStudents: 1, occurrences: 1, avgPerOccurrence: 1, trend: null,
});

describe('AderenciaChart', () => {
  it('draws horizontal bars so long class names stay readable on phones', () => {
    render(<AderenciaChart data={[row('a', 'Fundamentos (Demo)', 10), row('b', 'Gi Manhã', 5)]} />);
    const a = screen.getByTestId('aderencia-chart-bar-a');
    const b = screen.getByTestId('aderencia-chart-bar-b');
    // Value grows along x; every bar has the same thickness.
    expect(Number(a.getAttribute('width'))).toBeGreaterThan(Number(b.getAttribute('width')));
    expect(a.getAttribute('height')).toBe(b.getAttribute('height'));
    expect(screen.getByText('Fundamentos (Demo)')).toBeInTheDocument();
  });
});
