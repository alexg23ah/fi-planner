import type { Plan, Tier } from '../model/types';
import { TIERS, TIER_LABEL } from '../model/types';
import { NumberInput, TextInput } from '../components/Fields';
import { tierSpend } from '../model/engine';
import { uid } from '../model/defaults';
import { money } from '../lib/format';

type Props = { plan: Plan; update: (fn: (p: Plan) => Plan) => void };

export function Spending({ plan, update }: Props) {
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
