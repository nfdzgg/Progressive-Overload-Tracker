// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { extractFrontMatter, generateTokensCss } from './generate-tokens.mjs';

const root = new URL('../', import.meta.url);
const designMd = readFileSync(new URL('DESIGN.md', root), 'utf8');
const tokensCss = readFileSync(new URL('src/design/tokens.css', root), 'utf8');

describe('design tokens', () => {
  it('tokens.css is in sync with DESIGN.md (run `npm run tokens`)', () => {
    expect(tokensCss).toBe(generateTokensCss(designMd));
  });

  it('parses every color, type, radius, and spacing token', () => {
    const tokens = extractFrontMatter(designMd);
    for (const [name, value] of Object.entries(tokens.colors as Record<string, string>)) {
      expect(tokensCss).toContain(`--color-${name}: ${value};`);
    }
    for (const name of Object.keys(tokens.typography)) {
      expect(tokensCss).toContain(`--type-${name}:`);
    }
    for (const [name, value] of Object.entries(tokens.rounded as Record<string, string>)) {
      expect(tokensCss).toContain(`--radius-${name}: ${value};`);
    }
    for (const [name, value] of Object.entries(tokens.spacing as Record<string, string>)) {
      expect(tokensCss).toContain(`--space-${name}: ${value};`);
    }
  });

  it('uses the DESIGN.md canvas and accent', () => {
    expect(tokensCss).toContain('--color-canvas: #010102;');
    expect(tokensCss).toContain('--color-primary: #5e6ad2;');
    expect(tokensCss).toContain('--type-body: 400 16px/1.50 var(--font-sans);');
    expect(tokensCss).toContain('--exercise-card-bg: var(--color-surface-1);');
  });
});
