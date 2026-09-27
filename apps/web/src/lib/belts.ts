// IBJJF order: white, kids (grey → green), adults (blue → black).
export const KIDS_BELTS = [
  'grey-white',
  'grey',
  'grey-black',
  'yellow-white',
  'yellow',
  'yellow-black',
  'orange-white',
  'orange',
  'orange-black',
  'green-white',
  'green',
  'green-black',
];
export const ADULT_BELTS = ['blue', 'purple', 'brown', 'black'];
export const ALL_BELTS = ['white', ...KIDS_BELTS, ...ADULT_BELTS];

// Two-tone kids belts: main colour with an inset white/black stripe, so the badge reads on any background.
// Literal class names so Tailwind's scanner picks them up.
const BELT_CLASSES: Record<string, string> = {
  white: 'bg-gray-200 text-gray-800',
  'grey-white': 'bg-belt-grey text-white ring-2 ring-inset ring-white',
  grey: 'bg-belt-grey text-white',
  'grey-black': 'bg-belt-grey text-white ring-2 ring-inset ring-black',
  'yellow-white': 'bg-belt-yellow text-gray-900 ring-2 ring-inset ring-white',
  yellow: 'bg-belt-yellow text-gray-900',
  'yellow-black': 'bg-belt-yellow text-gray-900 ring-2 ring-inset ring-black',
  'orange-white': 'bg-belt-orange text-gray-900 ring-2 ring-inset ring-white',
  orange: 'bg-belt-orange text-gray-900',
  'orange-black': 'bg-belt-orange text-gray-900 ring-2 ring-inset ring-black',
  'green-white': 'bg-belt-green text-white ring-2 ring-inset ring-white',
  green: 'bg-belt-green text-white',
  'green-black': 'bg-belt-green text-white ring-2 ring-inset ring-black',
  blue: 'bg-belt-blue text-white',
  purple: 'bg-belt-purple text-white',
  brown: 'bg-belt-brown text-white',
  black: 'bg-belt-black text-white',
};

export const beltClasses = (belt?: string) => BELT_CLASSES[belt?.toLowerCase() ?? ''] ?? BELT_CLASSES.white;

// i18n key for a belt enum value: t(beltKey(belt)).
export const beltKey = (belt?: string) => `belts.${belt?.toLowerCase() || 'white'}`;
