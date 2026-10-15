import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { defaultBudgetSettings } from './defaults';
import type { BudgetSettings, CatSource, NewTxn, Split, Txn } from './types';
import type { AiItem } from './categorise';

const LS_SETTINGS = 'fi-planner:budget-settings';
const LS_TXNS = 'fi-planner:transactions';

type Row = { id: string; date: string; description: string; amount: number | string; account: string; category_id: string | null; source: string | null; hash: string; split?: Split | null };
const fromRow = (r: Row): Txn => ({
  id: r.id, date: r.date, description: r.description, amount: Number(r.amount), account: r.account ?? '',
  categoryId: r.category_id, source: (r.source as CatSource) ?? null, hash: r.hash, split: r.split ?? null,
});

const COLS = 'id,date,description,amount,account,category_id,source,hash,split';
const sortTxns = (t: Txn[]) => [...t].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

function normaliseSettings(raw: unknown): BudgetSettings {
  const d = defaultBudgetSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<BudgetSettings>;
  let categories = Array.isArray(r.categories) && r.categories.length ? r.categories : d.categories;
  // Categories added in later versions.
  for (const id of ['reimbursement', 'money-in']) {
    if (categories.some((c) => c.id === id)) continue;
    const add = d.categories.find((c) => c.id === id)!;
    const at = categories.findIndex((c) => c.id === 'transfers');
    categories = at >= 0 ? [...categories.slice(0, at + 1), add, ...categories.slice(at + 1)] : [...categories, add];
  }
  return {
    version: 1,
    categories,
    rules: Array.isArray(r.rules) ? r.rules : [],
    aiEnabled: r.aiEnabled ?? true,
    accounts: Array.isArray(r.accounts) ? r.accounts : [],
  };
}

export interface BudgetStore {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  settings: BudgetSettings;
  txns: Txn[];
  saveState: 'saved' | 'saving' | 'error' | 'local';
  updateSettings: (fn: (s: BudgetSettings) => BudgetSettings) => void;
  addTxns: (t: NewTxn[]) => Promise<{ added: number; skipped: number }>;
  patchTxns: (changes: { id: string; categoryId: string | null; source: CatSource | null }[]) => Promise<void>;
  deleteTxns: (ids: string[]) => Promise<void>;
  setSplits: (changes: { id: string; split: Split | null }[]) => Promise<void>;
  askAi: (items: AiItem[]) => Promise<Map<string, string | null>>;
}

export function useBudgetStore(planId: string | null): BudgetStore {
  const cloud = !!supabase;
  const [status, setStatus] = useState<BudgetStore['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<BudgetSettings>(defaultBudgetSettings);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [saveState, setSaveState] = useState<BudgetStore['saveState']>(cloud ? 'saved' : 'local');
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<BudgetSettings>(settings);
  const txnsRef = useRef<Txn[]>([]);
  txnsRef.current = txns;
  latest.current = settings;

  // Load
  useEffect(() => {
    if (!cloud) {
      try {
        setSettings(normaliseSettings(JSON.parse(localStorage.getItem(LS_SETTINGS) || 'null')));
        setTxns(sortTxns(JSON.parse(localStorage.getItem(LS_TXNS) || '[]')));
      } catch { /* defaults */ }
      setStatus('ready');
      return;
    }
    if (!planId) return;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      const s = await supabase!.from('budget_settings').select('data').eq('plan_id', planId).maybeSingle();
      if (cancelled) return;
      if (s.error) { setError(s.error.message); setStatus('error'); return; }
      let st = normaliseSettings(s.data?.data);
      if (!s.data) {
        const ins = await supabase!.from('budget_settings').insert({ plan_id: planId, data: st });
        if (ins.error) { setError(ins.error.message); setStatus('error'); return; }
      }
      const all: Txn[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error: e } = await supabase!.from('transactions')
          .select(COLS)
          .eq('plan_id', planId).order('date', { ascending: false }).order('id').range(from, from + 999);
        if (cancelled) return;
        if (e) { setError(e.message); setStatus('error'); return; }
        all.push(...(data as Row[]).map(fromRow));
        if (!data || data.length < 1000) break;
      }
      st = normaliseSettings(st);
      latest.current = st;
      setSettings(st);
      // Earlier versions filed interest and refunds under "Other income" by keyword; they're not income now.
      const moved = all.filter((t) => t.categoryId === 'other-income' && t.source === 'auto' && t.amount > 0);
      if (moved.length) {
        for (const t of moved) t.categoryId = 'money-in';
        for (let i = 0; i < moved.length; i += 200) {
          await supabase!.from('transactions').update({ category_id: 'money-in' }).in('id', moved.slice(i, i + 200).map((t) => t.id));
        }
      }
      setTxns(all);
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [cloud, planId]);

  const persistLocalTxns = (t: Txn[]) => { try { localStorage.setItem(LS_TXNS, JSON.stringify(t)); } catch { /* full */ } };

  const updateSettings = useCallback((fn: (s: BudgetSettings) => BudgetSettings) => {
    setSettings((prev) => {
      const next = fn(prev);
      latest.current = next;
      window.clearTimeout(timer.current);
      if (!cloud) { try { localStorage.setItem(LS_SETTINGS, JSON.stringify(next)); } catch { /* ignore */ } return next; }
      setSaveState('saving');
      timer.current = window.setTimeout(async () => {
        const { error: e } = await supabase!.from('budget_settings').upsert({ plan_id: planId, data: latest.current, updated_at: new Date().toISOString() });
        setSaveState(e ? 'error' : 'saved');
        if (e) setError(e.message);
      }, 700);
      return next;
    });
  }, [cloud, planId]);

  const addTxns = useCallback(async (incoming: NewTxn[]) => {
    const existing = new Set(txnsRef.current.map((t) => t.hash));
    const fresh = incoming.filter((t) => !existing.has(t.hash));
    let skipped = incoming.length - fresh.length;
    if (!fresh.length) return { added: 0, skipped };
    if (!cloud) {
      const added = fresh.map((t) => ({ ...t, id: crypto.randomUUID() }));
      const next = sortTxns([...txnsRef.current, ...added]);
      setTxns(next); persistLocalTxns(next);
      return { added: added.length, skipped };
    }
    const inserted: Txn[] = [];
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500).map((t) => ({
        plan_id: planId, date: t.date, description: t.description, amount: t.amount, account: t.account,
        category_id: t.categoryId, source: t.source, hash: t.hash, split: t.split,
      }));
      const { data, error: e } = await supabase!.from('transactions')
        .upsert(chunk, { onConflict: 'plan_id,hash', ignoreDuplicates: true })
        .select(COLS);
      if (e) { setError(e.message); throw new Error(e.message); }
      inserted.push(...(data as Row[]).map(fromRow));
    }
    skipped += fresh.length - inserted.length;
    setTxns((prev) => sortTxns([...prev, ...inserted]));
    return { added: inserted.length, skipped };
  }, [cloud, planId]);

  const patchTxns = useCallback(async (changes: { id: string; categoryId: string | null; source: CatSource | null }[]) => {
    if (!changes.length) return;
    const byId = new Map(changes.map((c) => [c.id, c]));
    const next = txnsRef.current.map((t) => { const c = byId.get(t.id); return c ? { ...t, categoryId: c.categoryId, source: c.source } : t; });
    setTxns(next);
    if (!cloud) { persistLocalTxns(next); return; }
    const groups = new Map<string, string[]>();
    for (const c of changes) {
      const k = `${c.categoryId ?? ''}|${c.source ?? ''}`;
      groups.set(k, [...(groups.get(k) ?? []), c.id]);
    }
    for (const [k, ids] of groups) {
      const [categoryId, source] = k.split('|');
      for (let i = 0; i < ids.length; i += 200) {
        const { error: e } = await supabase!.from('transactions')
          .update({ category_id: categoryId || null, source: source || null }).in('id', ids.slice(i, i + 200));
        if (e) { setError(e.message); setSaveState('error'); return; }
      }
    }
  }, [cloud]);

  const deleteTxns = useCallback(async (ids: string[]) => {
    const drop = new Set(ids);
    const next = txnsRef.current.filter((t) => !drop.has(t.id));
    setTxns(next);
    if (!cloud) { persistLocalTxns(next); return; }
    for (let i = 0; i < ids.length; i += 200) {
      const { error: e } = await supabase!.from('transactions').delete().in('id', ids.slice(i, i + 200));
      if (e) { setError(e.message); return; }
    }
  }, [cloud]);

  const setSplits = useCallback(async (changes: { id: string; split: Split | null }[]) => {
    if (!changes.length) return;
    const byId = new Map(changes.map((c) => [c.id, c.split]));
    const next = txnsRef.current.map((t) => (byId.has(t.id) ? { ...t, split: byId.get(t.id) ?? null } : t));
    setTxns(next);
    if (!cloud) { persistLocalTxns(next); return; }
    setSaveState('saving');
    const results = await Promise.all(changes.map((c) => supabase!.from('transactions').update({ split: c.split }).eq('id', c.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) { setError(failed.error.message); setSaveState('error'); return; }
    setSaveState('saved');
  }, [cloud]);

  const askAi = useCallback(async (items: AiItem[]) => {
    const out = new Map<string, string | null>();
    if (!items.length) return out;
    const token = cloud ? (await supabase!.auth.getSession()).data.session?.access_token : undefined;
    const categories = latest.current.categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind }));
    for (let i = 0; i < items.length; i += 150) {
      const res = await fetch('/api/categorise', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ items: items.slice(i, i + 150), categories }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `AI request failed (${res.status})`);
      for (const r of body.results as { key: string; categoryId: string | null }[]) out.set(r.key, r.categoryId);
    }
    return out;
  }, [cloud]);

  return { status, error, settings, txns, saveState, updateSettings, addTxns, patchTxns, deleteTxns, setSplits, askAi };
}
