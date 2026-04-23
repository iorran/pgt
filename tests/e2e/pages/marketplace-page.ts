import { type Page, type Locator, expect } from '@playwright/test';

export class MarketplacePage {
  readonly page: Page;
  readonly addProductButton: Locator;
  readonly productNameInput: Locator;
  readonly productDescriptionInput: Locator;
  readonly productPriceInput: Locator;
  readonly productStockInput: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // t('marketplace.addProduct') = "Adicionar Produto"
    this.addProductButton = page.getByRole('button', {
      name: /adicionar produto/i,
    });
    // Labels have no htmlFor — target input by proximity to label text
    // t('marketplace.productName') = "Nome do Produto"
    this.productNameInput = page
      .getByText(/nome do produto/i)
      .locator('..')
      .locator('input');
    // t('marketplace.description') = "Descrição"
    this.productDescriptionInput = page
      .getByText(/^descrição$/i)
      .locator('..')
      .locator('input');
    // t('marketplace.price') = "Preço"
    this.productPriceInput = page
      .getByText(/^preço$/i)
      .locator('..')
      .locator('input');
    // t('marketplace.stock') = "Estoque"
    this.productStockInput = page
      .getByText(/^estoque$/i)
      .locator('..')
      .locator('input');
    // t('common.save') = "Salvar"
    this.saveButton = page.getByRole('button', { name: /^salvar$/i });
  }

  async goto() {
    await this.page.goto('/marketplace');
    // No <h1> heading — "LOJA" renders as a tab link in TabsNav.
    // Scope to <main> so this doesn't collide with the StaffShell sidebar's
    // "Loja" link or the StudentShell bottom nav's "Loja" link.
    await expect(
      this.page.getByRole('main').getByRole('link', { name: /^loja$/i }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Product cards render as <div data-slot="card">, not <article>.
   */
  productCard(name: string) {
    return this.page
      .locator('[data-slot="card"]')
      .filter({ hasText: new RegExp(name, 'i') });
  }
}

export class OrdersPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/marketplace/orders');
    // No <h1> heading — "PEDIDOS" renders as a tab link in TabsNav.
    await expect(
      this.page.getByRole('link', { name: /^pedidos$/i }),
    ).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Orders render as table rows (<tr>), not cards.
   * Find the row containing the product name.
   */
  orderRow(productName: string) {
    return this.page
      .locator('tbody tr')
      .filter({ hasText: new RegExp(productName, 'i') });
  }
}
