import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import type { ClassItem } from '@/lib/schedule';
import { TeacherField } from './teacher-field';

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

export interface ClassEditPatch {
  name: string;
  type: string;
  dayOfWeek?: number;
  date?: string;
  startTime: string;
  endTime: string;
  teacherId: string | null;
  guestTeacherName: string | null;
  studentPrice?: string;
  outsiderPrice?: string;
}

export interface ClassEditDialogProps {
  cls: ClassItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (patch: ClassEditPatch) => Promise<void> | void;
  onDelete?: (classId: string) => Promise<void> | void;
}

export function ClassEditDialog({
  cls,
  onOpenChange,
  onSubmit,
  onDelete,
}: ClassEditDialogProps) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const once = cls?.recurrence === 'once';

  const form = useForm({
    defaultValues: {
      name: '',
      type: '',
      dayOfWeek: 0,
      date: '',
      startTime: '',
      endTime: '',
      teacherId: null as string | null,
      guestTeacherName: null as string | null,
      studentPrice: '',
      outsiderPrice: '',
    },
    onSubmit: async ({ value }) => {
      const { dayOfWeek, date, studentPrice, outsiderPrice, ...rest } = value;
      await onSubmit({
        ...rest,
        ...(once ? { date } : { dayOfWeek }),
        ...(cls?.isSeminar ? { studentPrice, outsiderPrice } : {}),
      });
    },
  });

  useEffect(() => {
    if (!cls) {
      setConfirmingDelete(false);
      return;
    }
    form.reset();
    form.setFieldValue('name', cls.name);
    form.setFieldValue('type', cls.type);
    form.setFieldValue('dayOfWeek', cls.dayOfWeek);
    form.setFieldValue('startTime', cls.startTime);
    form.setFieldValue('endTime', cls.endTime);
    form.setFieldValue('date', cls.date ?? '');
    form.setFieldValue('teacherId', cls.teacher?.id ?? null);
    form.setFieldValue('guestTeacherName', cls.guestTeacherName ?? null);
    form.setFieldValue('studentPrice', cls.studentPrice ?? '');
    form.setFieldValue('outsiderPrice', cls.outsiderPrice ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls]);

  async function handleDelete() {
    if (!cls || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(cls.id);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Dialog open={!!cls} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {cls?.isSeminar ? t('seminars.edit') : t('classes.editClass')}
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="class-edit-name">{t('classes.className')}</Label>
                <Input
                  id="class-edit-name"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  required
                />
              </div>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="class-edit-type">{t('classes.classType')}</Label>
                <select
                  id="class-edit-type"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  className="flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-base md:text-sm"
                >
                  <option value="">--</option>
                  <option value="gi">{t('owner.classes.types.gi')}</option>
                  <option value="no-gi">{t('owner.classes.types.no-gi')}</option>
                  <option value="open-mat">{t('owner.classes.types.open-mat')}</option>
                  <option value="kids">{t('owner.classes.types.kids')}</option>
                </select>
              </div>
            )}
          </form.Field>
          {once ? (
            <form.Field name="date">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="class-edit-date">{t('classes.date')}</Label>
                  <Input
                    id="class-edit-date"
                    type="date"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
          ) : (
          <form.Field name="dayOfWeek">
            {(field) => (
              <div className="space-y-2">
                <Label id="class-edit-days">{t('classes.dayOfWeek')}</Label>
                <div role="group" aria-labelledby="class-edit-days" className="flex flex-wrap gap-2">
                  {DAY_KEYS.map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={field.state.value === i}
                      onClick={() => field.handleChange(i)}
                      className={`inline-flex items-center justify-center gap-1 min-h-11 min-w-11 px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                        field.state.value === i
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
                      {field.state.value === i && <Check className="size-3.5" aria-hidden="true" />}
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form.Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="startTime">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="class-edit-startTime">{t('classes.startTime')}</Label>
                  <Input
                    id="class-edit-startTime"
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="endTime">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="class-edit-endTime">{t('classes.endTime')}</Label>
                  <Input
                    id="class-edit-endTime"
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
          </div>
          <form.Subscribe
            selector={(state) => ({ teacherId: state.values.teacherId, guestTeacherName: state.values.guestTeacherName })}
          >
            {(teacher) => (
              <TeacherField
                id="class-edit-teacher"
                value={teacher}
                allowGuest={!!cls?.isSeminar}
                onChange={(next) => {
                  form.setFieldValue('teacherId', next.teacherId);
                  form.setFieldValue('guestTeacherName', next.guestTeacherName);
                }}
              />
            )}
          </form.Subscribe>
          {cls?.isSeminar && (
            <div className="grid grid-cols-2 gap-4">
              {(['studentPrice', 'outsiderPrice'] as const).map((name) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={`class-edit-${name}`}>{t(`seminars.${name}`)}</Label>
                      <Input
                        id={`class-edit-${name}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </form.Field>
              ))}
            </div>
          )}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                loading={isSubmitting}
                disabled={confirmingDelete}
              >
                {t('common.save')}
              </Button>
            )}
          </form.Subscribe>
        </form>

        {onDelete && (
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(saving) =>
              !confirmingDelete ? (
                <Button
                  variant="destructive"
                  className="mt-4"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                >
                  {t('classes.deleteClass')}
                </Button>
              ) : (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">
                    {t('classes.confirmDelete', { name: cls?.name })}
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmingDelete(false)}
                      disabled={deleting || saving}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      loading={deleting}
                      disabled={saving}
                    >
                      {t('classes.deleteClass')}
                    </Button>
                  </div>
                </div>
              )
            }
          </form.Subscribe>
        )}
      </DialogContent>
    </Dialog>
  );
}
