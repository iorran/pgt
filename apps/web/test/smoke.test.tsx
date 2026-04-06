import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from './render';

describe('Test infrastructure', () => {
  it('renders a basic component', () => {
    renderWithProviders(<div data-testid="hello">Hello</div>);
    expect(screen.getByTestId('hello')).toHaveTextContent('Hello');
  });
});
