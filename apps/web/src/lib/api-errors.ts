// API error codes the user can hit → translated i18n keys; anything else gets the generic message.
const KEYS: Record<string, string> = {
  CHECKIN_DUPLICATE: 'classes.checkinDuplicate',
  OVERLAPPING_CLASS: 'classes.checkinOverlap',
  OUTSIDE_TIME_WINDOW: 'classes.checkinOutsideWindow',
  CLASS_NOT_ACTIVE: 'classes.checkinOutsideWindow',
  INVALID_TOKEN: 'classes.checkinInvalidToken',
  LOCATION_NOT_SET: 'classes.checkinLocationNotSet',
  TOO_FAR: 'classes.checkinTooFar',
  NO_SEASON_FOR_DATE: 'gamification.results.noSeasonForDate',
  MODALITY_EXISTS: 'settings.modalities.errors.exists',
  STUDENT_IN_FAMILY: 'families.errors.studentInFamily',
  'Academy not found': 'onboarding.academyNotFound',
};

export function errorKey(err: unknown): string {
  const code = err instanceof Error ? err.message : undefined;
  return (code && KEYS[code]) || 'common.genericError';
}
