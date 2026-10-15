import type { BudgetCategory, BudgetSettings } from './types';
import { FALLBACK } from './categorise';

export interface PastedLine { name: string; amount: number }

const SKIP = /^(row labels|grand total|total|category|categories|sum of .*|column labels)$/i;

/** Rows copied from a spreadsheet: "Holiday<TAB>833", "Eating Out, $400", "Bills 300". */
export function parsePastedBudget(text: string): PastedLine[] {
  const out: PastedLine[] = [];
  const seen = new Set<string>();
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)[\s,;:\t]+\(?-?\$?\s*([\d,]+(?:\.\d+)?)\)?\s*$/);
    if (!m) continue;
    const name = m[1].replace(/[\t,;:]+$/, '').trim().replace(/\s+/g, ' ');
    if (!name || SKIP.test(name) || /^\d/.test(name)) continue;
    const amount = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(amount)) continue;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name, amount });
  }
  return out;
}

/** Common names for the built-in categories, so a paste renames them instead of duplicating (keeps keyword matching working). */
const ALIASES: Record<string, string[]> = {
  travel: ['holiday', 'holidays', 'travel', 'trips', 'vacation'],
  dining: ['eating out', 'dining', 'dining out', 'restaurants', 'takeaway', 'dining & takeaway'],
  utilities: ['bills', 'utilities', 'household bills'],
  personal: ['personal care', 'personal', 'beauty'],
  groceries: ['groceries', 'grocery', 'food'],
  alcohol: ['alcohol', 'drinks', 'booze'],
  transport: ['transport', 'transport & fuel', 'fuel', 'car & transport'],
  shopping: ['shopping', 'clothes', 'clothing'],
  gifts: ['gifts', 'gifts & donations', 'presents'],
  home: ['home', 'home & garden', 'house', 'household'],
  entertainment: ['entertainment', 'entertainment & gigs', 'fun', 'gigs'],
  health: ['health', 'medical', 'health & medical'],
  fitness: ['fitness', 'gym'],
  subscriptions: ['subscriptions', 'subs'],
  insurance: ['insurance'],
  phone: ['phone', 'phone & internet', 'internet', 'mobile'],
  coffee: ['coffee'],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';

export interface ApplyResult {
  settings: BudgetSettings; updated: string[]; created: string[]; removed: string[];
  merged: { from: string; to: string; fromId: string; toId: string }[]; // categories folded into a kept one; move their transactions
  zeroed: string[];                                                     // unlisted but in use: kept with no budget
}

/**
 * Set budgets from pasted lines. Matches by name, then by alias to a built-in category (renaming it).
 * With `replace`, spending categories not in the list and not used by any transaction are removed.
 */
export function applyPastedBudget(
  s: BudgetSettings, lines: PastedLine[], opts: { period: 'month' | 'year'; replace: boolean; usedIds: Set<string> },
): ApplyResult {
  const cats = s.categories.map((c) => ({ ...c }));
  const touched = new Set<string>();
  const updated: string[] = []; const created: string[] = [];
  for (const { name, amount } of lines) {
    const k = name.toLowerCase();
    let c = cats.find((x) => x.name.toLowerCase() === k && !touched.has(x.id));
    if (!c) {
      const aliasId = Object.entries(ALIASES).find(([, names]) => names.includes(k))?.[0];
      if (aliasId) c = cats.find((x) => x.id === aliasId && !touched.has(x.id));
    }
    const monthly = opts.period === 'year' ? amount / 12 : amount;
    if (c) {
      c.name = name; c.kind = 'expense'; c.monthly = monthly; c.period = opts.period;
      touched.add(c.id); updated.push(name);
    } else {
      let id = `c-${slug(name)}`;
      for (let n = 2; cats.some((x) => x.id === id); n++) id = `c-${slug(name)}-${n}`;
      const nc: BudgetCategory = { id, name, kind: 'expense', monthly, period: opts.period };
      cats.push(nc); touched.add(id); created.push(name);
    }
  }
  const removed: string[] = [];
  const merged: ApplyResult['merged'] = [];
  const zeroed: string[] = [];
  let next = cats;
  if (opts.replace) {
    const keep = (c: BudgetCategory) => c.kind !== 'expense' || touched.has(c.id) || c.id === 'mortgage';
    const kept = new Set(cats.filter(keep).map((c) => c.id));
    next = cats.filter((c) => {
      if (keep(c)) return true;
      let to: string | undefined = FALLBACK[c.id];
      while (to && !kept.has(to)) to = FALLBACK[to];
      if (to) {
        merged.push({ from: c.name, to: cats.find((x) => x.id === to)!.name, fromId: c.id, toId: to });
        return false;
      }
      if (opts.usedIds.has(c.id)) { c.monthly = 0; zeroed.push(c.name); return true; }
      removed.push(c.name);
      return false;
    });
    // Keep spending categories in the order pasted, then everything else.
    const order = new Map(lines.map((l, i) => [l.name.toLowerCase(), i]));
    const pasted = next.filter((c) => touched.has(c.id)).sort((a, b) => (order.get(a.name.toLowerCase()) ?? 0) - (order.get(b.name.toLowerCase()) ?? 0));
    next = [...pasted, ...next.filter((c) => !touched.has(c.id))];
  }
  const ids = new Set(next.map((c) => c.id));
  const remap = new Map(merged.map((m) => [m.fromId, m.toId]));
  const rules = s.rules.map((r) => (remap.has(r.categoryId) ? { ...r, categoryId: remap.get(r.categoryId)! } : r)).filter((r) => ids.has(r.categoryId));
  return { settings: { ...s, categories: next, rules }, updated, created, removed, merged, zeroed };
}
