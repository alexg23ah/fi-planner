import { useEffect, useRef, useState } from 'react';

export type AppId = 'fi' | 'budget';

const APPS: { id: AppId; name: string; blurb: string }[] = [
  { id: 'fi', name: 'FI planner', blurb: 'When you could stop working' },
  { id: 'budget', name: 'Budget', blurb: 'Spending, categories and budgets' },
];

export function AppSwitcher({ app, onSwitch }: { app: AppId; onSwitch: (a: AppId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = APPS.find((a) => a.id === app)!;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className="switcher" ref={ref}>
      <button type="button" className="switcher-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="brand"><img className="logo" src="/logo.svg" alt="" width="32" height="32" />Buckaroo</span>
        <span className="switcher-app">{current.name}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <ul className="switcher-menu" role="menu">
          {APPS.map((a) => (
            <li key={a.id} role="none">
              <button type="button" role="menuitemradio" aria-checked={a.id === app} className={a.id === app ? 'on' : ''}
                onClick={() => { setOpen(false); onSwitch(a.id); }}>
                <strong>{a.name}</strong><span>{a.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
