import type { BudgetSettings, CatSource, MerchantRule, Txn } from './types';
import { KEYWORD_RULES } from './defaults';
import { cleanDescription, merchantKey } from './merchant';

export const FALLBACK: Record<string, string> = {
  coffee: 'dining', phone: 'utilities', insurance: 'utilities', car: 'transport', subscriptions: 'entertainment',
  fitness: 'personal', health: 'personal', education: 'other', fees: 'other', alcohol: 'dining', home: 'shopping',
};

export interface Decision { categoryId: string | null; source: CatSource | null }

/** Your remembered rules first (longest pattern wins), then built-in keywords. */
export function categoriseLocal(description: string, amount: number, settings: BudgetSettings): Decision {
  const clean = cleanDescription(description);
  const valid = new Set(settings.categories.map((c) => c.id));
  let best: MerchantRule | null = null;
  for (const r of settings.rules) {
    if (!valid.has(r.categoryId) || !r.pattern) continue;
    if (clean.includes(r.pattern) && (!best || r.pattern.length > best.pattern.length)) best = r;
  }
  if (best) return { categoryId: best.categoryId, source: 'rule' };
  const dir = amount < 0 ? 'out' : 'in';
  for (const k of KEYWORD_RULES) {
    if (k.dir && k.dir !== dir) continue;
    if (!k.re.test(clean)) continue;
    // If you've removed the built-in category, fall back to the nearest one you kept.
    let id: string | undefined = k.cat;
    while (id && !valid.has(id)) id = FALLBACK[id];
    if (id) return { categoryId: id, source: 'auto' };
  }
  return { categoryId: null, source: null };
}

export interface AiItem { key: string; text: string; direction: 'in' | 'out' }

/** One item per merchant still uncategorised — what gets sent to AI. Only cleaned merchant text and direction. */
export function aiItemsFor(txns: { description: string; amount: number; categoryId: string | null }[]): AiItem[] {
  const seen = new Map<string, AiItem>();
  for (const t of txns) {
    if (t.categoryId) continue;
    const key = merchantKey(t.description);
    if (!seen.has(key)) seen.set(key, { key, text: cleanDescription(t.description).slice(0, 120), direction: t.amount < 0 ? 'out' : 'in' });
  }
  return [...seen.values()];
}

/** Add or replace the rule for a merchant. A rule you set always beats an AI one. */
export function upsertRule(settings: BudgetSettings, pattern: string, categoryId: string, origin: 'you' | 'ai', id: string): BudgetSettings {
  const p = pattern.trim().toUpperCase();
  const existing = settings.rules.find((r) => r.pattern === p);
  if (existing && existing.origin === 'you' && origin === 'ai') return settings;
  const rules = existing
    ? settings.rules.map((r) => (r.pattern === p ? { ...r, categoryId, origin } : r))
    : [...settings.rules, { id, pattern: p, categoryId, origin }];
  return { ...settings, rules };
}

/** Transactions (other than ones you set by hand) that share a merchant key. */
export function sameMerchant(txns: Txn[], description: string): Txn[] {
  const key = merchantKey(description);
  return txns.filter((t) => t.source !== 'you' && merchantKey(t.description) === key);
}
