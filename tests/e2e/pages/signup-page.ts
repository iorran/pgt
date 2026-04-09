import type { Page } from '@playwright/test';

/**
 * /signup — choose-role page
 * Two cards: "Criar Academia" and "Tenho um código"
 */
export class SignupPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/signup');
  }

  async clickCreateAcademy() {
    await this.page.getByRole('button', { name: /criar academia/i }).first().click();
  }

  async enterCodeAndContinue(code: string) {
    await this.page.getByPlaceholder(/Digite o código da academia/i).fill(code);
    await this.page.getByRole('button', { name: /continuar/i }).click();
  }
}

/**
 * /signup — choose-role page (alias kept for clarity in tests)
 */
export const ChooseRolePage = SignupPage;

/**
 * /criar-academia — instructor signup + create academy
 */
export class CriarAcademiaPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/criar-academia');
  }

  async fillName(name: string) {
    await this.page.locator('#name').fill(name);
  }

  async fillEmail(email: string) {
    await this.page.locator('#email').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.locator('#password').fill(password);
  }

  async fillAcademyName(name: string) {
    await this.page.locator('#academyName').fill(name);
  }

  async fillCity(city: string) {
    await this.page.locator('#city').fill(city);
  }

  async submit() {
    await this.page.getByRole('button', { name: /criar academia/i }).click();
  }

  async fillAndSubmit(opts: {
    name: string;
    email: string;
    password: string;
    academyName: string;
    city: string;
  }) {
    await this.fillName(opts.name);
    await this.fillEmail(opts.email);
    await this.fillPassword(opts.password);
    await this.fillAcademyName(opts.academyName);
    await this.fillCity(opts.city);
    await this.submit();
  }

  errorMessage() {
    return this.page.locator('p.text-destructive');
  }
}

/**
 * /entrar/:code — student join-academy form
 */
export class EntrarPage {
  constructor(private page: Page) {}

  async goto(code: string) {
    await this.page.goto(`/entrar/${code}`);
  }

  notFoundMessage() {
    return this.page.getByText('Academia não encontrada');
  }

  async fillName(name: string) {
    await this.page.locator('#name').fill(name);
  }

  async fillEmail(email: string) {
    await this.page.locator('#email').fill(email);
  }

  async fillPassword(password: string) {
    await this.page.locator('#password').fill(password);
  }

  async selectBelt(belt: string) {
    // Native <select> with id="belt"
    await this.page.locator('#belt').selectOption(belt);
  }

  async submit() {
    await this.page.getByRole('button', { name: /continuar/i }).click();
  }

  async fillAndSubmit(opts: {
    name: string;
    email: string;
    password: string;
    belt?: string;
  }) {
    await this.fillName(opts.name);
    await this.fillEmail(opts.email);
    await this.fillPassword(opts.password);
    if (opts.belt) await this.selectBelt(opts.belt);
    await this.submit();
  }

  errorMessage() {
    return this.page.locator('p.text-destructive');
  }
}
