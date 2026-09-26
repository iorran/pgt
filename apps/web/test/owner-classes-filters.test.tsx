import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/use-api', () => ({ useApiQuery: () => ({ data: undefined }) }));

import { ClassesList } from '@/pages/owner/components/classes-list';

const row = (classId: string, type: string) => ({
  classId, name: classId, type, totalCheckins: 0, uniqueStudents: 0, occurrences: 0, avgPerOccurrence: 0, trend: null,
});
const renderList = (classes: ReturnType<typeof row>[]) =>
  render(<MemoryRouter><ClassesList classes={classes} period="week" from="2026-09-01" to="2026-09-07" /></MemoryRouter>);

describe('ClassesList type filters', () => {
  it('shows no filters and a create-class link when there are no classes', () => {
    renderList([]);
    expect(screen.queryByRole('button', { name: 'owner.classes.allTypes' })).toBeNull();
    expect(screen.getByRole('link', { name: 'classes.createClass' })).toHaveAttribute('href', '/classes');
  });

  it('only offers filters for class types that exist', () => {
    renderList([row('a', 'gi'), row('b', 'kids')]);
    expect(screen.getByRole('button', { name: 'owner.classes.allTypes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'owner.classes.types.gi' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'owner.classes.types.kids' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'owner.classes.types.no-gi' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'owner.classes.types.open-mat' })).toBeNull();
  });

  it('hides filters when every class has the same type', () => {
    renderList([row('a', 'gi'), row('b', 'gi')]);
    expect(screen.queryByRole('button', { name: 'owner.classes.allTypes' })).toBeNull();
  });
});
