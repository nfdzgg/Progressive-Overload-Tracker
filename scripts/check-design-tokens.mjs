#!/usr/bin/env node
// Enforces "UI uses only design tokens": no raw colors, lengths, or font
// families outside src/design/tokens.css. CSS everywhere under src/ is
// checked; TypeScript is checked under src/features/ (feature code).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEX = /(^|[\s'"`:(,])#[0-9a-fA-F]{3,8}\b/;
const COLOR_FN = /\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/;
const LENGTH = /(^|[^\w$.-])(\d*\.?\d+)(px|rem|em|pt)\b/g;

function hasNonZeroLength(text) {
  for (const match of text.matchAll(LENGTH)) {
    if (Number(match[2]) !== 0) return true;
  }
  return false;
}

/** Returns a list of { line, message } problems for a CSS source. */
export function checkCss(source) {
  const problems = [];
  const lines = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).split('\n');
  lines.forEach((text, i) => {
    const line = i + 1;
    // Media query preludes cannot use custom properties.
    if (/^\s*@(media|container)\b/.test(text)) return;
    if (HEX.test(text)) problems.push({ line, message: 'raw hex color; use a --color-* token' });
    if (COLOR_FN.test(text))
      problems.push({ line, message: 'raw color function; use a --color-* token' });
    if (hasNonZeroLength(text))
      problems.push({ line, message: 'raw length; use a spacing/size token' });
    const family = text.match(/font-family\s*:\s*([^;]+)/);
    if (family && !/var\(|inherit/.test(family[1])) {
      problems.push({ line, message: 'raw font-family; use --font-* tokens' });
    }
    const weight = text.match(/font-weight\s*:\s*([^;]+)/);
    if (weight && /\d/.test(weight[1]) && !/var\(/.test(weight[1])) {
      problems.push({ line, message: 'raw font-weight; use a typography token' });
    }
  });
  return problems;
}

/** Returns a list of { line, message } problems for feature TypeScript. */
export function checkTs(source) {
  const problems = [];
  source.split('\n').forEach((text, i) => {
    const line = i + 1;
    if (/^\s*(\/\/|\*)/.test(text)) return;
    if (HEX.test(text)) problems.push({ line, message: 'raw hex color in feature code' });
    if (COLOR_FN.test(text)) problems.push({ line, message: 'raw color function in feature code' });
    if (hasNonZeroLength(text)) problems.push({ line, message: 'raw length in feature code' });
    if (/fontFamily\s*:/.test(text)) problems.push({ line, message: 'raw font in feature code' });
  });
  return problems;
}

function walk(dir) {
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else out.push(full);
  }
  return out;
}

function main() {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const src = join(root, 'src');
  const problems = [];
  for (const file of walk(src)) {
    const rel = relative(root, file).split(sep).join('/');
    if (rel === 'src/design/tokens.css') continue;
    if (/\.test\.(ts|tsx)$/.test(rel)) continue;
    const source = readFileSync(file, 'utf8');
    let found = [];
    if (rel.endsWith('.css')) found = checkCss(source);
    else if (rel.startsWith('src/features/') && /\.(ts|tsx)$/.test(rel)) found = checkTs(source);
    for (const p of found) problems.push(`${rel}:${p.line}  ${p.message}`);
  }
  if (problems.length) {
    console.error(`Design token check failed (${problems.length}):\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log('Design token check passed.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
