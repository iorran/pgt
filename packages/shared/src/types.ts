export type Belt = 'white' | 'blue' | 'purple' | 'brown' | 'black';
export type UserRole = 'instructor' | 'student';
export type ClassType = 'gi' | 'no-gi' | 'open-mat' | 'kids';
export type Recurrence = 'once' | 'weekly';
export type PlanFrequency = 'monthly' | 'quarterly' | 'yearly';
export type OrderStatus = 'requested' | 'confirmed' | 'delivered' | 'cancelled';
export type ResultStatus = 'pending' | 'approved' | 'rejected';
export type XPSourceType = 'checkin' | 'competition' | 'badge';

export const BELTS: Belt[] = ['white', 'blue', 'purple', 'brown', 'black'];
export const KID_AGE_LIMIT = 16;
