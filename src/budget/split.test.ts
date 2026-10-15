import { describe, it, expect } from 'vitest';
import { buildSplit, myAmount, owedByPerson, parseNames, setStatus, shares, requestMessage } from './split';
import { summariseMonth } from './summary';
import { defaultBudgetSettings } from './defaults';
import type { Txn } from './types';

const txn = (p: Partial<Txn>): Txn => ({ id: Math.random().toString(36), date: '2026-10-10', description: 'DINNER', amount: -90, account: '', categoryId: 'dining', source: 'you', hash: Math.random().toString(36), split: null, ...p });

describe('splits', () => {
  it('parses names', () => {
    expect(parseNames(' emily, Oli ,emily,, me ')).toEqual(['Emily', 'Oli']);
  });
  it('splits equally with you, rounding onto your share', () => {
    expect(shares(-90, buildSplit(null, ['Emily', 'Oli']))).toEqual({ each: 30, mine: 30 });
    expect(shares(-100, buildSplit(null, ['A', 'B']))).toEqual({ each: 33.33, mine: 33.34 });
    expect(myAmount({ amount: -90, split: buildSplit(null, ['Emily']) })).toBe(-45);
    expect(myAmount({ amount: 50, split: buildSplit(null, ['Emily']) })).toBe(50);
  });
  it('keeps statuses when names are edited', () => {
    let s = buildSplit(null, ['Emily', 'Oli'])!;
    s = setStatus(s, 'emily', 'paid', '2026-10-15');
    const next = buildSplit(s, ['Emily', 'Sam'])!;
    expect(next.people).toEqual([{ name: 'Emily', status: 'paid', at: '2026-10-15' }, { name: 'Sam', status: 'owed' }]);
    expect(buildSplit(s, [])).toBeNull();
  });
  it('totals what each person owes', () => {
    const t1 = txn({ amount: -90, split: buildSplit(null, ['Emily', 'Oli']) });
    const t2 = txn({ amount: -40, split: setStatus(buildSplit(null, ['Emily'])!, 'Emily', 'requested', '2026-10-15') });
    const t3 = txn({ amount: -20, split: setStatus(buildSplit(null, ['Oli'])!, 'Oli', 'paid', '2026-10-15') });
    const p = owedByPerson([t1, t2, t3]);
    expect(p.map((x) => [x.name, x.owed, x.requested, x.paid])).toEqual([['Emily', 30, 20, 0], ['Oli', 30, 0, 10]]);
    expect(requestMessage(p[0], (n) => `$${n.toFixed(2)}`)).toContain('Total $50.00');
  });
  it('budget counts only your share', () => {
    const s = summariseMonth([txn({ amount: -90, split: buildSplit(null, ['Emily', 'Oli']) })], defaultBudgetSettings(), '2026-10');
    expect(s.spent).toBe(30);
    expect(s.byCategory.get('dining')).toBe(30);
  });
});
