import type { Plan, PersonKey, PersonYear, Scenario, Tier, YearRow, TaxConfig } from './types';
import { SCENARIOS, TIERS } from './types';

export const HORIZON = 50;

const zeroPerson = (hecsBal: number): PersonYear => ({
  workPct: 0, salary: 0, sacrifice: 0, taxable: 0, tax: 0, medicare: 0,
  hecsComp: 0, hecsVol: 0, hecsBal, takeHome: 0,
});

export function pmt(rate: number, nper: number, pv: number): number {
  if (pv <= 0 || nper <= 0) return 0;
  if (rate === 0) return pv / nper;
  return (pv * rate) / (1 - Math.pow(1 + rate, -nper));
}

export function incomeTax(taxable: number, tax: TaxConfig): number {
  let total = 0;
  const b = [...tax.brackets].sort((a, c) => a.threshold - c.threshold);
  for (let i = 0; i < b.length; i++) {
    const step = b[i].rate - (i > 0 ? b[i - 1].rate : 0);
    if (taxable > b[i].threshold) total += (taxable - b[i].threshold) * step;
  }
  return total;
}

/** Compulsory HELP repayment under the marginal system, thresholds indexed by `ix`. */
export function hecsRepayment(income: number, tax: TaxConfig, ix: number): number {
  const t1 = tax.hecsThreshold1 * ix;
  const t2 = tax.hecsThreshold2 * ix;
  const base = tax.hecsRate1 * (tax.hecsThreshold2 - tax.hecsThreshold1) * ix;
  let form = 0;
  if (income > t2) form = base + tax.hecsRate2 * (income - t2);
  else if (income > t1) form = tax.hecsRate1 * (income - t1);
  return Math.min(tax.hecsCap * income, form);
}

export function tierSpend(plan: Plan): Record<Tier, number> {
  const out = { min: 0, comf: 0, ideal: 0 };
  for (const c of plan.spending) for (const t of TIERS) out[t] += Number(c[t]) || 0;
  return out;
}

export function repaymentUsed(plan: Plan) {
  const i = plan.inputs;
  const min = pmt(i.rate, i.term, i.loan);
  return { min, used: Math.max(min, i.actualRepayment || 0) };
}

export function project(plan: Plan): YearRow[] {
  const i = plan.inputs;
  const tax = plan.tax;
  const spend = tierSpend(plan);
  const rep = repaymentUsed(plan).used;
  const rows: YearRow[] = [];

  const workPct = (who: PersonKey, cy: number) => {
    const hits = plan.workPatterns.filter((w) => w.active && w.person === who && w.start <= cy && w.end >= cy);
    return hits.length ? Math.min(...hits.map((w) => w.pct)) : 1;
  };

  const eventsReserve = (cy: number, inf: number) => {
    let s = 0;
    for (const e of plan.events) {
      if (!e.active || !e.includeInFI) continue;
      const yrs = e.end - Math.max(e.start, cy + 1) + 1;
      if (yrs > 0) s += e.annualCost * yrs;
    }
    return s * inf;
  };

  const fiTargets = (inf: number, loan: number, reserve: number): Record<Tier, number> => {
    const out = {} as Record<Tier, number>;
    for (const t of TIERS) {
      out[t] = i.withdrawalRate > 0
        ? (spend[t] * (1 + i.spendingAdj) * inf) / i.withdrawalRate
          + (i.mortgageAtFI === 'keep' && loan > 0 ? rep / i.withdrawalRate : 0)
        : 0;
      out[t] += reserve;
    }
    return out;
  };

  const fiAssets = (inv: number, sup: number, offset: number, loan: number, hecs: number) =>
    inv + offset + (i.includeSuper ? sup : 0)
    - (i.mortgageAtFI === 'clear' ? loan : 0)
    - (i.clearHecsAtFI ? hecs : 0);

  // Year 0
  {
    const inf = 1;
    const youH = i.you.hecs;
    const parH = i.includePartner ? i.partner.hecs : 0;
    const sup0 = i.you.superBalance + (i.includePartner ? i.partner.superBalance : 0);
    const reserve = eventsReserve(i.startYear, inf);
    const inv = { cons: i.investments, mid: i.investments, opt: i.investments };
    const sup = { cons: sup0, mid: sup0, opt: sup0 };
    const fa = {} as Record<Scenario, number>;
    for (const s of SCENARIOS) fa[s] = fiAssets(inv[s], sup[s], i.offset, i.loan, youH + parH);
    rows.push({
      t: 0, calYear: i.startYear, age: i.age, infIndex: inf,
      you: zeroPerson(youH), partner: zeroPerson(parH),
      householdTakeHome: 0, livingCosts: 0, lifeEvents: 0, surplus: 0, superContrib: 0,
      propertyValue: i.propertyValue, loan: i.loan, offset: i.offset,
      netDebt: i.loan - i.offset,
      netLvr: i.propertyValue > 0 ? Math.max(0, i.loan - i.offset) / i.propertyValue : 0,
      interest: 0, repayment: 0, pctToOffset: 0, toOffset: 0, releasedFromOffset: 0, newCashToInvest: 0,
      investments: inv, super: sup, fiAssets: fa, eventsReserve: reserve,
      fiTarget: fiTargets(inf, i.loan, reserve),
    });
  }

  for (let t = 1; t <= HORIZON; t++) {
    const prev = rows[t - 1];
    const cy = i.startYear + t;
    const inf = Math.pow(1 + i.inflation, t);
    const ix = Math.pow(1 + i.inflation, t - 1);

    const personYear = (who: PersonKey): PersonYear => {
      const p = i[who];
      const on = who === 'you' || i.includePartner ? 1 : 0;
      const pct = workPct(who, cy) * on;
      const g = Math.pow(1 + p.salaryGrowth, t - 1);
      const salary = p.salary * g * pct;
      const sacrifice = Math.min(salary, p.sacrifice * g * pct);
      const taxable = Math.max(0, salary - sacrifice);
      const tx = incomeTax(taxable, tax);
      const medicare = taxable * tax.medicare;
      const prevBal = prev[who].hecsBal;
      const hb = prevBal * (1 + i.hecsIndexation);
      const hecsComp = prevBal <= 0 ? 0 : Math.min(hb, hecsRepayment(salary, tax, ix));
      const hecsVol = prevBal <= 0 ? 0 : Math.max(0, Math.min(p.hecsVoluntary, hb - hecsComp));
      const hecsBal = Math.max(0, hb - hecsComp - hecsVol);
      return {
        workPct: pct, salary, sacrifice, taxable, tax: tx, medicare,
        hecsComp, hecsVol, hecsBal,
        takeHome: salary - sacrifice - tx - medicare - hecsComp,
      };
    };

    const you = personYear('you');
    const partner = personYear('partner');
    const householdTakeHome = you.takeHome + partner.takeHome;
    const livingCosts = spend[i.livingTier] * inf;
    let lifeEvents = 0;
    for (const e of plan.events) if (e.active && e.start <= cy && e.end >= cy) lifeEvents += e.annualCost;
    lifeEvents *= inf;

    const propertyValue = prev.propertyValue * (1 + i.propertyGrowth);
    const interest = i.rate * Math.max(0, prev.loan - prev.offset);
    const repayment = prev.loan > 0 ? Math.min(rep, prev.loan + interest) : 0;
    const surplus = householdTakeHome - livingCosts - lifeEvents - repayment - you.hecsVol - partner.hecsVol;
    const superContrib = (you.salary * i.sgRate + you.sacrifice + partner.salary * i.sgRate + partner.sacrifice) * (1 - i.contribTax);

    const pctToOffset = prev.loan <= 0 ? 0 : prev.netLvr > i.lvrTrigger ? i.offsetPctAbove : i.offsetPctBelow;
    const toOffset = surplus < 0
      ? (prev.loan > 0 ? Math.max(surplus, -prev.offset) : 0)
      : surplus * pctToOffset;
    const loanPre = prev.loan + interest - repayment;
    const offsetPre = prev.offset + toOffset;
    const loan = loanPre <= 0.5 ? 0 : (i.payoutWhenCovered && offsetPre >= loanPre ? 0 : loanPre);
    const offset = loan > 0 ? offsetPre : 0;
    const releasedFromOffset = loan > 0 ? 0 : offsetPre - Math.max(0, loanPre);
    const newCashToInvest = surplus - toOffset + releasedFromOffset;

    const inv = {} as Record<Scenario, number>;
    const sup = {} as Record<Scenario, number>;
    const fa = {} as Record<Scenario, number>;
    for (const s of SCENARIOS) {
      inv[s] = prev.investments[s] * (1 + i.returns[s]) + newCashToInvest;
      sup[s] = prev.super[s] * (1 + i.returns[s]) + superContrib;
      fa[s] = fiAssets(inv[s], sup[s], offset, loan, you.hecsBal + partner.hecsBal);
    }
    const reserve = eventsReserve(cy, inf);
    rows.push({
      t, calYear: cy, age: i.age + t, infIndex: inf,
      you, partner, householdTakeHome, livingCosts, lifeEvents, surplus, superContrib,
      propertyValue, loan, offset, netDebt: loan - offset,
      netLvr: propertyValue > 0 ? Math.max(0, loan - offset) / propertyValue : 0,
      interest, repayment, pctToOffset, toOffset, releasedFromOffset, newCashToInvest,
      investments: inv, super: sup, fiAssets: fa, eventsReserve: reserve,
      fiTarget: fiTargets(inf, loan, reserve),
    });
  }
  return rows;
}

const firstT = (rows: YearRow[], pred: (r: YearRow) => boolean): number | null => {
  const r = rows.find(pred);
  return r ? r.t : null;
};

export interface Summary {
  spend: Record<Tier, number>;
  today: Record<Tier, {
    base: number; adjusted: number; fiNumber: number; mortgage: number; events: number; hecs: number;
    total: number; assets: number; gap: number; progress: number;
  }>;
  yearsToFI: Record<Scenario, Record<Tier, number | null>>;
  realReturn: Record<Scenario, number>;
  hecsClearedYear: Record<PersonKey, number | null>;
  hecsTotalRepaid: Record<PersonKey, number>;
  lvrTriggerYear: number | null;
  loanClearedYear: number | null;
  totalInterest: number;
  interestNoOffset: number;
  repayment: { min: number; used: number };
  negativeSurplusYears: number;
  lowestSurplus: number;
}

export function summarise(plan: Plan, rows: YearRow[]): Summary {
  const i = plan.inputs;
  const spend = tierSpend(plan);
  const rep = repaymentUsed(plan);
  const r0 = rows[0];
  const mortgage = i.mortgageAtFI === 'clear'
    ? Math.max(0, i.loan - i.offset)
    : i.loan > 0 && i.withdrawalRate > 0 ? rep.used / i.withdrawalRate : 0;
  const hecs = i.clearHecsAtFI ? r0.you.hecsBal + r0.partner.hecsBal : 0;
  const assets = i.investments + (i.includeSuper ? r0.super.mid : 0)
    + (i.mortgageAtFI === 'clear' ? Math.max(0, i.offset - i.loan) : i.offset);

  const today = {} as Summary['today'];
  for (const t of TIERS) {
    const adjusted = spend[t] * (1 + i.spendingAdj);
    const fiNumber = i.withdrawalRate > 0 ? adjusted / i.withdrawalRate : 0;
    const total = fiNumber + mortgage + r0.eventsReserve + hecs;
    today[t] = {
      base: spend[t], adjusted, fiNumber, mortgage, events: r0.eventsReserve, hecs,
      total, assets, gap: Math.max(0, total - assets),
      progress: total > 0 ? Math.min(1, assets / total) : 0,
    };
  }

  const yearsToFI = {} as Summary['yearsToFI'];
  const realReturn = {} as Summary['realReturn'];
  for (const s of SCENARIOS) {
    yearsToFI[s] = {} as Record<Tier, number | null>;
    for (const t of TIERS) yearsToFI[s][t] = firstT(rows, (r) => r.fiAssets[s] >= r.fiTarget[t]);
    realReturn[s] = (1 + i.returns[s]) / (1 + i.inflation) - 1;
  }

  const sum = (f: (r: YearRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const surpluses = rows.slice(1).map((r) => r.surplus);
  return {
    spend, today, yearsToFI, realReturn,
    hecsClearedYear: {
      you: firstT(rows, (r) => r.you.hecsBal <= 0),
      partner: firstT(rows, (r) => r.partner.hecsBal <= 0),
    },
    hecsTotalRepaid: {
      you: sum((r) => r.you.hecsComp + r.you.hecsVol),
      partner: sum((r) => r.partner.hecsComp + r.partner.hecsVol),
    },
    lvrTriggerYear: firstT(rows, (r) => r.netLvr <= i.lvrTrigger),
    loanClearedYear: firstT(rows, (r) => r.loan <= 0),
    totalInterest: sum((r) => r.interest),
    interestNoOffset: Math.max(0, rep.min * i.term - i.loan),
    repayment: rep,
    negativeSurplusYears: surpluses.filter((s) => s < 0).length,
    lowestSurplus: Math.min(...surpluses),
  };
}

/** Total FI target today for a tier at an arbitrary withdrawal rate / spending adjustment. */
export function fiTargetAt(plan: Plan, tier: Tier, wr: number, adj: number, s: Summary): number {
  const i = plan.inputs;
  if (wr <= 0) return 0;
  const rep = repaymentUsed(plan).used;
  const mortgage = i.mortgageAtFI === 'clear' ? Math.max(0, i.loan - i.offset) : i.loan > 0 ? rep / wr : 0;
  return (s.spend[tier] * (1 + adj)) / wr + mortgage + s.today[tier].events + s.today[tier].hecs;
}
