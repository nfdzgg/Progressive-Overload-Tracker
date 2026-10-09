#!/usr/bin/env node
// Generates src/design/tokens.css from the YAML front matter of DESIGN.md.
//
//   colors.*      -> --color-<name>
//   typography.*  -> --type-<name> (font shorthand), --type-<name>-size/-weight/
//                    -line-height/-tracking/-family
//   rounded.*     -> --radius-<name>
//   spacing.*     -> --space-<name>
//   components.*  -> --<component>-bg/-fg/-font/-tracking/-radius/-padding/-height
//
// A short list of layout constants that DESIGN.md states in prose (tap
// targets, icon sizes, bar heights, motion) is appended under "Derived".
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FONT_STACKS = {
  Inter: "Inter, -apple-system, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif",
  'JetBrains Mono': "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
};
const FAMILY_VAR = { Inter: 'var(--font-sans)', 'JetBrains Mono': 'var(--font-mono)' };

// Values stated in DESIGN.md prose rather than front matter.
const DERIVED = [
  ['font-weight-regular', '400', 'Inter weights 400 / 500 / 600'],
  ['font-weight-medium', '500'],
  ['font-weight-semibold', '600'],
  ['border-width', '1px', '1px hairline borders'],
  ['border-hairline', 'var(--border-width) solid var(--color-hairline)'],
  ['border-hairline-strong', 'var(--border-width) solid var(--color-hairline-strong)'],
  ['border-hairline-tertiary', 'var(--border-width) solid var(--color-hairline-tertiary)'],
  ['focus-ring-width', '2px', 'Level 4: 2px primary-focus outline at 50% opacity'],
  ['focus-ring-color', 'color-mix(in srgb, var(--color-primary-focus) 50%, transparent)'],
  ['focus-ring', 'var(--focus-ring-width) solid var(--focus-ring-color)'],
  ['focus-ring-offset', '2px'],
  [
    'overlay-scrim',
    'color-mix(in srgb, var(--color-semantic-overlay) 60%, transparent)',
    'scrim at 60%',
  ],
  [
    'edge-highlight',
    'inset 0 1px 0 color-mix(in srgb, var(--color-ink) 6%, transparent)',
    'subtle white top edge on lifted panels',
  ],
  ['tap-target', '44px', 'minimum tap target'],
  ['chip-height', '34px', 'chip visual height 32-36px'],
  ['icon-card', '20px', 'icons in cards'],
  ['icon-tab', '24px', 'icons in the tab bar'],
  ['icon-stroke', '1.5', 'line icons, 1.5px stroke'],
  ['top-bar-height', '56px'],
  ['tab-bar-height', '56px'],
  ['content-max', '480px', 'phone-shaped column'],
  ['content-max-wide', '960px', 'Progress screen on wide windows'],
  ['progress-line', '2px', 'rest timer progress line'],
  ['dot-size', '4px', 'completed-day marker'],
  ['drag-handle-width', '36px'],
  ['drag-handle-height', '4px'],
  ['sheet-max-height', '85vh'],
  ['chart-line-width', '2px'],
  ['chart-point-size', '4px'],
  ['chart-height', '160px'],
  ['motion-duration', '180ms', '150-200ms ease-out'],
  ['motion-ease', 'cubic-bezier(0.16, 1, 0.3, 1)'],
  ['safe-top', 'env(safe-area-inset-top, 0px)'],
  ['safe-right', 'env(safe-area-inset-right, 0px)'],
  ['safe-bottom', 'env(safe-area-inset-bottom, 0px)'],
  ['safe-left', 'env(safe-area-inset-left, 0px)'],
];

const COMPONENT_PROPS = {
  backgroundColor: 'bg',
  textColor: 'fg',
  rounded: 'radius',
  padding: 'padding',
  height: 'height',
};

function unquote(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Parses the small YAML subset used in DESIGN.md (nested maps of scalars). */
export function parseYamlSubset(text) {
  const root = {};
  const stack = [{ indent: -1, obj: root }];
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^ */)[0].length;
    const match = raw.trim().match(/^([^:]+):\s*(.*)$/);
    if (!match) throw new Error(`Unsupported YAML line: ${raw}`);
    const key = match[1].trim();
    const value = match[2];
    while (stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].obj;
    if (value === '') {
      const obj = {};
      parent[key] = obj;
      stack.push({ indent, obj });
    } else {
      parent[key] = unquote(value);
    }
  }
  return root;
}

export function extractFrontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('DESIGN.md has no front matter');
  return parseYamlSubset(match[1]);
}

function typeShorthand(t) {
  return `${t.fontWeight} ${t.fontSize}/${t.lineHeight} ${FAMILY_VAR[t.fontFamily] ?? t.fontFamily}`;
}

function resolveRef(value, tokens) {
  const ref = String(value).match(/^\{(\w+)\.([\w-]+)\}$/);
  if (!ref) return value;
  const [, group, name] = ref;
  if (!tokens[group] || !(name in tokens[group])) throw new Error(`Unknown token ${value}`);
  if (group === 'colors') return `var(--color-${name})`;
  if (group === 'rounded') return `var(--radius-${name})`;
  if (group === 'spacing') return `var(--space-${name})`;
  if (group === 'typography') return `var(--type-${name})`;
  throw new Error(`Unsupported reference ${value}`);
}

export function generateTokensCss(markdown) {
  const tokens = extractFrontMatter(markdown);
  const out = [];
  out.push('/* Generated from DESIGN.md by scripts/generate-tokens.mjs. Do not edit by hand. */');
  out.push('/* Run `npm run tokens` after changing DESIGN.md. */');
  out.push(':root {');

  out.push('  /* Font stacks */');
  out.push(`  --font-sans: ${FONT_STACKS.Inter};`);
  out.push(`  --font-mono: ${FONT_STACKS['JetBrains Mono']};`);

  out.push('', '  /* Colors */');
  for (const [name, value] of Object.entries(tokens.colors))
    out.push(`  --color-${name}: ${value};`);

  out.push('', '  /* Typography */');
  for (const [name, t] of Object.entries(tokens.typography)) {
    out.push(`  --type-${name}: ${typeShorthand(t)};`);
    out.push(`  --type-${name}-family: ${FAMILY_VAR[t.fontFamily] ?? t.fontFamily};`);
    out.push(`  --type-${name}-size: ${t.fontSize};`);
    out.push(`  --type-${name}-weight: ${t.fontWeight};`);
    out.push(`  --type-${name}-line-height: ${t.lineHeight};`);
    out.push(`  --type-${name}-tracking: ${t.letterSpacing === '0' ? '0' : t.letterSpacing};`);
  }

  out.push('', '  /* Radius */');
  for (const [name, value] of Object.entries(tokens.rounded))
    out.push(`  --radius-${name}: ${value};`);

  out.push('', '  /* Spacing */');
  for (const [name, value] of Object.entries(tokens.spacing))
    out.push(`  --space-${name}: ${value};`);

  out.push('', '  /* Components */');
  for (const [component, props] of Object.entries(tokens.components)) {
    for (const [prop, value] of Object.entries(props)) {
      if (prop === 'typography') {
        const ref = String(value).match(/^\{typography\.([\w-]+)\}$/);
        if (!ref) throw new Error(`Bad typography ref in ${component}`);
        out.push(`  --${component}-font: var(--type-${ref[1]});`);
        out.push(`  --${component}-tracking: var(--type-${ref[1]}-tracking);`);
        continue;
      }
      const suffix = COMPONENT_PROPS[prop];
      if (!suffix) throw new Error(`Unknown component prop ${component}.${prop}`);
      out.push(`  --${component}-${suffix}: ${resolveRef(value, tokens)};`);
    }
  }

  out.push('', '  /* Derived from DESIGN.md prose */');
  for (const [name, value, note] of DERIVED) {
    out.push(`  --${name}: ${value};${note ? ` /* ${note} */` : ''}`);
  }
  out.push('}', '');
  return out.join('\n');
}

function main() {
  const root = new URL('..', import.meta.url);
  const markdown = readFileSync(new URL('DESIGN.md', root), 'utf8');
  const css = generateTokensCss(markdown);
  writeFileSync(new URL('src/design/tokens.css', root), css);
  console.log('Wrote src/design/tokens.css');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
