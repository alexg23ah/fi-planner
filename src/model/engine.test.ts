import { describe, it, expect } from 'vitest';
import { defaultPlan } from './defaults';
import { project, summarise, incomeTax, hecsRepayment, fiTargetAt } from './engine';

// Expected values come from the Excel workbook (FI_Mortgage_Planner.xlsx) recalculated with the same placeholders.
const near = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('tax and HECS formulas', () => {
  const tax = defaultPlan().tax;
  it('income tax 2026-27', () => {
    near(incomeTax(200000, tax), 55870);
    near(incomeTax(110000, tax), 23520);
    near(incomeTax(80000, tax), 14520); // ATO-published example
  });
  it('HECS marginal repayment 2026-27', () => {
    near(hecsRepayment(100000, tax, 1), 4570.8);
    near(hecsRepayment(140000, tax, 1), 10776.46, 2);
    near(hecsRepayment(200000, tax, 1), 20000);
    expect(hecsRepayment(60000, tax, 1)).toBe(0);
  });
});

describe('projection matches workbook', () => {
  const plan = defaultPlan();
  const rows = project(plan);
  const s = summarise(plan, rows);

  it('year 1 cash flow', () => {
    const r = rows[1];
    near(r.you.tax, 55870); near(r.you.medicare, 4000); near(r.you.hecsComp, 20000); near(r.you.takeHome, 120130);
    near(r.partner.tax, 23520); near(r.partner.hecsComp, 6071); near(r.partner.takeHome, 78209);
    near(r.livingCosts, 76055); near(r.repayment, 48485); near(r.surplus, 73799);
  });

  it('partner leave year', () => {
    expect(rows[2].partner.salary).toBe(0);
    near(rows[2].surplus, -6436);
    expect(rows[3].partner.workPct).toBeCloseTo(0.6);
  });

  it('FI target today', () => {
    near(s.today.min.total, 1886500); near(s.today.comf.total, 2639000); near(s.today.ideal.total, 3454000);
    near(s.today.min.events, 184000);
  });

  it('years to FI', () => {
    expect(s.yearsToFI.cons).toEqual({ min: 15, comf: 19, ideal: 23 });
    expect(s.yearsToFI.mid).toEqual({ min: 14, comf: 18, ideal: 21 });
    expect(s.yearsToFI.opt).toEqual({ min: 13, comf: 16, ideal: 19 });
  });

  it('HECS and mortgage summary', () => {
    expect(s.hecsClearedYear).toEqual({ you: 2, partner: 9 });
    near(s.hecsTotalRepaid.you, 31227); near(s.hecsTotalRepaid.partner, 23776);
    expect(s.lvrTriggerYear).toBe(0);
    expect(s.loanClearedYear).toBe(10);
    near(s.totalInterest, 237937); near(s.interestNoOffset, 707584);
    expect(s.negativeSurplusYears).toBe(1);
  });

  it('withdrawal-rate sensitivity', () => {
    near(fiTargetAt(plan, 'min', 0.03, 0, s), 2254000);
    near(fiTargetAt(plan, 'comf', 0.0325, 0, s), 3067077);
  });

  it('single income toggle removes partner', () => {
    const p2 = defaultPlan(); p2.inputs.includePartner = false;
    const r = project(p2)[1];
    expect(r.partner.salary).toBe(0); expect(r.partner.hecsBal).toBe(0);
  });
});
