import type { Split, SplitPerson, SplitStatus, Txn } from './types';

export interface SplitEntry { name: string; amount?: number }

/**
 * "emily, Oli $40, sam 12.50" → Emily (equal), Oli ($40), Sam ($12.50).
 * A number after a name fixes that person's share; everyone else splits the rest equally with you.
 */
export function parseSplitInput(input: string): SplitEntry[] {
  const seen = new Set<string>();
  const out: SplitEntry[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const part = raw.trim().replace(/\s+/g, ' ');
    if (!part) continue;
    const m = part.match(/^(.*?)\s*[:=]?\s*\$?\s*(\d+(?:\.\d{1,2})?)\s*$/);
    const rawName = (m && m[1] ? m[1] : part).trim();
    if (!rawName || /^(me|myself|i)$/i.test(rawName)) continue;
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(m && m[1] ? { name, amount: Number(m[2]) } : { name });
  }
  return out;
}

/** Names only (kept for callers that don't need amounts). */
export const parseNames = (input: string) => parseSplitInput(input).map((e) => e.name);

/** New split from typed entries, keeping the status of anyone already on it. */
export function buildSplit(prev: Split | null, entries: (SplitEntry | string)[]): Split | null {
  if (!entries.length) return null;
  const old = new Map((prev?.people ?? []).map((p) => [p.name.toLowerCase(), p]));
  return {
    people: entries.map((e) => {
      const { name, amount } = typeof e === 'string' ? { name: e, amount: undefined } : e;
      const base: SplitPerson = old.get(name.toLowerCase()) ?? { name, status: 'owed' };
      const next: SplitPerson = { name: base.name, status: base.status };
      if (base.at) next.at = base.at;
      if (amount !== undefined) next.amount = amount;
      return next;
    }),
  };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
export const splitText = (s: Split | null) =>
  s ? s.people.map((p) => (p.amount !== undefined ? `${p.name} $${fmt(p.amount)}` : p.name)).join(', ') : '';

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Each person's share and yours. Fixed amounts come off first; the rest is split equally
 * between you and everyone without a fixed amount. You absorb rounding.
 */
export function shares(amount: number, split: Split | null): { each: number; mine: number; byName: Map<string, number>; custom: boolean; over: boolean } {
  const total = Math.abs(amount);
  const byName = new Map<string, number>();
  if (!split?.people.length) return { each: 0, mine: total, byName, custom: false, over: false };
  const fixed = split.people.filter((p) => p.amount !== undefined);
  const equal = split.people.filter((p) => p.amount === undefined);
  const fixedSum = r2(fixed.reduce((a, p) => a + (p.amount ?? 0), 0));
  const rest = Math.max(0, total - fixedSum);
  const each = r2(rest / (equal.length + 1));
  for (const p of fixed) byName.set(p.name.toLowerCase(), r2(p.amount ?? 0));
  for (const p of equal) byName.set(p.name.toLowerCase(), each);
  const others = [...byName.values()].reduce((a, v) => a + v, 0);
  return { each, mine: r2(total - others), byName, custom: fixed.length > 0, over: fixedSum > total + 0.005 };
}

export const shareOf = (amount: number, split: Split, name: string) => shares(amount, split).byName.get(name.toLowerCase()) ?? 0;

/** The transaction amount that's yours (signed). Splits only apply to money out. */
export function myAmount(t: Pick<Txn, 'amount' | 'split'>): number {
  if (t.amount >= 0 || !t.split?.people.length) return t.amount;
  return -shares(t.amount, t.split).mine;
}

export function setStatus(split: Split, name: string, status: SplitStatus, today: string): Split {
  return {
    people: split.people.map((p) => (p.name.toLowerCase() === name.toLowerCase()
      ? { ...p, status, at: status === 'owed' ? undefined : today } : p)),
  };
}

export interface PersonLine { txn: Txn; share: number; person: SplitPerson }
export interface PersonSummary { name: string; owed: number; requested: number; paid: number; lines: PersonLine[] }

export function owedByPerson(txns: Txn[]): PersonSummary[] {
  const map = new Map<string, PersonSummary>();
  for (const t of txns) {
    if (t.amount >= 0 || !t.split?.people.length) continue;
    const { byName } = shares(t.amount, t.split);
    for (const p of t.split.people) {
      const each = byName.get(p.name.toLowerCase()) ?? 0;
      const k = p.name.toLowerCase();
      const s = map.get(k) ?? { name: p.name, owed: 0, requested: 0, paid: 0, lines: [] };
      s[p.status] = Math.round((s[p.status] + each) * 100) / 100;
      s.lines.push({ txn: t, share: each, person: p });
      map.set(k, s);
    }
  }
  return [...map.values()].sort((a, b) => b.owed + b.requested - (a.owed + a.requested) || a.name.localeCompare(b.name));
}

export function knownNames(txns: Txn[]): string[] {
  const m = new Map<string, string>();
  for (const t of txns) for (const p of t.split?.people ?? []) m.set(p.name.toLowerCase(), p.name);
  return [...m.values()].sort();
}

/** A message to paste into a text, listing what's outstanding. */
export function requestMessage(s: PersonSummary, money: (n: number) => string): string {
  const open = s.lines.filter((l) => l.person.status !== 'paid');
  const total = open.reduce((a, l) => a + l.share, 0);
  const items = open.map((l) => `- ${l.txn.date.slice(8)}/${l.txn.date.slice(5, 7)} ${l.txn.note ? l.txn.note : tidy(l.txn.description)}: ${money(l.share)}`);
  return `Hey ${s.name}, here's your share of a few things:\n${items.join('\n')}\nTotal ${money(total)}. Thanks!`;
}

const tidy = (d: string) => d.replace(/\b(card|value date)\b.*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 40);
