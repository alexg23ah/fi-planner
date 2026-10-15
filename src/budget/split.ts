import type { Split, SplitPerson, SplitStatus, Txn } from './types';

/** "emily, Oli ,  sam" → ["Emily", "Oli", "Sam"], de-duplicated case-insensitively. */
export function parseNames(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,;\n]+/)) {
    const n = raw.trim().replace(/\s+/g, ' ');
    if (!n || /^(me|myself|i)$/i.test(n)) continue;
    const name = n.charAt(0).toUpperCase() + n.slice(1);
    const k = name.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(name); }
  }
  return out;
}

/** New split from typed names, keeping the status of anyone already on it. */
export function buildSplit(prev: Split | null, names: string[]): Split | null {
  if (!names.length) return null;
  const old = new Map((prev?.people ?? []).map((p) => [p.name.toLowerCase(), p]));
  return { people: names.map((name) => old.get(name.toLowerCase()) ?? { name, status: 'owed' }) };
}

export const splitText = (s: Split | null) => (s ? s.people.map((p) => p.name).join(', ') : '');

/** Equal split between you and everyone named. Others round to cents; you absorb the rounding. */
export function shares(amount: number, split: Split | null): { each: number; mine: number } {
  const total = Math.abs(amount);
  if (!split?.people.length) return { each: 0, mine: total };
  const each = Math.round((total / (split.people.length + 1)) * 100) / 100;
  return { each, mine: Math.round((total - each * split.people.length) * 100) / 100 };
}

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
    const { each } = shares(t.amount, t.split);
    for (const p of t.split.people) {
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
  const items = open.map((l) => `- ${l.txn.date.slice(8)}/${l.txn.date.slice(5, 7)} ${tidy(l.txn.description)}: ${money(l.share)}`);
  return `Hey ${s.name}, here's your share of a few things:\n${items.join('\n')}\nTotal ${money(total)}. Thanks!`;
}

const tidy = (d: string) => d.replace(/\b(card|value date)\b.*$/i, '').replace(/\s+/g, ' ').trim().slice(0, 40);
