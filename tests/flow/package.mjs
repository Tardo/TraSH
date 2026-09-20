import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const consumer = mkdtempSync(path.join(tmpdir(), 'trash-flow-'));
try {
  const packed = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {cwd: root, encoding: 'utf8'}),
  );
  const archive = Array.isArray(packed) ? packed[0] : packed.files ? packed : Object.values(packed)[0];
  assert(archive.files.some(file => file.path === 'dist/index.mjs.flow'));
  assert(!archive.files.some(file => file.path.startsWith('flow-typed/')));
  writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({private: true, type: 'module'}));
  execFileSync(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      path.join(consumer, archive.filename),
    ],
    {cwd: consumer, stdio: 'inherit'},
  );
  copyFileSync(path.join(root, 'tests/flow/exports.js'), path.join(consumer, 'exports.js'));
  writeFileSync(path.join(consumer, '.flowconfig'), '[options]\ninclude_warnings=true\n');
  execFileSync(path.join(root, 'node_modules/.bin/flow'), ['check', '--max-workers', '2'], {
    cwd: consumer,
    stdio: 'inherit',
  });
} finally {
  rmSync(consumer, {recursive: true, force: true});
}
