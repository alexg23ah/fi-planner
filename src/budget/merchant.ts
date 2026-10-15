/**
 * Bank descriptions carry noise: card numbers, value dates, terminal IDs, locations.
 * `cleanDescription` strips the noise (also used before anything is sent to AI);
 * `merchantKey` reduces it to a short, stable name used to remember categories.
 */

const NOISE: RegExp[] = [
  /\bvalue date:?\s*\d{1,2}\/\d{1,2}\/\d{2,4}/gi,
  /\bcard\s*(?:no\.?|number)?\s*x*\d{2,}/gi,
  /\bx{2,}\d+/gi,
  /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  /\b\d{1,2}:\d{2}(?::\d{2})?\b/g,
  /\b(?:ref(?:erence)?|receipt|trace|auth(?:orisation)?|terminal|txn)\s*(?:no\.?|#|:)?\s*[\w-]*\d[\w-]*/gi,
  /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,
  /\b\d{4,}\b/g,
  /\bAUD\s*[\d.,]+/gi,
];

const PREFIXES = [
  'VISA DEBIT PURCHASE CARD', 'VISA PURCHASE', 'VISA DEBIT PURCHASE', 'EFTPOS PURCHASE', 'DEBIT CARD PURCHASE',
  'CARD PURCHASE', 'POS AUTHORISATION', 'POS PURCHASE', 'PURCHASE AUTHORISATION', 'TAP AND PAY', 'TAP & PAY',
  'EFTPOS', 'PURCHASE', 'DIRECT DEBIT', 'DD ', 'SQ ', 'ZLR ', 'SP ', 'PP ', 'LS ', 'IZ ', 'PENDING',
];

const LOCATION_TAIL = /\s+(?:AU|AUS|AUSTRALIA|NSW|VIC|QLD|SA|WA|TAS|ACT|NT|NS|NSWAU|SYDNEY)$/;

export function cleanDescription(raw: string): string {
  let s = ` ${raw} `;
  for (const re of NOISE) s = s.replace(re, ' ');
  s = s.toUpperCase().replace(/[*#_|]+/g, ' ').replace(/\s+/g, ' ').trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PREFIXES) {
      if (s.startsWith(p) && s.length > p.length + 2) { s = s.slice(p.length).trim(); changed = true; }
    }
    const t = s.replace(LOCATION_TAIL, '');
    if (t !== s && t.length > 2) { s = t; changed = true; }
  }
  return s.replace(/[.,:;-]+$/g, '').trim();
}

export function merchantKey(raw: string): string {
  const words = cleanDescription(raw).split(' ').filter((w) => /[A-Z]/.test(w));
  if (words.length > 2 && words[0] === 'THE') words.shift();
  if (!words.length) return cleanDescription(raw) || raw.trim().toUpperCase();
  const n = words[0].length <= 2 && words.length > 2 ? 3 : 2;
  return words.slice(0, n).join(' ');
}
