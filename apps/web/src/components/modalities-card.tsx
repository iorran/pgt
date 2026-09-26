import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Modality {
  id: string;
  name: string;
  studentCount: number;
}

export function ModalitiesCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Modality | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: modalities = [] } = useApiQuery<Modality[]>(['modalities'], '/modalities');

  function onError(err: Error, target?: Modality | null) {
    if (err.message === 'MODALITY_EXISTS') {
      setError(t('settings.modalities.errors.exists'));
    } else if (err.message === 'MODALITY_IN_USE') {
      setError(t('settings.modalities.errors.inUse', { count: target?.studentCount ?? 0 }));
    } else {
      setError(t('common.genericError'));
    }
  }

  function onSuccess() {
    setError(null);
    for (const key of ['modalities', 'students', 'student']) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const addMutation = useMutation({
    mutationFn: (name: string) => api('/modalities', { method: 'POST', body: JSON.stringify({ name }) }),
    meta: { silent: true, successMessage: t('settings.modalities.added') },
    onError: (err: Error) => onError(err),
    onSuccess: () => {
      onSuccess();
      setNewName('');
    },
  });

  const renameMutation = useMutation({
    mutationFn: (m: { id: string; name: string }) =>
      api(`/modalities/${m.id}`, { method: 'PUT', body: JSON.stringify({ name: m.name }) }),
    meta: { silent: true, successMessage: t('settings.modalities.saved') },
    onError: (err: Error) => onError(err),
    onSuccess: () => {
      onSuccess();
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (m: Modality) => api(`/modalities/${m.id}`, { method: 'DELETE' }),
    meta: { silent: true, successMessage: t('settings.modalities.deleted') },
    onError: (err: Error, m) => onError(err, m),
    onSuccess,
    onSettled: () => setDeleting(null),
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-heading text-lg uppercase">{t('settings.modalities.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y divide-border rounded-sm border border-border">
          {modalities.map((m) =>
            editing?.id === m.id ? (
              <li key={m.id} className="px-3 py-2">
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renameMutation.mutate(editing);
                  }}
                >
                  <Label htmlFor="modality-rename" className="sr-only">
                    {t('settings.modalities.name')}
                  </Label>
                  <Input
                    id="modality-rename"
                    className="h-11 flex-1"
                    value={editing.name}
                    onChange={(e) => setEditing({ id: m.id, name: e.target.value })}
                    required
                    autoFocus
                  />
                  <Button type="submit" loading={renameMutation.isPending}>
                    {t('common.save')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    {t('common.cancel')}
                  </Button>
                </form>
              </li>
            ) : (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('settings.modalities.studentCount', { count: m.studentCount })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`${t('settings.modalities.rename')} ${m.name}`}
                    onClick={() => {
                      setError(null);
                      setEditing({ id: m.id, name: m.name });
                    }}
                  >
                    {t('settings.modalities.rename')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    aria-label={`${t('settings.modalities.delete')} ${m.name}`}
                    disabled={m.studentCount > 0}
                    title={
                      m.studentCount > 0
                        ? t('settings.modalities.errors.inUse', { count: m.studentCount })
                        : undefined
                    }
                    onClick={() => {
                      setError(null);
                      setDeleting(m);
                    }}
                  >
                    {t('settings.modalities.delete')}
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) {
              addMutation.mutate(newName.trim());
            }
          }}
        >
          <div className="flex-1 space-y-2">
            <Label htmlFor="modality-new">{t('settings.modalities.newName')}</Label>
            <Input
              id="modality-new"
              className="h-11"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>
          <Button type="submit" loading={addMutation.isPending}>
            {t('settings.modalities.add')}
          </Button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{t('settings.modalities.delete')}</DialogTitle>
            <DialogDescription>{t('settings.modalities.confirmDelete', { name: deleting?.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting)}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
