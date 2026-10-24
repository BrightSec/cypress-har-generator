// Temporary probe: does a delete-on-close temp file vanish when its process is hard killed?
import { spawn, execSync } from 'node:child_process';
import { constants, existsSync, mkdtempSync, openSync, writeSync, closeSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const report = (k, v) => console.log(`${k}: ${v}`);
const TEMPORARY = constants.UV_FS_O_TEMPORARY ?? 0x40;
report('UV_FS_O_TEMPORARY', constants.UV_FS_O_TEMPORARY);
report('O_TEMPORARY', constants.O_TEMPORARY);
const flags = constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | TEMPORARY;
const dir = mkdtempSync(join(tmpdir(), 'probe-'));

// same process: write, read by path while open, close
const a = join(dir, 'a');
const fd = openSync(a, flags, 0o600);
writeSync(fd, 'hello\n');
report('read by path while open', JSON.stringify(await readFile(a, 'utf-8').catch(e => e.code)));
closeSync(fd);
report('exists after close', existsSync(a));

// write stream on the fd, like FileManager
const { open } = await import('node:fs/promises');
const b = join(dir, 'b');
const h = await open(b, flags, 0o600);
const s = h.createWriteStream({ encoding: 'utf-8' });
s.write('line\n');
await new Promise(r => s.write('', r));
report('stream read by path', JSON.stringify(await readFile(b, 'utf-8').catch(e => e.code)));
s.end();
await new Promise(r => s.once('close', r));
report('exists after stream end', existsSync(b));

// another process hard killed while holding it open
const c = join(dir, 'c');
const child = spawn(process.execPath, [
  '-e',
  `const fs=require('fs');fs.openSync(${JSON.stringify(c)},${flags},0o600);setInterval(()=>{},1000)`
]);
await sleep(1500);
report('exists while child holds it', existsSync(c));
execSync(`taskkill /PID ${child.pid} /F`);
await sleep(1500);
report('exists after taskkill /F', existsSync(c));
