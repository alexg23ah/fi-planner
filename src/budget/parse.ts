/**
 * Turns pasted bank data or a CSV export into transactions.
 * Handles CommBank (no header: date, amount, description, balance), NAB, Macquarie
 * (debit/credit columns), Easy Street and copy-pasted web-banking tables (tabs).
 * Column detection is automatic; the import screen lets the user override it.
 */

export interface ParsedTable {
  rows: string[][];
  header: string[] | null;
  delimiter: string;
}

export interface ColumnMap {
  date: number;
  description: number;
  amount: number | null;   // single signed amount column
  debit: number | null;    // or separate debit / credit columns
  credit: number | null;
}

export interface ParsedTxn {
  date: string;            // yyyy-mm-dd
  description: string;
  amount: number;          // negative = money out
}

export interface ParseResult {
  txns: ParsedTxn[];
  skipped: number;         // rows that couldn't be read
  map: ColumnMap;
  table: ParsedTable;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const fullYear = (y: number) => (y < 100 ? 2000 + y : y);
const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100;

/** Australian day-first dates. Returns yyyy-mm-dd or null. */
export function parseDate(raw: string): string | null {
  const s = raw.trim().replace(/^"|"$/g, '');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { const [y, mo, d] = [+m[1], +m[2], +m[3]]; return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const [d, mo, y] = [+m[1], +m[2], fullYear(+m[3])]; return valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null; }
  m = s.match(/^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})[\s-]+([A-Za-z]{3,9})\.?[\s-]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, m[2].length >= 4 && m[2].toLowerCase().startsWith('sept') ? 4 : 3)];
    const [d, y] = [+m[1], fullYear(+m[3])];
    return mo && valid(y, mo, d) ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  return null;
}

/** "$1,234.56", "-45.20", "(45.20)", "45.20 DR", "+12.00", "45.20 CR". */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/^"|"$/g, '').replace(/\s+/g, ' ');
  if (!s) return null;
  let sign = 1;
  if (/\bDR$/i.test(s)) { sign = -1; s = s.replace(/\s*DR$/i, ''); }
  else if (/\bCR$/i.test(s)) { s = s.replace(/\s*CR$/i, ''); }
  if (/^\(.*\)$/.test(s)) { sign = -sign; s = s.slice(1, -1); }
  s = s.replace(/[$\s,]|AUD/gi, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('-')) { sign = -sign; s = s.slice(1); }
  if (s.startsWith('$')) s = s.slice(1);
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
  return sign * Number(s);
}

/** CSV/TSV splitter that respects quotes. */
export function splitTable(text: string): ParsedTable {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  const sample = lines.slice(0, 20).join('\n');
  const count = (c: string) => (sample.match(new RegExp(c === '\t' ? '\t' : `\\${c}`, 'g')) || []).length;
  const delimiter = count('\t') >= Math.max(1, lines.slice(0, 20).length) ? '\t'
    : count(',') >= count(';') ? ',' : ';';
  const rows = lines.map((line) => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === delimiter) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
  const first = rows[0] ?? [];
  const isHeader = first.some((c) => /date/i.test(c)) && !first.some((c) => parseDate(c));
  return isHeader ? { rows: rows.slice(1), header: first, delimiter } : { rows, header: null, delimiter };
}

const findHeader = (h: string[], ...pats: RegExp[]) => {
  for (const p of pats) { const i = h.findIndex((c) => p.test(c.trim())); if (i >= 0) return i; }
  return -1;
};

export function detectColumns(t: ParsedTable): ColumnMap {
  const width = Math.max(0, ...t.rows.slice(0, 50).map((r) => r.length));
  const sample = t.rows.slice(0, 50);
  const share = (i: number, f: (s: string) => boolean) => {
    const vals = sample.map((r) => r[i] ?? '').filter((v) => v !== '');
    return vals.length ? vals.filter(f).length / vals.length : 0;
  };

  if (t.header) {
    const h = t.header;
    const date = findHeader(h, /^(transaction )?date$/i, /^date/i, /date/i);
    const debit = findHeader(h, /^debit/i, /withdrawal/i, /money out/i, /^paid out/i);
    const credit = findHeader(h, /^credit/i, /deposit/i, /money in/i, /^paid in/i);
    const amount = debit >= 0 && credit >= 0 ? -1 : findHeader(h, /^amount/i, /amount/i, /^value$/i);
    let description = findHeader(h, /^original description/i, /^transaction details/i, /^narrative/i, /^description/i, /^details/i, /description|details|narration|particulars|payee|merchant name/i);
    if (description < 0) description = bestTextColumn(sample, width, [date, amount, debit, credit]);
    if (date >= 0 && description >= 0 && (amount >= 0 || (debit >= 0 && credit >= 0))) {
      return { date, description, amount: amount >= 0 ? amount : null, debit: amount >= 0 ? null : debit, credit: amount >= 0 ? null : credit };
    }
  }

  // No usable header: infer from values.
  let date = 0;
  for (let i = 0; i < width; i++) if (share(i, (v) => parseDate(v) !== null) > 0.8) { date = i; break; }
  const fill = (i: number) => sample.filter((r) => (r[i] ?? '') !== '').length / Math.max(1, sample.length);
  const numeric = [...Array(width).keys()].filter((i) => i !== date && fill(i) > 0 && share(i, (v) => parseAmount(v) !== null) > 0.9);
  const dense = numeric.filter((i) => fill(i) > 0.95);
  const sparse = numeric.filter((i) => fill(i) <= 0.95);
  let amount: number | null = null;
  let debit: number | null = null;
  let credit: number | null = null;
  if (sparse.length >= 2) {
    // Pasted web-banking tables: separate debit and credit columns, each blank when unused.
    [debit, credit] = sparse;
  } else {
    // CommBank etc: signed amount before the running balance. Prefer a column with negatives.
    const withNeg = dense.filter((i) => share(i, (v) => (parseAmount(v) ?? 0) < 0) > 0);
    amount = withNeg[0] ?? dense[0] ?? sparse[0] ?? null;
  }
  const description = bestTextColumn(sample, width, [date, ...numeric]);
  return { date, description, amount, debit, credit };
}

function bestTextColumn(sample: string[][], width: number, exclude: number[]): number {
  let best = -1;
  let bestLen = -1;
  for (let i = 0; i < width; i++) {
    if (exclude.includes(i)) continue;
    const vals = sample.map((r) => r[i] ?? '');
    const textish = vals.filter((v) => /[A-Za-z]{3,}/.test(v) && parseDate(v) === null).length / Math.max(1, vals.length);
    const avg = vals.reduce((a, v) => a + v.length, 0) / Math.max(1, vals.length);
    if (textish > 0.5 && avg > bestLen) { best = i; bestLen = avg; }
  }
  if (best >= 0) return best;
  for (let i = 0; i < width; i++) if (!exclude.includes(i)) return i;
  return 0;
}

export function applyMap(t: ParsedTable, map: ColumnMap, flipSign = false): { txns: ParsedTxn[]; skipped: number } {
  const txns: ParsedTxn[] = [];
  let skipped = 0;
  for (const r of t.rows) {
    const date = parseDate(r[map.date] ?? '');
    const description = (r[map.description] ?? '').replace(/\s+/g, ' ').trim();
    let amount: number | null = null;
    if (map.amount !== null) amount = parseAmount(r[map.amount] ?? '');
    else if (map.debit !== null && map.credit !== null) {
      const d = parseAmount(r[map.debit] ?? '');
      const c = parseAmount(r[map.credit] ?? '');
      if (d !== null && d !== 0) amount = -Math.abs(d);
      else if (c !== null && c !== 0) amount = Math.abs(c);
      else if (d === 0 || c === 0) amount = 0;
    }
    if (!date || !description || amount === null) { skipped++; continue; }
    txns.push({ date, description, amount: flipSign ? -amount : amount });
  }
  return { txns, skipped };
}

export function parseBankText(text: string, opts: { map?: ColumnMap; flipSign?: boolean } = {}): ParseResult {
  const table = splitTable(text);
  const map = opts.map ?? detectColumns(table);
  const { txns, skipped } = applyMap(table, map, opts.flipSign);
  return { txns, skipped, map, table };
}

/** Stable de-duplication key. `n` separates identical same-day transactions. */
export function txnHash(t: ParsedTxn, account: string, n: number): string {
  const desc = t.description.toUpperCase().replace(/\s+/g, ' ').trim();
  return `${t.date}|${t.amount.toFixed(2)}|${desc}|${account.trim().toLowerCase()}|${n}`;
}

export function withHashes<T extends ParsedTxn>(txns: T[], account: string): (T & { hash: string })[] {
  const seen = new Map<string, number>();
  return txns.map((t) => {
    const base = txnHash(t, account, 0);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return { ...t, hash: txnHash(t, account, n) };
  });
}
