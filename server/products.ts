import { config } from './config';
import type { Product } from '../src/lib/platform';

/**
 * "Tutor tokens" are input-equivalent tokens: what one tutor turn actually costs us, normalised so that
 * one token = one uncached input token. Output (incl. thinking) costs 5× input on every current Claude
 * model, cache writes 1.25× and cache reads 0.1×. Users see a single honest number.
 */
export function tutorTokens(u: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number | null; cache_read_input_tokens?: number | null }) {
  return Math.ceil(u.input_tokens + 1.25 * (u.cache_creation_input_tokens ?? 0) + 0.1 * (u.cache_read_input_tokens ?? 0) + 5 * u.output_tokens);
}

export function products(): Product[] {
  return [
    {
      id: 'course',
      kind: 'course',
      name: 'Full course',
      priceCents: config.coursePriceCents,
      tokens: config.courseTokens,
      blurb: 'All 13 weeks, exams, capstone, MCP server and bundled tutor tokens. Lifetime access.',
    },
    { id: 'tokens_1m', kind: 'tokens', name: '1M tutor tokens', priceCents: envInt('TOKENS_1M_PRICE_CENTS', 1000), tokens: 1_000_000, blurb: '≈ 100 tutor questions' },
    { id: 'tokens_3m', kind: 'tokens', name: '3M tutor tokens', priceCents: envInt('TOKENS_3M_PRICE_CENTS', 2500), tokens: 3_000_000, blurb: '≈ 300 questions · save 17%' },
    { id: 'tokens_10m', kind: 'tokens', name: '10M tutor tokens', priceCents: envInt('TOKENS_10M_PRICE_CENTS', 7000), tokens: 10_000_000, blurb: '≈ 1,000 questions · save 30%' },
  ];
}

export const productById = (id: string) => products().find((p) => p.id === id);

function envInt(k: string, d: number) {
  const v = Number(process.env[k]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : d;
}
