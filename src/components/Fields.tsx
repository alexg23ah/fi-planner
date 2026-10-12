import { useEffect, useId, useState, type ReactNode } from 'react';

type Kind = 'money' | 'pct' | 'int';

const toDisplay = (v: number, kind: Kind) => {
  if (!Number.isFinite(v)) return '';
  if (kind === 'pct') return String(+(v * 100).toFixed(4));
  if (kind === 'money') return Math.round(v).toLocaleString('en-AU');
  return String(Math.round(v));
};

const parse = (s: string, kind: Kind): number | null => {
  const n = Number(s.replace(/[$,%\s]/g, ''));
  if (s.trim() === '' || !Number.isFinite(n)) return null;
  return kind === 'pct' ? n / 100 : n;
};

export function NumberInput({ value, onChange, kind = 'money', label, min, max }: {
  value: number; onChange: (v: number) => void; kind?: Kind; label: string; min?: number; max?: number;
}) {
  const [text, setText] = useState(toDisplay(value, kind));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(toDisplay(value, kind)); }, [value, kind, focused]);
  const commit = () => {
    let n = parse(text, kind);
    if (n === null) { setText(toDisplay(value, kind)); return; }
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
  };
  return (
    <span className={`num num-${kind}`}>
      {kind === 'money' && <span className="affix">$</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        value={text}
        onFocus={(e) => { setFocused(true); setText(kind === 'money' ? String(Math.round(value)) : toDisplay(value, kind)); requestAnimationFrame(() => e.target.select()); }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      />
      {kind === 'pct' && <span className="affix">%</span>}
    </span>
  );
}

export function Field({ label, hint, children, lever }: { label: string; hint?: ReactNode; children: ReactNode; lever?: boolean }) {
  const id = useId();
  return (
    <div className={`field${lever ? ' lever' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="control" id={id}>{children}</div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label}
      className={`switch${checked ? ' on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="knob" />
      <span className="switch-text">{checked ? 'Yes' : 'No'}</span>
    </button>
  );
}

export function TextInput({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  return <input className="text" aria-label={label} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
