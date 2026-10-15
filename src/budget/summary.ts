import type { BudgetSettings, Txn } from './types';
import { merchantKey } from './merchant';
import { myAmount } from './split';

export const monthOf = (date: string) => date.slice(0, 7);
export const monthLabel = (m: string, long = false) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('en-AU', { month: long ? 'long' : 'short', year: 'numeric' });
export const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const currentMonth = () => shiftMonth(new Date().toISOString().slice(0, 7), 0);

export interface MonthSummary {
  month: string;
  spent: number;          // net money out on expense categories + uncategorised outflows
  income: number;
  budget: number;
  byCategory: Map<string, number>; // spend (positive) per expense category; income per income category
  uncategorised: number;  // count of uncategorised money out
  uncategorisedSpend: number;
  merchants: { key: string; spent: number; count: number }[];
}

export function summariseMonth(txns: Txn[], settings: BudgetSettings, month: string): MonthSummary {
  const kind = new Map(settings.categories.map((c) => [c.id, c.kind]));
  const byCategory = new Map<string, number>();
  const merchants = new Map<string, { spent: number; count: number }>();
  let spent = 0, income = 0, uncategorised = 0, uncategorisedSpend = 0;
  for (const t of txns) {
    if (monthOf(t.date) !== month) continue;
    const amount = myAmount(t); // your share when split
    const k = t.categoryId ? kind.get(t.categoryId) : undefined;
    if (!t.categoryId || !k) {
      // Only salary and the income categories you choose count as income; other money in is ignored.
      if (amount >= 0) continue;
      uncategorised++;
      spent += -amount; uncategorisedSpend += -amount;
    } else if (k === 'expense') {
      spent += -amount;
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) - amount);
    } else if (k === 'income') {
      income += amount;
      byCategory.set(t.categoryId, (byCategory.get(t.categoryId) ?? 0) + amount);
    } else continue; // transfers don't count
    if (amount < 0 && k !== 'income') {
      const key = merchantKey(t.description);
      const m = merchants.get(key) ?? { spent: 0, count: 0 };
      m.spent += -amount; m.count++;
      merchants.set(key, m);
    }
  }
  const budget = settings.categories.filter((c) => c.kind === 'expense').reduce((a, c) => a + (c.monthly || 0), 0);
  return {
    month, spent, income, budget, byCategory, uncategorised, uncategorisedSpend,
    merchants: [...merchants.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.spent - a.spent),
  };
}

export function monthsWithData(txns: Txn[]): string[] {
  return [...new Set(txns.map((t) => monthOf(t.date)))].sort().reverse();
}
