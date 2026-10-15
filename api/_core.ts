/**
 * Server-side categorisation with an LLM. Only cleaned merchant text and money direction
 * are sent — no dates, amounts, account names or card numbers.
 *
 * Provider is chosen by env vars:
 *   GEMINI_API_KEY (+ optional GEMINI_MODEL)          → Google Gemini
 *   AI_API_KEY (+ optional AI_BASE_URL, AI_MODEL)     → any OpenAI-compatible API (default Groq)
 */

export interface Item { key: string; text: string; direction: 'in' | 'out' }
export interface Category { id: string; name: string; kind: 'expense' | 'income' | 'transfer' }
export interface Result { key: string; categoryId: string | null }

export const MAX_ITEMS = 150;
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_AI_BASE = 'https://api.groq.com/openai/v1';
const DEFAULT_AI_MODEL = 'openai/gpt-oss-120b';

type Env = Record<string, string | undefined>;

export function provider(env: Env): { kind: 'gemini' | 'openai'; model: string } | null {
  if (env.GEMINI_API_KEY) return { kind: 'gemini', model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL };
  if (env.AI_API_KEY) return { kind: 'openai', model: env.AI_MODEL?.trim() || DEFAULT_AI_MODEL };
  return null;
}

export function sanitiseItems(raw: unknown): Item[] {
  if (!Array.isArray(raw)) return [];
  const out: Item[] = [];
  for (const r of raw.slice(0, MAX_ITEMS)) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.key !== 'string' || typeof o.text !== 'string') continue;
    // Belt and braces: drop any long digit runs that slipped through.
    const text = o.text.replace(/\d{4,}/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    out.push({ key: o.key.slice(0, 80), text, direction: o.direction === 'in' ? 'in' : 'out' });
  }
  return out;
}

export function sanitiseCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 80).flatMap((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.name !== 'string') return [];
    const kind = o.kind === 'income' || o.kind === 'transfer' ? o.kind : 'expense';
    return [{ id: o.id.slice(0, 60), name: o.name.slice(0, 60), kind }];
  });
}

export function buildPrompt(items: Item[], cats: Category[]): string {
  return `You categorise Australian bank transactions for a household budget.

Categories (id: name, type):
${cats.map((c) => `- ${c.id}: ${c.name} (${c.kind})`).join('\n')}

Rules:
- Pick the single best category id for each merchant from the list above. Use null if you genuinely can't tell.
- "out" is money spent, "in" is money received. Income categories only fit "in"; refunds can sit in an expense category.
- Payments between the household's own accounts, to credit cards, or into brokers/super are transfer types.
- Use what you know about Australian businesses, chains and suburbs (e.g. Woolworths = groceries, Ampol = fuel).

Return JSON only: {"results":[{"key":"<key exactly as given>","category":"<id or null>"}]}

Merchants (key | description | direction):
${items.map((i) => `${i.key} | ${i.text} | ${i.direction}`).join('\n')}`;
}

export function parseResults(text: string, items: Item[], cats: Category[]): Result[] {
  const valid = new Set(cats.map((c) => c.id));
  const wanted = new Set(items.map((i) => i.key));
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    json = m ? JSON.parse(m[0]) : {};
  }
  const arr = (json as { results?: unknown }).results;
  const out = new Map<string, string | null>();
  if (Array.isArray(arr)) {
    for (const r of arr) {
      const o = (r ?? {}) as Record<string, unknown>;
      if (typeof o.key !== 'string' || !wanted.has(o.key)) continue;
      const c = typeof o.category === 'string' && valid.has(o.category) ? o.category : null;
      out.set(o.key, c);
    }
  }
  return items.map((i) => ({ key: i.key, categoryId: out.get(i.key) ?? null }));
}

export async function callModel(prompt: string, env: Env, fetchImpl: typeof fetch = fetch): Promise<string> {
  const p = provider(env);
  if (!p) throw new Error('No AI key configured');
  if (p.kind === 'gemini') {
    const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? '';
  }
  const base = (env.AI_BASE_URL?.trim() || DEFAULT_AI_BASE).replace(/\/$/, '');
  const res = await fetchImpl(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.AI_API_KEY}` },
    body: JSON.stringify({
      model: p.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Confirms the caller is a signed-in Supabase user. */
export async function verifyUser(authHeader: string | null, env: Env, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const res = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { authorization: `Bearer ${token}`, apikey: anon } });
  return res.ok;
}

export async function handle(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (request.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!provider(env)) return json({ error: 'AI is not set up. Add GEMINI_API_KEY in Vercel.' }, 503);
  if (!(await verifyUser(request.headers.get('authorization'), env, fetchImpl))) return json({ error: 'Sign in again.' }, 401);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return json({ error: 'Bad request' }, 400); }
  const items = sanitiseItems(body.items);
  const cats = sanitiseCategories(body.categories);
  if (!items.length || !cats.length) return json({ results: [] });
  try {
    const text = await callModel(buildPrompt(items, cats), env, fetchImpl);
    return json({ results: parseResults(text, items, cats), model: provider(env)!.model });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /\b429\b/.test(msg) ? 429 : 502;
    return json({ error: status === 429 ? 'The AI free-tier limit was hit. Try again later; remembered merchants still work.' : `AI request failed: ${msg}` }, status);
  }
}
