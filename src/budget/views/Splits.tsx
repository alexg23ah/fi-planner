import { useMemo, useState } from 'react';
import type { BudgetStore } from '../store';
import type { SplitStatus } from '../types';
import { owedByPerson, requestMessage, setStatus, type PersonSummary } from '../split';
import { Segmented } from '../../components/Fields';
import { cents as money } from '../../lib/format';

const STATUS_LABEL: Record<SplitStatus, string> = { owed: 'Owed', requested: 'Requested', paid: 'Paid' };
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function Splits({ store }: { store: BudgetStore }) {
  const people = useMemo(() => owedByPerson(store.txns), [store.txns]);
  const [showPaid, setShowPaid] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const totalOut = people.reduce((a, p) => a + p.owed + p.requested, 0);

  const mark = (p: PersonSummary, ids: string[], status: SplitStatus) => {
    const want = new Set(ids);
    store.setSplits(p.lines.filter((l) => want.has(l.txn.id)).map((l) => ({ id: l.txn.id, split: setStatus(l.txn.split!, p.name, status, today()) })));
  };

  const copyRequest = async (p: PersonSummary) => {
    const text = requestMessage(p, money);
    try {
      await navigator.clipboard.writeText(text);
      setNote(`Copied a request for ${p.name}. Paste it into a message.`);
    } catch {
      window.prompt('Copy this message:', text);
    }
    mark(p, p.lines.filter((l) => l.person.status === 'owed').map((l) => l.txn.id), 'requested');
  };

  if (!people.length) {
    return (
      <div className="page">
        <header className="page-head"><h1>Splits</h1></header>
        <section className="panel empty-state">
          <h2>Nothing split yet</h2>
          <p>On Transactions, type names into "Split with" (for example "Emily, Oli"). The cost is shared equally with you, only your share counts in your budget, and what each person owes shows up here.</p>
          <a className="btn primary" href="#/budget/transactions">Go to transactions</a>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head month-head">
        <div>
          <h1>Splits</h1>
          <p>{totalOut > 0 ? <>You're owed <strong>{money(totalOut)}</strong> in total.</> : 'Everyone has paid you back.'}</p>
        </div>
        <label className="check-inline"><input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} /> Show paid items</label>
      </header>
      {note && <p className="ok" role="status">{note}</p>}

      {people.map((p) => {
        const outstanding = p.owed + p.requested;
        const lines = p.lines.filter((l) => showPaid || l.person.status !== 'paid')
          .sort((a, b) => (a.txn.date < b.txn.date ? 1 : -1));
        if (!outstanding && !showPaid) return null;
        return (
          <section key={p.name} className="panel person">
            <div className="person-head">
              <div>
                <h2>{p.name}</h2>
                <p className="person-total">{outstanding > 0 ? <>Owes you <strong>{money(outstanding)}</strong></> : 'All paid'}</p>
              </div>
              <dl className="person-stats">
                <div><dt>Not requested</dt><dd>{money(p.owed)}</dd></div>
                <div><dt>Requested</dt><dd>{money(p.requested)}</dd></div>
                <div><dt>Paid back</dt><dd>{money(p.paid)}</dd></div>
              </dl>
              {outstanding > 0 && (
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => copyRequest(p)}>Copy request</button>
                  <button type="button" className="btn primary" onClick={() => {
                    mark(p, p.lines.filter((l) => l.person.status !== 'paid').map((l) => l.txn.id), 'paid');
                    setNote(`Marked everything from ${p.name} as paid.`);
                  }}>Mark all paid</button>
                </div>
              )}
            </div>
            {lines.length > 0 && (
              <div className="table-scroll">
                <table className="data">
                  <thead><tr><th>Date</th><th>What</th><th className="r">Total</th><th className="r">Their share</th><th>Status</th></tr></thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.txn.id} className={l.person.status === 'paid' ? 'paid' : ''}>
                        <td className="c-date">{l.txn.date}</td>
                        <td className="desc c-desc" title={l.txn.description}>{l.txn.description}{l.txn.note && <small className="txn-note">{l.txn.note}</small>}</td>
                        <td className="r muted c-total">{money(-l.txn.amount)}</td>
                        <td className="r c-share">{money(l.share)}</td>
                        <td className="c-status">
                          <Segmented<SplitStatus> label={`Status for ${l.txn.description}`} value={l.person.status}
                            onChange={(st) => mark(p, [l.txn.id], st)}
                            options={(['owed', 'requested', 'paid'] as SplitStatus[]).map((v) => ({ value: v, label: STATUS_LABEL[v] }))} />
                          {l.person.at && l.person.status !== 'owed' && <small className="muted status-date">{l.person.at}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
      <p className="fineprint">When someone pays you back, the money in is categorised as "Paid back by others" if their name appears in the bank description, so it isn't counted as income. Marking an item paid here is still up to you.</p>
    </div>
  );
}
