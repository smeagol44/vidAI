import {readFile} from 'node:fs/promises';

/** Resolve the asset actually referenced by the built application. Never pick
 * the first matching file: stale hashed assets may remain in a local dist. */
export async function builtWorkerAsset() {
  const index=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const entry=index.match(/src="[^"\s]*\/assets\/([^"\s]+\.js)"/);
  if(!entry)throw new Error('Run npm run build first (application entry missing)');
  const code=await readFile(new URL('../dist/assets/'+entry[1],import.meta.url),'utf8');
  const match=code.match(/simulation\.worker-[A-Za-z0-9_-]+\.js/);
  if(!match)throw new Error('Built application does not reference a simulation Worker');
  return new URL('../dist/assets/'+match[0],import.meta.url);
}
