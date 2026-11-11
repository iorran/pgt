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
import { FinancePage, StudentBillingSection } from '../pages/finance-page';

// Owner-side Financeiro journeys: Class Add-on, Recruited Student, Expenses,
// Teacher Payouts, Monthly Balance, Settings › Financeiro.

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

const SCREENS = path.resolve(__dirname, '../../../test-results/finance-screens');
const money = (amount: string) => new RegExp(`${amount.replace('.', ',')}\\s€`);

// Marta (add-on) and Carla (recruited) both paid this month.
async function paidThisMonth(setup: Awaited<ReturnType<typeof scenarioFinance>>) {
  const today = todayYmd();
  await createPayment(setup.addOnStudent.id, setup.academy.id, setup.instructor.id, {
    amount: '55.00',
    paymentDate: today,
    referenceMonth: monthFromNow(),
  });
  await createPayment(setup.recruited.id, setup.academy.id, setup.instructor.id, {
    amount: '45.00',
    paymentDate: today,
    referenceMonth: monthFromNow(),
  });
}

test('F1. student page marks a Class Add-on and a recruiter; owed per month goes 45 → 55', async ({ browser }) => {
  const setup = await scenarioFinance(false);
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const billing = new StudentBillingSection(page);

    await billing.goto(setup.addOnStudent.id);
    await expect(billing.owesPerMonth).toContainText(money('45.00'));
    await billing.addOnSwitch.check();
    await billing.addOnTeacher.selectOption(setup.teacher.id);
    await expect(billing.owesPerMonth).toContainText(money('55.00'));
    await billing.save.click();
    await expect(page.getByText('Cobrança salva')).toBeVisible();

    await billing.goto(setup.recruited.id);
    await billing.recruitedBy.selectOption(setup.teacher.id);
    await billing.save.click();
    await expect(page.getByText('Cobrança salva').first()).toBeVisible();

    // Persisted: reloads show the marks.
    await billing.goto(setup.addOnStudent.id);
    await expect(billing.addOnSwitch).toBeChecked();
    await expect(billing.addOnTeacher).toHaveValue(setup.teacher.id);
    await expect(billing.owesPerMonth).toContainText(money('55.00'));
    await billing.goto(setup.recruited.id);
    await expect(billing.recruitedBy).toHaveValue(setup.teacher.id);
  } finally {
    await context.close();
  }
});

test('F2. Cobranças shows add-on and recruited chips; quick pay records 55 €', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing');

    const marta = finance.overdueCard(setup.addOnStudent.name);
    await expect(marta.getByText('+ Acréscimo No Gi')).toBeVisible({ timeout: 10_000 });
    await expect(marta.getByText(/45,00\s€ \+ 10,00\s€/)).toBeVisible();
    const carla = finance.overdueCard(setup.recruited.name);
    await expect(carla.getByText(`Angariado · ${setup.teacher.name}`)).toBeVisible();

    await marta.getByRole('button', { name: 'Registrar pagamento' }).click();
    await expect(page.getByText('Pagamento registrado')).toBeVisible();
    await expect
      .poll(async () =>
        (
          await e2eDb
            .select({ amount: schema.payment.amount })
            .from(schema.payment)
            .where(eq(schema.payment.studentId, setup.addOnStudent.id))
        ).map((p) => p.amount),
      )
      .toEqual(['55.00']);
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

test('F4. Repasses suggests the payout, flags missing check-ins, confirms a correction and exports a CSV', async ({
  browser,
}) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await paidThisMonth(setup);

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing/payouts');

    await expect(page.getByRole('heading', { level: 2, name: setup.teacher.name })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Por confirmar')).toBeVisible();
    // 1 add-on payment × 5 € + 50% of the 45 € the recruited student paid.
    await expect(page.getByText(/Acréscimos pagos · 1 × 5,00\s€/).locator('..')).toContainText(money('5.00'));
    await expect(page.getByText(/Angariados · 50% de 45,00\s€ pagos/).locator('..')).toContainText(money('22.50'));
    await expect(page.getByText('Calculado pelo app').locator('..')).toContainText(money('27.50'));
    await expect(page.getByText(/não fez check-in/)).toContainText(setup.addOnStudent.name);

    const amount = page.getByLabel('Repasse do mês');
    await expect(amount).toHaveValue('27.50');
    await amount.fill('30');
    await page.getByRole('button', { name: 'Confirmar repasse' }).click();
    await expect(page.getByText('Confirmado', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Repasse do mês')).toHaveValue('30');

    const { download, text } = await finance.downloadCsv('Exportar Excel');
    expect(download.suggestedFilename()).toBe(`repasse-rafael-nogi-${monthFromNow()}.csv`);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('Aluno;Mensalidade;Pago;Data do pagamento;Mês de referência;Tipo;Repasse');
    expect(text).toContain(`${setup.addOnStudent.name};45,00;55,00;${todayYmd()};${monthFromNow()};Acréscimo;5,00`);
    expect(text).toContain('Repasse do mês;30,00');
  } finally {
    await context.close();
  }
});

test('F5. Balanço: result = income − expenses − confirmed payout; switches month; exports', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;
  await paidThisMonth(setup);
  await createExpense(setup.academy.id, monthFromNow(), 'Renda', '20.00');
  await e2eDb.insert(schema.teacherPayout).values({
    academyId: setup.academy.id,
    teacherId: setup.teacher.id,
    month: monthFromNow(),
    amount: '30.00',
  });

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const finance = new FinancePage(page);
    await finance.goto('/billing/balance');

    // 100 € in (55 + 45) − 20 € expenses − 30 € confirmed payout.
    await expect(page.getByText(/^\+ 50,00\s€$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Entrou').locator('..')).toContainText(money('100.00'));
    await expect(page.getByText(/Acréscimos No Gi · 1/).locator('..')).toContainText(money('10.00'));

    const { download, text } = await finance.downloadCsv('Exportar mês para Excel');
    expect(download.suggestedFilename()).toBe(`balanco-${monthFromNow()}.csv`);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('Renda;20,00');
    expect(text).toContain('Repasses;30,00');
    expect(text).toContain('Resultado;50,00');

    await finance.prevMonth.click();
    await expect(page.getByText(/^\+ 0,00\s€$/)).toBeVisible();
  } finally {
    await context.close();
  }
});

test('F6. Settings › Financeiro: add-on price 12 makes the student owe 57', async ({ browser }) => {
  const setup = await scenarioFinance();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    await page.goto('/settings');
    const price = page.getByLabel('Preço do acréscimo (€ por mês)');
    await expect(price).toHaveValue('10', { timeout: 10_000 });
    await price.fill('12');
    await page.getByRole('button', { name: 'Salvar financeiro' }).click();
    await expect(page.getByText('Configurações financeiras salvas')).toBeVisible();

    const billing = new StudentBillingSection(page);
    await billing.goto(setup.addOnStudent.id);
    await expect(billing.owesPerMonth).toContainText(money('57.00'));
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
    await shot('cobrancas', (p) => expect(p.getByText('+ Acréscimo No Gi')).toBeVisible({ timeout: 10_000 }));
    await page.goto('/billing/balance');
    await shot('balanco', (p) => expect(p.getByText('Resultado do mês')).toBeVisible({ timeout: 10_000 }));
    await page.goto('/billing/expenses');
    await shot('despesas', (p) => expect(p.getByLabel('Renda', { exact: true })).toBeVisible({ timeout: 10_000 }));
    await page.goto('/billing/payouts');
    await shot('repasses', (p) => expect(p.getByLabel('Repasse do mês')).toBeVisible({ timeout: 10_000 }));
    await page.goto(`/students/${setup.addOnStudent.id}`);
    await shot('aluno-cobranca', (p) => expect(p.getByText('Deve por mês')).toBeVisible({ timeout: 10_000 }));
    await page.goto('/settings');
    await shot('configuracoes-financeiro', (p) =>
      expect(p.getByLabel('Preço do acréscimo (€ por mês)')).toBeVisible({ timeout: 10_000 }),
    );
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
