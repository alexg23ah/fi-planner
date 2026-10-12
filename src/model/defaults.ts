import type { Plan } from './types';

let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Placeholder plan — mirrors the Excel workbook's example values. */
export function defaultPlan(): Plan {
  return {
    version: 1,
    inputs: {
      age: 35,
      startYear: 2026,
      investments: 50000,
      includeSuper: false,
      livingTier: 'comf',
      includePartner: true,
      you: { salary: 200000, salaryGrowth: 0.035, sacrifice: 0, superBalance: 120000, hecs: 30000, hecsVoluntary: 0 },
      partner: { salary: 110000, salaryGrowth: 0.03, sacrifice: 0, superBalance: 80000, hecs: 20000, hecsVoluntary: 0 },
      sgRate: 0.12,
      contribTax: 0.15,
      hecsIndexation: 0.03,
      clearHecsAtFI: false,
      propertyValue: 1100000,
      propertyGrowth: 0.03,
      loan: 650000,
      offset: 50000,
      rate: 0.06,
      term: 28,
      actualRepayment: 0,
      lvrTrigger: 0.6,
      offsetPctAbove: 1,
      offsetPctBelow: 0.5,
      payoutWhenCovered: true,
      mortgageAtFI: 'clear',
      withdrawalRate: 0.04,
      spendingAdj: 0,
      inflation: 0.025,
      returns: { cons: 0.05, mid: 0.07, opt: 0.1 },
    },
    spending: [
      ['Home ownership (rates, strata, insurance, maintenance)', 6000, 7500, 9000],
      ['Groceries', 12000, 15000, 18000],
      ['Utilities & internet', 3500, 4000, 4500],
      ['Transport', 4000, 6000, 8000],
      ['Insurance (health, life, car)', 4000, 5500, 7000],
      ['Health & medical', 2000, 3000, 4500],
      ['Dining out & drinks', 3000, 8000, 12000],
      ['Entertainment', 1500, 4000, 6000],
      ['Travel', 2000, 8000, 15000],
      ['Fitness', 1200, 2500, 3500],
      ['Subscriptions', 600, 1200, 1800],
      ['Gifts & donations', 800, 2000, 4000],
      ['Personal & clothing', 1500, 3500, 5500],
      ['Irregular / buffer', 2000, 4000, 8000],
    ].map(([name, min, comf, ideal]) => ({ id: uid(), name: name as string, min: min as number, comf: comf as number, ideal: ideal as number })),
    events: [
      { name: 'Child — baby & early years', active: true, annualCost: 12000, start: 2028, end: 2032, includeInFI: true, notes: '' },
      { name: 'Childcare (after subsidy)', active: true, annualCost: 15000, start: 2029, end: 2032, includeInFI: true, notes: 'Net of Child Care Subsidy' },
      { name: 'Primary school', active: true, annualCost: 4000, start: 2033, end: 2039, includeInFI: true, notes: 'Public school extras' },
      { name: 'High school', active: true, annualCost: 6000, start: 2040, end: 2045, includeInFI: true, notes: '' },
      { name: 'Car replacement', active: false, annualCost: 35000, start: 2030, end: 2030, includeInFI: false, notes: 'One-off' },
    ].map((e) => ({ id: uid(), ...e })),
    workPatterns: [
      { name: 'Partner parental leave', active: true, person: 'partner' as const, pct: 0, start: 2028, end: 2028, notes: 'Set e.g. 30% to approximate Paid Parental Leave' },
      { name: 'Partner part-time return', active: true, person: 'partner' as const, pct: 0.6, start: 2029, end: 2032, notes: '3 days a week' },
      { name: 'Your parental leave', active: false, person: 'you' as const, pct: 0.8, start: 2028, end: 2028, notes: '' },
    ].map((w) => ({ id: uid(), ...w })),
    tax: {
      brackets: [
        { threshold: 0, rate: 0 },
        { threshold: 18200, rate: 0.15 },
        { threshold: 45000, rate: 0.3 },
        { threshold: 135000, rate: 0.37 },
        { threshold: 190000, rate: 0.45 },
      ],
      medicare: 0.02,
      hecsThreshold1: 69528,
      hecsThreshold2: 129717,
      hecsRate1: 0.15,
      hecsRate2: 0.17,
      hecsCap: 0.1,
    },
  };
}
