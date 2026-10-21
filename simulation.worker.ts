import {SimulationHost, type WorldSnapshot, type WorldAction} from './simulationHost';
import type {SimulationSettings} from './simulation';
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
      if (data.settings.mouthContactModel !== host.settings.mouthContactModel)
        throw new Error('Mouth contact model can change only by resetting the world');
      host.settings = {...data.settings, physicsRegime: host.settings.physicsRegime ?? 'legacy-v0'} as SimulationSettings; host.speed = data.speed;
      host.running = data.running; host.selected = data.selected; return;
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
      message: error instanceof Error ? error.message : String(error)});
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
