import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import {
  cleanAcademy,
  createExpense,
  createPayment,
  e2eDb,
  monthFromNow,
  scenarioFinance,
  schema,
  todayYmd,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { FinancePage, PayoutSheetPage } from '../pages/finance-page';

// Owner-side Financeiro journeys: Expenses, Payout Sheets (owner fills, teacher reads), Monthly Balance.

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

const SCREENS = path.resolve(__dirname, '../../../test-results/finance-screens');
const money = (amount: string) => new RegExp(`${amount.replace('.', ',')}\\s€`);

// Marta and Carla both paid this month.
async function paidThisMonth(setup: Awaited<ReturnType<typeof scenarioFinance>>) {
  for (const s of [setup.marta, setup.carla]) {
    await createPayment(s.id, setup.academy.id, setup.instructor.id, {
      amount: '45.00',
      paymentDate: todayYmd(),
      referenceMonth: monthFromNow(),
    });
  }
}

// A No Gi sheet for this month with Marta's line, confirmed or a draft.
async function noGiSheet(setup: Awaited<ReturnType<typeof scenarioFinance>>, amount: string, confirmed: boolean) {
  const [sheet] = await e2eDb
    .insert(schema.payoutSheet)
    .values({
      academyId: setup.academy.id,
      className: 'No Gi',
      month: monthFromNow(),
      confirmedAt: confirmed ? new Date() : null,
    })
    .returning();
  await e2eDb.insert(schema.payoutLine).values({ sheetId: sheet.id, studentId: setup.marta.id, amount });
  return sheet;
}

test('F2. Cobranças quick pay records the Monthly Fee', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing');

    const marta = finance.overdueCard(setup.marta.name);
    await marta.getByRole('button', { name: 'Registrar pagamento' }).click();
    await expect(page.getByText('Pagamento registrado')).toBeVisible();
    await expect
      .poll(async () =>
        (
          await e2eDb
            .select({ amount: schema.payment.amount })
            .from(schema.payment)
            .where(eq(schema.payment.studentId, setup.marta.id))
        ).map((p) => p.amount),
      )
      .toEqual(['45.00']);
  } finally {
    await context.close();
  }
});

test('F3. Despesas copies last month, edits, adds a one-off, removes, and the next month skips the one-off', async ({
  browser,
}) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await createExpense(setup.academy.id, monthFromNow(-1), 'Renda', '1200.00');
  await createExpense(setup.academy.id, monthFromNow(-1), 'Luz', '87.40');

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing/expenses');

    // Copied rows: same values, greyed until confirmed.
    const luz = finance.expenseCell('Luz');
    await expect(finance.expenseCell('Renda')).toHaveValue('1200');
    await expect(luz).toHaveValue('87.4');
    await expect(luz).toHaveClass(/text-muted-foreground/);
    await expect(page.getByText(/Copiado do mês anterior/)).toBeVisible();
    await expect(finance.expenseTotal()).toHaveText(money('1287.40'));

    // Edit a cell: saved on blur, no longer grey.
    await luz.fill('94.10');
    await luz.press('Tab');
    await expect(finance.expenseCell('Luz')).toHaveValue('94.1');
    await expect(finance.expenseCell('Luz')).not.toHaveClass(/text-muted-foreground/);

    // Add a one-off row.
    await page.getByLabel('Nova despesa').fill('Tatame novo');
    await page.getByLabel('Valor (€)').fill('340');
    await page.getByLabel('Só este mês').check();
    await page.getByRole('button', { name: 'Adicionar linha' }).click();
    await expect(finance.expenseCell(/^Tatame novo/)).toHaveValue('340');
    await expect(page.getByText('só este mês', { exact: true })).toBeVisible();

    // Remove a row.
    await page.getByRole('button', { name: 'Remover Renda' }).click();
    await expect(finance.expenseCell('Renda')).toHaveCount(0);
    await expect(finance.expenseTotal()).toHaveText(money('434.10'));

    // Next month starts from this one, without the one-off row.
    await finance.nextMonth.click();
    await expect(finance.expenseCell('Luz')).toHaveValue('94.1');
    await expect(finance.expenseCell('Luz')).toHaveClass(/text-muted-foreground/);
    await expect(page.getByText('Tatame novo')).toHaveCount(0);
    await expect(finance.expenseTotal()).toHaveText(money('94.10'));
  } finally {
    await context.close();
  }
});

test('F4. Repasses: the owner fills the No Gi sheet by hand (autosave), adds a student without check-in, confirms and reopens', async ({
  browser,
}) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await createPayment(setup.marta.id, setup.academy.id, setup.instructor.id, {
    amount: '45.00',
    paymentDate: todayYmd(),
    referenceMonth: monthFromNow(),
  });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing/payouts');

    const card = page.getByRole('link', { name: /No Gi/ });
    await expect(card).toContainText(setup.teacher.name, { timeout: 10_000 });
    await expect(card).toContainText('Não iniciada');
    await card.click();

    const sheet = new PayoutSheetPage(page);
    const marta = sheet.row(setup.marta.name);
    await expect(marta).toContainText('1 check-in');
    await expect(marta).toContainText('Pagou');
    await expect(marta).toContainText(money('45.00'));
    await expect(page.getByRole('button', { name: /Salvar/ })).toHaveCount(0);

    // Autosave on blur, comma decimals.
    await sheet.amount(setup.marta.name).fill('5');
    await sheet.amount(setup.marta.name).press('Tab');
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();

    await sheet.addStudent(setup.carla.name);
    await expect(sheet.row(setup.carla.name)).toContainText('Pendente');
    await sheet.amount(setup.carla.name).fill('22,50');
    await sheet.amount(setup.carla.name).press('Tab');
    await expect(sheet.total).toContainText(money('27.50'));

    await sheet.confirm.click();
    await expect(page.getByText('Confirmada', { exact: true })).toBeVisible();
    await expect(sheet.amount(setup.marta.name)).toHaveCount(0);
    await expect(marta).toContainText(money('5.00'));
    const [saved] = await e2eDb
      .select()
      .from(schema.payoutSheet)
      .where(eq(schema.payoutSheet.academyId, setup.academy.id));
    expect(saved.confirmedAt).not.toBeNull();

    await sheet.reopen.click();
    await expect(page.getByText('Rascunho', { exact: true })).toBeVisible();
    await expect(sheet.amount(setup.marta.name)).toHaveValue('5,00');
  } finally {
    await context.close();
  }
});

test('F5. Balanço: result = income − expenses − confirmed payouts; switches month; exports', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await paidThisMonth(setup);
  await createExpense(setup.academy.id, monthFromNow(), 'Renda', '20.00');
  await noGiSheet(setup, '30.00', true);

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing/balance');

    // 90 € in (45 + 45) − 20 € expenses − 30 € confirmed payout.
    await expect(page.getByText(/^\+ 40,00\s€$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Entrou').locator('..')).toContainText(money('90.00'));

    const { download, text } = await finance.downloadCsv('Exportar mês para Excel');
    expect(download.suggestedFilename()).toBe(`balanco-${monthFromNow()}.csv`);
    expect(text.startsWith('\ufeff')).toBe(true);
    expect(text).toContain('Renda;20,00');
    expect(text).toContain('Repasses;30,00');
    expect(text).toContain('Resultado;40,00');

    await finance.prevMonth.click();
    await expect(page.getByText(/^\+ 0,00\s€$/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('F6. the class teacher reads the draft sheet from Perfil, never a Monthly Fee', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await noGiSheet(setup, '5.00', false);

  const context = await impersonateAs(browser, setup.teacher.email);
  try {
    const page = await context.newPage();
    await page.goto('/me');
    await page.getByRole('link', { name: /Meu repasse/ }).click();

    await expect(page.getByText(/ainda em rascunho/)).toBeVisible({ timeout: 10_000 });
    const marta = page.getByRole('row').filter({ hasText: setup.marta.name });
    await expect(marta).toContainText(money('5.00'));
    await expect(page.getByText('Total para a aula').locator('..')).toContainText(money('5.00'));
    await expect(page.getByText(money('45.00'))).toHaveCount(0);
    await expect(page.getByRole('textbox')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('F7. screenshots of every finance screen at 390px for UI review', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await paidThisMonth(setup);
  for (const [description, amount] of [
    ['Renda', '1200.00'],
    ['Luz', '87.40'],
    ['Água', '32.15'],
    ['Internet', '35.00'],
  ]) {
    await createExpense(setup.academy.id, monthFromNow(-1), description, amount);
  }
  await createExpense(setup.academy.id, monthFromNow(), 'Renda', '1200.00');
  await createExpense(setup.academy.id, monthFromNow(), 'Tatame novo', '340.00', true);

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    const shot = async (name: string, ready: (p: Page) => Promise<void>) => {
      await ready(page);
      await page.screenshot({ path: path.join(SCREENS, `${name}.png`), fullPage: true });
    };

    await page.goto('/billing');
    await shot('cobrancas', (p) => expect(p.getByText(setup.marta.name)).toBeVisible({ timeout: 10_000 }));
    await page.goto('/billing/balance');
    await shot('balanco', (p) => expect(p.getByText('Resultado do mês')).toBeVisible({ timeout: 10_000 }));
    await page.goto('/billing/expenses');
    await shot('despesas', (p) => expect(p.getByLabel('Renda', { exact: true })).toBeVisible({ timeout: 10_000 }));
    await page.goto('/billing/payouts');
    await shot('repasses', (p) => expect(p.getByRole('link', { name: /No Gi/ })).toBeVisible({ timeout: 10_000 }));
    await page.goto(`/billing/payouts/${monthFromNow()}/No%20Gi`);
    await shot('repasse-planilha', (p) => expect(p.getByLabel(`Repasse de ${setup.marta.name}`)).toBeVisible({ timeout: 10_000 }));
    // Despesas right after a month copy (greyed rows): next month starts from this one.
    await page.goto('/billing/expenses');
    await page.getByRole('button', { name: 'Mês seguinte' }).click();
    await shot('despesas-copiadas', (p) => expect(p.getByText(/Copiado do mês anterior/)).toBeVisible());

    expect(
      await e2eDb
        .select()
        .from(schema.expense)
        .where(and(eq(schema.expense.academyId, setup.academy.id), eq(schema.expense.month, monthFromNow(1)))),
    ).toHaveLength(1);
  } finally {
    await context.close();
  }
});
