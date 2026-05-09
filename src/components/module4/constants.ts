import { Train, Bus, Plane, Hotel, Ticket, Car, Star, type LucideIcon } from 'lucide-react';
import type { BookingType, BookingStatus, BookingPriority } from '../../lib/types';

export const BOOKING_TYPE_META: Record<BookingType, { label: string; icon: LucideIcon; color: string; platforms: { label: string; url: string }[] }> = {
  train: {
    label: 'Train', icon: Train, color: 'bg-sky-100 text-sky-800',
    platforms: [{ label: 'IRCTC', url: 'https://www.irctc.co.in' }, { label: 'ConfirmTkt', url: 'https://www.confirmtkt.com' }],
  },
  bus: {
    label: 'Bus', icon: Bus, color: 'bg-emerald-100 text-emerald-800',
    platforms: [{ label: 'redBus', url: 'https://www.redbus.in' }, { label: 'AbhiBus', url: 'https://www.abhibus.com' }],
  },
  flight: {
    label: 'Flight', icon: Plane, color: 'bg-blue-100 text-blue-800',
    platforms: [{ label: 'MakeMyTrip', url: 'https://www.makemytrip.com/flights' }, { label: 'Google Flights', url: 'https://www.google.com/travel/flights' }],
  },
  hotel: {
    label: 'Hotel', icon: Hotel, color: 'bg-amber-100 text-amber-800',
    platforms: [{ label: 'Booking.com', url: 'https://www.booking.com' }, { label: 'Airbnb', url: 'https://www.airbnb.com' }, { label: 'Goibibo', url: 'https://www.goibibo.com/hotels' }],
  },
  activity: {
    label: 'Activity', icon: Ticket, color: 'bg-teal-100 text-teal-800',
    platforms: [{ label: 'GetYourGuide', url: 'https://www.getyourguide.com' }, { label: 'Viator', url: 'https://www.viator.com' }],
  },
  car_rental: {
    label: 'Car Rental', icon: Car, color: 'bg-stone-200 text-stone-800',
    platforms: [{ label: 'Zoomcar', url: 'https://www.zoomcar.com' }, { label: 'Revv', url: 'https://www.revv.co.in' }],
  },
  event_ticket: {
    label: 'Event Ticket', icon: Star, color: 'bg-rose-100 text-rose-800',
    platforms: [{ label: 'BookMyShow', url: 'https://in.bookmyshow.com' }],
  },
  transport: {
    label: 'Transport', icon: Bus, color: 'bg-stone-100 text-stone-700',
    platforms: [],
  },
};

export const BOOKING_TYPE_KEYS: BookingType[] = ['train', 'bus', 'flight', 'hotel', 'activity', 'car_rental', 'event_ticket'];

export const STATUS_META: Record<BookingStatus, { label: string; color: string; dot: string }> = {
  pending:          { label: 'Pending',          color: 'bg-stone-100 text-stone-700 border-stone-300',    dot: 'bg-stone-400' },
  in_progress:      { label: 'In Progress',      color: 'bg-amber-50 text-amber-800 border-amber-300',     dot: 'bg-amber-500' },
  confirmed:        { label: 'Confirmed',        color: 'bg-teal-50 text-teal-800 border-teal-300',        dot: 'bg-teal-600' },
  cancelled:        { label: 'Cancelled',        color: 'bg-red-50 text-red-700 border-red-300',           dot: 'bg-red-500' },
  on_hold:          { label: 'On Hold',          color: 'bg-orange-50 text-orange-800 border-orange-300',  dot: 'bg-orange-500' },
  requires_action:  { label: 'Requires Action',  color: 'bg-blue-50 text-blue-800 border-blue-300',        dot: 'bg-blue-500' },
  proposed:         { label: 'Proposed',         color: 'bg-stone-100 text-stone-700 border-stone-300',    dot: 'bg-stone-400' },
};

export const PRIORITY_META: Record<BookingPriority, { label: string; color: string }> = {
  low:     { label: 'Low',     color: 'bg-stone-100 text-stone-700' },
  medium:  { label: 'Medium',  color: 'bg-sky-50 text-sky-800' },
  high:    { label: 'High',    color: 'bg-amber-50 text-amber-800' },
  urgent:  { label: 'Urgent',  color: 'bg-red-50 text-red-700' },
};

export const BOOKING_STATUS_KEYS: BookingStatus[] = ['pending', 'in_progress', 'confirmed', 'requires_action', 'on_hold', 'cancelled'];

export const BOOKING_CATEGORY_MAP: Record<BookingType, string> = {
  train: 'transport', bus: 'transport', flight: 'transport', car_rental: 'transport',
  hotel: 'hotel', activity: 'activities', event_ticket: 'activities', transport: 'transport',
};
