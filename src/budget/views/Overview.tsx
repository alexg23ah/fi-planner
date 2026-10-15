import { useMemo } from 'react';
import type { BudgetStore } from '../store';
import { currentMonth, monthLabel, monthsWithData, shiftMonth, summariseMonth } from '../summary';
import { MonthBars } from '../../components/charts';
import { money, pct } from '../../lib/format';
import type { TxnFilter } from './Transactions';

type Props = {
  store: BudgetStore;
  month: string;
  setMonth: (m: string) => void;
  openTxns: (f: Partial<TxnFilter>) => void;
  fiComfortable: number; // annual Comfortable spend from the FI plan, for comparison
};

export function Overview({ store, month, setMonth, openTxns, fiComfortable }: Props) {
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

  const left = s.budget - s.spent;
  const cats = settings.categories
    .filter((c) => c.kind === 'expense' && ((s.byCategory.get(c.id) ?? 0) !== 0 || c.monthly > 0))
    .map((c) => ({ ...c, spent: s.byCategory.get(c.id) ?? 0 }))
    .sort((a, b) => b.spent - a.spent || b.monthly - a.monthly);
  const incomeCats = settings.categories.filter((c) => c.kind === 'income' && (s.byCategory.get(c.id) ?? 0) !== 0);

  return (
    <div className="page">
      <header className="page-head month-head">
        <h1>{monthLabel(month, true)}</h1>
        <div className="month-nav">
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
        <div><span>Budget</span><strong>{money(s.budget)}</strong></div>
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
        <p className="panel-note">Excludes transfers. The dashed line is your monthly budget.</p>
        <MonthBars data={trend} refValue={s.budget} refLabel="Budget" />
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
