/**
 * build.js
 * Agent 3 script — Runs the Style Dictionary pipeline.
 *
 * Steps:
 *   1. Reads tokens/raw/figma-tokens.json (output of fetchTokens.js)
 *   2. Normalises raw Figma tokens → Style Dictionary compatible JSON format
 *      and writes to tokens/converted/<category>.json
 *   3. Runs Style Dictionary build → tokens/build/android/<category>.json
 */

import 'dotenv/config';
import StyleDictionary from 'style-dictionary';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { figmaColorToCompose } from './transforms/composeColor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const RAW_PATH      = path.join(ROOT, 'tokens', 'raw', 'figma-tokens.json');
const CONVERTED_DIR = path.join(ROOT, 'tokens', 'converted');
const BUILD_DIR     = path.join(ROOT, 'tokens', 'build', 'android');

function tick(step, message) {
  console.log(`[✓] ${step} ${message}`);
}

// ─── Step 1: Normalise raw Figma tokens → SD token JSON ──────────────────────
async function normaliseTokens() {
  if (!(await fs.pathExists(RAW_PATH))) {
    throw new Error(`Raw tokens not found at ${RAW_PATH}. Run fetchTokens.js first.`);
  }

  const { tokens } = await fs.readJson(RAW_PATH);
  await fs.ensureDir(CONVERTED_DIR);

  // Group tokens by category, build deep nested SD token objects per category
  const byCategory = {};

  for (const token of Object.values(tokens)) {
    const { category, nameParts, resolvedType, value, description } = token;

    if (!byCategory[category]) byCategory[category] = {};

    // Build a nested path from nameParts (e.g. ["color","primary","default"] →
    //   { color: { primary: { default: { value, type, comment } } } })
    let node = byCategory[category];
    const parts = nameParts.length > 0 ? nameParts : [token.name.replace(/\//g, '-')];

    for (let i = 0; i < parts.length - 1; i++) {
      const key = sanitiseKey(parts[i]);
      if (!node[key] || typeof node[key] !== 'object' || node[key].value !== undefined) {
        node[key] = {};
      }
      node = node[key];
    }

    const leafKey = sanitiseKey(parts[parts.length - 1]);
    node[leafKey] = buildSDToken(resolvedType, value, description, category);
  }

  // Write one JSON file per category
  const written = [];
  for (const [cat, data] of Object.entries(byCategory)) {
    const outPath = path.join(CONVERTED_DIR, `${cat}.json`);
    await fs.writeJson(outPath, data, { spaces: 2 });
    written.push(cat);
  }

  return { byCategory, written };
}

function sanitiseKey(key) {
  // Make safe as a Kotlin identifier: remove illegal chars, camelCase
  return key.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}

function buildSDToken(resolvedType, value, description, category) {
  const base = { value, comment: description || undefined };

  switch (resolvedType) {
    case 'COLOR':
      return { ...base, $type: 'color', type: 'color' };
    case 'FLOAT': {
      const sdType = category === 'opacity' ? 'opacity'
        : category === 'borders' ? 'borderRadius'
        : 'dimension';
      return { ...base, $type: sdType, type: sdType };
    }
    case 'STRING':
      return { ...base, $type: 'string', type: 'fontName' };
    case 'TYPOGRAPHY':
      return { ...base, $type: 'typography', type: 'typography' };
    case 'EFFECT':
      return { ...base, $type: 'shadow', type: 'shadow' };
    default:
      return { ...base, type: resolvedType?.toLowerCase() ?? 'other' };
  }
}

// ─── Step 2: Run Style Dictionary ─────────────────────────────────────────────
async function runStyleDictionary() {
  // Dynamically import config (ES module)
  const { default: sdConfig } = await import('./config.js').catch(() => {
    throw new Error('Could not load style-dictionary/config.js');
  });

  await fs.ensureDir(BUILD_DIR);

  const sd = new StyleDictionary(sdConfig);
  await sd.buildAllPlatforms();
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n[token-convert] Starting token conversion pipeline...');

  tick('1/3', 'Normalising raw Figma tokens → Style Dictionary format...');
  const { written } = await normaliseTokens();
  tick('2/3', `Converted ${written.length} token categories: ${written.join(', ')}`);

  tick('3/3', 'Running Style Dictionary build...');
  await runStyleDictionary();

  // Report what was built
  const builtFiles = await fs.readdir(BUILD_DIR).catch(() => []);
  const nonEmpty = [];
  for (const f of builtFiles) {
    if (!f.endsWith('.json')) continue;
    const content = await fs.readJson(path.join(BUILD_DIR, f)).catch(() => ({}));
    const count = Object.keys(content).length;
    if (count > 0) nonEmpty.push(`${f} (${count} tokens)`);
  }

  console.log('\n[token-convert] Build output:');
  for (const f of nonEmpty) console.log(`  ✓ ${f}`);
  if (nonEmpty.length === 0) console.log('  (no tokens output — check token categories in raw file)');

  console.log(`\n[token-convert] ✅ Done — ${nonEmpty.length} category files built\n`);
}

main().catch(err => {
  console.error(`\n[token-convert] ❌ Fatal: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
