import { describe, it, expect } from 'vitest';
import { parsePastedBudget, applyPastedBudget } from './budgetPaste';
import { defaultBudgetSettings } from './defaults';
import { categoriseLocal } from './categorise';
import { summariseMonth, yearlyProgress } from './summary';
import { fromBudget } from '../views/Spending';
import { defaultPlan } from '../model/defaults';
import type { Txn } from './types';

const PIVOT = `Row Labels\tTotal Budget
Holiday\t833
Entertainment\t400
Eating Out\t400
Personal Care\t300
Bills\t300
Groceries\t250
Alcohol\t200
Transport\t160
Shopping\t150
Gifts\t150
Home\t120
Grand Total\t3,263`;

describe('pasting budgets', () => {
  it('reads a pivot table copy and skips headers/totals', () => {
    const l = parsePastedBudget(PIVOT);
    expect(l).toHaveLength(11);
    expect(l[0]).toEqual({ name: 'Holiday', amount: 833 });
    expect(parsePastedBudget('Bills, $1,200.50')).toEqual([{ name: 'Bills', amount: 1200.5 }]);
  });
  it('renames built-ins, removes unused, keeps keyword matching', () => {
    const r = applyPastedBudget(defaultBudgetSettings(), parsePastedBudget(PIVOT), { period: 'month', replace: true, usedIds: new Set() });
    const exp = r.settings.categories.filter((c) => c.kind === 'expense');
    expect(exp.map((c) => c.name)).toEqual(['Holiday', 'Entertainment', 'Eating Out', 'Personal Care', 'Bills', 'Groceries', 'Alcohol', 'Transport', 'Shopping', 'Gifts', 'Home', 'Mortgage']);
    expect(r.created).toEqual([]);
    expect(exp.find((c) => c.name === 'Eating Out')!.id).toBe('dining');
    expect(categoriseLocal('SQ *BLACKSTAR COFFEE NEWTOWN', -6, r.settings).categoryId).toBe('dining'); // coffee → Eating Out
    expect(categoriseLocal('TELSTRA PREPAID', -40, r.settings).categoryId).toBe('utilities'); // phone → Bills
    expect(categoriseLocal('NETFLIX.COM', -23, r.settings).categoryId).toBe('entertainment'); // subscriptions → Entertainment
    expect(r.settings.categories.some((c) => c.id === 'salary')).toBe(true);
  });
  it('yearly holiday budget is tracked year to date, not monthly', () => {
    let s = applyPastedBudget(defaultBudgetSettings(), parsePastedBudget(PIVOT), { period: 'month', replace: true, usedIds: new Set() }).settings;
    s = { ...s, categories: s.categories.map((c) => (c.id === 'travel' ? { ...c, period: 'year' as const, monthly: 10000 / 12 } : c)) };
    const t = (date: string, amount: number, categoryId: string): Txn => ({ id: date + amount, date, description: 'X', amount, account: '', categoryId, source: 'you', hash: date + amount, split: null, note: '' });
    const txns = [t('2026-03-10', -4000, 'travel'), t('2026-10-02', -1500, 'travel'), t('2026-10-03', -300, 'groceries')];
    const m = summariseMonth(txns, s, '2026-10');
    expect(m.spent).toBe(1800);
    expect(m.monthlySpent).toBe(300);
    expect(m.budget).toBe(2430);
    expect(Math.round(m.budgetAll)).toBe(3263);
    expect(yearlyProgress(txns, s, '2026-10')).toEqual([{ id: 'travel', name: 'Holiday', annual: 10000, spent: 5500 }]);
  });
  it('copies budget into the FI plan', () => {
    let s = applyPastedBudget(defaultBudgetSettings(), parsePastedBudget(PIVOT), { period: 'month', replace: true, usedIds: new Set() }).settings;
    s = { ...s, categories: s.categories.map((c) => (c.id === 'travel' ? { ...c, period: 'year' as const, monthly: 10000 / 12 } : c)) };
    const rows = fromBudget(defaultPlan(), s.categories, 'comf');
    expect(rows).toHaveLength(11);
    expect(rows.find((r) => r.name === 'Holiday')!.comf).toBe(10000);
    expect(rows.reduce((a, r) => a + r.comf, 0)).toBe(10000 + 2430 * 12);
  });
});
