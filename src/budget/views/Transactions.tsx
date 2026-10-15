import { useMemo, useState } from 'react';
import type { BudgetStore } from '../store';
import type { Txn } from '../types';
import { aiItemsFor, sameMerchant, upsertRule } from '../categorise';
import { merchantKey } from '../merchant';
import { monthLabel, monthOf, monthsWithData } from '../summary';
import { CategorySelect, SourceBadge, SplitInput, amountClass } from './shared';
import { buildSplit, parseSplitInput, shares, splitText } from '../split';
import { cents, money } from '../../lib/format';
import { uid } from '../../model/defaults';

function SplitHint({ amount, split }: { amount: number; split: NonNullable<Txn['split']> }) {
  const sh = shares(amount, split);
  return (
    <small className="muted">
      {sh.custom ? `Your share ${cents(sh.mine)}` : `${split.people.length + 1} ways, ${cents(sh.each)} each`}
    </small>
  );
}

export interface TxnFilter { month: string; category: string; account: string; q: string }

export function Transactions({ store, filter, setFilter }: { store: BudgetStore; filter: TxnFilter; setFilter: (f: TxnFilter) => void }) {
  const { settings, txns } = store;
  const [limit, setLimit] = useState(200);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const months = useMemo(() => monthsWithData(txns), [txns]);
  const accounts = useMemo(() => [...new Set(txns.map((t) => t.account).filter(Boolean))].sort(), [txns]);

  const list = useMemo(() => {
    const q = filter.q.trim().toUpperCase();
    return txns.filter((t) =>
      (filter.month === 'all' || monthOf(t.date) === filter.month)
      && (filter.category === 'all' || (filter.category === 'none' ? !t.categoryId : t.categoryId === filter.category))
      && (filter.account === 'all' || t.account === filter.account)
      && (!q || t.description.toUpperCase().includes(q)));
  }, [txns, filter]);

  const total = list.reduce((a, t) => a + t.amount, 0);
  const uncategorised = txns.filter((t) => !t.categoryId && t.amount < 0);

  const change = async (t: Txn, categoryId: string | null) => {
    const others = categoryId ? sameMerchant(txns, t.description).filter((o) => o.id !== t.id) : [];
    await store.patchTxns([
      { id: t.id, categoryId, source: categoryId ? 'you' : null },
      ...others.map((o) => ({ id: o.id, categoryId, source: 'rule' as const })),
    ]);
    if (categoryId) {
      store.updateSettings((s) => upsertRule(s, merchantKey(t.description), categoryId, 'you', uid()));
      const name = settings.categories.find((c) => c.id === categoryId)?.name;
      setNote({ kind: 'ok', text: `${merchantKey(t.description)} will be ${name} from now on${others.length ? `. Also updated ${others.length} other ${others.length === 1 ? 'transaction' : 'transactions'}` : ''}.` });
    }
  };

  const aiUncategorised = async () => {
    setBusy(true); setNote(null);
    try {
      const items = aiItemsFor(uncategorised);
      const res = await store.askAi(items);
      const changes = uncategorised.flatMap((t) => {
        const c = res.get(merchantKey(t.description));
        return c ? [{ id: t.id, categoryId: c, source: 'ai' as const }] : [];
      });
      await store.patchTxns(changes);
      store.updateSettings((s) => {
        let next = s;
        for (const [key, c] of res) if (c) next = upsertRule(next, key, c, 'ai', uid());
        return next;
      });
      setNote({ kind: 'ok', text: `AI categorised ${changes.length} of ${uncategorised.length} transactions.` });
    } catch (e) {
      setNote({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(false); }
  };

  return (
    <div className="page wide">
      <header className="page-head">
        <h1>Transactions</h1>
        <p>Change a category and every transaction from that merchant follows, now and in future imports. To split a purchase, type names separated by commas; it's shared equally with you. Add an amount after a name for a fixed share (e.g. “Emily, Oli $40”). Only your share counts in the budget.</p>
      </header>

      <div className="toolbar filters">
        <select aria-label="Month" value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })}>
          <option value="all">All months</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m, true)}</option>)}
        </select>
        <select aria-label="Category" value={filter.category} onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="all">All categories</option>
          <option value="none">Uncategorised</option>
          {settings.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {accounts.length > 1 && (
          <select aria-label="Account" value={filter.account} onChange={(e) => setFilter({ ...filter, account: e.target.value })}>
            <option value="all">All accounts</option>
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <input className="text search" type="search" placeholder="Search descriptions" aria-label="Search" value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        {settings.aiEnabled && uncategorised.length > 0 && (
          <button type="button" className="btn" disabled={busy} onClick={aiUncategorised}>
            {busy ? 'Asking AI…' : `Categorise ${uncategorised.length} uncategorised with AI`}
          </button>
        )}
      </div>
      {note && <p className={note.kind} role="status">{note.text}</p>}

      {txns.length === 0 ? (
        <section className="panel empty-state">
          <h2>No transactions yet</h2>
          <p>Import from your bank to start tracking. <a href="#/budget/import">Import transactions</a></p>
        </section>
      ) : (
        <>
          <p className="muted list-meta">{list.length} transactions, net {money(total)}</p>
          <div className="table-scroll tall">
            <table className="data txn-table">
              <thead><tr><th className="sticky">Date</th><th>Description</th><th>Account</th><th className="r">Amount</th><th>Category</th><th>How</th><th>Split with</th><th aria-label="Delete" /></tr></thead>
              <tbody>
                {list.slice(0, limit).map((t) => (
                  <tr key={t.id}>
                    <td className="sticky">{t.date}</td>
                    <td className="desc" title={t.description}>{t.description}</td>
                    <td className="muted">{t.account}</td>
                    <td className={`r ${amountClass(t.amount)}`}>{money(t.amount)}</td>
                    <td><CategorySelect label={`Category for ${t.description}`} value={t.categoryId} settings={settings} onChange={(id) => change(t, id)} /></td>
                    <td><SourceBadge source={t.source} /></td>
                    <td className="split-cell">
                      <SplitInput label={`Split ${t.description} with`} value={splitText(t.split)} disabled={t.amount >= 0}
                        validate={(v) => {
                          const sp = buildSplit(t.split, parseSplitInput(v));
                          return sp && shares(t.amount, sp).over ? `Fixed amounts add up to more than ${cents(-t.amount)}.` : null;
                        }}
                        onCommit={(v) => store.setSplits([{ id: t.id, split: buildSplit(t.split, parseSplitInput(v)) }])} />
                      {t.split && <SplitHint amount={t.amount} split={t.split} />}
                    </td>
                    <td><button type="button" className="icon-btn" aria-label={`Delete ${t.description}`} onClick={() => {
                      if (window.confirm(`Delete this transaction?\n${t.date} ${t.description} ${money(t.amount)}`)) store.deleteTxns([t.id]);
                    }}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length > limit && <button type="button" className="btn ghost" onClick={() => setLimit((l) => l + 500)}>Show more ({list.length - limit} left)</button>}
        </>
      )}
    </div>
  );
}
