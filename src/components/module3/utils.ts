import type { Expense, ExpenseSplit, TripMember, Profile } from '../../lib/types';

export type MemberRow = TripMember & { profile: Profile };

export type Balances = Record<string, { paid: number; owed: number; net: number }>;

export function computeBalances(expenses: Expense[], splits: ExpenseSplit[], members: MemberRow[]): Balances {
  const bal: Balances = {};
  members.forEach(m => { bal[m.user_id] = { paid: 0, owed: 0, net: 0 }; });
  const groupExpenses = expenses.filter(e => e.expense_type !== 'personal' && e.status !== 'rejected');
  const ids = new Set(groupExpenses.map(e => e.id));

  groupExpenses.forEach(e => {
    if (e.paid_by && bal[e.paid_by]) {
      bal[e.paid_by].paid += Number(e.amount);
    }
  });
  splits.filter(s => ids.has(s.expense_id)).forEach(s => {
    if (bal[s.user_id] && !s.settled) {
      bal[s.user_id].owed += Number(s.amount);
    }
  });
  Object.keys(bal).forEach(k => {
    bal[k].net = bal[k].paid - bal[k].owed;
  });
  return bal;
}

export type Settlement = { from: string; to: string; amount: number };

export function optimizeSettlements(bal: Balances): Settlement[] {
  const creditors = Object.entries(bal).filter(([, v]) => v.net > 0.01).map(([k, v]) => ({ id: k, v: v.net }));
  const debtors = Object.entries(bal).filter(([, v]) => v.net < -0.01).map(([k, v]) => ({ id: k, v: -v.net }));
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);
  const res: Settlement[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    res.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(amt * 100) / 100 });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v < 0.01) i++;
    if (creditors[j].v < 0.01) j++;
  }
  return res;
}

export function formatCurrency(amount: number, currency: string): string {
  const sym = currency === 'INR' ? '\u20B9' : currency === 'USD' ? '$' : currency === 'EUR' ? '\u20AC' : currency === 'GBP' ? '\u00A3' : currency + ' ';
  return `${sym}${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function memberName(id: string | null, members: MemberRow[]): string {
  if (!id) return 'Unknown';
  return members.find(m => m.user_id === id)?.profile.full_name || 'Member';
}
