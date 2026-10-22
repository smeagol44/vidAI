/** TESTING-ONLY. Do not merge this source file or its manifest into main. */
import {readFileSync, appendFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runGit = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const manifest = JSON.parse(readFileSync(resolve(root, 'testing-baseline.json'), 'utf8'));
if (manifest.environment !== 'testing' || !/^[a-f0-9]{40}$/.test(manifest.mainCommit)
  || !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(manifest.mainVersion)
  || !Number.isSafeInteger(manifest.cycle) || manifest.cycle < 1) {
  throw new Error('Invalid testing baseline manifest; do not publish a misidentified build');
}
const branchHead = runGit('rev-parse', 'HEAD');
try {runGit('merge-base', '--is-ancestor', manifest.mainCommit, branchHead);}
catch {throw new Error('Pinned production baseline is not an ancestor of testing HEAD; deliberate reset is required');}
const baselinePackage = JSON.parse(runGit('show', manifest.mainCommit + ':package.json'));
if (baselinePackage.version !== manifest.mainVersion) {
  throw new Error('Pinned production version does not match actual main baseline commit');
}
const iteration = Number(runGit('rev-list', '--count', manifest.mainCommit + '..HEAD'));
if (!Number.isSafeInteger(iteration) || iteration < 1) {
  throw new Error('Testing must have at least one testing-only commit after its main baseline');
}
const shortMain = manifest.mainCommit.slice(0, 7);
const label = 'TESTING · main v' + manifest.mainVersion + ' @ ' + shortMain
  + ' · cycle ' + manifest.cycle + ' · iteration ' + iteration;
const version = 'T' + manifest.cycle + '.' + iteration;
const result = {label,version,cycle:manifest.cycle,iteration,
  mainVersion:manifest.mainVersion,mainCommit:manifest.mainCommit,testingCommit:branchHead};
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, 'label=' + label + '\nversion=' + version
    + '\niteration=' + iteration + '\nmain_sha=' + manifest.mainCommit + '\n');
}
console.log(JSON.stringify(result));
