import { type Page, type Locator, expect } from '@playwright/test';

export class ClassesPage {
  readonly page: Page;
  readonly classesTab: Locator;
  readonly historyTab: Locator;
  readonly createClassButton: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // TabsNav renders <Link> → <a> elements
    this.classesTab = page.getByRole('link', { name: /quadro de aulas/i });
    this.historyTab = page.getByRole('link', { name: /histórico de presença/i });
    // t('classes.createClass') = "Criar Aula"
    this.createClassButton = page.getByRole('button', { name: /criar aula/i });
    // t('common.save') = "Salvar"
    this.saveButton = page.getByRole('button', { name: /^salvar$/i });
  }

  async goto() {
    await this.page.goto('/classes');
    await expect(this.page.locator('body')).toBeVisible({ timeout: 10_000 });
  }

  async gotoHistory() {
    await this.page.goto('/classes/history');
    await expect(this.historyTab).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Class card renders as <div data-slot="card">
   */
  classCard(name: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: new RegExp(name, 'i') });
  }

  /**
   * Open create-class dialog and fill in form fields.
   */
  async openCreateDialog() {
    await this.createClassButton.click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Fill the create class form. dayIndex is 0=Sun, 1=Mon … 6=Sat.
   */
  async fillCreateForm(opts: {
    name: string;
    type: string;
    dayIndex: number;
    startTime: string;
    endTime: string;
  }) {
    const dialog = this.page.getByRole('dialog');

    // Name
    await dialog.locator('input').first().fill(opts.name);

    // Type — native <select>
    await dialog.locator('select').first().selectOption(opts.type);

    // Day-of-week toggle buttons (0-indexed, matching DAY_KEYS order)
    // The buttons are in a flex-wrap row of 7 day buttons
    const dayButtons = dialog.locator('button[type="button"]');
    await dayButtons.nth(opts.dayIndex).click();

    // Start and end time inputs (type="time")
    const timeInputs = dialog.locator('input[type="time"]');
    await timeInputs.nth(0).fill(opts.startTime);
    await timeInputs.nth(1).fill(opts.endTime);
  }

  /**
   * Fill the edit class form fields in the open dialog.
   */
  async fillEditForm(opts: { startTime: string; endTime: string }) {
    const dialog = this.page.getByRole('dialog');
    const timeInputs = dialog.locator('input[type="time"]');
    await timeInputs.nth(0).fill(opts.startTime);
    await timeInputs.nth(1).fill(opts.endTime);
  }

  /**
   * Click the edit (pencil) button on a class card.
   */
  async clickEditOnCard(cardName: string) {
    const card = this.classCard(cardName);
    // aria-label = t('classes.editClass') = "Editar Aula"
    await card.getByRole('button', { name: /editar aula/i }).click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Click the check-in button on a class card (student view).
   * Button text = t('classes.checkinProximity') = "Check-in"
   */
  async clickCheckinOnCard(cardName: string) {
    const card = this.classCard(cardName);
    await card.getByRole('button', { name: /^check-in$/i }).click();
  }
}
