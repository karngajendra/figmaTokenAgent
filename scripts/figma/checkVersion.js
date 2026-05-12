/**
 * checkVersion.js
 * Agent 2 script — Polls the current Figma file version and compares with
 * the locally cached version.
 *
 * Exit codes:
 *   0  — New version detected (proceed with sync)
 *   2  — No change (skip sync — short-circuit the pipeline)
 *   1  — Fatal error
 *
 * Stdout signals consumed by the orchestrator:
 *   "NO_CHANGE"       — version unchanged
 *   "VERSION_CHANGED" — new version detected
 */

import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CACHE_PATH = path.join(ROOT, '.version-cache.json');

const TOKEN = process.env.FIGMA_ACCESS_TOKEN;
const FILE_KEY = process.env.FIGMA_FILE_KEY;

if (!TOKEN) throw new Error('[version-check] FIGMA_ACCESS_TOKEN is not set in .env');
if (!FILE_KEY) throw new Error('[version-check] FIGMA_FILE_KEY is not set in .env');

function tick(step, message) {
  console.log(`[✓] ${step} ${message}`);
}

async function getCurrentVersion() {
  const response = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}/meta`, {
    headers: { 'X-Figma-Token': TOKEN },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma meta API HTTP ${response.status}: ${body}`);
  }

  const data = await response.json();

  // The /v1/files/:key/meta endpoint wraps the payload under a `file` key
  const file = data.file ?? data;

  if (!file.version) {
    throw new Error('Figma meta response did not include a version field');
  }

  return { version: file.version, name: file.name ?? FILE_KEY };
}

async function readCache() {
  if (!(await fs.pathExists(CACHE_PATH))) return null;
  try {
    return await fs.readJson(CACHE_PATH);
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n[version-check] Checking Figma file version...');
  tick('1/2', 'Fetching current file version from Figma...');

  const { version: currentVersion, name: fileName } = await getCurrentVersion();
  tick('2/2', `Current version: ${currentVersion} (file: "${fileName}")`);

  const cache = await readCache();
  const cachedVersion = cache?.lastVersion ?? null;

  if (cachedVersion === currentVersion) {
    console.log(`\n[version-check] ⏭  NO_CHANGE — version ${currentVersion} matches cache. Skipping sync.\n`);
    console.log('NO_CHANGE');
    process.exit(2);
  }

  if (cachedVersion) {
    console.log(`\n[version-check] 🔄 VERSION_CHANGED — ${cachedVersion} → ${currentVersion}`);
  } else {
    console.log(`\n[version-check] 🆕 VERSION_CHANGED — no cache found, first run (version: ${currentVersion})`);
  }

  // Write the new version to a temp file so downstream scripts can read it
  // without re-fetching. saveVersion.js writes to the real cache after a
  // successful full sync.
  await fs.writeJson(path.join(ROOT, '.version-pending.json'), {
    fileKey: FILE_KEY,
    pendingVersion: currentVersion,
    previousVersion: cachedVersion,
    detectedAt: new Date().toISOString(),
  });

  console.log('VERSION_CHANGED');
  process.exit(0);
}

main().catch(err => {
  console.error(`\n[version-check] ❌ Fatal: ${err.message}`);
  process.exit(1);
});
