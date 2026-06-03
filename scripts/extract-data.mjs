import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || 'W:/Download/毛概刷题.html';
const outPath = path.join(root, 'src', 'data', 'bank.json');
const html = fs.readFileSync(source, 'utf8');
const match = html.match(/<script id="bank-data" type="application\/json">([\s\S]*?)<\/script>/);

if (!match) {
  throw new Error('Missing <script id="bank-data" type="application/json"> in source HTML.');
}

const bank = JSON.parse(match[1]);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(bank, null, 2), 'utf8');
console.log(`Extracted ${bank.questions.length} questions to ${outPath}`);
