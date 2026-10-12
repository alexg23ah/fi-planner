import { useState } from 'react';
import type { Plan, Scenario, YearRow } from '../model/types';
import { SCENARIO_LABEL, TIER_LABEL } from '../model/types';
import { Segmented } from '../components/Fields';
import { money, pct } from '../lib/format';

type Props = { plan: Plan; rows: YearRow[] };

export function Projection({ plan, rows }: Props) {
  const [sc, setSc] = useState<Scenario>('mid');
  const [real, setReal] = useState<'nominal' | 'real'>('nominal');
  const i = plan.inputs;
  const tier = i.livingTier;
  const d = (r: YearRow, v: number) => (real === 'real' ? v / r.infIndex : v);
  const fiYear = rows.find((r) => r.fiAssets[sc] >= r.fiTarget[tier])?.t;

  const cols: { h: string; v: (r: YearRow) => string }[] = [
    { h: 'Your salary', v: (r) => money(d(r, r.you.salary)) },
    ...(i.includePartner ? [{ h: 'Partner salary', v: (r: YearRow) => money(d(r, r.partner.salary)) }] : []),
    { h: 'Take-home', v: (r) => money(d(r, r.householdTakeHome)) },
    { h: 'Living', v: (r) => money(d(r, r.livingCosts)) },
    { h: 'Life events', v: (r) => money(d(r, r.lifeEvents)) },
    { h: 'Repayment', v: (r) => money(d(r, r.repayment)) },
    { h: 'Surplus', v: (r) => money(d(r, r.surplus)) },
    { h: 'To offset', v: (r) => money(d(r, r.toOffset)) },
    { h: 'To invest', v: (r) => money(d(r, r.newCashToInvest)) },
    { h: 'Loan', v: (r) => money(d(r, r.loan)) },
    { h: 'Offset', v: (r) => money(d(r, r.offset)) },
    { h: 'Net LVR', v: (r) => pct(r.netLvr) },
    { h: 'Your HECS', v: (r) => money(d(r, r.you.hecsBal)) },
    ...(i.includePartner ? [{ h: 'Partner HECS', v: (r: YearRow) => money(d(r, r.partner.hecsBal)) }] : []),
    { h: 'Investments', v: (r) => money(d(r, r.investments[sc])) },
    { h: 'Super', v: (r) => money(d(r, r.super[sc])) },
    { h: 'FI assets', v: (r) => money(d(r, r.fiAssets[sc])) },
    { h: `${TIER_LABEL[tier]} target`, v: (r) => money(d(r, r.fiTarget[tier])) },
  ];

  return (
    <div className="page wide">
      <header className="page-head">
        <h1>Year by year</h1>
        <p>The full projection behind the dashboard. The highlighted row is the first year you reach {TIER_LABEL[tier]} FI.</p>
      </header>
      <div className="toolbar">
        <Segmented<Scenario> label="Return scenario" value={sc} onChange={setSc}
          options={(['cons', 'mid', 'opt'] as Scenario[]).map((x) => ({ value: x, label: SCENARIO_LABEL[x] }))} />
        <Segmented label="Dollars" value={real} onChange={setReal}
          options={[{ value: 'nominal', label: 'Nominal' }, { value: 'real', label: "Today's dollars" }]} />
      </div>
      <div className="table-scroll tall">
        <table className="data proj">
          <thead>
            <tr><th className="sticky">Year</th><th className="r">Age</th>{cols.map((c) => <th key={c.h} className="r">{c.h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.t} className={r.t === fiYear ? 'current' : ''}>
                <th className="sticky">{r.calYear}</th><td className="r">{r.age}</td>
                {cols.map((c) => <td key={c.h} className={`r${c.h === 'Surplus' && r.surplus < 0 ? ' neg' : ''}`}>{c.v(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
