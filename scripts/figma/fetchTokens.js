/**
 * fetchTokens.js
 * Agent 1 script — Connects to Figma and pulls design tokens.
 *
 * Strategy:
 *   1. Try Variables API  (/v1/files/:key/variables/local)   ← preferred
 *   2. Fall back to Styles API (/v1/files/:key)               ← if Variables empty/403
 *
 * Output: tokens/raw/figma-tokens.json
 */

import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ─── Env validation ──────────────────────────────────────────────────────────
const TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;
const PREFERRED_MODE = process.env.FIGMA_MODE ?? null;

if (!TOKEN) throw new Error('[figma-connect] FIGMA_ACCESS_TOKEN is not set in .env');
if (!FILE_KEY) throw new Error('[figma-connect] FIGMA_FILE_KEY is not set in .env');

const HEADERS = { 'X-Figma-Token': TOKEN };
const BASE = 'https://api.figma.com';

function tick(step, message) {
  console.log(`[✓] ${step} ${message}`);
}

function warn(message) {
  console.warn(`[!] ${message}`);
}

// ─── Figma API helpers ────────────────────────────────────────────────────────
async function figmaGet(path) {
  const response = await fetch(`${BASE}${path}`, { headers: HEADERS });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma API ${path} → HTTP ${response.status}: ${body}`);
  }
  return response.json();
}

// ─── Variables API ────────────────────────────────────────────────────────────
async function fetchViaVariablesAPI() {
  const data = await figmaGet(`/v1/files/${FILE_KEY}/variables/local`);

  if (data.error || !data.meta) {
    throw new Error('Variables API returned an error response');
  }

  const { variables = {}, variableCollections = {} } = data.meta;

  if (Object.keys(variables).length === 0) {
    throw new Error('Variables API returned 0 variables — file may not use the Variables feature');
  }

  // Determine the default mode per collection (or user-specified mode)
  const modeMap = {};
  for (const [collId, coll] of Object.entries(variableCollections)) {
    const preferred = PREFERRED_MODE
      ? coll.modes.find(m => m.name.toLowerCase() === PREFERRED_MODE.toLowerCase())
      : null;
    modeMap[collId] = preferred ? preferred.modeId : coll.defaultModeId;
  }

  const tokens = {};

  for (const [varId, variable] of Object.entries(variables)) {
    const { name, resolvedType, valuesByMode, variableCollectionId, description, codeSyntax } = variable;

    const modeId = modeMap[variableCollectionId];
    const rawValue = valuesByMode[modeId];

    if (rawValue === undefined) continue;

    // Resolve alias references recursively (inline — aliases within same file)
    const value = resolveAlias(rawValue, variables, modeMap);
    if (value === null) continue;

    // Build a normalized token entry
    const nameParts = name.split('/').map(s => s.trim());
    const category = inferCategory(resolvedType, nameParts[0]);

    tokens[varId] = {
      name,                             // e.g. "color/primary"
      nameParts,                        // ["color", "primary"]
      category,                         // "colors" | "typography" | "dimensions" | ...
      resolvedType,                     // "COLOR" | "FLOAT" | "STRING" | "BOOLEAN"
      value,                            // resolved primitive value
      description: description ?? '',
      codeSyntax: codeSyntax ?? {},
      source: 'variables',
    };
  }

  return tokens;
}

function resolveAlias(rawValue, variables, modeMap, depth = 0) {
  if (depth > 10) return null; // Guard against circular refs
  if (rawValue?.type === 'VARIABLE_ALIAS') {
    const referenced = variables[rawValue.id];
    if (!referenced) return null;
    const modeId = modeMap[referenced.variableCollectionId];
    const next = referenced.valuesByMode[modeId];
    return resolveAlias(next, variables, modeMap, depth + 1);
  }
  return rawValue;
}

// ─── Styles API fallback ──────────────────────────────────────────────────────
async function fetchViaStylesAPI() {
  const data = await figmaGet(`/v1/files/${FILE_KEY}`);
  const styles = data.styles ?? {};

  if (Object.keys(styles).length === 0) {
    throw new Error('Styles API also returned 0 styles. Check the FIGMA_FILE_KEY value.');
  }

  // Figma styles API only gives us metadata; actual paint/typography values are
  // in nodes. We need to fetch the nodes that reference each style.
  const styleIds = Object.keys(styles);
  tick('Styles API', `Found ${styleIds.length} styles, fetching node data...`);

  // Fetch nodes — styles are attached to nodes, Figma does not expose style values directly
  // via /files/:key/styles. We fetch a batch of node IDs.
  const nodeIds = styleIds.join(',');
  const nodesData = await figmaGet(`/v1/files/${FILE_KEY}/nodes?ids=${encodeURIComponent(nodeIds)}`);

  const tokens = {};

  for (const [nodeId, nodeWrapper] of Object.entries(nodesData.nodes ?? {})) {
    const node = nodeWrapper?.document;
    if (!node) continue;

    const style = styles[nodeId];
    if (!style) continue;

    const { styleType, name, description } = style;
    const nameParts = name.split('/').map(s => s.trim());

    if (styleType === 'FILL' && node.fills?.length > 0) {
      const fill = node.fills[0];
      if (fill.type === 'SOLID') {
        tokens[nodeId] = {
          name,
          nameParts,
          category: 'colors',
          resolvedType: 'COLOR',
          value: { type: 'COLOR', ...fill.color },
          description: description ?? '',
          codeSyntax: {},
          source: 'styles',
        };
      }
    } else if (styleType === 'TEXT' && node.style) {
      const s = node.style;
      tokens[nodeId] = {
        name,
        nameParts,
        category: 'typography',
        resolvedType: 'TYPOGRAPHY',
        value: {
          fontFamily: s.fontFamily,
          fontWeight: s.fontWeight,
          fontSize: s.fontSize,
          lineHeightPx: s.lineHeightPx,
          letterSpacing: s.letterSpacing,
          textCase: s.textCase,
          textDecoration: s.textDecoration,
        },
        description: description ?? '',
        codeSyntax: {},
        source: 'styles',
      };
    } else if (styleType === 'EFFECT') {
      tokens[nodeId] = {
        name,
        nameParts,
        category: 'elevation',
        resolvedType: 'EFFECT',
        value: node.effects ?? [],
        description: description ?? '',
        codeSyntax: {},
        source: 'styles',
      };
    }
  }

  return tokens;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inferCategory(resolvedType, firstNamePart) {
  const part = (firstNamePart ?? '').toLowerCase();
  if (resolvedType === 'COLOR' || part.includes('color') || part === 'colour') return 'colors';
  if (resolvedType === 'TYPOGRAPHY' || part.includes('typography') || part.includes('font') || part.includes('text')) return 'typography';
  if (part.includes('spacing') || part.includes('space') || part.includes('gap') || part.includes('padding') || part.includes('margin')) return 'dimensions';
  if (part.includes('border') || part.includes('radius') || part.includes('corner') || part.includes('stroke')) return 'borders';
  if (part.includes('elevation') || part.includes('shadow')) return 'elevation';
  if (part.includes('opacity') || part.includes('alpha')) return 'opacity';
  if (resolvedType === 'FLOAT') return 'dimensions'; // generic numeric → dimensions
  return 'misc';
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n[figma-connect] Starting Figma token fetch...');
  tick('1/3', 'Connecting to Figma API...');

  let tokens;
  let source;

  try {
    tokens = await fetchViaVariablesAPI();
    source = 'Variables API';
    tick('2/3', `Variables API succeeded — ${Object.keys(tokens).length} tokens found`);
  } catch (err) {
    warn(`Variables API failed (${err.message}), falling back to Styles API...`);
    try {
      tokens = await fetchViaStylesAPI();
      source = 'Styles API';
      tick('2/3', `Styles API fallback succeeded — ${Object.keys(tokens).length} tokens found`);
    } catch (fallbackErr) {
      throw new Error(`Both APIs failed.\n  Variables: ${err.message}\n  Styles: ${fallbackErr.message}`);
    }
  }

  // Ensure output directory exists
  const outDir = path.join(ROOT, 'tokens', 'raw');
  await fs.ensureDir(outDir);

  const outPath = path.join(outDir, 'figma-tokens.json');
  await fs.writeJson(outPath, { source, fetchedAt: new Date().toISOString(), tokens }, { spaces: 2 });

  tick('3/3', `Raw tokens saved → tokens/raw/figma-tokens.json`);

  // Summary by category
  const categoryCounts = {};
  for (const t of Object.values(tokens)) {
    categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;
  }
  console.log('\n[figma-connect] Token summary:');
  for (const [cat, count] of Object.entries(categoryCounts)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\n[figma-connect] ✅ Done — ${Object.keys(tokens).length} tokens from ${source}\n`);
}

main().catch(err => {
  console.error(`\n[figma-connect] ❌ Fatal: ${err.message}`);
  process.exit(1);
});
