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
    // The page header renders this as the create-dialog trigger
    // (aria-expanded); the empty state repeats the same CTA as a plain button.
    // expanded:false picks the header trigger only.
    this.createClassButton = page.getByRole('button', {
      name: /criar aula/i,
      expanded: false,
    });
    // t('common.save') = "Salvar"
    this.saveButton = page.getByRole('button', { name: /^salvar$/i });
  }

  /**
   * Create/edit flows drive the calendar view, which is optional since the
   * day list became the default; the choice is remembered in localStorage.
   */
  async goto() {
    await this.page.addInitScript(() => localStorage.setItem('pgt.classesView', 'calendar'));
    await this.page.goto('/classes');
    await expect(this.page.locator('body')).toBeVisible({ timeout: 10_000 });
  }

  async gotoHistory() {
    await this.page.goto('/classes/history');
    await expect(this.historyTab).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Class events render as .rbc-event blocks inside the react-big-calendar
   * grid. The event title is the class name (see schedule.ts buildEvent).
   */
  classEvent(name: string) {
    return this.page
      .locator('.rbc-event')
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

    // Day-of-week toggle buttons (0-indexed, matching DAY_KEYS order), inside the
    // "Dias da semana" group — the dialog also has the Toda semana / Data única toggle.
    const dayButtons = dialog.getByRole('group', { name: /dias da semana/i }).getByRole('button');
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
   * Click a calendar event to open the edit dialog (instructor view).
   * InstructorClassesView opens ClassEditDialog on onEventClick.
   */
  async clickEditOnEvent(name: string) {
    await this.classEvent(name).first().click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
  }

  /**
   * Card for a class in the student's day list.
   */
  classCard(name: string) {
    return this.page.locator('li').filter({ hasText: new RegExp(name, 'i') });
  }

  /**
   * Click the check-in button on a class card (student day list).
   */
  async clickCheckinOnCard(name: string) {
    await this.classCard(name).first().getByRole('button', { name: /^check-in$/i }).click();
  }
}
