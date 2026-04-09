import { test, expect } from '@playwright/test';
import { eq } from 'drizzle-orm';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { MarketplacePage, OrdersPage } from '../pages/marketplace-page';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

// ─── Test 20 ─────────────────────────────────────────────────────────────────

test('20. instructor adds a product', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const marketplace = new MarketplacePage(page);
    await marketplace.goto();

    await marketplace.addProductButton.click();

    const productName = `E2E Kimono ${Date.now()}`;
    await marketplace.productNameInput.fill(productName);
    await marketplace.productDescriptionInput.fill('Kimono de teste E2E');
    await marketplace.productPriceInput.fill('450');
    await marketplace.productStockInput.fill('10');
    await marketplace.saveButton.click();

    await expect(marketplace.productCard(productName)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});

// ─── Test 21 ─────────────────────────────────────────────────────────────────

test('21. student requests a product', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Order Student',
  });

  // Pre-create a product via direct DB insert so this test only exercises the
  // order flow. Schema: id, academyId, name, description, price, stock, active
  const [p] = await e2eDb
    .insert(schema.product)
    .values({
      academyId: setup.academy.id,
      name: 'E2E Faixa Branca',
      description: 'Faixa de teste',
      price: '80.00',
      stock: 5,
    })
    .returning();

  const context = await impersonateAs(browser, student.email);
  try {
    const page = await context.newPage();
    const marketplace = new MarketplacePage(page);
    await marketplace.goto();

    const card = marketplace.productCard(p.name);
    await expect(card).toBeVisible({ timeout: 10_000 });

    // t('marketplace.request') = "Solicitar"
    await card.getByRole('button', { name: /solicitar/i }).click();

    // t('marketplace.requestSuccess') = "Pedido realizado com sucesso!"
    await expect(
      page.getByText(/pedido realizado com sucesso/i),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});

// ─── Test 22 ─────────────────────────────────────────────────────────────────

test('22. instructor confirms and delivers an order', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Delivery Student',
  });

  // Pre-create product and a pending (requested) order via direct DB inserts.
  // Note: order schema has no academyId — filtered by joining on product.academyId.
  // Status enum values: 'requested', 'confirmed', 'delivered', 'cancelled'
  const [p] = await e2eDb
    .insert(schema.product)
    .values({
      academyId: setup.academy.id,
      name: 'E2E Faixa Preta',
      description: 'Faixa de teste',
      price: '200.00',
      stock: 2,
    })
    .returning();

  await e2eDb.insert(schema.order).values({
    productId: p.id,
    studentId: student.id,
    quantity: 1,
    status: 'requested',
  });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const orders = new OrdersPage(page);
    await orders.goto();

    const orderRow = orders.orderRow(p.name);
    await expect(orderRow).toBeVisible({ timeout: 10_000 });

    // t('common.confirm') = "Confirmar" — button only shows for 'requested' orders
    await orderRow.getByRole('button', { name: /confirmar/i }).click();
    // t('marketplace.orderStatus.confirmed') = "Confirmado"
    await expect(orderRow.getByText(/confirmado/i)).toBeVisible({
      timeout: 10_000,
    });

    // t('marketplace.deliver') = "Entregar" — button shows for 'confirmed' orders
    await orderRow.getByRole('button', { name: /entregar/i }).click();
    // t('marketplace.orderStatus.delivered') = "Entregue"
    await expect(orderRow.getByText(/entregue/i)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});
