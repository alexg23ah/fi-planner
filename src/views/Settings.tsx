import { useRef, useState } from 'react';
import type { PlanStore } from '../lib/store';
import { normalisePlan } from '../lib/store';
import { defaultPlan } from '../model/defaults';

export function Settings({ store }: { store: PlanStore }) {
  const [emails, setEmails] = useState(store.sharedWith.join(', '));
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store.plan, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fi-plan-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (f: File) => {
    try {
      store.replace(normalisePlan(JSON.parse(await f.text())));
      setNote('Plan imported.');
    } catch {
      setNote("That file isn't a plan export. Choose a .json file exported from this app.");
    }
  };

  return (
    <div className="page">
      <header className="page-head"><h1>Settings</h1></header>

      {store.mode === 'cloud' && (
        <section className="panel">
          <h2>Share this plan</h2>
          {store.isOwner ? (
            <>
              <p className="panel-note">People you add can sign in with Google using that email, then view and edit this plan. Separate emails with commas.</p>
              <div className="share-row">
                <input className="text" aria-label="Shared emails" value={emails} placeholder="partner@example.com" onChange={(e) => setEmails(e.target.value)} />
                <button type="button" className="btn primary" onClick={async () => { await store.setSharedWith(emails.split(',')); setNote('Sharing updated.'); }}>Save sharing</button>
              </div>
            </>
          ) : <p className="panel-note">This plan was shared with you. Only the owner can change who has access.</p>}
          <p className="panel-note">If you both edit at the same moment, the last save wins.</p>
        </section>
      )}

      <section className="panel">
        <h2>Backup</h2>
        <p className="panel-note">Download your plan as a file, or load one you exported earlier. Loading replaces the current plan.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={exportJson}>Download plan</button>
          <button type="button" className="btn" onClick={() => file.current?.click()}>Load plan from file</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </div>
      </section>

      <section className="panel">
        <h2>Start again</h2>
        <p className="panel-note">Replaces every input with the example placeholders.</p>
        <button type="button" className="btn danger" onClick={() => {
          if (window.confirm('Replace your whole plan with the example placeholders? This cannot be undone.')) { store.replace(defaultPlan()); setNote('Plan reset to placeholders.'); }
        }}>Reset to placeholders</button>
      </section>
      {note && <p className="ok" role="status">{note}</p>}
    </div>
  );
}
