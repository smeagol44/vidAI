// Bounded follow-up justified by failure of all nine finest-pair convergence
// gates. First .5s only: observe existing bias/passivity/pose-repair switches.
import {readFileSync,writeFileSync} from 'node:fs';
import {startPhysicsWorker} from './physics-worker-client.mjs';
const worker=await startPhysicsWorker(),report={protocol:'prism-integration-probe-v1',reason:'All nine5s methods failed at3840Hz; inspect existing joint-bias/passivity switching over first.5s without changing equations.',workerAsset:worker.bundle.split('/').pop(),rows:[],performance:[]};
try {
  for(const id of ['CUR-008','CUR-007','CUR-006']) {
    const {snapshot,tape}=JSON.parse(readFileSync(`docs/experiments/prism-integration-v1-${id}.json`));
    for(const substeps of [4,32,64]) {
      await worker.reset(snapshot);const row=await worker.request('integration-experiment',{request:{ticks:30,substeps,splitting:'motor-drag',tape,probe:true}});
      report.rows.push({id,...row});
    }
    // Timing-only repetitions, run after the fast suite and main experiment have
    // exited. Same observer/trajectory overhead; not observation-free browser FPS.
    for(let round=0;round<2;round++) {
      const configs=[['motor-drag',4],['motor-drag',32],['motor-half-half',32],['half-motor-half',32]];
      if(round)configs.reverse();
      for(const [splitting,substeps] of configs) {
        await worker.reset(snapshot);
        const r=await worker.request('integration-experiment',{request:{ticks:120,substeps,splitting,tape}});
        report.performance.push({id,round,substeps,splitting,ticks:120,runtimeMs:r.runtimeMs});
      }
    }
  }
  report.completed=true;writeFileSync('docs/experiments/prism-integration-probe-v1.json',JSON.stringify(report)+'\n');
}finally{await worker.close();}
