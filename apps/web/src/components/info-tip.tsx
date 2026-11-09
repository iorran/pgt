import { Popover } from '@base-ui/react/popover';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';

// A tappable "?" that explains an app-specific term and links to its section in the user guide.
export function InfoTip({ label, text, section }: { label: string; text: string; section: string }) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const guide = isOwner(session?.user as { role?: string } | undefined) ? '/ajuda' : '/ajuda?guia=aluno';

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm align-middle text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Info className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={4} className="z-50">
          <Popover.Popup className="max-w-72 rounded-sm border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md outline-none">
            <Popover.Description className="mb-2">{text}</Popover.Description>
            <Link to={`${guide}#${encodeURIComponent(section)}`} className="text-primary underline underline-offset-2">
              {t('infoTip.learnMore')}
            </Link>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
