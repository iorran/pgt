import { useForm } from '@tanstack/react-form';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, Medal } from 'lucide-react';
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

export interface ClassCreateValues {
  name: string;
  type: string;
  recurrence: 'weekly' | 'once';
  daysOfWeek: number[];
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string | null;
  guestTeacherName: string | null;
  studentPrice: string;
  outsiderPrice: string;
}

export interface ClassCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ClassCreateValues) => Promise<void> | void;
  // A Seminar: always a single date, with prices and possibly a Guest Teacher.
  seminar?: boolean;
}

export function ClassCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  seminar = false,
}: ClassCreateDialogProps) {
  const { t } = useTranslation();
  const idp = seminar ? 'seminar-create' : 'class-create';
  const title = seminar ? t('seminars.new') : t('classes.createClass');

  const form = useForm({
    defaultValues: {
      name: '',
      type: '',
      recurrence: (seminar ? 'once' : 'weekly') as 'weekly' | 'once',
      daysOfWeek: [] as number[],
      date: '',
      startTime: '',
      endTime: '',
      teacherId: null as string | null,
      guestTeacherName: null as string | null,
      studentPrice: '',
      outsiderPrice: '',
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value);
        form.reset();
      } catch {
        // Parent already reported the error; keep the values for a retry.
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          seminar ? (
            <Button className="h-12 w-full bg-seminar font-heading text-base uppercase text-seminar-foreground hover:bg-seminar/90" />
          ) : (
            <Button />
          )
        }
      >
        {seminar && <Medal aria-hidden />}
        {title}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {title}
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
                <Label htmlFor={`${idp}-name`}>{t('classes.className')}</Label>
                <Input
                  id={`${idp}-name`}
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
                <Label htmlFor={`${idp}-type`}>{t('classes.classType')}</Label>
                <select
                  id={`${idp}-type`}
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
          {!seminar && (
            <form.Field name="recurrence">
              {(field) => (
                <div role="group" aria-label={t('classes.recurrence.weekly')} className="grid grid-cols-2 gap-1 rounded-sm border border-border p-0.5">
                  {(['weekly', 'once'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={field.state.value === r}
                      onClick={() => field.handleChange(r)}
                      className={`min-h-11 rounded-sm font-heading text-sm uppercase tracking-wide ${
                        field.state.value === r ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t(`classes.recurrence.${r}`)}
                    </button>
                  ))}
                </div>
              )}
            </form.Field>
          )}
          <form.Subscribe selector={(state) => state.values.recurrence}>
            {(recurrence) =>
              recurrence === 'once' ? (
                <form.Field name="date">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={`${idp}-date`}>{t('classes.date')}</Label>
                      <Input
                        id={`${idp}-date`}
                        type="date"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        required
                      />
                    </div>
                  )}
                </form.Field>
              ) : (
          <form.Field name="daysOfWeek">
            {(field) => (
              <div className="space-y-2">
                <Label id={`${idp}-days`}>{t('classes.daysOfWeek')}</Label>
                <div role="group" aria-labelledby={`${idp}-days`} className="flex flex-wrap gap-2">
                  {DAY_KEYS.map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={field.state.value.includes(i)}
                      onClick={() => {
                        const current = field.state.value;
                        field.handleChange(
                          current.includes(i)
                            ? current.filter((d) => d !== i)
                            : [...current, i],
                        );
                      }}
                      className={`inline-flex items-center justify-center gap-1 min-h-11 min-w-11 px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                        field.state.value.includes(i)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
                      {field.state.value.includes(i) && <Check className="size-3.5" aria-hidden="true" />}
                      {t(k)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form.Field>
              )
            }
          </form.Subscribe>
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="startTime">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={`${idp}-startTime`}>{t('classes.startTime')}</Label>
                  <Input
                    id={`${idp}-startTime`}
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    required
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="endTime">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={`${idp}-endTime`}>{t('classes.endTime')}</Label>
                  <Input
                    id={`${idp}-endTime`}
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
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
                id={`${idp}-teacher`}
                value={teacher}
                allowGuest={seminar}
                onChange={(next) => {
                  form.setFieldValue('teacherId', next.teacherId);
                  form.setFieldValue('guestTeacherName', next.guestTeacherName);
                }}
              />
            )}
          </form.Subscribe>
          {seminar && (
            <div className="grid grid-cols-2 gap-4">
              {(['studentPrice', 'outsiderPrice'] as const).map((name) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={`${idp}-${name}`}>{t(`seminars.${name}`)}</Label>
                      <Input
                        id={`${idp}-${name}`}
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
          <form.Subscribe
            selector={(state) => ({
              daysOfWeek: state.values.daysOfWeek,
              recurrence: state.values.recurrence,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ daysOfWeek, recurrence, isSubmitting }) => (
              <Button
                type="submit"
                disabled={recurrence === 'weekly' && daysOfWeek.length === 0}
                loading={isSubmitting}
              >
                {t('common.save')}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
