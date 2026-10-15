import { useEffect, useMemo, useState } from 'react';
import { usePlanStore } from './lib/store';
import { project, summarise, tierSpend } from './model/engine';
import { Dashboard } from './views/Dashboard';
import { PlanInputs } from './views/PlanInputs';
import { Spending } from './views/Spending';
import { LifeEvents } from './views/LifeEvents';
import { Projection } from './views/Projection';
import { Settings } from './views/Settings';
import { SignIn } from './views/SignIn';
import { AppSwitcher, type AppId } from './components/AppSwitcher';
import { useBudgetStore } from './budget/store';
import { Overview, type OverviewView } from './budget/views/Overview';
import { Transactions, type TxnFilter } from './budget/views/Transactions';
import { Import } from './budget/views/Import';
import { Setup } from './budget/views/Setup';
import { Splits } from './budget/views/Splits';
import { currentMonth, monthsWithData } from './budget/summary';

const TABS: Record<AppId, { id: string; label: string }[]> = {
  fi: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'inputs', label: 'Plan inputs' },
    { id: 'spending', label: 'Spending' },
    { id: 'events', label: 'Life events' },
    { id: 'projection', label: 'Year by year' },
    { id: 'settings', label: 'Settings' },
  ],
  budget: [
    { id: 'overview', label: 'Overview' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'splits', label: 'Splits' },
    { id: 'import', label: 'Import' },
    { id: 'setup', label: 'Setup' },
  ],
};

interface Route { app: AppId; tab: string }

/** Hash routes: #/fi/dashboard, #/budget/overview. Old links like #dashboard still work. */
const parseHash = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [a, t] = h.split('/');
  if (a === 'budget' || a === 'fi') {
    const app = a as AppId;
    return { app, tab: TABS[app].some((x) => x.id === t) ? t : TABS[app][0].id };
  }
  if (TABS.fi.some((x) => x.id === a)) return { app: 'fi', tab: a };
  return { app: 'fi', tab: 'dashboard' };
};
const href = (app: AppId, tab: string) => `#/${app}/${tab}`;

const SAVE_LABEL = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved', local: 'Saved on this device' } as const;

export default function App() {
  const store = usePlanStore();
  const budget = useBudgetStore(store.planId);
  const [route, setRoute] = useState<Route>(parseHash);
  const [month, setMonth] = useState<string | null>(null);
  const [overviewView, setOverviewView] = useState<OverviewView>('month');
  const [filter, setFilter] = useState<TxnFilter>({ month: 'all', category: 'all', account: 'all', q: '' });

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const rows = useMemo(() => (store.plan ? project(store.plan) : null), [store.plan]);
  const summary = useMemo(() => (store.plan && rows ? summarise(store.plan, rows) : null), [store.plan, rows]);
  const budgetMonth = month ?? monthsWithData(budget.txns)[0] ?? currentMonth();

  if (store.status === 'signed-out') return <SignIn error={store.error} />;
  if (store.status === 'error') return <main className="center"><p className="err">Couldn't load your plan: {store.error}</p></main>;
  if (store.status === 'loading' || !store.plan || !rows || !summary) return <main className="center"><p className="muted">Loading your plan…</p></main>;

  const plan = store.plan;
  const { app, tab } = route;
  const go = (t: string) => { window.location.hash = href(app, t); };
  const openTxns = (f: Partial<TxnFilter>) => {
    setFilter({ month: 'all', category: 'all', account: 'all', q: '', ...f });
    window.location.hash = href('budget', 'transactions');
  };
  const saveState = app === 'budget' && budget.saveState !== 'saved' ? budget.saveState : store.saveState;

  return (
    <div className="shell">
      <header className="topbar">
        <AppSwitcher app={app} onSwitch={(a) => { window.location.hash = href(a, TABS[a][0].id); }} />
        <nav aria-label="Sections">
          {TABS[app].map((t) => (
            <a key={t.id} href={href(app, t.id)} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
        <div className="account">
          <span className={`save save-${saveState}`} role="status">{SAVE_LABEL[saveState]}</span>
          {store.session && <button type="button" className="btn link" onClick={store.signOut}>Sign out</button>}
        </div>
      </header>
      {store.mode === 'local' && (
        <p className="banner">Supabase isn't configured, so data is stored in this browser only. Add the environment variables to enable sign-in and sync.</p>
      )}
      {store.saveState === 'error' && <p className="banner err">Your last change didn't save: {store.error}. Check your connection; the next edit will retry.</p>}
      {app === 'budget' && budget.status === 'error' && (
        <p className="banner err">Couldn't load the budget: {budget.error}. If this is a new setup, run supabase/migrations/002_budget.sql, 003_splits.sql and 004_notes.sql in Supabase.</p>
      )}
      <main>
        {app === 'fi' && tab === 'dashboard' && <Dashboard plan={plan} rows={rows} summary={summary} />}
        {app === 'fi' && tab === 'inputs' && <PlanInputs plan={plan} update={store.update} />}
        {app === 'fi' && tab === 'spending' && <Spending plan={plan} update={store.update} budgetCats={budget.status === 'ready' ? budget.settings.categories : []} />}
        {app === 'fi' && tab === 'events' && <LifeEvents plan={plan} update={store.update} />}
        {app === 'fi' && tab === 'projection' && <Projection plan={plan} rows={rows} />}
        {app === 'fi' && tab === 'settings' && <Settings store={store} />}
        {app === 'budget' && budget.status !== 'ready' && budget.status !== 'error' && <div className="center"><p className="muted">Loading your budget…</p></div>}
        {app === 'budget' && budget.status === 'ready' && (
          <>
            {tab === 'overview' && <Overview store={budget} month={budgetMonth} setMonth={setMonth} openTxns={openTxns} fiComfortable={tierSpend(plan).comf} view={overviewView} setView={setOverviewView} />}
            {tab === 'transactions' && <Transactions store={budget} filter={filter} setFilter={setFilter} />}
            {tab === 'import' && <Import store={budget} go={go} />}
            {tab === 'splits' && <Splits store={budget} />}
            {tab === 'setup' && <Setup store={budget} />}
          </>
        )}
      </main>
    </div>
  );
}
