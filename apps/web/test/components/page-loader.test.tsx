import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageLoader } from '@/components/page-loader';

describe('PageLoader', () => {
  it('announces loading as a status', () => {
    render(<PageLoader />);
    expect(screen.getByRole('status', { name: 'common.loading' })).toBeInTheDocument();
  });
});
