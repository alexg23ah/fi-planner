import type { Plan, Tier } from '../model/types';
import { TIERS, TIER_LABEL } from '../model/types';
import { NumberInput, TextInput } from '../components/Fields';
import { tierSpend } from '../model/engine';
import { uid } from '../model/defaults';
import { money } from '../lib/format';
import { useState } from 'react';
import type { BudgetCategory } from '../budget/types';

/** FI spending rows from the budget's spending categories: the chosen tier = budget × 12; other tiers keep matching rows or start equal. */
export function fromBudget(plan: Plan, cats: BudgetCategory[], tier: Tier): Plan['spending'] {
  const prev = new Map(plan.spending.map((c) => [c.name.trim().toLowerCase(), c]));
  return cats
    .filter((c) => c.kind === 'expense' && c.monthly > 0 && c.id !== 'mortgage')
    .map((c) => {
      const annual = Math.round(c.monthly * 12);
      const old = prev.get(c.name.trim().toLowerCase());
      const row = old ? { ...old, name: c.name } : { id: uid(), name: c.name, min: annual, comf: annual, ideal: annual };
      const next = { ...row, [tier]: annual };
      // Keep Minimum ≤ Comfortable ≤ Ideal around the value just set.
      if (tier === 'comf') { next.min = Math.min(next.min, annual); next.ideal = Math.max(next.ideal, annual); }
      if (tier === 'min') { next.comf = Math.max(next.comf, annual); next.ideal = Math.max(next.ideal, next.comf); }
      if (tier === 'ideal') { next.comf = Math.min(next.comf, annual); next.min = Math.min(next.min, next.comf); }
      return next;
    });
}

type Props = { plan: Plan; update: (fn: (p: Plan) => Plan) => void; budgetCats?: BudgetCategory[] };

export function Spending({ plan, update, budgetCats = [] }: Props) {
  const [tier, setTier] = useState<Tier>('comf');
  const [msg, setMsg] = useState('');
  const usable = budgetCats.filter((c) => c.kind === 'expense' && c.monthly > 0 && c.id !== 'mortgage');
  const copy = () => {
    const rows = fromBudget(plan, budgetCats, tier);
    const total = rows.reduce((a, r) => a + r[tier], 0);
    if (!window.confirm(`Replace the ${plan.spending.length} rows below with your ${rows.length} budget categories?\n${TIER_LABEL[tier]} will be ${money(total)} a year (monthly budgets × 12, yearly budgets as set). New rows start with the same amount in the other tiers.`)) return;
    update((p) => ({ ...p, spending: rows }));
    setMsg(`Copied ${rows.length} categories into ${TIER_LABEL[tier]}. Adjust Minimum and Ideal below.`);
  };
  const totals = tierSpend(plan);
  const setCat = (id: string, patch: Partial<Plan['spending'][number]>) =>
    update((p) => ({ ...p, spending: p.spending.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const remove = (id: string) => update((p) => ({ ...p, spending: p.spending.filter((c) => c.id !== id) }));
  const add = () => update((p) => ({ ...p, spending: [...p.spending, { id: uid(), name: 'New category', min: 0, comf: 0, ideal: 0 }] }));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Spending</h1>
        <p>Annual household spending in today's dollars. Leave out mortgage repayments and life events, which are modelled separately.</p>
      </header>
      {usable.length > 0 && (
        <section className="panel">
          <h2>Use your budget</h2>
          <p className="panel-note">Copy the Budget app's spending categories here: {usable.length} categories, {money(usable.reduce((a, c) => a + c.monthly * 12, 0))} a year.</p>
          <div className="btn-row">
            <label className="check-inline">Fill
              <select aria-label="Tier to fill" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
                {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
              </select>
            </label>
            <button type="button" className="btn primary" onClick={copy}>Copy from budget</button>
          </div>
          {msg && <p className="ok" role="status">{msg}</p>}
        </section>
      )}
      <section className="panel">
        <dl className="tier-key">
          <div><dt>Minimum</dt><dd>Enough to step away from work you don't enjoy.</dd></div>
          <div><dt>Comfortable</dt><dd>Your current lifestyle.</dd></div>
          <div><dt>Ideal</dt><dd>More flexibility and buffer.</dd></div>
        </dl>
        <div className="table-scroll">
          <table className="edit-table">
            <thead>
              <tr><th>Category</th>{TIERS.map((t) => <th key={t} className="r">{TIER_LABEL[t]}</th>)}<th aria-label="Remove" /></tr>
            </thead>
            <tbody>
              {plan.spending.map((c) => (
                <tr key={c.id}>
                  <td><TextInput label="Category name" value={c.name} onChange={(v) => setCat(c.id, { name: v })} /></td>
                  {TIERS.map((t: Tier) => (
                    <td key={t}><NumberInput label={`${c.name} ${TIER_LABEL[t]}`} value={c[t]} onChange={(v) => setCat(c.id, { [t]: v })} min={0} /></td>
                  ))}
                  <td><button type="button" className="icon-btn" aria-label={`Remove ${c.name}`} onClick={() => remove(c.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th>Total per year</th>{TIERS.map((t) => <td key={t} className="r strong">{money(totals[t])}</td>)}<td /></tr>
              <tr className="sub"><th>Per month</th>{TIERS.map((t) => <td key={t} className="r">{money(totals[t] / 12)}</td>)}<td /></tr>
            </tfoot>
          </table>
        </div>
        <button type="button" className="btn ghost" onClick={add}>Add category</button>
      </section>
    </div>
  );
}
