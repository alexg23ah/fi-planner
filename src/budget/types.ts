export type CategoryKind = 'expense' | 'income' | 'transfer';
/** How a transaction got its category. */
export type CatSource = 'you' | 'rule' | 'auto' | 'ai';

export interface BudgetCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  monthly: number; // budget per month (expense) or expected per month (income); ignored for transfers
}

export interface MerchantRule {
  id: string;
  pattern: string;          // upper-case text matched inside the cleaned description
  categoryId: string;
  origin: 'you' | 'ai';     // who decided it
}

export interface BudgetSettings {
  version: 1;
  categories: BudgetCategory[];
  rules: MerchantRule[];
  aiEnabled: boolean;
  accounts: string[];
}

export interface Txn {
  id: string;
  date: string;             // yyyy-mm-dd
  description: string;
  amount: number;           // negative = money out
  account: string;
  categoryId: string | null;
  source: CatSource | null;
  hash: string;
}

export type NewTxn = Omit<Txn, 'id'>;

export const SOURCE_LABEL: Record<CatSource, string> = {
  you: 'You',
  rule: 'Remembered',
  auto: 'Keyword',
  ai: 'AI',
};
