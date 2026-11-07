import { useTranslation } from 'react-i18next';
import { signOut } from '@/lib/auth-client';
import { markProfileChosen, setActingAs, type Profile } from '@/lib/profile';
import { PageLoader } from '@/components/page-loader';
import { useProfiles } from '@/hooks/use-profiles';
import { Button } from '@/components/ui/button';


// "Quem vai usar?" — the Responsible picks themself or a Dependent (ADR 0004).
export default function ProfilesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useProfiles();

  function choose(profile: Profile, isSelf: boolean) {
    setActingAs(isSelf ? null : profile);
    markProfileChosen();
    // Full reload: every cached query belonged to the previous profile.
    window.location.assign('/');
  }

  if (isLoading || !data) {
    return <PageLoader />;
  }

  const profiles = [...(data.self ? [{ profile: data.self, isSelf: true }] : []), ...data.dependents.map(profile => ({ profile, isSelf: false }))];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 arena-stripes">
      <h1 className="font-heading text-3xl uppercase tracking-wider">{t('profiles.title')}</h1>
      <ul className="grid w-full max-w-md grid-cols-2 gap-4">
        {profiles.map(({ profile, isSelf }) => (
          <li key={profile.id}>
            <button
              type="button"
              onClick={() => choose(profile, isSelf)}
              className="flex w-full flex-col items-center gap-2 rounded-sm border border-border bg-card p-4 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span
                aria-hidden
                className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-display text-primary-foreground"
              >
                {profile.name.charAt(0)}
              </span>
              <span className="text-center font-medium">{profile.name}</span>
              {isSelf && <span className="text-xs text-muted-foreground">{t('profiles.you')}</span>}
            </button>
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={() => signOut().then(() => window.location.assign('/login'))}>
        {t('auth.logout')}
      </Button>
    </div>
  );
}
