import { useMemo, useRef, useState } from 'react';
import type { BudgetStore } from '../store';
import type { BudgetCategory, CatSource, NewTxn } from '../types';
import { parseBankText, withHashes, type ColumnMap } from '../parse';
import { aiItemsFor, categoriseLocal, upsertRule } from '../categorise';
import { merchantKey } from '../merchant';
import { knownNames } from '../split';
import { CategorySelect, SourceBadge, amountClass } from './shared';
import { money } from '../../lib/format';
import { uid } from '../../model/defaults';

type Row = NewTxn & { duplicate: boolean };

const TEMPLATE = `Date,Description,Amount,Category,Notes
13/10/2026,WOOLWORTHS MARRICKVILLE,-45.20,Groceries,
14/10/2026,SALARY ENERGIZER,5200.00,Salary,
15/10/2026,THE GREEK CLUB MARRICKVILLE,-102.88,Dining & takeaway,Oli birthday dinner`;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'category';

/** Planned categories for names in the file that don't match an existing one. */
function planNewCategories(names: Map<string, number[]>, existing: BudgetCategory[]): BudgetCategory[] {
  const ids = new Set(existing.map((c) => c.id));
  const out: BudgetCategory[] = [];
  for (const [name, amounts] of names) {
    let id = `imp-${slug(name)}`;
    for (let n = 2; ids.has(id); n++) id = `imp-${slug(name)}-${n}`;
    ids.add(id);
    const allIn = amounts.every((a) => a > 0);
    const kind = allIn ? (/salary|wage|pay|bonus|income/i.test(name) ? 'income' : 'transfer') : 'expense';
    out.push({ id, name, kind, monthly: 0 });
  }
  return out;
}

export function Import({ store, go }: { store: BudgetStore; go: (tab: string) => void }) {
  const { settings } = store;
  const [account, setAccount] = useState(settings.accounts[0] ?? '');
  const [text, setText] = useState('');
  const [mapOverride, setMapOverride] = useState<ColumnMap | null>(null);
  const [flip, setFlip] = useState(false);
  const [aiCats, setAiCats] = useState<Map<string, string | null>>(new Map());
  const [manual, setManual] = useState<Map<string, string | null>>(new Map()); // by merchant key
  const [busy, setBusy] = useState<'ai' | 'import' | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [createMissing, setCreateMissing] = useState(true);
  const file = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (text.trim() ? parseBankText(text, { map: mapOverride ?? undefined, flipSign: flip }) : null), [text, mapOverride, flip]);
  const map = parsed?.map;

  const existing = useMemo(() => new Set(store.txns.map((t) => t.hash)), [store.txns]);
  // Money in that mentions someone you've split with is probably them paying you back.
  const payerRe = useMemo(() => {
    const names = knownNames(store.txns).filter((n) => n.length >= 3).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return names.length && settings.categories.some((c) => c.id === 'reimbursement') ? new RegExp(`\\b(${names.join('|')})\\b`, 'i') : null;
  }, [store.txns, settings.categories]);
  // Category names from the file: match existing categories by name (or id), plan the rest.
  const { lookup, newCats } = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const c of settings.categories) { lookup.set(c.name.trim().toLowerCase(), c.id); lookup.set(c.id.toLowerCase(), c.id); }
    const unmatched = new Map<string, number[]>();
    for (const t of parsed?.txns ?? []) {
      const k = t.category?.trim().toLowerCase();
      if (!k || lookup.has(k)) continue;
      const name = t.category!.trim();
      const key = [...unmatched.keys()].find((n) => n.toLowerCase() === k) ?? name;
      unmatched.set(key, [...(unmatched.get(key) ?? []), t.amount]);
    }
    const newCats = createMissing ? planNewCategories(unmatched, settings.categories) : [];
    for (const c of newCats) lookup.set(c.name.toLowerCase(), c.id);
    return { lookup, newCats };
  }, [parsed, settings.categories, createMissing]);
  const preview = useMemo(() => ({ ...settings, categories: [...settings.categories, ...newCats] }), [settings, newCats]);

  const rows: Row[] = useMemo(() => {
    if (!parsed) return [];
    return withHashes(parsed.txns, account).map((t) => {
      const key = merchantKey(t.description);
      let categoryId: string | null; let source: CatSource | null;
      const fromFile = t.category ? lookup.get(t.category.trim().toLowerCase()) : undefined;
      if (manual.has(key)) { categoryId = manual.get(key) ?? null; source = categoryId ? 'you' : null; }
      else if (fromFile) { categoryId = fromFile; source = 'you'; }
      else {
        const d = categoriseLocal(t.description, t.amount, settings);
        categoryId = d.categoryId; source = d.source;
        if (t.amount > 0 && payerRe?.test(t.description) && (!categoryId || source === 'auto')) { categoryId = 'reimbursement'; source = 'auto'; }
        if (!categoryId && aiCats.get(key)) { categoryId = aiCats.get(key)!; source = 'ai'; }
      }
      return { date: t.date, description: t.description, amount: t.amount, hash: t.hash, account, categoryId, source, split: null, note: t.note ?? '', duplicate: existing.has(t.hash) };
    });
  }, [parsed, account, settings, aiCats, manual, existing, payerRe, lookup]);

  const fresh = rows.filter((r) => !r.duplicate);
  const unknown = aiItemsFor(fresh.filter((r) => r.amount < 0)).filter((i) => !aiCats.has(i.key));
  const cols = parsed ? Math.max(0, ...parsed.table.rows.slice(0, 20).map((r) => r.length)) : 0;
  const colLabel = (i: number) => {
    const h = parsed?.table.header?.[i];
    const ex = parsed?.table.rows[0]?.[i] ?? '';
    return `${h ? h : `Column ${i + 1}`}${ex ? ` (${ex.slice(0, 18)})` : ''}`;
  };
  const setMap = (patch: Partial<ColumnMap>) => map && setMapOverride({ ...map, ...patch });

  const runAi = async () => {
    setBusy('ai'); setMsg(null);
    try {
      const res = await store.askAi(unknown);
      setAiCats((prev) => new Map([...prev, ...res]));
      const got = [...res.values()].filter(Boolean).length;
      setMsg({ kind: 'ok', text: `AI categorised ${got} of ${res.size} merchants. Check them before importing.` });
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally { setBusy(null); }
  };

  const doImport = async () => {
    setBusy('import'); setMsg(null);
    try {
      // Remember decisions so the next import doesn't need AI for these merchants.
      // Categories from the file: create missing ones, and remember each merchant's most-used category.
      const used = new Set(fresh.map((r) => r.categoryId));
      const toCreate = newCats.filter((c) => used.has(c.id));
      const fileVotes = new Map<string, Map<string, number>>();
      for (const t of parsed?.txns ?? []) {
        const id = t.category ? lookup.get(t.category.trim().toLowerCase()) : undefined;
        if (!id) continue;
        const k = merchantKey(t.description);
        const v = fileVotes.get(k) ?? new Map<string, number>();
        v.set(id, (v.get(id) ?? 0) + 1);
        fileVotes.set(k, v);
      }
      store.updateSettings((s) => {
        let next = toCreate.length ? { ...s, categories: [...s.categories, ...toCreate.filter((c) => !s.categories.some((x) => x.id === c.id))] } : s;
        for (const [key, votes] of fileVotes) {
          if (manual.has(key)) continue;
          const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
          next = upsertRule(next, key, top, 'you', uid());
        }
        for (const [key, cat] of manual) if (cat) next = upsertRule(next, key, cat, 'you', uid());
        for (const r of fresh) if (r.source === 'ai' && r.categoryId) next = upsertRule(next, merchantKey(r.description), r.categoryId, 'ai', uid());
        const acct = account.trim();
        if (acct && !next.accounts.includes(acct)) next = { ...next, accounts: [...next.accounts, acct] };
        return next;
      });
      const created = toCreate.length;
      const { added, skipped } = await store.addTxns(fresh.map((r) => { const t: NewTxn & { duplicate?: boolean } = { ...r }; delete t.duplicate; return t; }));
      setMsg({ kind: 'ok', text: `Imported ${added} transactions${skipped ? `, skipped ${skipped} already imported` : ''}${created ? `. Added ${created} new ${created === 1 ? 'category' : 'categories'}; set their budgets in Setup` : ''}.` });
      setText(''); setAiCats(new Map()); setManual(new Map()); setMapOverride(null);
    } catch (e) {
      setMsg({ kind: 'err', text: `Import failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(null); }
  };

  const shown = showAll ? rows : rows.slice(0, 40);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Import transactions</h1>
        <p>Paste rows copied from internet banking, or load a CSV export from CommBank, NAB, Macquarie or Easy Street. Already-imported transactions are skipped.</p>
      </header>

      <details className="panel import-help" open={!store.txns.length}>
        <summary><h2>What to paste</h2></summary>
        <p className="panel-note">Column order doesn't matter, and a header row is optional. Each row needs three things:</p>
        <ul className="help-list">
          <li><strong>Date</strong>: 13/10/2026, 13 Oct 2026 or 2026-10-13</li>
          <li><strong>Description</strong>: the bank's text, e.g. WOOLWORTHS MARRICKVILLE</li>
          <li><strong>Amount</strong>: one column with money out negative (-45.20), or separate Debit and Credit columns</li>
        </ul>
        <p className="panel-note">Optional: a <strong>Category</strong> column (your own category names; any that don't exist yet are created) and a <strong>Notes</strong> column. Other columns like balance are ignored. Easiest: export a CSV from your bank and load it as is. If you're typing your own, use this layout:</p>
        <pre className="example">{TEMPLATE}</pre>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => { setText(TEMPLATE); setMapOverride(null); }}>Paste this example</button>
          <a className="btn" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="transactions-template.csv">Download template</a>
        </div>
        <p className="panel-note" style={{ marginTop: 12 }}>
          Where to find exports: CommBank NetBank → Accounts → Export → CSV. NAB → Transactions → Export → CSV.
          Macquarie → account → Export transactions → CSV. Easy Street → Statements and transactions → Export.
        </p>
      </details>

      <section className="panel">
        <div className="grid">
          <div className="field">
            <label htmlFor="acct">Account</label>
            <input id="acct" className="text" list="accounts" value={account} placeholder="e.g. CommBank Everyday" onChange={(e) => setAccount(e.target.value)} />
            <datalist id="accounts">{settings.accounts.map((a) => <option key={a} value={a} />)}</datalist>
            <p className="hint">Used to tell accounts apart and to spot duplicates.</p>
          </div>
          <div className="field">
            <label>CSV file</label>
            <div className="control">
              <button type="button" className="btn" onClick={() => file.current?.click()}>Choose CSV file</button>
              <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) { setText(await f.text()); setMapOverride(null); }
                e.target.value = '';
              }} />
            </div>
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="paste">Or paste transactions</label>
          <textarea id="paste" className="paste" value={text} spellCheck={false}
            placeholder={'13/10/2026,"-45.20","WOOLWORTHS 1234 MARRICKVILLE AU","+1,234.56"\n14/10/2026,"+5,000.00","SALARY ENERGIZER","+6,234.56"'}
            onChange={(e) => { setText(e.target.value); setMapOverride(null); }} />
        </div>
      </section>

      {parsed && map && (
        <section className="panel">
          <div className="panel-head">
            <h2>{parsed.txns.length ? `${parsed.txns.length} transactions read` : 'No transactions found yet'}</h2>
            {parsed.skipped > 0 && <span className="muted">{parsed.skipped} rows couldn't be read</span>}
          </div>
          <p className="panel-note">Columns are detected automatically. If dates or amounts look wrong, change them here.</p>
          <div className="map-row">
            <label>Date<select value={map.date} onChange={(e) => setMap({ date: +e.target.value })}>
              {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
            </select></label>
            <label>Description<select value={map.description} onChange={(e) => setMap({ description: +e.target.value })}>
              {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
            </select></label>
            <label>Amount<select value={map.amount ?? 'split'} onChange={(e) => {
              const v = e.target.value;
              if (v === 'split') setMap({ amount: null, debit: map.debit ?? 0, credit: map.credit ?? 1 });
              else setMap({ amount: +v, debit: null, credit: null });
            }}>
              <option value="split">Separate debit and credit columns</option>
              {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
            </select></label>
            {map.amount === null && (<>
              <label>Debit (money out)<select value={map.debit ?? 0} onChange={(e) => setMap({ debit: +e.target.value })}>
                {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
              </select></label>
              <label>Credit (money in)<select value={map.credit ?? 0} onChange={(e) => setMap({ credit: +e.target.value })}>
                {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
              </select></label>
            </>)}
            {map.amount !== null && (
              <label className="check"><input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} /> Spending shows as positive numbers</label>
            )}
            <label>Category (optional)<select value={map.category ?? ''} onChange={(e) => setMap({ category: e.target.value === '' ? null : +e.target.value })}>
              <option value="">None</option>
              {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
            </select></label>
            <label>Notes (optional)<select value={map.note ?? ''} onChange={(e) => setMap({ note: e.target.value === '' ? null : +e.target.value })}>
              <option value="">None</option>
              {[...Array(cols).keys()].map((i) => <option key={i} value={i}>{colLabel(i)}</option>)}
            </select></label>
          </div>
          {map.category != null && (newCats.length > 0 || !createMissing) && (
            <div className="new-cats">
              <label className="check-inline"><input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} /> Create categories that don't exist yet</label>
              {createMissing
                ? <p className="panel-note">New: {newCats.map((c) => `${c.name} (${c.kind === 'expense' ? 'spending' : c.kind === 'income' ? 'income' : 'not counted'})`).join(', ')}. You can rename, merge or set budgets for them in Setup afterwards.</p>
                : <p className="panel-note">Rows with a category name that doesn't match one of yours are categorised automatically instead.</p>}
            </div>
          )}

          {rows.length > 0 && (
            <>
              <div className="import-bar">
                <span>
                  {fresh.length} new{rows.length - fresh.length ? `, ${rows.length - fresh.length} already imported` : ''}.{' '}
                  {fresh.filter((r) => !r.categoryId && r.amount < 0).length} purchases without a category.
                </span>
                <div className="btn-row">
                  {settings.aiEnabled && unknown.length > 0 && (
                    <button type="button" className="btn" disabled={!!busy} onClick={runAi}>
                      {busy === 'ai' ? 'Asking AI…' : `Categorise ${unknown.length} new ${unknown.length === 1 ? 'merchant' : 'merchants'} with AI`}
                    </button>
                  )}
                  <button type="button" className="btn primary" disabled={!!busy || !fresh.length} onClick={doImport}>
                    {busy === 'import' ? 'Importing…' : `Import ${fresh.length} transactions`}
                  </button>
                </div>
              </div>
              {msg && <p className={msg.kind} role="status">{msg.text}</p>}
              <div className="table-scroll">
                <table className="data txn-table">
                  <thead><tr><th>Date</th><th>Description</th><th className="r">Amount</th><th>Category</th><th>How</th><th>Notes</th></tr></thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.hash} className={r.duplicate ? 'dup' : ''}>
                        <td>{r.date}</td>
                        <td className="desc" title={r.description}>{r.description}{r.duplicate && <span className="badge none"> Already imported</span>}</td>
                        <td className={`r ${amountClass(r.amount)}`}>{money(r.amount)}</td>
                        <td><CategorySelect label={`Category for ${r.description}`} value={r.categoryId} settings={preview}
                          onChange={(id) => setManual((m) => new Map(m).set(merchantKey(r.description), id))} /></td>
                        <td><SourceBadge source={r.source} /></td>
                        <td className="muted import-note">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > shown.length && <button type="button" className="btn ghost" onClick={() => setShowAll(true)}>Show all {rows.length}</button>}
              <p className="panel-note" style={{ marginTop: 12 }}>Changing a category here applies to every row from that merchant, and is remembered for future imports.</p>
            </>
          )}
        </section>
      )}
      {!parsed && msg && <p className={msg.kind} role="status">{msg.text} <button type="button" className="btn link" onClick={() => go('transactions')}>See transactions</button></p>}
    </div>
  );
}
