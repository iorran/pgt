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
                <Label>{t('classes.dayOfWeek')}</Label>
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

        {onDelete && !confirmingDelete && (
          <Button
            variant="outline"
            className="text-destructive mt-4"
            onClick={() => setConfirmingDelete(true)}
          >
            {t('classes.deleteClass')}
          </Button>
        )}

        {onDelete && confirmingDelete && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              {t('classes.confirmDelete')}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={handleDelete}
                loading={deleting}
              >
                {t('classes.deleteClass')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
