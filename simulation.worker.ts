import {createUncappedPlasticityObservation} from './experiments/uncappedPlasticityObservation';
import {createPlasticityObservation} from './experiments/plasticityObservation';
import {createHybridModeObservation} from './experiments/hybridModeObservation';
import {createIntakeEvaluation} from './experiments/intakeEvaluation';
import {createFoodObservation} from './experiments/foodObservation';
import {createTorqueRecorder} from './experiments/torqueRecorder';
import {SimulationHost, type WorldSnapshot, type WorldAction} from './simulationHost';
import {calculateOrganismCOM,type SimulationSettings} from './simulation';
import {measureWorkerTrial} from './experiments/workerMetrics';
import {workerWakeDelay} from './workerPacing';

const host = new SimulationHost();
const port = self as unknown as {postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null};
let dirty = false;
let initialized = false, outstanding = false, lastFrame = 0, previous = performance.now(), accumulator = 0;
const sendFrame = () => {
  if (!initialized || outstanding) return;
  port.postMessage({type: 'frame', frame: host.frame()});
  outstanding = true; dirty = false; lastFrame = performance.now();
};
port.onmessage = ({data}: MessageEvent) => {
  try {
    if (data.type === 'reset') {
      host.reset(data.snapshot as WorldSnapshot, data.epoch);
      initialized = true; dirty = true; accumulator = 0; previous = performance.now();
      outstanding = false; sendFrame(); return;
    }
    if (!initialized || data.epoch !== host.epoch) return;
    if (data.type === 'ack') {outstanding = false; return;}
    if (data.type === 'control') {
      if (host.running !== data.running) {accumulator = 0; previous = performance.now();}
      if (host.selected !== data.selected) dirty = true;
      if ((data.settings.physicsRegime ?? 'legacy-v0') !== (host.settings.physicsRegime ?? 'legacy-v0'))
        throw new Error('Physics regime can change only by resetting the world');
      if (data.settings.ecologyRegime !== host.settings.ecologyRegime)
        throw new Error('Ecology regime can change only by resetting the world');
      if (data.settings.motorExperiment !== host.settings.motorExperiment)
        throw new Error('Motor experiment can change only by resetting the world');
      if(data.settings.experimentalVelocityMode !== host.settings.experimentalVelocityMode)throw new Error('Velocity mode can change only by reset');
      if (data.settings.mouthContactModel !== host.settings.mouthContactModel)
        throw new Error('Mouth contact model can change only by resetting the world');
      host.settings = {...data.settings, physicsRegime: host.settings.physicsRegime ?? 'legacy-v0'} as SimulationSettings; host.speed = data.speed;
      host.running = data.running; host.selected = data.selected; return;
    }
    if (data.type === 'experiment-step') {
      if (host.running || !['gated-torque-v1','retained-head-v1','neural-motor-v1','neural-motor-v2','plasticity-study-v1'].includes(host.settings.motorExperiment!)
        || !Number.isInteger(data.ticks) || data.ticks < 1 || data.ticks > 3600)
        throw new Error('Paused explicit experimental world and 1–3600 ticks required');
      if (data.auditTorque !== undefined && (typeof data.auditTorque !== 'boolean' || host.settings.physicsRegime !== 'passive-work-v3'))
        throw new Error('Torque audit requires passive-work-v3 and a boolean selector');
      if(data.traceJoints!==undefined&&typeof data.traceJoints!=='boolean')throw new Error('Invalid joint trace selector');
      if(data.traceFood!==undefined&&(typeof data.traceFood!=='boolean'||!['gated-torque-v1','neural-motor-v1','neural-motor-v2','plasticity-study-v1'].includes(host.settings.motorExperiment!)))throw new Error('Food audit requires explicit experimental world');
      if(data.nonlethalEvaluation!==undefined&&data.nonlethalEvaluation!=='nutrient-intake-v1')throw new Error('Unknown offline nonlethal evaluation');
      const intake=data.nonlethalEvaluation?createIntakeEvaluation(host,data.ticks):undefined;
      const food=data.traceFood?createFoodObservation(host):undefined;
      const trajectory:unknown[]=[];
      const trace=data.traceJoints?(tick:number)=>{if(tick%10===9)trajectory.push({tick:tick+1,organisms:host.state.organisms.map(o=>({
        id:o.id,com:calculateOrganismCOM(o),joints:o.joints.map((j,i)=>({mode:j.gateMode,torque:j.appliedTorque,
          angle:Math.atan2(Math.sin(o.segments[i+1].angle-o.segments[o.genome.parts[i+1].parentIndex].angle-o.genome.parts[i+1].baseAngleOffset),
            Math.cos(o.segments[i+1].angle-o.segments[o.genome.parts[i+1].parentIndex].angle-o.genome.parts[i+1].baseAngleOffset))}))}))});}:undefined;
      if(data.traceModes!==undefined&&(typeof data.traceModes!=='boolean'||!['neural-motor-v2','plasticity-study-v1'].includes(host.settings.motorExperiment!)))throw new Error('Revised mode audit requires explicit v2 world');
      if(data.traceLearning!==undefined&&(typeof data.traceLearning!=='boolean'||host.settings.motorExperiment!=='plasticity-study-v1'))throw new Error('Learning audit requires explicit plasticity study');
      if(data.traceUncapped!==undefined&&(typeof data.traceUncapped!=='boolean'||host.settings.experimentalVelocityMode!=='uncapped-plasticity-v1'))throw new Error('Uncapped audit requires explicit98 mode');
      const uncapped=data.traceUncapped?createUncappedPlasticityObservation(host):undefined;
      const learning=data.traceLearning?createPlasticityObservation(host):undefined;
      const modes=data.traceModes?createHybridModeObservation(host):undefined;
      const recorder = data.auditTorque ? createTorqueRecorder() : undefined;
      const metrics = measureWorkerTrial(host, data.ticks,recorder||modes||uncapped?(s)=>{recorder?.observe(s);modes?.observe(s);uncapped?.observe(s);}:undefined,(tick)=>{trace?.(tick);food?.afterTick(tick);intake?.afterTick(tick);learning?.afterTick(tick);uncapped?.afterTick(tick);},intake?.mortality,learning?.observe);
      dirty = true;
      port.postMessage({type: 'result', id: data.id, epoch: host.epoch, value: {metrics, snapshot: host.snapshot(), ...(recorder ? {torqueAudit: recorder.report()} : {}),...(trace?{trajectory}:{}),...(food?{foodAudit:food.report()}:{}),...(intake?{intakeAudit:intake.report()}:{}),...(modes?{modeAudit:modes.report()}:{}),...(learning?{learningAudit:learning.report()}:{}),...(uncapped?{uncappedAudit:uncapped.report()}:{})}});
      return;
    }
    if (data.type === 'action') {
      const value = host.action(data.action as WorldAction);
      dirty = true;
      sendFrame(); port.postMessage({type: 'result', id: data.id, epoch: host.epoch, value});
    } else if (data.type === 'snapshot') {
      port.postMessage({type: 'result', id: data.id, epoch: host.epoch, value: host.snapshot(data.metadata)});
    }
  } catch (error) {
    host.running = false;
    port.postMessage({type: 'error', id: data.id, epoch: data.epoch,
      message: error instanceof Error ? error.message : String(error),...(host.settings.experimentalVelocityMode?{failureSnapshot:structuredClone({settings:host.settings,state:host.state})}:{})});
  }
};
// A queued message yields to commands without the minimum delay imposed on
// nested timers. Only one wakeup is scheduled; idle worlds still use a timer.
const wake = new MessageChannel();
wake.port1.onmessage = () => pump();
function pump() {
  const now = performance.now();
  if (initialized && host.running) {
    accumulator = Math.min(2, accumulator + Math.min(.25, (now - previous) / 1000) * host.speed);
    const deadline = now + 8;
    try {
      while (accumulator >= 1 / 60 && performance.now() < deadline) {
        host.tick(); dirty = true; accumulator -= 1 / 60;
      }
    } catch (error) {
      host.running = false;
      port.postMessage({type: 'error', message: error instanceof Error ? error.message : String(error)});
    }
  }
  previous = now;
  if (initialized && dirty && now - lastFrame >= 1000 / 30) sendFrame();
  const delay = workerWakeDelay(accumulator, host.speed, performance.now() - previous,
    initialized && host.running);
  if (delay === 0) wake.port2.postMessage(null);
  else setTimeout(pump, delay);
}
pump();
