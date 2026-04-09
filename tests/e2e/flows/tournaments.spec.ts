import { test, expect } from '@playwright/test';
import {
  setupAcademy,
  cleanAcademy,
  createStudent,
  e2eDb,
  schema,
  type FixtureAcademy,
} from '../fixtures';
import { impersonateAs } from '../auth';
import { TournamentsPage } from '../pages/tournaments-page';
import { GamificationResultsPage } from '../pages/gamification-page';

let academy: FixtureAcademy | undefined;

test.afterEach(async () => {
  if (academy) {
    await cleanAcademy(academy.id);
    academy = undefined;
  }
});

// ─── Test 23 ──────────────────────────────────────────────────────────────────

test('23. instructor creates a tournament', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;

  const context = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await context.newPage();
    const tournaments = new TournamentsPage(page);
    await tournaments.goto();

    await tournaments.createTournamentButton.click();

    const name = `E2E Open ${Date.now()}`;
    // Labels have no htmlFor — navigate via parent div to input
    // t('tournaments.tournamentName') = "Nome do Campeonato"
    await tournaments.inputByLabel(/nome do campeonato/i).fill(name);
    // t('classes.date') = "Data"
    const future = new Date();
    future.setMonth(future.getMonth() + 1);
    await tournaments.inputByLabel(/^data$/i).fill(future.toISOString().slice(0, 10));
    // t('tournaments.location') = "Local"
    await tournaments.inputByLabel(/^local$/i).fill('Lisboa');

    // t('common.create') = "Criar"
    await tournaments.saveButton.click();

    await expect(tournaments.tournamentCard(name)).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    await context.close();
  }
});

// ─── Test 24 ──────────────────────────────────────────────────────────────────

test('24. student signs up for a tournament', async ({ browser }) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Competitor',
  });

  // Pre-create a tournament via direct DB insert
  const future = new Date();
  future.setMonth(future.getMonth() + 1);
  const [t] = await e2eDb
    .insert(schema.tournament)
    .values({
      academyId: setup.academy.id,
      name: 'E2E Tournament Signup',
      date: future.toISOString().slice(0, 10),
      location: 'Lisboa',
    })
    .returning();

  const context = await impersonateAs(browser, student.email);
  try {
    const page = await context.newPage();
    const tournaments = new TournamentsPage(page);
    await tournaments.goto();

    const card = tournaments.tournamentCard(t.name);
    await expect(card).toBeVisible({ timeout: 10_000 });

    // t('tournaments.signUp') = "Inscrever-se"
    await card.getByRole('button', { name: /inscrever-se/i }).click();

    // Fill weight class in the signup dialog
    // t('tournaments.weightClass') = "Categoria de Peso"
    await page
      .getByText(/categoria de peso/i)
      .locator('..')
      .locator('input')
      .fill('70kg');

    // t('common.confirm') = "Confirmar"
    await page.getByRole('button', { name: /confirmar/i }).click();

    // t('tournaments.signupSuccess') = "Inscrição realizada com sucesso!"
    await expect(
      page.getByText(/inscrição realizada com sucesso/i),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await context.close();
  }
});

// ─── Test 25 ──────────────────────────────────────────────────────────────────

test('25. student submits a result and instructor approves it', async ({
  browser,
}) => {
  const setup = await setupAcademy();
  academy = setup.academy;
  const student = await createStudent(setup.academy.id, {
    name: 'E2E Result Submitter',
  });

  // Pre-create a season (required by competitionResult FK)
  const now = new Date();
  const [s] = await e2eDb
    .insert(schema.season)
    .values({
      academyId: setup.academy.id,
      name: 'E2E Season 2025',
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`,
      pointsConfig: { 1: 100, 2: 60, 3: 30 },
      active: true,
    })
    .returning();

  // Phase 1: Student submits a result via UI form
  const studentContext = await impersonateAs(browser, student.email);
  try {
    const page = await studentContext.newPage();
    await page.goto('/gamification/results');
    // Wait for the tab nav to confirm the page loaded
    await expect(
      page.getByRole('link', { name: /resultados de competição/i }),
    ).toBeVisible({ timeout: 10_000 });

    // t('gamification.competitionName') = "Nome da Competição"
    await page
      .getByText(/nome da competição/i)
      .locator('..')
      .locator('input')
      .fill('E2E Grand Prix');

    // t('classes.date') = "Data"
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 7);
    await page
      .getByText(/^data$/i)
      .locator('..')
      .locator('input')
      .fill(pastDate.toISOString().slice(0, 10));

    // Select position 1º Lugar (already default but click to be sure)
    // t('gamification.first') = "1º Lugar"
    await page.getByRole('button', { name: /1º lugar/i }).click();

    // t('common.save') = "Salvar"
    await page.getByRole('button', { name: /^salvar$/i }).click();

    // t('gamification.resultSubmitted') = "Resultado enviado com sucesso!"
    await expect(
      page.getByText(/resultado enviado com sucesso/i),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await studentContext.close();
  }

  // Phase 2: Instructor approves the result
  const instructorContext = await impersonateAs(browser, setup.instructor.email);
  try {
    const page = await instructorContext.newPage();
    const results = new GamificationResultsPage(page);
    await results.goto();

    const card = results.resultCard(student.name);
    await expect(card).toBeVisible({ timeout: 10_000 });

    // t('gamification.approve') = "Aprovar"
    await card.getByRole('button', { name: /aprovar/i }).click();

    // After approval, the card should disappear from the pending list
    // (results filtered by status=pending — approved rows no longer show)
    await expect(card).not.toBeVisible({ timeout: 10_000 });
  } finally {
    await instructorContext.close();
  }
});
