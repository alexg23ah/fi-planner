import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { defaultPlan } from '../model/defaults';
import type { Plan } from '../model/types';

const LOCAL_KEY = 'fi-planner:plan';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Fill in any fields added since the plan was saved, so old saves keep working. */
function mergeDefaults<T>(base: T, saved: unknown): T {
  if (!isObj(base) || !isObj(saved)) return (saved === undefined ? base : saved) as T;
  const out: Obj = { ...base };
  for (const k of Object.keys(saved)) out[k] = k in base ? mergeDefaults((base as Obj)[k], saved[k]) : saved[k];
  return out as T;
}

export function normalisePlan(raw: unknown): Plan {
  return mergeDefaults(defaultPlan(), raw);
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'local';

export interface PlanStore {
  mode: 'cloud' | 'local';
  status: 'loading' | 'signed-out' | 'ready' | 'error';
  error: string | null;
  session: Session | null;
  plan: Plan | null;
  planId: string | null;
  isOwner: boolean;
  sharedWith: string[];
  saveState: SaveState;
  update: (fn: (p: Plan) => Plan) => void;
  replace: (p: Plan) => void;
  setSharedWith: (emails: string[]) => Promise<void>;
  signOut: () => Promise<void>;
}

export function usePlanStore(): PlanStore {
  const mode = supabase ? 'cloud' : 'local';
  const [status, setStatus] = useState<PlanStore['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [sharedWith, setShared] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<SaveState>(mode === 'local' ? 'local' : 'idle');
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef<Plan | null>(null);

  // Local-only mode
  useEffect(() => {
    if (supabase) return;
    let p = defaultPlan();
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) p = normalisePlan(JSON.parse(raw));
    } catch { /* storage unavailable — use defaults */ }
    setPlan(p);
    setStatus('ready');
  }, []);

  // Auth session
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setStatus('signed-out');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setPlan(null); setPlanId(null); setStatus('signed-out'); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load (or create) the plan once signed in
  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      const { data, error: e } = await supabase
        .from('plans').select('id, owner_id, data, shared_with')
        .order('created_at', { ascending: true }).limit(1);
      if (cancelled) return;
      if (e) { setError(e.message); setStatus('error'); return; }
      if (data && data.length) {
        const row = data[0];
        setPlan(normalisePlan(row.data));
        setPlanId(row.id);
        setIsOwner(row.owner_id === userId);
        setShared(row.shared_with ?? []);
      } else {
        const fresh = defaultPlan();
        const { data: ins, error: ie } = await supabase
          .from('plans').insert({ data: fresh }).select('id').single();
        if (cancelled) return;
        if (ie) { setError(ie.message); setStatus('error'); return; }
        setPlan(fresh); setPlanId(ins.id); setIsOwner(true); setShared([]);
      }
      setSaveState('saved');
      setStatus('ready');
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const persist = useCallback((p: Plan) => {
    latest.current = p;
    window.clearTimeout(timer.current);
    if (!supabase) {
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(p)); } catch { /* ignore */ }
      return;
    }
    if (!planId) return;
    setSaveState('saving');
    timer.current = window.setTimeout(async () => {
      const { error: e } = await supabase!.from('plans').update({ data: latest.current }).eq('id', planId);
      setSaveState(e ? 'error' : 'saved');
      if (e) setError(e.message);
    }, 800);
  }, [planId]);

  const update = useCallback((fn: (p: Plan) => Plan) => {
    setPlan((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, [persist]);

  const replace = useCallback((p: Plan) => { setPlan(p); persist(p); }, [persist]);

  const setSharedWith = useCallback(async (emails: string[]) => {
    if (!supabase || !planId) return;
    const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    const { error: e } = await supabase.from('plans').update({ shared_with: clean }).eq('id', planId);
    if (e) { setError(e.message); return; }
    setShared(clean);
  }, [planId]);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, []);

  return { mode, status, error, session, plan, planId, isOwner, sharedWith, saveState, update, replace, setSharedWith, signOut };
}
