import { type Page, type Locator, expect } from '@playwright/test';

export class GamificationResultsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/gamification/results');
    // t('gamification.resultsTitle') = "Resultados de Competição"
    await expect(
      this.page.getByRole('link', { name: /resultados de competição/i }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Results render as [data-slot="card"] cards, not table rows.
   * Filter by student name text inside the card.
   */
  resultCard(studentName: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: new RegExp(studentName, 'i') });
  }
}

export class LeaderboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/gamification');
    // t('gamification.leaderboardTitle') = "Classificação"
    await expect(
      this.page.getByRole('link', { name: /classificação/i }),
    ).toBeVisible({ timeout: 10_000 });
  }
}
