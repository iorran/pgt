import { type Page, type Locator, expect } from '@playwright/test';

export class TournamentsPage {
  readonly page: Page;
  readonly createTournamentButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('tournaments.createTournament') = "Criar Campeonato"
    this.createTournamentButton = page.getByRole('button', {
      name: /criar campeonato/i,
    });
    // t('common.create') = "Criar" — the submit button in the create form
    this.saveButton = page.getByRole('button', { name: /^criar$/i });
  }

  async goto() {
    await this.page.goto('/tournaments');
    // t('tournaments.pageTitle') = "CAMPEONATOS"
    await expect(
      this.page.getByRole('heading', { name: /campeonatos/i }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Get the label → parent div → input for a given label text.
   * Labels in this form use <Label> without htmlFor.
   */
  inputByLabel(labelText: RegExp) {
    return this.page
      .getByText(labelText)
      .locator('..')
      .locator('input');
  }

  /**
   * Tournament cards render as [data-slot="card"].
   */
  tournamentCard(name: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: new RegExp(name, 'i') });
  }
}
