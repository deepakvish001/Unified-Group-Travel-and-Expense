import type { TravelerProfile, Profile, TripMember } from '../../lib/types';

export type MemberRow = TripMember & { profile: Profile };

export const REQUIRED_VAULT_FIELDS: (keyof TravelerProfile)[] = [
  'full_name', 'date_of_birth', 'gender', 'phone_number', 'email', 'nationality',
];

export function computeCompleteness(v: TravelerProfile | null): { pct: number; missing: string[] } {
  if (!v) return { pct: 0, missing: REQUIRED_VAULT_FIELDS.map(f => labelOf(f)) };
  const missing: string[] = [];
  REQUIRED_VAULT_FIELDS.forEach(f => {
    const val = (v as Record<string, unknown>)[f];
    if (!val || String(val).trim() === '') missing.push(labelOf(f));
  });
  const pct = Math.round(((REQUIRED_VAULT_FIELDS.length - missing.length) / REQUIRED_VAULT_FIELDS.length) * 100);
  return { pct, missing };
}

export function labelOf(k: keyof TravelerProfile): string {
  const map: Partial<Record<keyof TravelerProfile, string>> = {
    full_name: 'Full name', date_of_birth: 'Date of birth', gender: 'Gender',
    phone_number: 'Phone number', email: 'Email', nationality: 'Nationality',
  };
  return map[k] ?? String(k);
}

export function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function currencyFmt(amount: number, currency: string): string {
  const sym = currency === 'INR' ? '\u20B9' : currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : currency + ' ';
  return `${sym}${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function memberName(id: string | null, members: MemberRow[]): string {
  if (!id) return 'Unassigned';
  return members.find(m => m.user_id === id)?.profile.full_name || 'Member';
}

export function memberInitial(id: string | null, members: MemberRow[]): string {
  const n = memberName(id, members);
  return n.charAt(0).toUpperCase();
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

export function downloadBlob(content: string, filename: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
