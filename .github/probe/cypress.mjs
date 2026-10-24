// Temporary probe: temp files left after a real Cypress run ends in different ways.
import { spawn, execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const mode = process.argv[2];
const dir = join(
  tmpdir(),
  `cypress-har-generator${process.getuid ? `-${process.getuid()}` : ''}`
);
const list = () => (existsSync(dir) ? readdirSync(dir) : []);
const flag = resolve('probe-ready');
rmSync(flag, { force: true });

const before = new Set(list());
const spec = mode === 'twice' ? 'cypress/e2e/zz-twice.cy.ts' : 'cypress/e2e/zz-probe.cy.ts';
const child = spawn(
  `npx cypress run --browser chrome --spec ${spec} --env probe_flag=${flag}`,
  { shell: true, stdio: 'inherit' }
);
const done = new Promise(r => child.once('exit', r));

if (mode !== 'clean' && mode !== 'twice') {
  while (!existsSync(flag)) {
    await sleep(1000);
  }
  await sleep(2000);
  const own = list().filter(n => !before.has(n));
  const pluginPid = +own[0].split('-')[0];
  console.log(`plugin pid ${pluginPid}, files ${own.length}`);
  if (mode === 'kill-main') {
    // the Cypress app itself, not the plugin process it forked
    execSync(
      `powershell -Command "Get-Process Cypress | Where-Object Id -ne ${pluginPid} | Stop-Process -Force"`,
      { stdio: 'inherit' }
    );
  } else if (mode === 'kill-plugin') {
    execSync(`taskkill /PID ${pluginPid} /F`, { stdio: 'inherit' });
  }
}

await Promise.race([done, sleep(120000)]);
await sleep(3000);
const left = list().filter(n => !before.has(n));
console.log(`RESULT ${mode}: ${left.length} temp file(s) left ${left.join(' ')}`);
