import { type Page, type Locator, type Download, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Financeiro tabs: /billing (Cobranças), /billing/balance, /billing/expenses, /billing/payouts.
export class FinancePage {
  readonly page: Page;
  readonly prevMonth: Locator;
  readonly nextMonth: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('finance.prevMonth') / t('finance.nextMonth')
    this.prevMonth = page.getByRole('button', { name: 'Mês anterior' });
    this.nextMonth = page.getByRole('button', { name: 'Mês seguinte' });
  }

  async goto(path: '/billing' | '/billing/balance' | '/billing/expenses' | '/billing/payouts') {
    await this.page.goto(path);
    await expect(this.page.getByRole('heading', { level: 1, name: 'Financeiro' })).toBeVisible({ timeout: 10_000 });
  }

  /** Overdue card on Cobranças (Card renders <div data-slot="card">). */
  overdueCard(name: string) {
    return this.page.locator('[data-slot="card"]').filter({ hasText: name });
  }

  /** Despesas: the amount cell of a row is labelled by its description. */
  expenseCell(description: string | RegExp) {
    return this.page.getByLabel(description, { exact: typeof description === 'string' });
  }

  expenseTotal() {
    // The Total row: "Total" then the formatted sum.
    return this.page.getByText('Total', { exact: true }).locator('xpath=following-sibling::span[1]');
  }

  /** Clicks a button that downloads a CSV; returns the download and its text. */
  async downloadCsv(name: string): Promise<{ download: Download; text: string }> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('button', { name }).click(),
    ]);
    const path = await download.path();
    return { download, text: await readFile(path!, 'utf8') };
  }
}

// Student page › Mensalidade card › Class Add-on / Angariado por.
export class StudentBillingSection {
  readonly page: Page;
  readonly addOnSwitch: Locator;
  readonly addOnTeacher: Locator;
  readonly recruitedBy: Locator;
  readonly owesPerMonth: Locator;
  readonly save: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addOnSwitch = page.getByRole('switch', { name: 'Acréscimo No Gi' });
    this.addOnTeacher = page.getByLabel('Professor do acréscimo');
    this.recruitedBy = page.getByLabel('Angariado por');
    // "Deve por mês" and its amount share one row.
    this.owesPerMonth = page.getByText('Deve por mês').locator('..');
    this.save = page.getByRole('button', { name: 'Salvar cobrança' });
  }

  async goto(studentId: string) {
    await this.page.goto(`/students/${studentId}`);
    await expect(this.save).toBeVisible({ timeout: 10_000 });
  }
}
