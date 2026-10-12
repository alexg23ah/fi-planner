export type Tier = 'min' | 'comf' | 'ideal';
export type Scenario = 'cons' | 'mid' | 'opt';
export type PersonKey = 'you' | 'partner';

export const TIERS: Tier[] = ['min', 'comf', 'ideal'];
export const SCENARIOS: Scenario[] = ['cons', 'mid', 'opt'];
export const TIER_LABEL: Record<Tier, string> = { min: 'Minimum', comf: 'Comfortable', ideal: 'Ideal' };
export const SCENARIO_LABEL: Record<Scenario, string> = { cons: 'Conservative', mid: 'Middle', opt: 'Optimistic' };

export interface Person {
  salary: number;          // gross, excl. super
  salaryGrowth: number;    // p.a., applied from year 2
  sacrifice: number;       // salary sacrifice to super, $/yr
  superBalance: number;
  hecs: number;
  hecsVoluntary: number;   // $/yr
}

export interface Inputs {
  age: number;
  startYear: number;
  investments: number;
  includeSuper: boolean;
  livingTier: Tier;
  includePartner: boolean;
  you: Person;
  partner: Person;
  sgRate: number;
  contribTax: number;
  hecsIndexation: number;
  clearHecsAtFI: boolean;
  propertyValue: number;
  propertyGrowth: number;
  loan: number;
  offset: number;
  rate: number;
  term: number;
  actualRepayment: number; // 0 = use calculated minimum
  lvrTrigger: number;
  offsetPctAbove: number;
  offsetPctBelow: number;
  payoutWhenCovered: boolean;
  mortgageAtFI: 'clear' | 'keep';
  withdrawalRate: number;
  spendingAdj: number;
  inflation: number;
  returns: Record<Scenario, number>;
}

export interface SpendingCategory {
  id: string;
  name: string;
  min: number;
  comf: number;
  ideal: number;
}

export interface CostEvent {
  id: string;
  name: string;
  active: boolean;
  annualCost: number;
  start: number;
  end: number;
  includeInFI: boolean;
  notes: string;
}

export interface WorkPattern {
  id: string;
  name: string;
  active: boolean;
  person: PersonKey;
  pct: number;
  start: number;
  end: number;
  notes: string;
}

export interface TaxConfig {
  brackets: { threshold: number; rate: number }[];
  medicare: number;
  hecsThreshold1: number;
  hecsThreshold2: number;
  hecsRate1: number;
  hecsRate2: number;
  hecsCap: number;
}

export interface Plan {
  version: 1;
  inputs: Inputs;
  spending: SpendingCategory[];
  events: CostEvent[];
  workPatterns: WorkPattern[];
  tax: TaxConfig;
}

export interface PersonYear {
  workPct: number;
  salary: number;
  sacrifice: number;
  taxable: number;
  tax: number;
  medicare: number;
  hecsComp: number;
  hecsVol: number;
  hecsBal: number;
  takeHome: number;
}

export interface YearRow {
  t: number;
  calYear: number;
  age: number;
  infIndex: number;
  you: PersonYear;
  partner: PersonYear;
  householdTakeHome: number;
  livingCosts: number;
  lifeEvents: number;
  surplus: number;
  superContrib: number;
  propertyValue: number;
  loan: number;
  offset: number;
  netDebt: number;
  netLvr: number;
  interest: number;
  repayment: number;
  pctToOffset: number;
  toOffset: number;
  releasedFromOffset: number;
  newCashToInvest: number;
  investments: Record<Scenario, number>;
  super: Record<Scenario, number>;
  fiAssets: Record<Scenario, number>;
  eventsReserve: number;
  fiTarget: Record<Tier, number>;
}
