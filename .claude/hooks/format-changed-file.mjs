#!/usr/bin/env node
// PostToolUse-хук: форматирует файл, который Claude Code только что записал/изменил.
// Вход — JSON на stdin (см. tool_input.file_path). Prettier сам пропускает
// неподдерживаемые типы (--ignore-unknown) и пути из .prettierignore.
// Хук никогда не роняет операцию: любые ошибки логируются в stderr, exit 0.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

const raw = await readStdin();

let payload = {};
try {
  payload = JSON.parse(raw || '{}');
} catch {
  process.exit(0);
}

const input = payload.tool_input ?? {};
const candidates = [
  input.file_path,
  ...(Array.isArray(input.edits) ? input.edits.map((e) => e?.file_path) : []),
  input.notebook_path,
].filter((v) => typeof v === 'string' && v.length > 0);

if (candidates.length === 0) process.exit(0);

const files = [...new Set(candidates)].map((f) =>
  path.isAbsolute(f) ? f : path.join(projectDir, f),
);

const prettierBin = path.join(
  projectDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prettier.cmd' : 'prettier',
);

if (!existsSync(prettierBin)) {
  console.error('[format-changed-file] prettier не установлен, пропуск');
  process.exit(0);
}

const res = spawnSync(prettierBin, ['--write', '--ignore-unknown', ...files], {
  cwd: projectDir,
  encoding: 'utf8',
});

if (res.status !== 0 && res.stderr) {
  console.error(`[format-changed-file] ${res.stderr.trim()}`);
}

process.exit(0);
