// Temporary: checks that an unlinked-while-open temp file behaves the same on
// every OS. Mirrors FileManager.createTmpFile + DefaultHarExporter. Removed before merge.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { open, unlink, readdir, stat } from 'node:fs/promises';
import { tmpdir, platform } from 'node:os';
import { join } from 'node:path';

const results = [];
const check = (name, ok, extra = '') => {
  results.push(ok);
  console.log(`RESULT ${platform()} ${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
};

if (process.argv[2] === 'child') {
  const name = randomBytes(16).toString('hex').substring(16);
  const path = join(tmpdir(), name);
  const file = await open(path, 'wx+', 0o600);
  await unlink(path);
  const stream = file.createWriteStream({ encoding: 'utf-8' });
  stream.write('x'.repeat(1024 * 1024));
  await new Promise((r) => stream.write('', r));
  const { size } = await file.stat();
  const { bytesRead } = await file.read(Buffer.alloc(size), 0, size, 0);
  console.log(JSON.stringify({ name, size, bytesRead }));
  setInterval(() => stream.write('y'), 100);
} else {
  const child = spawn(process.execPath, [process.argv[1], 'child'], {
    stdio: ['ignore', 'pipe', 'inherit']
  });
  const line = await new Promise((r) =>
    child.stdout.once('data', (d) => r(d.toString()))
  );
  const { name, size, bytesRead } = JSON.parse(line);
  const path = join(tmpdir(), name);

  check('write and read through handle', size >= 1024 * 1024 && bytesRead === size, `size=${size}`);
  check('name gone while open', !(await readdir(tmpdir())).includes(name));
  check('stat by path fails while open', await stat(path).then(() => false, () => true));
  const reuse = await open(path, 'wx', 0o600).then(
    async (f) => (await f.close(), await unlink(path), true),
    (e) => e.code
  );
  check('name reusable while open', reuse === true, `got=${reuse}`);

  child.kill('SIGKILL');
  await new Promise((r) => child.once('exit', r));
  check('nothing left after hard kill', !(await readdir(tmpdir())).includes(name));

  process.exit(results.every(Boolean) ? 0 : 1);
}
