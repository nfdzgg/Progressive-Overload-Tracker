// @vitest-environment node
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { checkCss, checkTs } from './check-design-tokens.mjs';

describe('design token check', () => {
  it('accepts token-only CSS', () => {
    const css = `.card { padding: var(--space-md); color: var(--color-ink); margin: 0; }
@media (min-width: 768px) { .card { width: 50%; } }`;
    expect(checkCss(css)).toEqual([]);
  });

  it('flags raw colors, lengths, fonts', () => {
    const css = `.a { color: #fff; }
.b { background: rgba(0, 0, 0, 0.5); }
.c { padding: 12px; }
.d { font-family: Inter; }
.e { font-weight: 500; }`;
    expect(checkCss(css).map((p: { line: number }) => p.line)).toEqual([1, 2, 3, 4, 5]);
  });

  it('flags raw values in feature TypeScript but not comments', () => {
    const ts = `const a = { color: '#5e6ad2' };
// a comment with 12px is fine
const b = { width: '12px' };`;
    expect(checkTs(ts).map((p: { line: number }) => p.line)).toEqual([1, 3]);
  });
});
