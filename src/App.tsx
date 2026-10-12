import { useEffect, useMemo, useState } from 'react';
import { usePlanStore } from './lib/store';
import { project, summarise } from './model/engine';
import { Dashboard } from './views/Dashboard';
import { PlanInputs } from './views/PlanInputs';
import { Spending } from './views/Spending';
import { LifeEvents } from './views/LifeEvents';
import { Projection } from './views/Projection';
import { Settings } from './views/Settings';
import { SignIn } from './views/SignIn';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inputs', label: 'Plan inputs' },
  { id: 'spending', label: 'Spending' },
  { id: 'events', label: 'Life events' },
  { id: 'projection', label: 'Year by year' },
  { id: 'settings', label: 'Settings' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const fromHash = (): TabId => {
  const h = window.location.hash.slice(1);
  return (TABS.find((t) => t.id === h)?.id ?? 'dashboard') as TabId;
};

const SAVE_LABEL = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved', local: 'Saved on this device' } as const;

export default function App() {
  const store = usePlanStore();
  const [tab, setTab] = useState<TabId>(fromHash);
  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const rows = useMemo(() => (store.plan ? project(store.plan) : null), [store.plan]);
  const summary = useMemo(() => (store.plan && rows ? summarise(store.plan, rows) : null), [store.plan, rows]);

  if (store.status === 'signed-out') return <SignIn error={store.error} />;
  if (store.status === 'error') return <main className="center"><p className="err">Couldn't load your plan: {store.error}</p></main>;
  if (store.status === 'loading' || !store.plan || !rows || !summary) return <main className="center"><p className="muted">Loading your plan…</p></main>;

  const plan = store.plan;
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Runway</span>
        <nav aria-label="Sections">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
        <div className="account">
          <span className={`save save-${store.saveState}`} role="status">{SAVE_LABEL[store.saveState]}</span>
          {store.session && <button type="button" className="btn link" onClick={store.signOut}>Sign out</button>}
        </div>
      </header>
      {store.mode === 'local' && (
        <p className="banner">Supabase isn't configured, so this plan is stored in this browser only. Add the environment variables to enable sign-in and sync.</p>
      )}
      {store.saveState === 'error' && <p className="banner err">Your last change didn't save: {store.error}. Check your connection; the next edit will retry.</p>}
      <main>
        {tab === 'dashboard' && <Dashboard plan={plan} rows={rows} summary={summary} />}
        {tab === 'inputs' && <PlanInputs plan={plan} update={store.update} />}
        {tab === 'spending' && <Spending plan={plan} update={store.update} />}
        {tab === 'events' && <LifeEvents plan={plan} update={store.update} />}
        {tab === 'projection' && <Projection plan={plan} rows={rows} />}
        {tab === 'settings' && <Settings store={store} />}
      </main>
    </div>
  );
}
