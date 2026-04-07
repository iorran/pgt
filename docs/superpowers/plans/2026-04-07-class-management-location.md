---
title: Class Management & Academy Location Implementation Plan
date: 2026-04-07
tags:
  - plan
  - classes
  - academy
  - forms
status: pending
---

# Class Management & Academy Location Implementation Plan

> [!info] Related
> - Spec: [[2026-04-07-class-management-location-design|Design Spec]]

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add edit/delete UI for classes and academy location setup, using TanStack Form for form management.

**Architecture:** Install @tanstack/react-form, refactor the class create dialog to use it, add edit/delete class actions, and add academy location section to the dashboard.

**Tech Stack:** @tanstack/react-form, React 19, TanStack Query, Lucide icons, shadcn/ui

---

## File Structure

**New files:**
- None

**Modified files:**
- `apps/web/package.json` — add @tanstack/react-form
- `apps/web/src/pages/classes/index.tsx` — refactor create form, add edit/delete
- `apps/web/src/pages/dashboard.tsx` — add academy location section
- `apps/web/src/i18n/en.json` — new translation keys
- `apps/web/src/i18n/pt-BR.json` — new translation keys
- `apps/web/test/pages/classes.test.tsx` — tests for edit/delete
- `apps/web/test/pages/dashboard.test.tsx` — tests for location section

---

### Task 1: Install TanStack Form + Add Translation Keys

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/i18n/en.json`
- Modify: `apps/web/src/i18n/pt-BR.json`

- [ ] **Step 1: Install @tanstack/react-form**

```bash
cd apps/web && npm install @tanstack/react-form
```

- [ ] **Step 2: Add translation keys to en.json**

Add to the `classes` section:

```json
"editClass": "Edit Class",
"deleteClass": "Delete Class",
"confirmDelete": "Are you sure you want to delete this class?",
"classDeleted": "Class deleted"
```

Add to the `onboarding` section (alongside existing keys):

```json
"setLocation": "Set academy location",
"useMyLocation": "Use my current location",
"locationSet": "Location saved",
"address": "Address"
```

- [ ] **Step 3: Add translation keys to pt-BR.json**

Add to the `classes` section:

```json
"editClass": "Editar Aula",
"deleteClass": "Excluir Aula",
"confirmDelete": "Tem certeza que deseja excluir esta aula?",
"classDeleted": "Aula excluída"
```

Add to the `onboarding` section:

```json
"setLocation": "Definir localização da academia",
"useMyLocation": "Usar minha localização atual",
"locationSet": "Localização salva",
"address": "Endereço"
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src/i18n/en.json apps/web/src/i18n/pt-BR.json
git commit -m "chore: install @tanstack/react-form and add translation keys

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Refactor Classes Page — Create Form + Add Edit/Delete

**Files:**
- Modify: `apps/web/src/pages/classes/index.tsx`
- Modify: `apps/web/test/pages/classes.test.tsx`

- [ ] **Step 1: Update the test file with new test cases**

Add to `apps/web/test/pages/classes.test.tsx` — new tests for edit and delete:

```typescript
it('shows edit and delete buttons for instructors', async () => {
  renderWithProviders(<ClassesPage />);
  await screen.findByText('Morning Gi');
  const editButtons = screen.getAllByLabelText('classes.editClass');
  const deleteButtons = screen.getAllByLabelText('classes.deleteClass');
  expect(editButtons.length).toBe(2);
  expect(deleteButtons.length).toBe(2);
});

it('does not show edit/delete buttons for students', async () => {
  mockUseSession.mockReturnValue(studentSession);
  renderWithProviders(<ClassesPage />);
  await screen.findByText('Morning Gi');
  expect(screen.queryByLabelText('classes.editClass')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('classes.deleteClass')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

Run: `cd apps/web && npx vitest run test/pages/classes.test.tsx`
Expected: New tests FAIL (no edit/delete buttons yet)

- [ ] **Step 3: Refactor ClassesPage**

Rewrite `apps/web/src/pages/classes/index.tsx`. Key changes:

1. Import `useForm` from `@tanstack/react-form` and `Pencil`, `Trash2` from `lucide-react`
2. Replace `useState` form with `useForm` for create dialog
3. Add edit dialog with `useForm` pre-filled with class data
4. Add delete confirmation dialog
5. Add edit/delete mutations
6. Add icon buttons to each class card (instructor only)

The create form using TanStack Form:

```typescript
const createForm = useForm({
  defaultValues: {
    name: '',
    type: '',
    recurrence: 'weekly',
    daysOfWeek: [] as number[],
    startTime: '',
    endTime: '',
  },
  onSubmit: async ({ value }) => {
    for (const day of value.daysOfWeek) {
      await api('/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: value.name,
          type: value.type,
          recurrence: value.recurrence,
          dayOfWeek: day,
          startTime: value.startTime,
          endTime: value.endTime,
          academyId: user.academyId,
        }),
      });
    }
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    setDialogOpen(false);
    createForm.reset();
  },
});
```

The edit form:

```typescript
const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

const editForm = useForm({
  defaultValues: {
    name: '',
    type: '',
    startTime: '',
    endTime: '',
  },
  onSubmit: async ({ value }) => {
    await api(`/classes/${editingClass!.id}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    setEditingClass(null);
  },
});
```

When opening edit dialog, reset the form with the class data:

```typescript
function handleEdit(cls: ClassItem) {
  editForm.reset();
  editForm.setFieldValue('name', cls.name);
  editForm.setFieldValue('type', cls.type);
  editForm.setFieldValue('startTime', cls.startTime);
  editForm.setFieldValue('endTime', cls.endTime);
  setEditingClass(cls);
}
```

The delete flow:

```typescript
const [deletingClass, setDeletingClass] = useState<ClassItem | null>(null);

const deleteMutation = useMutation({
  mutationFn: (classId: string) =>
    api(`/classes/${classId}`, { method: 'DELETE' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    setDeletingClass(null);
  },
});
```

Each class card header (instructor view) gets icon buttons:

```tsx
{user?.role === 'instructor' && (
  <div className="flex gap-1">
    <button
      onClick={() => handleEdit(c)}
      aria-label={t('classes.editClass')}
      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Pencil size={16} />
    </button>
    <button
      onClick={() => setDeletingClass(c)}
      aria-label={t('classes.deleteClass')}
      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
    >
      <Trash2 size={16} />
    </button>
  </div>
)}
```

TanStack Form field rendering pattern:

```tsx
<createForm.Field name="name">
  {(field) => (
    <div className="space-y-2">
      <Label>{t('classes.className')}</Label>
      <Input
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        required
      />
    </div>
  )}
</createForm.Field>
```

The form submit uses:

```tsx
<form onSubmit={(e) => { e.preventDefault(); createForm.handleSubmit(); }}>
```

Delete confirmation dialog:

```tsx
<Dialog open={!!deletingClass} onOpenChange={(open) => !open && setDeletingClass(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('classes.deleteClass')}</DialogTitle>
    </DialogHeader>
    <p className="text-muted-foreground">{t('classes.confirmDelete')}</p>
    <div className="flex justify-end gap-2 mt-4">
      <Button variant="outline" onClick={() => setDeletingClass(null)}>
        {t('common.cancel')}
      </Button>
      <Button
        variant="destructive"
        onClick={() => deleteMutation.mutate(deletingClass!.id)}
        disabled={deleteMutation.isPending}
      >
        {t('classes.deleteClass')}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/pages/classes.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/classes/index.tsx apps/web/test/pages/classes.test.tsx
git commit -m "feat: add class edit/delete and refactor create form to TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Academy Location on Dashboard

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`
- Modify: `apps/web/test/pages/dashboard.test.tsx`

- [ ] **Step 1: Update dashboard test with location tests**

Add to `apps/web/test/pages/dashboard.test.tsx`:

Update `mockAcademy` to include location fields:
```typescript
const mockAcademy = {
  id: 'a1',
  name: 'Fight Arena',
  city: 'Sao Paulo',
  joinCode: 'ABC123',
  latitude: null,
  longitude: null,
  address: null,
};
```

Add new tests:
```typescript
it('shows set location button for instructor', async () => {
  renderWithProviders(<DashboardPage />);
  await waitFor(() => {
    expect(screen.getByText('onboarding.setLocation')).toBeInTheDocument();
  });
});

it('shows saved address when location is set', async () => {
  mockApi.mockResolvedValue({
    ...mockAcademy,
    latitude: '-23.5505',
    longitude: '-46.6333',
    address: 'Rua Augusta, 123',
  } as any);
  renderWithProviders(<DashboardPage />);
  await waitFor(() => {
    expect(screen.getByText('Rua Augusta, 123')).toBeInTheDocument();
  });
});

it('does not show location section for students', async () => {
  mockUseSession.mockReturnValue(studentSession);
  renderWithProviders(<DashboardPage />);
  await waitFor(() => {
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
  });
  expect(screen.queryByText('onboarding.setLocation')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify new ones fail**

Run: `cd apps/web && npx vitest run test/pages/dashboard.test.tsx`
Expected: New tests FAIL

- [ ] **Step 3: Update DashboardPage with location section**

Modify `apps/web/src/pages/dashboard.tsx`:

1. Import `useForm` from `@tanstack/react-form`, `Input` and `Label` from components
2. Update `AcademyInfo` interface to include `latitude`, `longitude`, `address`
3. Add location section inside the instructor academy card

Update the interface:
```typescript
interface AcademyInfo {
  id: string;
  name: string;
  city: string;
  joinCode: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
}
```

Add state and form for location:
```typescript
const [locationMsg, setLocationMsg] = useState('');

const locationForm = useForm({
  defaultValues: {
    address: academy?.address || '',
  },
  onSubmit: async ({ value }) => {
    // This form only handles address text.
    // Geolocation is triggered by the button separately.
    if (academy) {
      await api(`/academies/${academy.id}/location`, {
        method: 'PUT',
        body: JSON.stringify({
          latitude: Number(academy.latitude) || 0,
          longitude: Number(academy.longitude) || 0,
          address: value.address,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['academy-mine'] });
    }
  },
});

function handleSetLocation() {
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      await api(`/academies/${academy!.id}/location`, {
        method: 'PUT',
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          address: locationForm.getFieldValue('address') || undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['academy-mine'] });
      setLocationMsg(t('onboarding.locationSet'));
      setTimeout(() => setLocationMsg(''), 3000);
    },
    () => {
      setLocationMsg('Geolocation unavailable');
      setTimeout(() => setLocationMsg(''), 3000);
    },
  );
}
```

Add the location section JSX inside the academy card, after the WhatsApp share button:

```tsx
<div className="border-t border-border pt-4 mt-4">
  <p className="font-heading uppercase tracking-wider text-sm mb-3">
    {t('onboarding.setLocation')}
  </p>

  {academy.address && (
    <p className="text-sm text-muted-foreground mb-2">{academy.address}</p>
  )}

  {academy.latitude && (
    <p className="text-xs text-muted-foreground mb-3">
      {academy.latitude}, {academy.longitude}
    </p>
  )}

  <locationForm.Field name="address">
    {(field) => (
      <div className="space-y-2 mb-3">
        <Label>{t('onboarding.address')}</Label>
        <Input
          value={field.state.value}
          onChange={e => field.handleChange(e.target.value)}
          placeholder={t('onboarding.address')}
        />
      </div>
    )}
  </locationForm.Field>

  <Button variant="outline" className="w-full" onClick={handleSetLocation}>
    {t('onboarding.useMyLocation')}
  </Button>

  {locationMsg && (
    <p className="text-primary text-sm mt-2">{locationMsg}</p>
  )}
</div>
```

Also import `useQueryClient` and add `const queryClient = useQueryClient();`

- [ ] **Step 4: Run tests**

Run: `cd apps/web && npx vitest run test/pages/dashboard.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Run full web test suite**

Run: `cd apps/web && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/dashboard.tsx apps/web/test/pages/dashboard.test.tsx
git commit -m "feat: add academy location setup to dashboard with TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
