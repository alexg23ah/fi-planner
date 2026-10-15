import { describe, it, expect, vi } from 'vitest';
import { handle, parseResults, sanitiseItems } from './_core';

const cats = [{ id: 'groceries', name: 'Groceries', kind: 'expense' }, { id: 'salary', name: 'Salary', kind: 'income' }];
const items = [{ key: 'WOOLWORTHS METRO', text: 'WOOLWORTHS METRO NEWTOWN', direction: 'out' }, { key: 'ACME PTY', text: 'ACME PTY LTD', direction: 'out' }];
const env = { GEMINI_API_KEY: 'g', VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' };

const req = (body: unknown, auth = 'Bearer tok') =>
  new Request('https://app/api/categorise', { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('categorise API', () => {
  it('rejects unknown categories and keys from the model', () => {
    const r = parseResults('```json\n{"results":[{"key":"WOOLWORTHS METRO","category":"groceries"},{"key":"ACME PTY","category":"made-up"},{"key":"OTHER","category":"salary"}]}\n```', items as never, cats as never);
    expect(r).toEqual([{ key: 'WOOLWORTHS METRO', categoryId: 'groceries' }, { key: 'ACME PTY', categoryId: null }]);
  });

  it('strips long digit runs before sending', () => {
    expect(sanitiseItems([{ key: 'K', text: 'SHOP 123456 CARD 9876543', direction: 'out' }])[0].text).toBe('SHOP CARD');
  });

  it('requires a signed-in user', async () => {
    const f = vi.fn(async () => new Response('', { status: 401 }));
    const res = await handle(req({ items, categories: cats }), env, f as unknown as typeof fetch);
    expect(res.status).toBe(401);
  });

  it('calls Gemini and returns validated results', async () => {
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/auth/v1/user')) return new Response('{}', { status: 200 });
      expect(url).toContain('generativelanguage.googleapis.com');
      const sent = JSON.parse(String(init?.body)).contents[0].parts[0].text as string;
      expect(sent).toContain('WOOLWORTHS METRO NEWTOWN');
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"results":[{"key":"WOOLWORTHS METRO","category":"groceries"}]}' }] } }] }));
    });
    const res = await handle(req({ items, categories: cats }), env, f as unknown as typeof fetch);
    expect(await res.json()).toMatchObject({ results: [{ key: 'WOOLWORTHS METRO', categoryId: 'groceries' }, { key: 'ACME PTY', categoryId: null }] });
  });

  it('reports the free-tier limit clearly', async () => {
    const f = vi.fn(async (url: string) => (url.includes('/auth/') ? new Response('{}') : new Response('quota', { status: 429 })));
    const res = await handle(req({ items, categories: cats }), env, f as unknown as typeof fetch);
    expect(res.status).toBe(429);
  });

  it('falls back to an OpenAI-compatible provider (Groq)', async () => {
    const f = vi.fn(async (url: string) => {
      if (url.includes('/auth/')) return new Response('{}');
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"results":[{"key":"ACME PTY","category":"groceries"}]}' } }] }));
    });
    const res = await handle(req({ items, categories: cats }), { ...env, GEMINI_API_KEY: undefined, AI_API_KEY: 'q' }, f as unknown as typeof fetch);
    expect((await res.json()).results[1]).toEqual({ key: 'ACME PTY', categoryId: 'groceries' });
  });
});
