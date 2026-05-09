import { Utensils, Hotel, Car, Ticket, AlertTriangle, ShoppingBag, Package, type LucideIcon } from 'lucide-react';
import type { ExpenseCategory } from '../../lib/types';

export const CATEGORY_META: Record<ExpenseCategory, { label: string; icon: LucideIcon; color: string; chipColor: string }> = {
  food:       { label: 'Food',       icon: Utensils,       color: 'bg-orange-100 text-orange-800',  chipColor: 'bg-orange-500' },
  hotel:      { label: 'Hotel',      icon: Hotel,          color: 'bg-sky-100 text-sky-800',        chipColor: 'bg-sky-500' },
  transport:  { label: 'Transport',  icon: Car,            color: 'bg-emerald-100 text-emerald-800',chipColor: 'bg-emerald-500' },
  activities: { label: 'Activities', icon: Ticket,         color: 'bg-teal-100 text-teal-800',      chipColor: 'bg-teal-600' },
  emergency:  { label: 'Emergency',  icon: AlertTriangle,  color: 'bg-red-100 text-red-700',        chipColor: 'bg-red-500' },
  shopping:   { label: 'Shopping',   icon: ShoppingBag,    color: 'bg-pink-100 text-pink-700',      chipColor: 'bg-pink-500' },
  other:      { label: 'Other',      icon: Package,        color: 'bg-stone-100 text-stone-700',    chipColor: 'bg-stone-400' },
};

export const CATEGORY_KEYS: ExpenseCategory[] = ['food', 'hotel', 'transport', 'activities', 'emergency', 'shopping', 'other'];
