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

export class PaymentsPage {
  readonly page: Page;
  readonly studentInput: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly referenceMonthInput: Locator;
  readonly recordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('billing.selectStudent') = "Selecione um aluno" — searchable
    // <input list> backed by a <datalist>; fill with the exact student name.
    this.studentInput = page.getByRole('combobox', { name: /selecione um aluno/i });
    // t('billing.amount') = "Valor" — prefilled from the student's Monthly Fee
    this.amountInput = page.getByRole('spinbutton', { name: /^valor$/i });
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
