const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export const money = (v: number) => (Math.abs(v) < 0.5 ? '–' : v < 0 ? `(${aud.format(-v)})` : aud.format(v));

export const compact = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}m`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}k`;
  return `${s}$${Math.round(a)}`;
};

export const pct = (v: number, dp = 1) => `${(v * 100).toFixed(dp)}%`;

const audCents = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Dollars and cents, for amounts people pay each other back. */
export const cents = (v: number) => (Math.abs(v) < 0.005 ? '–' : v < 0 ? `(${audCents.format(-v)})` : audCents.format(v));
