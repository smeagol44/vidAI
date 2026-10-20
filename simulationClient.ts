import {RenderReplica, type RenderFrame, type WorldSnapshot, type WorldAction} from './simulationHost';
import type {SimulationState, SimulationSettings} from './simulation';

/** One frame in flight prevents cloning/queued-message growth when a tab stalls. */
export class SimulationClient {
  private worker: Worker;
  private replica = new RenderReplica();
  private pending = new Map<number, {resolve(value: unknown): void; reject(error: Error): void}>();
  private nextId = 0;
  epoch = 0;
  constructor(private current: () => SimulationState,
    onFrame: (state: SimulationState, frame: RenderFrame) => void, onError: (message: string) => void) {
    this.worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {type: 'module'});
    this.worker.onmessage = ({data}) => {
      if (data.type === 'frame') {
        if (data.frame.epoch !== this.epoch) return;
        try {onFrame(this.replica.apply(data.frame, this.current()), data.frame);}
        catch (error) {onError(String(error));}
        this.worker.postMessage({type: 'ack', epoch: this.epoch});
      } else if (data.type === 'result' || data.type === 'error') {
        const pending = this.pending.get(data.id);
        if (pending) {
          this.pending.delete(data.id);
          if (data.type === 'error') pending.reject(new Error(data.message)); else pending.resolve(data.value);
        }
        if (data.type === 'error') onError(data.message);
      }
    };
    this.worker.onerror = event => {
      const error = new Error(event.message || 'Simulation worker stopped');
      for (const entry of this.pending.values()) entry.reject(error);
      this.pending.clear(); onError(error.message);
    };
  }
  reset(snapshot: WorldSnapshot, epoch: number): void {
    for (const entry of this.pending.values()) entry.reject(new Error('World was replaced'));
    this.pending.clear(); this.epoch = epoch;
    this.worker.postMessage({type: 'reset', snapshot, epoch});
  }
  control(settings: SimulationSettings, running: boolean, speed: number, selected: string | null): void {
    this.worker.postMessage({type: 'control', epoch: this.epoch, settings, running, speed, selected});
  }
  private request(type: string, extra: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.worker.postMessage({type, epoch: this.epoch, id, ...extra});
    });
  }
  action(action: WorldAction) { return this.request('action', {action}) as Promise<string | number | null>; }
  snapshot(metadata: Record<string, unknown> = {}) {
    return this.request('snapshot', {metadata}) as Promise<WorldSnapshot>;
  }
  dispose(): void {
    this.worker.terminate();
    for (const entry of this.pending.values()) entry.reject(new Error('Simulation closed'));
    this.pending.clear();
  }
}
