import type { BudgetSettings, CatSource } from '../types';
import { SOURCE_LABEL } from '../types';

export function CategorySelect({ value, settings, onChange, label }: {
  value: string | null; settings: BudgetSettings; onChange: (id: string | null) => void; label: string;
}) {
  const groups: [string, string][] = [['expense', 'Spending'], ['income', 'Income'], ['transfer', 'Transfers (not counted)']];
  return (
    <select className={`cat-select${value ? '' : ' empty'}`} aria-label={label} value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Uncategorised</option>
      {groups.map(([k, name]) => (
        <optgroup key={k} label={name}>
          {settings.categories.filter((c) => c.kind === k).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

export function SourceBadge({ source }: { source: CatSource | null }) {
  if (!source) return <span className="badge none">–</span>;
  return <span className={`badge src-${source}`} title={SOURCE_HELP[source]}>{SOURCE_LABEL[source]}</span>;
}

const SOURCE_HELP: Record<CatSource, string> = {
  you: 'You chose this category',
  rule: 'Matched a merchant you or AI categorised before',
  auto: 'Matched a built-in keyword',
  ai: 'Suggested by AI',
};

export const amountClass = (a: number) => (a < 0 ? 'amt out' : 'amt in');
