import { type Page, type Locator, type Download, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

// Financeiro tabs: /billing (Cobranças), /billing/balance, /billing/expenses, /billing/payouts (Payout Sheets).
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

// Financeiro › Repasses › one class's Payout Sheet, open in place on the tab (or on /billing/payouts/:month/:className).
export class PayoutSheetPage {
  readonly page: Page;
  readonly total: Locator;
  readonly confirm: Locator;
  readonly reopen: Locator;

  constructor(page: Page) {
    this.page = page;
    // "Total do repasse" and its amount share one row.
    this.total = page.getByText('Total do repasse').locator('..');
    this.confirm = page.getByRole('button', { name: 'Confirmar mês' });
    this.reopen = page.getByRole('button', { name: 'Reabrir' });
  }

  /** A student's row (an <li>). */
  row(name: string) {
    return this.page.getByRole('listitem').filter({ hasText: name });
  }

  /** The € amount of a student's row; saved on blur. */
  amount(name: string) {
    return this.page.getByLabel(`Repasse de ${name}`);
  }

  async addStudent(name: string) {
    await this.page.getByRole('button', { name: 'Adicionar aluno sem check-in' }).click();
    await this.page.getByRole('combobox', { name: 'Procure o aluno' }).fill(name.split(' ')[0]);
    await this.page.getByRole('option', { name: new RegExp(name) }).click();
  }
}
