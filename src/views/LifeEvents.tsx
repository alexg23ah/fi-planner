import type { CostEvent, Plan, PersonKey, WorkPattern } from '../model/types';
import { NumberInput, Segmented, Switch, TextInput } from '../components/Fields';
import { uid } from '../model/defaults';

type Props = { plan: Plan; update: (fn: (p: Plan) => Plan) => void };

export function LifeEvents({ plan, update }: Props) {
  const y0 = plan.inputs.startYear;
  const setEv = (id: string, patch: Partial<CostEvent>) =>
    update((p) => ({ ...p, events: p.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const setWp = (id: string, patch: Partial<WorkPattern>) =>
    update((p) => ({ ...p, workPatterns: p.workPatterns.map((w) => (w.id === id ? { ...w, ...patch } : w)) }));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Life events</h1>
        <p>Costs and work changes that apply for a set run of years. Years are inclusive; for a one-off, set start and end to the same year.</p>
      </header>

      <section className="panel">
        <h2>Extra costs</h2>
        <p className="panel-note">Annual cost in today's dollars, inflated each year. "Count in FI" adds any costs still to come to your FI target, so FI isn't reached before they're funded.</p>
        <div className="table-scroll">
          <table className="edit-table">
            <thead><tr><th>On</th><th>Event</th><th className="r">Cost per year</th><th>From</th><th>To</th><th>Count in FI</th><th>Notes</th><th aria-label="Remove" /></tr></thead>
            <tbody>
              {plan.events.map((e) => (
                <tr key={e.id} className={e.active ? '' : 'inactive'}>
                  <td><Switch label={`${e.name} active`} checked={e.active} onChange={(v) => setEv(e.id, { active: v })} /></td>
                  <td><TextInput label="Event name" value={e.name} onChange={(v) => setEv(e.id, { name: v })} /></td>
                  <td><NumberInput label={`${e.name} cost`} value={e.annualCost} onChange={(v) => setEv(e.id, { annualCost: v })} min={0} /></td>
                  <td><NumberInput label={`${e.name} start`} kind="int" value={e.start} onChange={(v) => setEv(e.id, { start: v })} /></td>
                  <td><NumberInput label={`${e.name} end`} kind="int" value={e.end} onChange={(v) => setEv(e.id, { end: v })} /></td>
                  <td><Switch label={`${e.name} count in FI`} checked={e.includeInFI} onChange={(v) => setEv(e.id, { includeInFI: v })} /></td>
                  <td><TextInput label="Notes" value={e.notes} onChange={(v) => setEv(e.id, { notes: v })} /></td>
                  <td><button type="button" className="icon-btn" aria-label={`Remove ${e.name}`}
                    onClick={() => update((p) => ({ ...p, events: p.events.filter((x) => x.id !== e.id) }))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn ghost" onClick={() => update((p) => ({
          ...p, events: [...p.events, { id: uid(), name: 'New event', active: true, annualCost: 0, start: y0 + 1, end: y0 + 1, includeInFI: true, notes: '' }],
        }))}>Add cost</button>
      </section>

      <section className="panel">
        <h2>Work pattern changes</h2>
        <p className="panel-note">Salary in these years is full-time salary × the percentage. Tax, HECS and super recalculate on the lower income. If rows overlap, the lowest percentage applies.</p>
        <div className="table-scroll">
          <table className="edit-table">
            <thead><tr><th>On</th><th>Description</th><th>Who</th><th className="r">% of salary</th><th>From</th><th>To</th><th>Notes</th><th aria-label="Remove" /></tr></thead>
            <tbody>
              {plan.workPatterns.map((w) => (
                <tr key={w.id} className={w.active ? '' : 'inactive'}>
                  <td><Switch label={`${w.name} active`} checked={w.active} onChange={(v) => setWp(w.id, { active: v })} /></td>
                  <td><TextInput label="Description" value={w.name} onChange={(v) => setWp(w.id, { name: v })} /></td>
                  <td><Segmented<PersonKey> label="Who" value={w.person} onChange={(v) => setWp(w.id, { person: v })}
                    options={[{ value: 'you', label: 'You' }, { value: 'partner', label: 'Partner' }]} /></td>
                  <td><NumberInput label={`${w.name} percent`} kind="pct" value={w.pct} onChange={(v) => setWp(w.id, { pct: v })} min={0} max={1} /></td>
                  <td><NumberInput label={`${w.name} start`} kind="int" value={w.start} onChange={(v) => setWp(w.id, { start: v })} /></td>
                  <td><NumberInput label={`${w.name} end`} kind="int" value={w.end} onChange={(v) => setWp(w.id, { end: v })} /></td>
                  <td><TextInput label="Notes" value={w.notes} onChange={(v) => setWp(w.id, { notes: v })} /></td>
                  <td><button type="button" className="icon-btn" aria-label={`Remove ${w.name}`}
                    onClick={() => update((p) => ({ ...p, workPatterns: p.workPatterns.filter((x) => x.id !== w.id) }))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn ghost" onClick={() => update((p) => ({
          ...p, workPatterns: [...p.workPatterns, { id: uid(), name: 'New change', active: true, person: 'partner', pct: 0.6, start: y0 + 1, end: y0 + 1, notes: '' }],
        }))}>Add work change</button>
      </section>
    </div>
  );
}
