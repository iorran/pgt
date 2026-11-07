// Which Family profile this browser tab is using (ADR 0004). Per tab on purpose: a parent can keep
// one tab per kid. Storage can throw (private mode, blocked site data) — then it simply isn't kept.
export interface Profile {
  id: string;
  name: string;
  belt: string;
  image: string | null;
}

const ACTING_KEY = 'pgt.actingAs';
const CHOSEN_KEY = 'pgt.profileChosen';

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
    }
  } catch {
    // Not persisted; the choice lasts until reload.
  }
}

export function getActingAs(): Profile | null {
  const raw = read(ACTING_KEY);
  try {
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function setActingAs(profile: Profile | null) {
  write(ACTING_KEY, profile ? JSON.stringify(profile) : null);
}

export function markProfileChosen() {
  write(CHOSEN_KEY, '1');
}

export function wasProfileChosen() {
  return read(CHOSEN_KEY) === '1';
}

export function clearProfile() {
  write(ACTING_KEY, null);
  write(CHOSEN_KEY, null);
}
