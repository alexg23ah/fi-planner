import { useMemo, useState } from 'react';
import type { Plan, Tier, YearRow } from '../model/types';
import { SCENARIOS, SCENARIO_LABEL, TIERS, TIER_LABEL } from '../model/types';
import { fiTargetAt, HORIZON, type Summary } from '../model/engine';
import { LineSet } from '../components/charts';
import { Segmented } from '../components/Fields';
import { money, pct } from '../lib/format';

type Props = { plan: Plan; rows: YearRow[]; summary: Summary };
const SHORT = { cons: 'Low', mid: 'Mid', opt: 'High' } as const;

export function Dashboard({ plan, rows, summary: s }: Props) {
  const i = plan.inputs;
  const [tier, setTier] = useState<Tier>(i.livingTier);
  const [range, setRange] = useState<'focus' | 'full'>('focus');
  const r1 = rows[1];
  // Focus window: through the latest FI year shown (or loan payout), plus 8 years.
  const focusEnd = useMemo(() => {
    const ts = [...SCENARIOS.map((sc) => s.yearsToFI[sc][tier]), s.loanClearedYear].filter((x): x is number => x !== null);
    return Math.min(HORIZON, Math.max(15, (ts.length ? Math.max(...ts) : HORIZON) + 8));
  }, [s, tier]);
  const win = (rs: YearRow[]) => (range === 'full' ? rs : rs.filter((r) => r.t <= focusEnd));

  const fiData = useMemo(() => win(rows).map((r) => ({
    age: r.age, calYear: r.calYear,
    cons: r.fiAssets.cons / r.infIndex, mid: r.fiAssets.mid / r.infIndex, opt: r.fiAssets.opt / r.infIndex,
    target: r.fiTarget[tier] / r.infIndex,
  })), [rows, tier, range, focusEnd]);

  const balData = useMemo(() => win(rows).map((r) => ({
    age: r.age, calYear: r.calYear, loan: r.loan, offset: r.offset, inv: r.investments.mid,
    hy: r.you.hecsBal, hp: r.partner.hecsBal,
  })), [rows, range, focusEnd]);

  const cashData = useMemo(() => win(rows).slice(1).map((r) => ({
    age: r.age, calYear: r.calYear, th: r.householdTakeHome, living: r.livingCosts + r.lifeEvents, rep: r.repayment, surplus: r.surplus,
  })), [rows, range, focusEnd]);

  const yr = (t: number | null) => (t === null ? null : i.startYear + t);

  return (
    <div className="page">
      <header className="page-head">
        <h1>When could you stop?</h1>
        <p>Your age at financial independence, by spending tier and investment return.</p>
      </header>

      <section className="matrix" aria-label="Age at financial independence">
        <div className="mx-corner" />
        {TIERS.map((t) => (
          <div key={t} className={`mx-col${t === tier ? ' sel' : ''}`}>
            <span>{TIER_LABEL[t]}</span>
            <small>{money(s.spend[t] * (1 + i.spendingAdj))} a year</small>
          </div>
        ))}
        {SCENARIOS.map((sc) => (
          <div key={sc} className="mx-row">
            <div className="mx-label"><span className="long">{SCENARIO_LABEL[sc]}</span><span className="short">{SHORT[sc]}</span><small>{pct(i.returns[sc], 0)} return</small></div>
            {TIERS.map((t) => {
              const yrs = s.yearsToFI[sc][t];
              const hero = sc === 'mid' && t === i.livingTier;
              return (
                <button type="button" key={t} className={`mx-cell${hero ? ' hero' : ''}${t === tier ? ' sel' : ''}`}
                  onClick={() => setTier(t)} aria-label={`${SCENARIO_LABEL[sc]}, ${TIER_LABEL[t]}: ${yrs === null ? 'not reached' : `age ${i.age + yrs}`}`}>
                  {yrs === null ? <span className="age none">Not by {i.age + HORIZON}</span> : (
                    <>
                      <span className="age">{i.age + yrs}</span>
                      <span className="when">{yrs === 0 ? 'Now' : `${yrs} years, ${yr(yrs)}`}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>FI assets against your target</h2>
          <div className="btn-row">
            <Segmented<Tier> label="Target tier" value={tier} onChange={setTier}
              options={TIERS.map((t) => ({ value: t, label: TIER_LABEL[t] }))} />
            <Segmented label="Chart range" value={range} onChange={setRange}
              options={[{ value: 'focus', label: `To age ${i.age + focusEnd}` }, { value: 'full', label: `${HORIZON} years` }]} />
          </div>
        </div>
        <p className="panel-note">Today's dollars. FI is reached where a scenario line crosses the dashed target. The range setting applies to every chart on this page.</p>
        <LineSet data={fiData} height={320} series={[
          { key: 'cons', name: 'Conservative' }, { key: 'mid', name: 'Middle' }, { key: 'opt', name: 'Optimistic' },
          { key: 'target', name: `${TIER_LABEL[tier]} target`, target: true },
        ]} />
      </section>

      <div className="two">
        <section className="panel">
          <h2>Your FI target today</h2>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th /> {TIERS.map((t) => <th key={t} className="r">{TIER_LABEL[t]}</th>)}</tr></thead>
              <tbody>
                <tr><th>Annual spend</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].adjusted)}</td>)}</tr>
                <tr><th>Spend ÷ {pct(i.withdrawalRate)}</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].fiNumber)}</td>)}</tr>
                <tr><th>{i.mortgageAtFI === 'clear' ? 'Mortgage to clear' : 'Repayments ÷ rate'}</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].mortgage)}</td>)}</tr>
                <tr><th>Future life events</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].events)}</td>)}</tr>
                {i.clearHecsAtFI && <tr><th>HECS to clear</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].hecs)}</td>)}</tr>}
                <tr className="total"><th>FI target</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].total)}</td>)}</tr>
                <tr><th>FI assets now</th>{TIERS.map((t) => <td key={t} className="r">{money(s.today[t].assets)}</td>)}</tr>
                <tr><th>Progress</th>{TIERS.map((t) => (
                  <td key={t} className="r"><span className="bar" style={{ ['--p' as string]: s.today[t].progress }} />{pct(s.today[t].progress)}</td>
                ))}</tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <h2>Cash flow, {r1.calYear}</h2>
          <div className="table-scroll">
            <table className="data">
              <thead><tr><th /><th className="r">You</th>{i.includePartner && <th className="r">Partner</th>}<th className="r">Household</th></tr></thead>
              <tbody>
                {([
                  ['Gross salary', 'salary'], ['Salary sacrifice', 'sacrifice'], ['Income tax', 'tax'],
                  ['Medicare', 'medicare'], ['HECS', 'hecsComp'], ['Take-home', 'takeHome'],
                ] as const).map(([l, k]) => (
                  <tr key={k} className={k === 'takeHome' ? 'total' : ''}>
                    <th>{l}</th><td className="r">{money(r1.you[k])}</td>
                    {i.includePartner && <td className="r">{money(r1.partner[k])}</td>}
                    <td className="r">{money(r1.you[k] + r1.partner[k])}</td>
                  </tr>
                ))}
                <tr><th>Living costs</th><td colSpan={i.includePartner ? 3 : 2} className="r">{money(-r1.livingCosts)}</td></tr>
                <tr><th>Life events</th><td colSpan={i.includePartner ? 3 : 2} className="r">{money(-r1.lifeEvents)}</td></tr>
                <tr><th>Mortgage repayment</th><td colSpan={i.includePartner ? 3 : 2} className="r">{money(-r1.repayment)}</td></tr>
                <tr className="total"><th>Surplus</th><td colSpan={i.includePartner ? 3 : 2} className="r">{money(r1.surplus)}</td></tr>
              </tbody>
            </table>
          </div>
          {s.negativeSurplusYears > 0 && (
            <p className="flag"><strong>Shortfall:</strong> costs exceed income in {s.negativeSurplusYears} {s.negativeSurplusYears === 1 ? 'year' : 'years'}, lowest {money(s.lowestSurplus)}. The gap comes from the offset, then investments.</p>
          )}
        </section>
      </div>

      <div className="two">
        <section className="panel">
          <h2>Mortgage and offset</h2>
          <dl className="facts">
            <div><dt>Net LVR today</dt><dd>{pct(rows[0].netLvr)}</dd></div>
            <div><dt>Repayment</dt><dd>{money(s.repayment.used)}/yr</dd></div>
            <div><dt>Reach {pct(i.lvrTrigger, 0)} LVR</dt><dd>{s.lvrTriggerYear === null ? 'Not reached' : s.lvrTriggerYear === 0 ? 'Already there' : `${yr(s.lvrTriggerYear)}, age ${i.age + s.lvrTriggerYear}`}</dd></div>
            <div><dt>Loan cleared</dt><dd>{s.loanClearedYear === null ? 'Not in horizon' : `${yr(s.loanClearedYear)}, age ${i.age + s.loanClearedYear}`}</dd></div>
            <div><dt>Interest paid</dt><dd>{money(s.totalInterest)}</dd></div>
            <div><dt>Interest saved vs minimum, no offset</dt><dd>{money(Math.max(0, s.interestNoOffset - s.totalInterest))}</dd></div>
          </dl>
        </section>
        <section className="panel">
          <h2>HECS</h2>
          <dl className="facts">
            {(['you', 'partner'] as const).filter((w) => w === 'you' || i.includePartner).map((w) => {
              const bal = rows[0][w].hecsBal;
              const t = s.hecsClearedYear[w];
              return (
                <div key={w}>
                  <dt>{w === 'you' ? 'You' : 'Partner'}: {money(bal)}</dt>
                  <dd>{bal <= 0 ? 'No debt' : t === null ? 'Not cleared in horizon' : `Cleared ${yr(t)}, ${money(s.hecsTotalRepaid[w])} repaid. Frees ${money(r1[w].hecsComp)} a year.`}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>

      <section className="panel">
        <h2>Balances over time</h2>
        <p className="panel-note">Middle return scenario, nominal dollars.</p>
        <LineSet data={balData} series={[
          { key: 'inv', name: 'Investments' }, { key: 'loan', name: 'Loan' }, { key: 'offset', name: 'Offset' },
          { key: 'hy', name: 'Your HECS' }, ...(i.includePartner ? [{ key: 'hp', name: 'Partner HECS' }] : []),
        ]} />
      </section>

      <section className="panel">
        <h2>Household cash flow</h2>
        <p className="panel-note">Nominal dollars. Surplus jumps when HECS clears and when the loan is paid out.</p>
        <LineSet data={cashData} series={[
          { key: 'th', name: 'Take-home' }, { key: 'living', name: 'Living + life events' },
          { key: 'rep', name: 'Mortgage repayment' }, { key: 'surplus', name: 'Surplus' },
        ]} />
      </section>

      <div className="two">
        <section className="panel">
          <h2>If the withdrawal rate changes</h2>
          <div className="table-scroll"><table className="data">
            <thead><tr><th>Rate</th>{TIERS.map((t) => <th key={t} className="r">{TIER_LABEL[t]}</th>)}</tr></thead>
            <tbody>
              {[0.03, 0.0325, 0.035, 0.0375, 0.04, 0.045, 0.05].map((w) => (
                <tr key={w} className={Math.abs(w - i.withdrawalRate) < 1e-9 ? 'current' : ''}>
                  <th>{pct(w, 2)}</th>
                  {TIERS.map((t) => <td key={t} className="r">{money(fiTargetAt(plan, t, w, i.spendingAdj, s))}</td>)}
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
        <section className="panel">
          <h2>If spending changes</h2>
          <div className="table-scroll"><table className="data">
            <thead><tr><th>Change</th>{TIERS.map((t) => <th key={t} className="r">{TIER_LABEL[t]}</th>)}</tr></thead>
            <tbody>
              {[-0.2, -0.1, 0, 0.1, 0.2].map((a) => (
                <tr key={a} className={Math.abs(a - i.spendingAdj) < 1e-9 ? 'current' : ''}>
                  <th>{a > 0 ? '+' : ''}{Math.round(a * 100)}%</th>
                  {TIERS.map((t) => <td key={t} className="r">{money(fiTargetAt(plan, t, i.withdrawalRate, a, s))}</td>)}
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      </div>

      <p className="fineprint">
        Not modelled: tax on investment returns, fees, franking, Paid Parental Leave, Family Tax Benefit, Age Pension, interest-rate changes or market sequence risk.
        Ages are yours. This is a planning model, not financial advice.
      </p>
    </div>
  );
}
