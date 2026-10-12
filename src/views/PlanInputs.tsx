import type { Inputs, Person, Plan, PersonKey, TaxConfig, Tier } from '../model/types';
import { Field, NumberInput, Segmented, Switch } from '../components/Fields';
import { repaymentUsed } from '../model/engine';
import { money, pct } from '../lib/format';

type Props = { plan: Plan; update: (fn: (p: Plan) => Plan) => void };

export function PlanInputs({ plan, update }: Props) {
  const i = plan.inputs;
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => update((p) => ({ ...p, inputs: { ...p.inputs, [k]: v } }));
  const setP = (who: PersonKey, k: keyof Person, v: number) =>
    update((p) => ({ ...p, inputs: { ...p.inputs, [who]: { ...p.inputs[who], [k]: v } } }));
  const setTax = <K extends keyof TaxConfig>(k: K, v: TaxConfig[K]) => update((p) => ({ ...p, tax: { ...p.tax, [k]: v } }));
  const rep = repaymentUsed(plan);
  const lvr = i.propertyValue > 0 ? Math.max(0, i.loan - i.offset) / i.propertyValue : 0;

  const personRow = (k: keyof Person, label: string, kind: 'money' | 'pct', hint?: string, lever?: boolean) => (
    <div className={`pair-row${lever ? ' lever' : ''}`}>
      <div className="pair-label"><span>{label}</span>{hint && <small>{hint}</small>}</div>
      <NumberInput label={`${label} (you)`} kind={kind} value={i.you[k]} onChange={(v) => setP('you', k, v)} min={0} />
      <div className={i.includePartner ? '' : 'muted-off'}>
        <NumberInput label={`${label} (partner)`} kind={kind} value={i.partner[k]} onChange={(v) => setP('partner', k, v)} min={0} />
      </div>
    </div>
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Plan inputs</h1>
        <p>Highlighted fields are the main levers. Changes save automatically.</p>
      </header>

      <section className="panel">
        <h2>Household</h2>
        <div className="grid">
          <Field label="Your current age"><NumberInput label="Your current age" kind="int" value={i.age} onChange={(v) => set('age', v)} min={18} max={90} /></Field>
          <Field label="Starting year" hint="Year 0 of the projection. Life events match against this."><NumberInput label="Starting year" kind="int" value={i.startYear} onChange={(v) => set('startYear', v)} /></Field>
          <Field label="Current investments" hint="Shares and ETFs outside super. Not the offset."><NumberInput label="Current investments" value={i.investments} onChange={(v) => set('investments', v)} min={0} /></Field>
          <Field label="Living costs while working" hint="Which spending tier you live on before FI." lever>
            <Segmented<Tier> label="Living tier" value={i.livingTier} onChange={(v) => set('livingTier', v)}
              options={[{ value: 'min', label: 'Minimum' }, { value: 'comf', label: 'Comfortable' }, { value: 'ideal', label: 'Ideal' }]} />
          </Field>
          <Field label="Include partner" lever><Switch label="Include partner" checked={i.includePartner} onChange={(v) => set('includePartner', v)} /></Field>
          <Field label="Count super towards FI" hint="Off = only assets you can reach before 60."><Switch label="Count super" checked={i.includeSuper} onChange={(v) => set('includeSuper', v)} /></Field>
        </div>
      </section>

      <section className="panel">
        <h2>Income, super and HECS</h2>
        <div className="pair-head"><span /><span>You</span><span className={i.includePartner ? '' : 'muted-off'}>Partner</span></div>
        {personRow('salary', 'Gross salary', 'money', 'Full-time, excl. super', true)}
        {personRow('salaryGrowth', 'Salary growth', 'pct', 'Per year, from year 2', true)}
        {personRow('sacrifice', 'Salary sacrifice', 'money', 'Per year, to super')}
        {personRow('superBalance', 'Super balance', 'money')}
        {personRow('hecs', 'HECS balance', 'money', 'From myGov', true)}
        {personRow('hecsVoluntary', 'Voluntary HECS', 'money', 'Extra per year')}
        <div className="grid tight">
          <Field label="Super guarantee"><NumberInput label="Super guarantee" kind="pct" value={i.sgRate} onChange={(v) => set('sgRate', v)} min={0} /></Field>
          <Field label="Contributions tax"><NumberInput label="Contributions tax" kind="pct" value={i.contribTax} onChange={(v) => set('contribTax', v)} min={0} /></Field>
          <Field label="HECS indexation" hint="Applied each 1 June."><NumberInput label="HECS indexation" kind="pct" value={i.hecsIndexation} onChange={(v) => set('hecsIndexation', v)} min={0} /></Field>
          <Field label="Clear HECS before FI"><Switch label="Clear HECS before FI" checked={i.clearHecsAtFI} onChange={(v) => set('clearHecsAtFI', v)} /></Field>
        </div>
      </section>

      <section className="panel">
        <h2>Mortgage</h2>
        <div className="grid">
          <Field label="Property value"><NumberInput label="Property value" value={i.propertyValue} onChange={(v) => set('propertyValue', v)} min={0} /></Field>
          <Field label="Property growth" hint="Set 0% to measure LVR against today's value."><NumberInput label="Property growth" kind="pct" value={i.propertyGrowth} onChange={(v) => set('propertyGrowth', v)} /></Field>
          <Field label="Loan balance" lever><NumberInput label="Loan balance" value={i.loan} onChange={(v) => set('loan', v)} min={0} /></Field>
          <Field label="Offset balance" lever><NumberInput label="Offset balance" value={i.offset} onChange={(v) => set('offset', v)} min={0} /></Field>
          <Field label="Interest rate" lever><NumberInput label="Interest rate" kind="pct" value={i.rate} onChange={(v) => set('rate', v)} min={0} /></Field>
          <Field label="Remaining term (years)"><NumberInput label="Remaining term" kind="int" value={i.term} onChange={(v) => set('term', v)} min={0} max={40} /></Field>
          <Field label="Actual annual repayment" hint={`Leave 0 to use the minimum (${money(rep.min)} a year).`}>
            <NumberInput label="Actual annual repayment" value={i.actualRepayment} onChange={(v) => set('actualRepayment', v)} min={0} />
          </Field>
          <div className="readout">
            <div><span>Repayment used</span><strong>{money(rep.used)}/yr</strong></div>
            <div><span>Net LVR today</span><strong>{pct(lvr)}</strong></div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Offset or invest</h2>
        <p className="panel-note">Surplus goes to the offset until net LVR reaches the trigger, then splits.</p>
        <div className="grid">
          <Field label="Net LVR trigger" lever><NumberInput label="Net LVR trigger" kind="pct" value={i.lvrTrigger} onChange={(v) => set('lvrTrigger', v)} min={0} max={1} /></Field>
          <Field label="To offset above trigger" lever><NumberInput label="To offset above trigger" kind="pct" value={i.offsetPctAbove} onChange={(v) => set('offsetPctAbove', v)} min={0} max={1} /></Field>
          <Field label="To offset at or below trigger" hint="The rest goes to investments." lever><NumberInput label="To offset below trigger" kind="pct" value={i.offsetPctBelow} onChange={(v) => set('offsetPctBelow', v)} min={0} max={1} /></Field>
          <Field label="Pay out loan once offset covers it" hint="Excess offset then moves to investments."><Switch label="Pay out loan" checked={i.payoutWhenCovered} onChange={(v) => set('payoutWhenCovered', v)} /></Field>
          <Field label="Mortgage at FI" hint="Clear: FI needs assets net of remaining debt. Keep: repayments count as FI spending until the loan ends.">
            <Segmented label="Mortgage at FI" value={i.mortgageAtFI} onChange={(v) => set('mortgageAtFI', v)}
              options={[{ value: 'clear', label: 'Clear' }, { value: 'keep', label: 'Keep' }]} />
          </Field>
        </div>
      </section>

      <section className="panel">
        <h2>FI assumptions</h2>
        <div className="grid">
          <Field label="Safe withdrawal rate" hint="3.5% is safer for 40+ year retirements." lever><NumberInput label="Withdrawal rate" kind="pct" value={i.withdrawalRate} onChange={(v) => set('withdrawalRate', v)} min={0.005} max={0.2} /></Field>
          <Field label="Spending adjustment" hint="+10% is more conservative. Applies to all tiers." lever><NumberInput label="Spending adjustment" kind="pct" value={i.spendingAdj} onChange={(v) => set('spendingAdj', v)} min={-0.9} /></Field>
          <Field label="Inflation"><NumberInput label="Inflation" kind="pct" value={i.inflation} onChange={(v) => set('inflation', v)} /></Field>
          <Field label="Conservative return" hint="Nominal, before tax and fees." lever><NumberInput label="Conservative return" kind="pct" value={i.returns.cons} onChange={(v) => set('returns', { ...i.returns, cons: v })} /></Field>
          <Field label="Middle return" lever><NumberInput label="Middle return" kind="pct" value={i.returns.mid} onChange={(v) => set('returns', { ...i.returns, mid: v })} /></Field>
          <Field label="Optimistic return" lever><NumberInput label="Optimistic return" kind="pct" value={i.returns.opt} onChange={(v) => set('returns', { ...i.returns, opt: v })} /></Field>
        </div>
      </section>

      <details className="panel">
        <summary><h2>Tax and HECS rates (2026–27)</h2></summary>
        <p className="panel-note">Update these each July. Tax brackets stay fixed in the projection, so bracket creep is included. HECS thresholds index with inflation.</p>
        <table className="mini">
          <thead><tr><th>Taxable income over</th><th>Marginal rate</th></tr></thead>
          <tbody>
            {plan.tax.brackets.map((b, k) => (
              <tr key={k}>
                <td><NumberInput label={`Bracket ${k + 1} threshold`} value={b.threshold}
                  onChange={(v) => setTax('brackets', plan.tax.brackets.map((x, j) => (j === k ? { ...x, threshold: v } : x)))} /></td>
                <td><NumberInput label={`Bracket ${k + 1} rate`} kind="pct" value={b.rate}
                  onChange={(v) => setTax('brackets', plan.tax.brackets.map((x, j) => (j === k ? { ...x, rate: v } : x)))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid tight">
          <Field label="Medicare levy"><NumberInput label="Medicare levy" kind="pct" value={plan.tax.medicare} onChange={(v) => setTax('medicare', v)} /></Field>
          <Field label="HECS threshold 1"><NumberInput label="HECS threshold 1" value={plan.tax.hecsThreshold1} onChange={(v) => setTax('hecsThreshold1', v)} /></Field>
          <Field label="HECS threshold 2"><NumberInput label="HECS threshold 2" value={plan.tax.hecsThreshold2} onChange={(v) => setTax('hecsThreshold2', v)} /></Field>
          <Field label="Rate above threshold 1"><NumberInput label="HECS rate 1" kind="pct" value={plan.tax.hecsRate1} onChange={(v) => setTax('hecsRate1', v)} /></Field>
          <Field label="Rate above threshold 2"><NumberInput label="HECS rate 2" kind="pct" value={plan.tax.hecsRate2} onChange={(v) => setTax('hecsRate2', v)} /></Field>
          <Field label="Cap (% of income)"><NumberInput label="HECS cap" kind="pct" value={plan.tax.hecsCap} onChange={(v) => setTax('hecsCap', v)} /></Field>
        </div>
      </details>
    </div>
  );
}
