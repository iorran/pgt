import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithRoute } from '../render';
import { SubpageHeader } from '@/components/subpage-header';

function routes() {
  return (
    <Routes>
      <Route path="/me" element={<p>me hub</p>} />
      <Route path="/classes" element={<p>classes</p>} />
      <Route path="/tournaments" element={<SubpageHeader title="Torneios" />} />
    </Routes>
  );
}

describe('SubpageHeader', () => {
  it('renders the title as h1 and a back link to the fallback route', () => {
    renderWithRoute(routes(), ['/tournaments']);
    expect(screen.getByRole('heading', { level: 1, name: 'Torneios' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/me');
  });

  it('goes to the fallback route when there is no history (direct link / PWA open)', async () => {
    renderWithRoute(routes(), ['/tournaments']);
    await userEvent.click(screen.getByRole('link', { name: 'common.back' }));
    expect(screen.getByText('me hub')).toBeInTheDocument();
  });

  it('goes back in history when the user navigated here', async () => {
    renderWithRoute(routes(), ['/classes', '/tournaments']);
    await userEvent.click(screen.getByRole('link', { name: 'common.back' }));
    expect(screen.getByText('classes')).toBeInTheDocument();
  });
});
