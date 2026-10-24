import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';

/** Drives the actual Vite-built browser Worker. Only its message port is adapted. */
export async function startGatedWorker() {
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  const entry=html.match(/src="[^"]*\/assets\/(index-[^"]+\.js)"/);
  const app=entry?await readFile(new URL('../dist/assets/'+entry[1],import.meta.url),'utf8'):'';
  const asset=app.match(/simulation\.worker-[A-Za-z0-9_-]+\.js/)?.[0];
  if (!asset) throw new Error('Run npm run build first');
  const bundle = new URL(`../dist/assets/${asset}`, import.meta.url).href;
  const boot = `import {parentPort} from 'node:worker_threads';
    globalThis.self={postMessage:value=>parentPort.postMessage(value)};
    parentPort.on('message',data=>self.onmessage({data}));
    await import(${JSON.stringify(bundle)}); parentPort.postMessage({type:'ready'});`;
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(boot)}`));
  let sequence = 0, epoch = 0;
  const pending = new Map();
  let ready;
  const started = new Promise((resolve, reject) => {ready = resolve; worker.once('error', reject);});
  worker.on('error', error => {for (const p of pending.values()) {clearTimeout(p.timer); p.reject(error);} pending.clear();});
  worker.on('message', value => {
    if (value.type === 'ready') {ready(); return;}
    if (value.type === 'frame') {worker.postMessage({type: 'ack', epoch: value.frame.epoch}); return;}
    const p = pending.get(value.id);
    if (p) {pending.delete(value.id); clearTimeout(p.timer); value.type === 'error' ? p.reject(Object.assign(new Error(value.message),{workerFailure:value})) : p.resolve(value.value);}
  });
  await started;
  const request = (type, extra = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {pending.delete(id); reject(new Error('Experimental Worker timed out'));}, 30000);
    pending.set(id, {resolve, reject, timer}); worker.postMessage({type, epoch, id, ...extra});
  });
  return {
    bundle,
    request,
    async reset(snapshot) {
      epoch++; worker.postMessage({type: 'reset', epoch, snapshot});
      // Ordered messages guarantee reset completes before the snapshot request.
      return request('snapshot');
    },
    async trial(snapshot, ticks, options = {}) {await this.reset(snapshot); return request('experiment-step', {ticks, ...options});},
    close: () => worker.terminate(),
  };
}
