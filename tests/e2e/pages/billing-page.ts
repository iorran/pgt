import { type Page, type Locator, expect } from '@playwright/test';

export class BillingPage {
  readonly page: Page;
  readonly overdueTab: Locator;
  readonly plansTab: Locator;
  readonly paymentsTab: Locator;

  constructor(page: Page) {
    this.page = page;
    // TabsNav renders <Link> → <a> elements, not ARIA tabs
    this.overdueTab = page.getByRole('link', { name: /^inadimplentes$/i });
    this.plansTab = page.getByRole('link', { name: /^planos$/i });
    this.paymentsTab = page.getByRole('link', { name: /^pagamentos$/i });
  }

  async goto() {
    await this.page.goto('/billing');
    await expect(this.overdueTab).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Card component renders as <div data-slot="card"> — not <article>.
   */
  studentCard(name: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: new RegExp(name, 'i') });
  }
}

export class PlansPage {
  readonly page: Page;
  readonly createPlanButton: Locator;
  readonly planNameInput: Locator;
  readonly priceInput: Locator;
  readonly frequencySelect: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('billing.createPlan') = "Criar Plano"
    this.createPlanButton = page.getByRole('button', { name: /criar plano/i });
    // t('billing.planName') = "Nome do Plano"
    this.planNameInput = page.getByText(/nome do plano/i).locator('..').locator('input');
    // t('billing.price') = "Preço"
    this.priceInput = page.getByText(/^preço$/i).locator('..').locator('input');
    // t('billing.frequency') = "Frequência" — native <select>
    this.frequencySelect = page.getByText(/^frequência$/i).locator('..').locator('select');
    // Button is "Criar" on create, "Salvar" on edit — match both
    this.saveButton = page.getByRole('button', { name: /^(criar|salvar)$/i });
  }

  async goto() {
    await this.page.goto('/billing/plans');
    await expect(this.createPlanButton).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Card component renders as <div data-slot="card"> — not <article>.
   */
  planCard(name: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: new RegExp(name, 'i') });
  }
}

export class PaymentsPage {
  readonly page: Page;
  readonly studentSelect: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly referenceMonthInput: Locator;
  readonly recordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('billing.selectStudent') = "Selecione um aluno" — native <select>
    this.studentSelect = page.locator('select').first();
    // t('billing.amount') = "Valor"
    this.amountInput = page.getByText(/^valor$/i).locator('..').locator('input');
    // t('billing.date') = "Data" — type="date"
    this.dateInput = page.locator('input[type="date"]');
    // t('billing.referenceMonth') = "Mês Referência" — type="month"
    this.referenceMonthInput = page.locator('input[type="month"]');
    // t('common.save') = "Salvar"
    this.recordButton = page.getByRole('button', { name: /^salvar$/i });
  }

  async goto() {
    await this.page.goto('/billing/payments');
    await expect(this.recordButton).toBeVisible({ timeout: 10_000 });
  }
}
