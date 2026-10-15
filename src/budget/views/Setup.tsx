import { useState } from 'react';
import type { BudgetStore } from '../store';
import type { BudgetCategory, CategoryKind } from '../types';
import { NumberInput, Switch, TextInput } from '../../components/Fields';
import { CategorySelect } from './shared';
import { applyPastedBudget, parsePastedBudget } from '../budgetPaste';
import { money } from '../../lib/format';
import { uid } from '../../model/defaults';

const KIND_LABEL: Record<CategoryKind, string> = { expense: 'Spending', income: 'Income', transfer: 'Transfer (not counted)' };

export function Setup({ store }: { store: BudgetStore }) {
  const { settings, updateSettings, txns } = store;
  const [q, setQ] = useState('');
  const [paste, setPaste] = useState('');
  const [pastePeriod, setPastePeriod] = useState<'month' | 'year'>('month');
  const [replace, setReplace] = useState(true);
  const [pasteMsg, setPasteMsg] = useState('');
  const pasted = parsePastedBudget(paste);
  const usedIds = new Set(txns.map((t) => t.categoryId).filter((x): x is string => !!x));
  const applyPaste = () => {
    const res = applyPastedBudget(settings, pasted, { period: pastePeriod, replace, usedIds });
    updateSettings(() => res.settings);
    if (res.merged.length) {
      const to = new Map(res.merged.map((m) => [m.fromId, m.toId]));
      store.patchTxns(txns.filter((t) => t.categoryId && to.has(t.categoryId)).map((t) => ({ id: t.id, categoryId: to.get(t.categoryId!)!, source: t.source })));
    }
    const summary = [
      res.updated.length ? `Updated ${res.updated.length}` : '',
      res.created.length ? `added ${res.created.join(', ')}` : '',
      res.merged.length ? `merged ${res.merged.map((m) => `${m.from} into ${m.to}`).join(', ')}` : '',
      res.removed.length ? `removed ${res.removed.join(', ')}` : '',
      res.zeroed.length ? `kept ${res.zeroed.join(', ')} with no budget (they have transactions)` : '',
    ].filter(Boolean).join('; ');
    setPasteMsg(`${summary || 'Budgets set'}.`);
    setPaste('');
  };
  const setCat = (id: string, patch: Partial<BudgetCategory>) =>
    updateSettings((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const used = (id: string) => txns.filter((t) => t.categoryId === id).length;
  const totalBudget = settings.categories.filter((c) => c.kind === 'expense').reduce((a, c) => a + (c.monthly || 0), 0);
  const rules = settings.rules.filter((r) => !q || r.pattern.includes(q.toUpperCase())).sort((a, b) => a.pattern.localeCompare(b.pattern));

  return (
    <div className="page">
      <header className="page-head">
        <h1>Budget setup</h1>
        <p>Categories, monthly budgets and the merchants the app has learned.</p>
      </header>

      <section className="panel">
        <h2>Paste budgets from a spreadsheet</h2>
        <p className="panel-note">Copy the category and amount columns (e.g. a pivot table's rows) and paste them here. Names that match a category update it; new names are added.</p>
        <textarea className="paste short" aria-label="Paste budgets" value={paste} placeholder={'Holiday\t833\nEating Out\t400\nGroceries\t250'} onChange={(e) => { setPaste(e.target.value); setPasteMsg(''); }} />
        {pasted.length > 0 && (
          <>
            <div className="paste-preview">
              {pasted.map((l) => <span key={l.name} className="chip">{l.name} <strong>{money(l.amount)}</strong></span>)}
            </div>
            <div className="paste-opts">
              <label className="check-inline">Amounts are per
                <select aria-label="Amounts are per" value={pastePeriod} onChange={(e) => setPastePeriod(e.target.value as 'month' | 'year')}>
                  <option value="month">month</option><option value="year">year</option>
                </select>
              </label>
              <label className="check-inline"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Replace my other spending categories (similar ones are merged in, e.g. Coffee into Eating Out)</label>
              <button type="button" className="btn primary" onClick={applyPaste}>Set {pasted.length} budgets</button>
            </div>
          </>
        )}
        {paste.trim() && !pasted.length && <p className="err">No category and amount pairs found. Paste two columns: name, then amount.</p>}
        {pasteMsg && <p className="ok" role="status">{pasteMsg}</p>}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Categories and monthly budgets</h2>
          <span className="muted">Total spending budget {money(totalBudget)} a month, {money(totalBudget * 12)} a year (yearly budgets included as a twelfth)</span>
        </div>
        <p className="panel-note">Set a category to <strong>Year</strong> for lumpy costs like holidays: enter the yearly amount, and the Overview tracks it year to date instead of month by month.</p>
        <p className="panel-note">Income counts only categories set to Income: your salary plus any you add (bonus, side work). Everything else that comes in, like refunds, interest or transfers, is left out. Transfer categories are left out of spending too.</p>
        <div className="table-scroll">
          <table className="edit-table">
            <thead><tr><th>Category</th><th>Type</th><th className="r">Budget</th><th>Per</th><th className="r">Used</th><th aria-label="Delete" /></tr></thead>
            <tbody>
              {settings.categories.map((c) => (
                <tr key={c.id}>
                  <td><TextInput label="Category name" value={c.name} onChange={(v) => setCat(c.id, { name: v })} /></td>
                  <td>
                    <select aria-label={`${c.name} type`} value={c.kind} onChange={(e) => setCat(c.id, { kind: e.target.value as CategoryKind })}>
                      {(Object.keys(KIND_LABEL) as CategoryKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                  </td>
                  <td>{c.kind === 'transfer' ? <span className="muted">–</span>
                    : c.period === 'year'
                      ? <NumberInput label={`${c.name} yearly`} value={c.monthly * 12} onChange={(v) => setCat(c.id, { monthly: v / 12 })} min={0} />
                      : <NumberInput label={`${c.name} monthly`} value={c.monthly} onChange={(v) => setCat(c.id, { monthly: v })} min={0} />}</td>
                  <td>{c.kind !== 'transfer' && (
                    <select aria-label={`${c.name} budget period`} value={c.period ?? 'month'} onChange={(e) => setCat(c.id, { period: e.target.value as 'month' | 'year' })}>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  )}</td>
                  <td className="r muted">{used(c.id) || ''}</td>
                  <td><button type="button" className="icon-btn" aria-label={`Delete ${c.name}`} onClick={() => {
                    const n = used(c.id);
                    if (n && !window.confirm(`${n} transactions use ${c.name}. They'll become uncategorised. Delete it?`)) return;
                    if (n) store.patchTxns(txns.filter((t) => t.categoryId === c.id).map((t) => ({ id: t.id, categoryId: null, source: null })));
                    updateSettings((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id), rules: s.rules.filter((r) => r.categoryId !== c.id) }));
                  }}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn ghost" onClick={() => updateSettings((s) => ({
          ...s, categories: [...s.categories, { id: uid(), name: 'New category', kind: 'expense', monthly: 0 }],
        }))}>Add category</button>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Remembered merchants ({settings.rules.length})</h2>
          <input className="text search" type="search" placeholder="Search" aria-label="Search merchants" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="panel-note">Any description containing the text gets that category. Shorten the text to cover more stores (e.g. "WOOLWORTHS" instead of "WOOLWORTHS NEWTOWN"). Your choices always beat AI's.</p>
        {rules.length === 0 ? <p className="muted">Nothing remembered yet. Categorise a transaction and it appears here.</p> : (
          <div className="table-scroll">
            <table className="edit-table">
              <thead><tr><th>Description contains</th><th>Category</th><th>Set by</th><th aria-label="Delete" /></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td><TextInput label="Merchant text" value={r.pattern}
                      onChange={(v) => updateSettings((s) => ({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, pattern: v.toUpperCase() } : x)) }))} /></td>
                    <td><CategorySelect label={`Category for ${r.pattern}`} value={r.categoryId} settings={settings}
                      onChange={(id) => id && updateSettings((s) => ({ ...s, rules: s.rules.map((x) => (x.id === r.id ? { ...x, categoryId: id, origin: 'you' } : x)) }))} /></td>
                    <td><span className={`badge src-${r.origin === 'you' ? 'you' : 'ai'}`}>{r.origin === 'you' ? 'You' : 'AI'}</span></td>
                    <td><button type="button" className="icon-btn" aria-label={`Forget ${r.pattern}`}
                      onClick={() => updateSettings((s) => ({ ...s, rules: s.rules.filter((x) => x.id !== r.id) }))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>AI categorising</h2>
        <div className="ai-row">
          <Switch label="Use AI for new merchants" checked={settings.aiEnabled} onChange={(v) => updateSettings((s) => ({ ...s, aiEnabled: v }))} />
          <p className="panel-note">
            Only merchants the app hasn't seen before are sent, one line each: the cleaned merchant name (card numbers, dates and references removed) and whether money went in or out.
            No amounts, dates or account names. On Gemini's free tier, Google may use and review what's sent.
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>Delete data</h2>
        <p className="panel-note">Removes every imported transaction. Categories and remembered merchants stay.</p>
        <button type="button" className="btn danger" disabled={!txns.length} onClick={() => {
          if (window.confirm(`Delete all ${txns.length} transactions? This cannot be undone.`)) store.deleteTxns(txns.map((t) => t.id));
        }}>Delete all transactions</button>
      </section>
    </div>
  );
}
