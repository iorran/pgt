import type { Page } from '@playwright/test';

/**
 * Page object for /owner/dashboard.
 *
 * Selectors intentionally lean on role/text queries so they stay resilient
 * to class/style churn. Kept minimal — add helpers only when a test needs
 * to reuse the same locator logic.
 */
export class OwnerDashboardPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/owner/dashboard');
  }

  heading() {
    return this.page.getByRole('heading', { name: /academy dashboard/i });
  }

  forbiddenNotice() {
    // The page renders "Forbidden (403)" when a non-owner hits the route.
    return this.page.getByText(/forbidden|403/i);
  }

  /**
   * A class row is rendered as a <button> whose accessible name includes
   * the class name. Regex is safer than exact match because the rendered
   * label also contains the class type and the checkin totals.
   */
  classRow(name: string | RegExp) {
    const pattern = typeof name === 'string' ? new RegExp(name, 'i') : name;
    return this.page.getByRole('button', { name: pattern });
  }

  /**
   * Student rows are buttons too, so callers should pass a name regex
   * narrow enough to disambiguate from the class rows (and the status
   * chips at the top of the StudentsList).
   */
  studentRow(name: string | RegExp) {
    const pattern = typeof name === 'string' ? new RegExp(name, 'i') : name;
    return this.page.getByRole('button', { name: pattern });
  }

  /**
   * The StudentsList status filters — "All", "Active", "Slowing",
   * "Drifting", "Inactive". The chip labels end with a count, so a
   * case-insensitive substring match is correct.
   */
  statusChip(label: string | RegExp) {
    const pattern = typeof label === 'string' ? new RegExp(label, 'i') : label;
    return this.page.getByRole('button', { name: pattern });
  }
}
