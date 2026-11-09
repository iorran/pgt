import { type Page, type Locator, expect } from '@playwright/test';

export class StudentsPage {
  readonly page: Page;
  readonly activeTab: Locator;
  readonly pendingTab: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    // TabsNav renders links, not ARIA tabs. Scope to <main> so these don't
    // collide with the StaffShell sidebar, which also has an "Alunos" link
    // pointing at /students.
    const main = page.getByRole('main');
    this.activeTab = main.getByRole('link', { name: /^alunos$/i });
    this.pendingTab = main.getByRole('link', { name: /^pendentes$/i });
    // placeholder is t('common.search') = "Buscar"
    this.searchInput = page.getByPlaceholder(/buscar/i);
  }

  async goto() {
    await this.page.goto('/students');
    await expect(this.pendingTab).toBeVisible({ timeout: 10_000 });
  }

  row(name: string) {
    return this.page
      .getByRole('row')
      .filter({ hasText: new RegExp(name, 'i') });
  }
}

export class PendingStudentsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/pending');
    // Wait for the page to be ready (tab nav visible). Scope to <main> so
    // this doesn't collide with the sidebar's "Alunos" link.
    await expect(
      this.page.getByRole('main').getByRole('link', { name: /^alunos$/i }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /** Returns the card element for a student by name */
  card(name: string) {
    return this.page.locator('[data-slot="card"]').filter({
      hasText: new RegExp(name, 'i'),
    });
  }

  async approve(name: string) {
    const studentCard = this.card(name);
    await studentCard
      .getByRole('button', { name: /aprovar/i })
      .click();
  }

  async reject(name: string) {
    const studentCard = this.card(name);
    await studentCard
      .getByRole('button', { name: /^recusar$/i })
      .click();
    // Rejecting asks for confirmation first.
    await confirmDialog(this.page, /^recusar cadastro$/i);
  }
}

/** Click the confirm button (default "Confirmar", t('common.confirm')) in the open confirm dialog. */
export async function confirmDialog(page: Page, name: RegExp = /^confirmar$/i) {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name }).click();
  await expect(dialog).toBeHidden({ timeout: 10_000 });
}

export class StudentDetailPage {
  readonly page: Page;
  readonly payMonthButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('students.payMonth') = "Registrar mensalidade"
    this.payMonthButton = page.getByRole('button', {
      name: /registrar mensalidade/i,
    });
  }

  /** Quick-pay the oldest unpaid month at the student's Monthly Fee (confirmed). */
  async payMonth() {
    await this.payMonthButton.click();
    await confirmDialog(this.page);
  }

  async goto(studentId: string) {
    await this.page.goto(`/students/${studentId}`);
    // Wait for content to load — t('common.back') = "Voltar"
    await expect(this.page.getByRole('button', { name: /^voltar$/i })).toBeVisible({
      timeout: 10_000,
    });
  }
}
