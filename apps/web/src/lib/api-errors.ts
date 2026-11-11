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
  RESPONSIBLE_OF_FAMILY: 'onboarding.responsibleOfFamily',
  'Academy not found': 'onboarding.academyNotFound',
  ALREADY_PARTICIPANT: 'seminars.errors.alreadyParticipant',
  SEMINAR_PAST: 'seminars.errors.past',
  SEMINAR_ALREADY_PAID: 'seminars.errors.alreadyPaid',
  SEMINAR_PRICE_REQUIRED: 'seminars.errors.priceRequired',
  DATE_REQUIRED: 'seminars.errors.dateRequired',
  INVALID_TEACHER: 'seminars.errors.invalidTeacher',
  NAME_REQUIRED: 'seminars.errors.nameRequired',
  NO_BILLABLE_MEMBER: 'billing.errors.noBillableMember',
  NOT_OVERDUE: 'billing.errors.notOverdue',
};

export function errorKey(err: unknown): string {
  const code = err instanceof Error ? err.message : undefined;
  return (code && KEYS[code]) || 'common.genericError';
}
