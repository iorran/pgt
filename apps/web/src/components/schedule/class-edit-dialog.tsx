import { useEffect } from 'react';
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
import type { ClassItem } from '@/lib/schedule';

const DAY_KEYS = [
  'classes.days.sun',
  'classes.days.mon',
  'classes.days.tue',
  'classes.days.wed',
  'classes.days.thu',
  'classes.days.fri',
  'classes.days.sat',
];

export interface ClassEditDialogProps {
  cls: ClassItem | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (patch: {
    name: string;
    type: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }) => Promise<void> | void;
}

export function ClassEditDialog({ cls, onOpenChange, onSubmit }: ClassEditDialogProps) {
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: {
      name: '',
      type: '',
      dayOfWeek: 0,
      startTime: '',
      endTime: '',
    },
    onSubmit: async ({ value }) => {
      await onSubmit(value);
    },
  });

  useEffect(() => {
    if (!cls) return;
    form.reset();
    form.setFieldValue('name', cls.name);
    form.setFieldValue('type', cls.type);
    form.setFieldValue('dayOfWeek', cls.dayOfWeek);
    form.setFieldValue('startTime', cls.startTime);
    form.setFieldValue('endTime', cls.endTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls]);

  return (
    <Dialog open={!!cls} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">
            {t('classes.editClass')}
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
                <Label>{t('classes.className')}</Label>
                <Input
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
                <Label>{t('classes.classType')}</Label>
                <select
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  className="flex h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
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
          <form.Field name="dayOfWeek">
            {(field) => (
              <div className="space-y-2">
                <Label>{t('classes.daysOfWeek')}</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_KEYS.map((k, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => field.handleChange(i)}
                      className={`px-3 py-1.5 rounded-sm text-sm font-heading uppercase tracking-wide border transition-colors ${
                        field.state.value === i
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-foreground'
                      }`}
                    >
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
                  <Label>{t('classes.startTime')}</Label>
                  <Input
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
                  <Label>{t('classes.endTime')}</Label>
                  <Input
                    type="time"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    required
                  />
                </div>
              )}
            </form.Field>
          </div>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" loading={isSubmitting}>
                {t('common.save')}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
