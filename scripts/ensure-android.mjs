import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(root, 'android');

if (!fs.existsSync(androidDir)) {
  execFileSync('npx', ['cap', 'add', 'android'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
}
