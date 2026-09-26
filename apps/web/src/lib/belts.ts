const BELT_CLASSES: Record<string, string> = {
  white: 'bg-gray-200 text-gray-800',
  blue: 'bg-belt-blue text-white',
  purple: 'bg-belt-purple text-white',
  brown: 'bg-belt-brown text-white',
  black: 'bg-belt-black text-white',
};

export const beltClasses = (belt?: string) => BELT_CLASSES[belt?.toLowerCase() ?? ''] ?? BELT_CLASSES.white;

// i18n key for a belt enum value: t(beltKey(belt)).
export const beltKey = (belt?: string) => `belts.${belt?.toLowerCase() || 'white'}`;
