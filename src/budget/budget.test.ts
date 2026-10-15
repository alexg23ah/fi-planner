import { describe, it, expect } from 'vitest';
import { parseBankText, parseDate, parseAmount, withHashes } from './parse';
import { cleanDescription, merchantKey } from './merchant';
import { categoriseLocal, aiItemsFor, upsertRule } from './categorise';
import { defaultBudgetSettings } from './defaults';

describe('dates and amounts', () => {
  it('reads Australian formats', () => {
    expect(parseDate('13/10/2026')).toBe('2026-10-13');
    expect(parseDate('3/1/26')).toBe('2026-01-03');
    expect(parseDate('13 Oct 26')).toBe('2026-10-13');
    expect(parseDate('13-Oct-2026')).toBe('2026-10-13');
    expect(parseDate('Mon, 13 October 2026')).toBe('2026-10-13');
    expect(parseDate('2 Sept 2026')).toBe('2026-09-02');
    expect(parseDate('2026-10-13')).toBe('2026-10-13');
    expect(parseDate('WOOLWORTHS')).toBeNull();
  });
  it('reads amounts', () => {
    expect(parseAmount('-45.20')).toBe(-45.2);
    expect(parseAmount('"+1,234.56"')).toBe(1234.56);
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('-$12.00')).toBe(-12);
    expect(parseAmount('(45.20)')).toBe(-45.2);
    expect(parseAmount('45.20 DR')).toBe(-45.2);
    expect(parseAmount('45.20 CR')).toBe(45.2);
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('bank formats', () => {
  it('CommBank CSV (no header, amount then description then balance)', () => {
    const csv = `13/10/2026,"-45.20","WOOLWORTHS 1234 MARRICKVILLE AU Card xx1234 Value Date: 11/10/2026","+1,234.56"
14/10/2026,"+5,000.00","Salary ENERGIZER AUSTRALIA","+6,234.56"
14/10/2026,"-6.50","SQ *BLACKSTAR COFFEE NEWTOWN AU Card xx1234","+6,228.06"`;
    const r = parseBankText(csv);
    expect(r.txns).toHaveLength(3);
    expect(r.txns[0]).toEqual({ date: '2026-10-13', amount: -45.2, description: expect.stringContaining('WOOLWORTHS') });
    expect(r.txns[1].amount).toBe(5000);
  });
  it('NAB CSV with header', () => {
    const csv = `Date,Amount,Account Number,,Transaction Type,Transaction Details,Balance,Category,Merchant Name,Processed On
13 Oct 26,-12.50,123456789,,EFTPOS DEBIT,SQ *BLACKSTAR COFFEE NEWTOWN,1500.00,Food,Blackstar Coffee,14 Oct 26
14 Oct 26,250.00,123456789,,TRANSFER CREDIT,TRANSFER FROM A SMITH,1750.00,Transfers,,14 Oct 26`;
    const r = parseBankText(csv);
    expect(r.txns).toMatchObject([
      { date: '2026-10-13', amount: -12.5, description: 'SQ *BLACKSTAR COFFEE NEWTOWN' },
      { date: '2026-10-14', amount: 250, description: 'TRANSFER FROM A SMITH' },
    ]);
  });
  it('Macquarie CSV with debit and credit columns', () => {
    const csv = `Transaction Date,Details,Account,Category,Subcategory,Tags,Notes,Debit,Credit,Balance,Original Description
13 Oct 2026,Netflix,Everyday,,,,,22.99,,1000.00,NETFLIX.COM MELBOURNE AU
14 Oct 2026,Interest,Everyday,,,,,,4.12,1004.12,CREDIT INTEREST`;
    const r = parseBankText(csv);
    expect(r.txns.map((t) => t.amount)).toEqual([-22.99, 4.12]);
    expect(r.txns[0].description).toBe('NETFLIX.COM MELBOURNE AU');
  });
  it('generic header (Easy Street style)', () => {
    const csv = `Date,Description,Debit,Credit,Balance
13/10/2026,BUNNINGS 123 ASHFIELD,89.00,,911.00
14/10/2026,PAY ENERGIZER,,3000.00,3911.00`;
    expect(parseBankText(csv).txns.map((t) => t.amount)).toEqual([-89, 3000]);
  });
  it('pasted web-banking table with tabs and blank debit/credit cells', () => {
    const txt = `13 Oct 2026\tWOOLWORTHS METRO NEWTOWN\t45.20\t\t1,000.00
14 Oct 2026\tSALARY ENERGIZER\t\t5,000.00\t6,000.00
15 Oct 2026\tOPAL TRANSPORTFORNSW\t3.20\t\t5,996.80`;
    const r = parseBankText(txt);
    expect(r.txns.map((t) => t.amount)).toEqual([-45.2, 5000, -3.2]);
    expect(r.txns[1].description).toBe('SALARY ENERGIZER');
  });
  it('flips sign when spending is shown as positive', () => {
    const txt = `13/10/2026\tCOLES 0812 SYDNEY\t45.20`;
    expect(parseBankText(txt, { flipSign: true }).txns[0].amount).toBe(-45.2);
  });
  it('hashes identical same-day transactions separately', () => {
    const t = { date: '2026-10-13', description: 'COFFEE', amount: -5 };
    const h = withHashes([t, t], 'CBA');
    expect(h[0].hash).not.toBe(h[1].hash);
    expect(withHashes([t], 'CBA')[0].hash).toBe(h[0].hash);
  });
});

describe('merchant cleaning', () => {
  it('strips card and date noise', () => {
    expect(cleanDescription('WOOLWORTHS 1234 MARRICKVILLE AU Card xx1234 Value Date: 11/10/2026')).toBe('WOOLWORTHS MARRICKVILLE');
    expect(cleanDescription('SQ *BLACKSTAR COFFEE NEWTOWN AU')).toBe('BLACKSTAR COFFEE NEWTOWN');
    expect(cleanDescription('VISA PURCHASE UBER *EATS HELP.UBER.COM AU Card 4567')).toContain('UBER EATS');
  });
  it('keys by merchant', () => {
    expect(merchantKey('WOOLWORTHS 1234 MARRICKVILLE AU Card xx1234')).toBe('WOOLWORTHS MARRICKVILLE');
    expect(merchantKey('UBER *TRIP HELP.UBER.COM')).toBe('UBER TRIP');
  });
});

describe('categorising', () => {
  const s = defaultBudgetSettings();
  it('built-in keywords', () => {
    expect(categoriseLocal('WOOLWORTHS 1234 MARRICKVILLE', -45, s)).toEqual({ categoryId: 'groceries', source: 'auto' });
    expect(categoriseLocal('UBER *EATS HELP.UBER.COM', -30, s).categoryId).toBe('dining');
    expect(categoriseLocal('UBER *TRIP HELP.UBER.COM', -18, s).categoryId).toBe('transport');
    expect(categoriseLocal('SQ *BLACKSTAR COFFEE', -6, s).categoryId).toBe('coffee');
    expect(categoriseLocal('Salary ENERGIZER AUSTRALIA', 5000, s).categoryId).toBe('salary');
    expect(categoriseLocal('NETFLIX.COM MELBOURNE AU', -23, s).categoryId).toBe('subscriptions');
    expect(categoriseLocal('TRANSFER TO XX1234 SAVINGS', -500, s).categoryId).toBe('transfers');
    expect(categoriseLocal('MYSTERY PTY LTD', -10, s)).toEqual({ categoryId: null, source: null });
  });
  it('your rules beat keywords, longest pattern wins', () => {
    let st = upsertRule(s, 'WOOLWORTHS', 'other', 'you', 'r1');
    st = upsertRule(st, 'WOOLWORTHS METRO', 'dining', 'you', 'r2');
    expect(categoriseLocal('WOOLWORTHS 1234 MARRICKVILLE', -45, st)).toEqual({ categoryId: 'other', source: 'rule' });
    expect(categoriseLocal('WOOLWORTHS METRO NEWTOWN', -9, st).categoryId).toBe('dining');
  });
  it('AI never overwrites your rule', () => {
    const st = upsertRule(s, 'ACME', 'other', 'you', 'r1');
    expect(upsertRule(st, 'ACME', 'shopping', 'ai', 'r2').rules[0].categoryId).toBe('other');
  });
  it('sends one cleaned item per unknown merchant', () => {
    const items = aiItemsFor([
      { description: 'MYSTERY PTY LTD 4455 Card xx1234', amount: -10, categoryId: null },
      { description: 'MYSTERY PTY LTD 9988 Card xx1234', amount: -12, categoryId: null },
      { description: 'COLES', amount: -5, categoryId: 'groceries' },
    ]);
    expect(items).toEqual([{ key: 'MYSTERY PTY', text: 'MYSTERY PTY LTD', direction: 'out' }]);
  });
});

describe('category and notes columns', () => {
  it('reads optional Category and Notes columns by header', () => {
    const csv = `Date,Description,Amount,Category,Notes
13/10/2026,WOOLWORTHS MARRICKVILLE,-45.20,Groceries,
15/10/2026,THE GREEK CLUB,-102.88,Eating out,Oli birthday dinner`;
    const r = parseBankText(csv);
    expect(r.map.category).toBe(3);
    expect(r.map.note).toBe(4);
    expect(r.txns[0]).toEqual({ date: '2026-10-13', description: 'WOOLWORTHS MARRICKVILLE', amount: -45.2, category: 'Groceries' });
    expect(r.txns[1]).toMatchObject({ category: 'Eating out', note: 'Oli birthday dinner' });
  });
  it('NAB bank category column is detected but can be switched off', () => {
    const csv = `Date,Amount,Account Number,,Transaction Type,Transaction Details,Balance,Category,Merchant Name,Processed On
13 Oct 26,-12.50,123456789,,EFTPOS DEBIT,SQ *BLACKSTAR COFFEE NEWTOWN,1500.00,Food,Blackstar Coffee,14 Oct 26`;
    const r = parseBankText(csv);
    expect(r.txns[0].category).toBe('Food');
    expect(parseBankText(csv, { map: { ...r.map, category: null } }).txns[0].category).toBeUndefined();
  });
});

import { summariseYear, categoryBudgetToDate } from './summary';

describe('year summary', () => {
  const settings = defaultBudgetSettings();
  const cat = (id: string) => settings.categories.find((c) => c.id === id)!;
  const t = (date: string, amount: number, categoryId: string | null) =>
    ({ id: date + amount, date, description: 'X', amount, account: '', categoryId, source: null, hash: date + amount, split: null, note: '' });
  it('totals a calendar year and pro-rates budgets to date', () => {
    const txns = [t('2026-01-05', -100, 'groceries'), t('2026-03-02', -50, 'groceries'), t('2026-03-15', 3000, 'salary'), t('2025-12-30', -999, 'groceries')];
    const s = summariseYear(txns, settings, '2026', '2026-03');
    expect(s.spent).toBe(150);
    expect(s.income).toBe(3000);
    expect(s.monthsElapsed).toBe(3);
    expect(s.monthsWithData).toBe(2);
    expect(s.byCategory.get('groceries')).toBe(150);
    expect(summariseYear(txns, settings, '2025', '2026-03').monthsElapsed).toBe(12);
  });
  it('counts yearly budgets in full once the year starts', () => {
    expect(categoryBudgetToDate({ monthly: 100 }, 3)).toBe(300);
    expect(categoryBudgetToDate({ monthly: 100, period: 'year' }, 3)).toBe(1200);
    expect(categoryBudgetToDate({ monthly: 100, period: 'year' }, 0)).toBe(0);
    expect(cat('groceries')).toBeTruthy();
  });
});
