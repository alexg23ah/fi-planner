import { useMemo } from 'react';
import type { BudgetStore } from '../store';
import { categoryBudgetToDate, currentMonth, monthLabel, monthsWithData, shiftMonth, summariseMonth, summariseYear, yearlyProgress, yearsWithData } from '../summary';
import { Segmented } from '../../components/Fields';
import { MonthBars } from '../../components/charts';
import { money, pct } from '../../lib/format';
import type { TxnFilter } from './Transactions';

type Props = {
  store: BudgetStore;
  month: string;
  setMonth: (m: string) => void;
  openTxns: (f: Partial<TxnFilter>) => void;
  fiComfortable: number; // annual Comfortable spend from the FI plan, for comparison
  view: OverviewView;
  setView: (v: OverviewView) => void;
};

export type OverviewView = 'month' | 'year';

function ViewToggle({ view, setView }: { view: OverviewView; setView: (v: OverviewView) => void }) {
  return <Segmented label="Show" value={view} onChange={setView} options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }]} />;
}

export function Overview(props: Props) {
  if (props.view === 'year' && props.store.txns.length) return <YearOverview {...props} />;
  return <MonthOverview {...props} />;
}

function MonthOverview({ store, month, setMonth, openTxns, fiComfortable, view, setView }: Props) {
  const { settings, txns } = store;
  const s = useMemo(() => summariseMonth(txns, settings, month), [txns, settings, month]);
  const months = useMemo(() => monthsWithData(txns), [txns]);
  const latest = months[0] ?? currentMonth();

  const trend = useMemo(() => {
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const m = shiftMonth(month, -i);
      out.push({ month: m, label: monthLabel(m).replace(/ \d{4}$/, ''), value: summariseMonth(txns, settings, m).spent });
    }
    return out;
  }, [txns, settings, month]);

  // Last 12 complete months with data, excluding mortgage, annualised.
  const annual = useMemo(() => {
    const ms = months.slice(0, 12);
    if (!ms.length) return null;
    const total = ms.reduce((a, m) => {
      const sm = summariseMonth(txns, settings, m);
      return a + sm.spent - (sm.byCategory.get('mortgage') ?? 0);
    }, 0);
    return { perYear: (total / ms.length) * 12, months: ms.length };
  }, [txns, settings, months]);

  if (!txns.length) {
    return (
      <div className="page">
        <header className="page-head"><h1>Budget</h1></header>
        <section className="panel empty-state">
          <h2>Start by importing transactions</h2>
          <p>Paste from internet banking or load a CSV export. Categories are filled in automatically from merchant names, and anything new can go to AI.</p>
          <a className="btn primary" href="#/budget/import">Import transactions</a>
        </section>
      </div>
    );
  }

  const left = s.budget - s.monthlySpent;
  const yearly = yearlyProgress(txns, settings, month);
  const cats = settings.categories
    .filter((c) => c.kind === 'expense' && c.period !== 'year' && ((s.byCategory.get(c.id) ?? 0) !== 0 || c.monthly > 0))
    .map((c) => ({ ...c, spent: s.byCategory.get(c.id) ?? 0 }))
    .sort((a, b) => b.spent - a.spent || b.monthly - a.monthly);
  const incomeCats = settings.categories.filter((c) => c.kind === 'income' && (s.byCategory.get(c.id) ?? 0) !== 0);

  return (
    <div className="page">
      <header className="page-head month-head">
        <h1>{monthLabel(month, true)}</h1>
        <div className="month-nav">
          <ViewToggle view={view} setView={setView} />
          <button type="button" className="btn" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
          <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
            {[...new Set([month, ...months])].sort().reverse().map((m) => <option key={m} value={m}>{monthLabel(m, true)}</option>)}
          </select>
          <button type="button" className="btn" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          {month !== latest && <button type="button" className="btn link" onClick={() => setMonth(latest)}>Latest</button>}
        </div>
      </header>

      <section className="ledger" aria-label="Month summary">
        <div><span>Spent</span><strong>{money(s.spent)}</strong></div>
        <div><span>Monthly budget</span><strong>{money(s.budget)}</strong><small>{yearly.length > 0 ? 'Excludes yearly budgets and mortgage' : 'Excludes mortgage'}</small></div>
        <div className={left < 0 ? 'over' : ''}><span>{left < 0 ? 'Over budget' : 'Left'}</span><strong>{money(Math.abs(left))}</strong></div>
        <div><span>Income</span><strong>{money(s.income)}</strong></div>
        <div><span>Saved</span><strong>{money(s.income - s.spent)}</strong>{s.income > 0 && <small>{pct((s.income - s.spent) / s.income, 0)} of income</small>}</div>
      </section>

      {s.uncategorised > 0 && (
        <p className="flag">
          <strong>{s.uncategorised} uncategorised</strong> this month ({money(s.uncategorisedSpend)} spent).{' '}
          <button type="button" className="btn link" onClick={() => openTxns({ month, category: 'none' })}>Categorise them</button>
        </p>
      )}

      <div className="two">
        <section className="panel">
          <h2>Spending by category</h2>
          <div className="table-scroll"><table className="data budget-table">
            <thead><tr><th>Category</th><th className="r">Spent</th><th className="r">Budget</th><th className="bar-col"><span className="sr-only">Progress</span></th></tr></thead>
            <tbody>
              {cats.map((c) => {
                const ratio = c.monthly > 0 ? c.spent / c.monthly : 0;
                const over = c.monthly > 0 && c.spent > c.monthly + 0.5;
                return (
                  <tr key={c.id} className="clickable" onClick={() => openTxns({ month, category: c.id })}>
                    <th>{c.name}</th>
                    <td className="r">{money(c.spent)}</td>
                    <td className="r muted">{c.monthly > 0 ? money(c.monthly) : 'No budget'}</td>
                    <td className="bar-col">
                      {c.monthly > 0 && <span className={`meter${over ? ' over' : ''}`} style={{ ['--p' as string]: Math.min(1, Math.max(0, ratio)) }} />}
                      {over && <small className="over-text">{money(c.spent - c.monthly)} over</small>}
                    </td>
                  </tr>
                );
              })}
              {s.uncategorisedSpend > 0 && (
                <tr className="clickable" onClick={() => openTxns({ month, category: 'none' })}>
                  <th>Uncategorised</th><td className="r">{money(s.uncategorisedSpend)}</td><td className="r muted">–</td><td />
                </tr>
              )}
            </tbody>
          </table></div>
        </section>

        <div className="stack">
          {yearly.length > 0 && (
            <section className="panel">
              <h2>Yearly budgets, {month.slice(0, 4)}</h2>
              <table className="data budget-table">
                <thead><tr><th>Category</th><th className="r">Spent</th><th className="r">Budget</th><th className="bar-col"><span className="sr-only">Progress</span></th></tr></thead>
                <tbody>
                  {yearly.map((y) => {
                    const over = y.annual > 0 && y.spent > y.annual + 0.5;
                    return (
                      <tr key={y.id} className="clickable" onClick={() => openTxns({ category: y.id })}>
                        <th>{y.name}</th>
                        <td className="r">{money(y.spent)}</td>
                        <td className="r muted">{money(y.annual)}</td>
                        <td className="bar-col">
                          {y.annual > 0 && <span className={`meter${over ? ' over' : ''}`} style={{ ['--p' as string]: Math.min(1, Math.max(0, y.spent / y.annual)) }} />}
                          <small className={over ? 'over-text' : 'muted'}>{over ? `${money(y.spent - y.annual)} over` : `${money(Math.max(0, y.annual - y.spent))} left`}</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
          <section className="panel">
            <h2>Where it went</h2>
            <table className="data">
              <tbody>
                {s.merchants.slice(0, 8).map((m) => (
                  <tr key={m.key} className="clickable" onClick={() => openTxns({ month, q: m.key.split(' ')[0] })}>
                    <th>{m.key}</th><td className="r muted">{m.count}×</td><td className="r">{money(m.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {incomeCats.length > 0 && (
            <section className="panel">
              <h2>Income</h2>
              <table className="data"><tbody>
                {incomeCats.map((c) => <tr key={c.id}><th>{c.name}</th><td className="r">{money(s.byCategory.get(c.id) ?? 0)}</td></tr>)}
              </tbody></table>
            </section>
          )}
        </div>
      </div>

      <section className="panel">
        <h2>Spending over 12 months</h2>
        <p className="panel-note">Excludes transfers. The dashed line is your total budget per month, with yearly budgets spread evenly.</p>
        <MonthBars data={trend} refValue={s.budgetAll} refLabel="Budget" />
      </section>

      {annual && fiComfortable > 0 && (
        <section className="panel">
          <h2>Against your FI plan</h2>
          <dl className="facts">
            <div><dt>Actual spending, annualised ({annual.months} {annual.months === 1 ? 'month' : 'months'}, excl. mortgage)</dt><dd>{money(annual.perYear)}</dd></div>
            <div><dt>FI plan, Comfortable tier</dt><dd>{money(fiComfortable)}</dd></div>
            <div><dt>{annual.perYear > fiComfortable ? 'Running above plan by' : 'Running below plan by'}</dt><dd>{money(Math.abs(annual.perYear - fiComfortable))} a year</dd></div>
          </dl>
          <p className="panel-note" style={{ marginTop: 10 }}>The FI plan's Comfortable tier excludes mortgage repayments and life events, so this is a rough check, not a like-for-like match.</p>
        </section>
      )}
    </div>
  );
}

function YearOverview({ store, month, setMonth, setView, openTxns, view }: Props) {
  const { settings, txns } = store;
  const year = month.slice(0, 4);
  const years = useMemo(() => yearsWithData(txns), [txns]);
  const s = useMemo(() => summariseYear(txns, settings, year), [txns, settings, year]);
  const pickYear = (y: string) => setMonth(`${y}-${month.slice(5, 7)}`);

  const bars = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, '0')}`;
    return { month: m, label: monthLabel(m).replace(/ \d{4}$/, ''), value: summariseMonth(txns, settings, m).spent };
  }), [txns, settings, year]);

  const n = s.monthsElapsed;
  const left = s.budgetToDate - s.budgetedSpent;
  const cats = settings.categories
    .filter((c) => c.kind === 'expense' && ((s.byCategory.get(c.id) ?? 0) !== 0 || c.monthly > 0))
    .map((c) => ({ ...c, spent: s.byCategory.get(c.id) ?? 0, budget: categoryBudgetToDate(c, n) }))
    .sort((a, b) => b.spent - a.spent || b.budget - a.budget);
  const incomeCats = settings.categories.filter((c) => c.kind === 'income' && (s.byCategory.get(c.id) ?? 0) !== 0);
  const avgOver = Math.max(1, s.monthsWithData);
  const thisYear = currentMonth().slice(0, 4);

  return (
    <div className="page">
      <header className="page-head month-head">
        <h1>{year}</h1>
        <div className="month-nav">
          <ViewToggle view={view} setView={setView} />
          <button type="button" className="btn" aria-label="Previous year" onClick={() => pickYear(String(Number(year) - 1))}>‹</button>
          <select aria-label="Year" value={year} onChange={(e) => pickYear(e.target.value)}>
            {[...new Set([year, ...years])].sort().reverse().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn" aria-label="Next year" onClick={() => pickYear(String(Number(year) + 1))}>›</button>
        </div>
      </header>
      <p className="muted year-note">
        {year === thisYear ? `January to ${monthLabel(currentMonth(), true).split(' ')[0]}` : 'Full year'}
        {s.monthsWithData < Math.max(n, 1) ? `. Transactions for ${s.monthsWithData} of ${n} ${n === 1 ? 'month' : 'months'}, so budgets may look underspent` : ''}.
      </p>

      <section className="ledger" aria-label="Year summary">
        <div><span>Spent</span><strong>{money(s.spent)}</strong><small>{money(s.spent / avgOver)} a month on average</small></div>
        <div><span>Budget so far</span><strong>{money(s.budgetToDate)}</strong><small>{n} {n === 1 ? 'month' : 'months'}, excludes mortgage</small></div>
        <div className={left < 0 ? 'over' : ''}><span>{left < 0 ? 'Over budget' : 'Under budget'}</span><strong>{money(Math.abs(left))}</strong></div>
        <div><span>Income</span><strong>{money(s.income)}</strong></div>
        <div><span>Saved</span><strong>{money(s.income - s.spent)}</strong>{s.income > 0 && <small>{pct((s.income - s.spent) / s.income, 0)} of income</small>}</div>
      </section>

      {s.uncategorised > 0 && (
        <p className="flag">
          <strong>{s.uncategorised} uncategorised</strong> in {year} ({money(s.uncategorisedSpend)} spent).{' '}
          <button type="button" className="btn link" onClick={() => openTxns({ category: 'none' })}>Categorise them</button>
        </p>
      )}

      <section className="panel">
        <h2>Spending by month</h2>
        <p className="panel-note">Tap a month to open it. The dashed line is your total budget per month, with yearly budgets spread evenly.</p>
        <MonthBars data={bars} refValue={s.budgetAll} refLabel="Budget" onPick={(m) => { setMonth(m); setView('month'); }} />
      </section>

      <div className="two">
        <section className="panel">
          <h2>Spending by category</h2>
          <p className="panel-note">Budget is {n} {n === 1 ? 'month' : 'months'} of each monthly budget; yearly budgets count in full.</p>
          <div className="table-scroll"><table className="data budget-table">
            <thead><tr><th>Category</th><th className="r">Spent</th><th className="r hide-sm">Per month</th><th className="r">Budget</th><th className="bar-col"><span className="sr-only">Progress</span></th></tr></thead>
            <tbody>
              {cats.map((c) => {
                const over = c.budget > 0 && c.spent > c.budget + 0.5;
                return (
                  <tr key={c.id} className="clickable" onClick={() => openTxns({ category: c.id })}>
                    <th>{c.name}{c.period === 'year' && <small className="muted"> yearly</small>}</th>
                    <td className="r">{money(c.spent)}</td>
                    <td className="r muted hide-sm">{money(c.spent / avgOver)}</td>
                    <td className="r muted">{c.budget > 0 ? money(c.budget) : 'No budget'}</td>
                    <td className="bar-col">
                      {c.budget > 0 && <span className={`meter${over ? ' over' : ''}`} style={{ ['--p' as string]: Math.min(1, Math.max(0, c.spent / c.budget)) }} />}
                      {over && <small className="over-text">{money(c.spent - c.budget)} over</small>}
                    </td>
                  </tr>
                );
              })}
              {s.uncategorisedSpend > 0 && (
                <tr className="clickable" onClick={() => openTxns({ category: 'none' })}>
                  <th>Uncategorised</th><td className="r">{money(s.uncategorisedSpend)}</td><td className="r muted hide-sm">{money(s.uncategorisedSpend / avgOver)}</td><td className="r muted">–</td><td />
                </tr>
              )}
            </tbody>
          </table></div>
        </section>

        <div className="stack">
          <section className="panel">
            <h2>Where it went</h2>
            <table className="data">
              <tbody>
                {s.merchants.slice(0, 10).map((m) => (
                  <tr key={m.key} className="clickable" onClick={() => openTxns({ q: m.key.split(' ')[0] })}>
                    <th>{m.key}</th><td className="r muted">{m.count}×</td><td className="r">{money(m.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {incomeCats.length > 0 && (
            <section className="panel">
              <h2>Income</h2>
              <table className="data"><tbody>
                {incomeCats.map((c) => <tr key={c.id}><th>{c.name}</th><td className="r">{money(s.byCategory.get(c.id) ?? 0)}</td></tr>)}
              </tbody></table>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
