// Temporary probe: Node behaviours FileManager relies on, per OS.
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const report = (k, v) => console.log(`${k}: ${v}`);

report('platform', process.platform);
report('getuid', typeof process.getuid);

// unlink a file whose write stream is still open (exit hook case)
const dir = mkdtempSync(join(tmpdir(), 'probe-'));
const file = join(dir, 'f');
const s = createWriteStream(file);
s.write('x');
await new Promise(r => s.once('open', r));
try {
  rmSync(file, { force: true });
  report('rm open file', existsSync(file) ? 'still exists' : 'removed');
} catch (e) {
  report('rm open file', `throws ${e.code}`);
}

// liveness check
const dead = spawnSync(process.execPath, ['-e', 'console.log(process.pid)'])
  .stdout.toString()
  .trim();
for (const [name, pid] of [['self', process.pid], ['dead', +dead]]) {
  try {
    process.kill(pid, 0);
    report(`kill(${name}, 0)`, 'alive');
  } catch (e) {
    report(`kill(${name}, 0)`, e.code);
  }
}

// re-raising each hooked signal from inside its own handler
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const r = spawnSync(process.execPath, [
    '-e',
    `process.once('${sig}', () => {
       console.log('handler ran');
       try { process.kill(process.pid, '${sig}'); }
       catch (e) { console.log('re-raise throws ' + e.code); process.exit(99); }
     });
     process.on('exit', c => console.log('exit event ' + c));
     process.emit('${sig}', '${sig}');
     setTimeout(() => console.log('still alive'), 1000);`
  ]);
  report(
    `re-raise ${sig}`,
    `${r.stdout.toString().trim().replace(/\r?\n/g, ' | ')} | status ${r.status} signal ${r.signal}`
  );
}
