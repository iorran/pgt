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
import { Check } from 'lucide-react';

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

export interface ClassCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: {
    name: string;
    type: string;
    recurrence: string;
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
  }) => Promise<void> | void;
}

export function ClassCreateDialog({
  open,
  onOpenChange,
  onSubmit,
}: ClassCreateDialogProps) {
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: {
      name: '',
      type: '',
      recurrence: 'weekly',
      daysOfWeek: [] as number[],
      startTime: '',
      endTime: '',
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
      <DialogTrigger render={<Button />}>
        {t('classes.createClass')}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {t('classes.createClass')}
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
                <Label htmlFor="class-create-name">{t('classes.className')}</Label>
                <Input
                  id="class-create-name"
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
                <Label htmlFor="class-create-type">{t('classes.classType')}</Label>
                <select
                  id="class-create-type"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  className="flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="">--</option>
                  <option value="gi">Gi</option>
                  <option value="no-gi">No-Gi</option>
                  <option value="open-mat">Open Mat</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
            )}
          </form.Field>
          <form.Field name="daysOfWeek">
            {(field) => (
              <div className="space-y-2">
                <Label id="class-create-days">{t('classes.daysOfWeek')}</Label>
                <div role="group" aria-labelledby="class-create-days" className="flex flex-wrap gap-2">
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
          <div className="grid grid-cols-2 gap-4">
            <form.Field name="startTime">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="class-create-startTime">{t('classes.startTime')}</Label>
                  <Input
                    id="class-create-startTime"
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
                  <Label htmlFor="class-create-endTime">{t('classes.endTime')}</Label>
                  <Input
                    id="class-create-endTime"
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
            selector={(state) => ({
              daysOfWeek: state.values.daysOfWeek,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ daysOfWeek, isSubmitting }) => (
              <Button
                type="submit"
                disabled={daysOfWeek.length === 0}
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
