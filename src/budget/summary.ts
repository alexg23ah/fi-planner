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
  budget: number;          // monthly-budgeted categories only
  monthlySpent: number;    // spending in monthly-budgeted categories + uncategorised
  budgetAll: number;       // all budgets as a monthly equivalent (yearly ones / 12)
  byCategory: Map<string, number>; // spend (positive) per expense category; income per income category
  uncategorised: number;  // count of uncategorised money out
  uncategorisedSpend: number;
  merchants: { key: string; spent: number; count: number }[];
}

export function summariseMonth(txns: Txn[], settings: BudgetSettings, month: string): MonthSummary {
  return summarisePeriod(txns, settings, month, (d) => monthOf(d) === month);
}

/** Same totals as a month, over any set of dates (e.g. a calendar year). */
export function summarisePeriod(txns: Txn[], settings: BudgetSettings, label: string, inPeriod: (date: string) => boolean): MonthSummary {
  const month = label;
  const kind = new Map(settings.categories.map((c) => [c.id, c.kind]));
  const yearly = new Set(settings.categories.filter((c) => c.period === 'year').map((c) => c.id));
  let monthlySpent = 0;
  const byCategory = new Map<string, number>();
  const merchants = new Map<string, { spent: number; count: number }>();
  let spent = 0, income = 0, uncategorised = 0, uncategorisedSpend = 0;
  for (const t of txns) {
    if (!inPeriod(t.date)) continue;
    const amount = myAmount(t); // your share when split
    const k = t.categoryId ? kind.get(t.categoryId) : undefined;
    if (!t.categoryId || !k) {
      // Only salary and the income categories you choose count as income; other money in is ignored.
      if (amount >= 0) continue;
      uncategorised++;
      spent += -amount; uncategorisedSpend += -amount; monthlySpent += -amount;
    } else if (k === 'expense') {
      spent += -amount;
      // Yearly budgets are tracked year to date; the mortgage sits outside the spending budget.
      if (!yearly.has(t.categoryId) && t.categoryId !== 'mortgage') monthlySpent += -amount;
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
  const exp = settings.categories.filter((c) => c.kind === 'expense');
  const budget = exp.filter((c) => c.period !== 'year').reduce((a, c) => a + (c.monthly || 0), 0);
  const budgetAll = exp.reduce((a, c) => a + (c.monthly || 0), 0);
  return {
    month, spent, income, budget, monthlySpent, budgetAll, byCategory, uncategorised, uncategorisedSpend,
    merchants: [...merchants.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.spent - a.spent),
  };
}

export function monthsWithData(txns: Txn[]): string[] {
  return [...new Set(txns.map((t) => monthOf(t.date)))].sort().reverse();
}

/** Year-to-date spending for categories budgeted per year, for the calendar year of `month`. */
export function yearlyProgress(txns: Txn[], settings: BudgetSettings, month: string) {
  const year = month.slice(0, 4);
  const cats = settings.categories.filter((c) => c.kind === 'expense' && c.period === 'year');
  const spent = new Map<string, number>(cats.map((c) => [c.id, 0]));
  for (const t of txns) {
    if (!t.categoryId || !spent.has(t.categoryId) || t.date.slice(0, 4) !== year || monthOf(t.date) > month) continue;
    spent.set(t.categoryId, spent.get(t.categoryId)! - myAmount(t));
  }
  return cats.map((c) => ({ id: c.id, name: c.name, annual: c.monthly * 12, spent: spent.get(c.id) ?? 0 }));
}

export interface YearSummary extends MonthSummary {
  year: string;
  /** Months of the year counted against the budget: 12 for past years, months so far for this year. */
  monthsElapsed: number;
  /** Months that have any transactions. */
  monthsWithData: number;
  /** Budget for the months elapsed, all spending categories except mortgage (yearly ones in full). */
  budgetToDate: number;
  /** Spending in budgeted categories + uncategorised, excluding mortgage. */
  budgetedSpent: number;
}

/** A calendar year. `today` is a yyyy-mm month used to pro-rate the current year. */
export function summariseYear(txns: Txn[], settings: BudgetSettings, year: string, today = currentMonth()): YearSummary {
  const s = summarisePeriod(txns, settings, year, (d) => d.slice(0, 4) === year);
  const ty = today.slice(0, 4);
  const monthsElapsed = year < ty ? 12 : year > ty ? 0 : Number(today.slice(5, 7));
  const withData = new Set(txns.filter((t) => t.date.slice(0, 4) === year).map((t) => monthOf(t.date))).size;
  const exp = settings.categories.filter((c) => c.kind === 'expense' && c.id !== 'mortgage');
  const budgetToDate = exp.reduce((a, c) => a + categoryBudgetToDate(c, monthsElapsed), 0);
  const budgetedSpent = s.spent - (s.byCategory.get('mortgage') ?? 0);
  return { ...s, year, monthsElapsed, monthsWithData: withData, budgetToDate, budgetedSpent };
}

export const yearsWithData = (txns: Txn[]) => [...new Set(txns.map((t) => t.date.slice(0, 4)))].sort().reverse();

/** A category's budget for the first `months` months of a year. Yearly budgets count in full once the year has started (they're lumpy). */
export function categoryBudgetToDate(c: { monthly: number; period?: 'month' | 'year' }, months: number): number {
  if (!months) return 0;
  return c.period === 'year' ? (c.monthly || 0) * 12 : (c.monthly || 0) * months;
}
