import { type Page, type Locator, expect } from '@playwright/test';

export class StudentsPage {
  readonly page: Page;
  readonly activeTab: Locator;
  readonly pendingTab: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    // TabsNav renders links, not ARIA tabs
    this.activeTab = page.getByRole('link', { name: /^alunos$/i });
    this.pendingTab = page.getByRole('link', { name: /^pendentes$/i });
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
    // Wait for the page to be ready (tab nav visible)
    await expect(
      this.page.getByRole('link', { name: /^alunos$/i }),
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
      .getByRole('button', { name: /rejeitar/i })
      .click();
  }
}

export class StudentDetailPage {
  readonly page: Page;
  readonly assignPlanButton: Locator;
  readonly payCurrentMonthButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('students.assignMembership') = "Atribuir Plano"
    this.assignPlanButton = page.getByRole('button', {
      name: /atribuir.*plano/i,
    });
    // t('students.payCurrentMonth') = "Pagar Mês Atual"
    this.payCurrentMonthButton = page.getByRole('button', {
      name: /pagar.*mês.*atual/i,
    });
  }

  async goto(studentId: string) {
    await this.page.goto(`/students/${studentId}`);
    // Wait for content to load — t('common.back') = "Voltar"
    await expect(this.page.getByRole('button', { name: /^voltar$/i })).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * Assign a plan via the dialog. The dialog uses a native <select> element,
   * so we use selectOption() instead of combobox interaction.
   */
  async assignPlan(planName: string) {
    await this.assignPlanButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Native <select> inside the dialog — options are "{name} — {price}", select by partial label match
    const selectEl = dialog.locator('select');
    const options = await selectEl.locator('option').allInnerTexts();
    const matchedLabel = options.find((o) =>
      o.toLowerCase().includes(planName.toLowerCase()),
    );
    if (!matchedLabel) {
      throw new Error(`Plan option "${planName}" not found. Available: ${options.join(', ')}`);
    }
    await selectEl.selectOption({ label: matchedLabel });

    // Fill in a start date (today) and due day
    const today = new Date().toISOString().split('T')[0];
    await dialog.locator('input[type="date"]').fill(today);
    await dialog.locator('input[type="number"]').fill('5');

    await dialog.getByRole('button', { name: /salvar/i }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  }
}
