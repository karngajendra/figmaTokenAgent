/**
 * saveVersion.js
 * Called ONLY after a fully successful sync pipeline run.
 * Promotes .version-pending.json → .version-cache.json
 */

import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const PENDING_PATH = path.join(ROOT, '.version-pending.json');
const CACHE_PATH = path.join(ROOT, '.version-cache.json');

async function main() {
  if (!(await fs.pathExists(PENDING_PATH))) {
    console.warn('[save-version] No pending version file found — nothing to promote');
    return;
  }

  const pending = await fs.readJson(PENDING_PATH);

  const cache = {
    fileKey: pending.fileKey,
    lastVersion: pending.pendingVersion,
    previousVersion: pending.previousVersion,
    savedAt: new Date().toISOString(),
  };

  await fs.writeJson(CACHE_PATH, cache, { spaces: 2 });
  await fs.remove(PENDING_PATH);

  console.log(`[✓] Version cache updated → ${cache.lastVersion}`);
}

main().catch(err => {
  console.error(`[save-version] ❌ Fatal: ${err.message}`);
  process.exit(1);
});
