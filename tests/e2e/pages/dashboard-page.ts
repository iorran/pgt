import { type Page, type Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly greeting: Locator;
  readonly academyCard: Locator;
  readonly joinCodeDisplay: Locator;
  readonly overdueBanner: Locator;
  readonly sidebarStudents: Locator;
  readonly sidebarBilling: Locator;
  readonly sidebarClasses: Locator;
  readonly sidebarMarketplace: Locator;
  readonly sidebarTournaments: Locator;
  readonly sidebarGamification: Locator;
  readonly sidebarSettings: Locator;

  constructor(page: Page) {
    this.page = page;
    this.greeting = page.getByText(/olá/i);
    this.academyCard = page.getByRole('article').first();
    this.joinCodeDisplay = page.getByText(/^PGT-/i).first();
    this.overdueBanner = page.getByRole('alert').filter({
      hasText: /pagamento|atraso|inadimpl|vence/i,
    });
    this.sidebarStudents = page.getByRole('link', { name: /^alunos$/i });
    this.sidebarBilling = page.getByRole('link', { name: /^financeiro$/i });
    this.sidebarClasses = page.getByRole('link', { name: /^aulas$/i });
    this.sidebarMarketplace = page.getByRole('link', { name: /^loja$/i });
    this.sidebarTournaments = page.getByRole('link', {
      name: /^campeonatos$/i,
    });
    this.sidebarGamification = page.getByRole('link', { name: /^ranking$/i });
    this.sidebarSettings = page.getByRole('link', {
      name: /^configurações$/i,
    });
  }

  async goto() {
    await this.page.goto('/');
    await expect(this.sidebarStudents).toBeVisible({ timeout: 10_000 });
  }
}
