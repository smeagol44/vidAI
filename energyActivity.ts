import type {Organism} from './simulation';

/** Primitive receipts only: no organism reference can be changed by this observer.
 * part=-1 is actual absorption; part>=0 is actual extraction from that body part. */
export type EnergyTransferObserver = (id: string, time: number, joules: number,
  stock: number, capacity: number, part: number) => void;
export const ENERGY_WINDOW = .25;
export const ENERGY_ON = .005;
export const ENERGY_OFF = .0035;
const SLOTS = 16;
class Signal {
  readonly times = new Float64Array(SLOTS).fill(-Infinity);
  readonly joules = new Float64Array(SLOTS);
  readonly stocks = new Float64Array(SLOTS);
  active = false;
  seen = false;
  add(time: number, amount: number, reference: number) {
    const slot = Math.floor(time * 60 + 1e-6) % SLOTS;
    if (this.times[slot] !== time) {
      this.times[slot] = time; this.joules[slot] = 0; this.stocks[slot] = 0;
    }
    this.joules[slot] += amount;
    this.stocks[slot] = Math.max(this.stocks[slot], reference);
  }
  advance(time: number) {
    let amount = 0, reference = 0;
    for (let i = 0; i < SLOTS; i++) if (time - this.times[i] < ENERGY_WINDOW - 1e-9) {
      amount += this.joules[i]; reference = Math.max(reference, this.stocks[i]);
    }
    this.active = reference > 0 && amount / reference >= (this.active ? ENERGY_OFF : ENERGY_ON);
    this.seen ||= this.active;
    return amount > 0;
  }
}
type Activity = {gain: Signal; loss: Signal; parts: Map<number, number>; seenParts: Set<number>};
export type EnergyActivityFrame = Array<{id: string; gain: boolean; gainSeen: boolean;
  loss: boolean; lossSeen: boolean; parts: number[]; seenParts: number[]}>;

/** Transient host-owned state, never attached to a world, genome or save. */
export class EnergyActivityCollector {
  private entries = new Map<string, Activity>();
  clear() {this.entries.clear();}
  readonly record: EnergyTransferObserver = (id, time, joules, stock, capacity, part) => {
    if (!(joules > 0)) return;
    let entry = this.entries.get(id);
    if (!entry) {
      entry = {gain: new Signal(), loss: new Signal(), parts: new Map(), seenParts: new Set()};
      this.entries.set(id, entry);
    }
    // Stable maximum pre-transfer stock in the window; 1% of inherited capacity
    // prevents near-empty numerical sensitivity while retaining structural injury.
    const reference = Math.max(stock, capacity * .01, 1e-9);
    (part < 0 ? entry.gain : entry.loss).add(time, joules, reference);
    if (part >= 0) entry.parts.set(part, time);
  };
  advance(state: {simTime: number; organisms: Pick<Organism, 'id' | 'dissolving'>[]}) {
    for (const [id, entry] of this.entries) {
      const org = state.organisms.find(o => o.id === id);
      if (!org || org.dissolving) {this.entries.delete(id); continue;}
      const gain = entry.gain.advance(state.simTime), loss = entry.loss.advance(state.simTime);
      for (const [part, time] of entry.parts) {
        if (state.simTime - time >= ENERGY_WINDOW - 1e-9) entry.parts.delete(part);
        else if (entry.loss.active) entry.seenParts.add(part);
      }
      if (!gain && !loss && !entry.gain.seen && !entry.loss.seen) this.entries.delete(id);
    }
  }
  frame(): EnergyActivityFrame {
    const result: EnergyActivityFrame = [];
    for (const [id, e] of this.entries) {
      result.push({id, gain: e.gain.active, gainSeen: e.gain.seen, loss: e.loss.active,
        lossSeen: e.loss.seen, parts: e.loss.active ? [...e.parts.keys()] : [], seenParts: [...e.seenParts]});
      e.gain.seen = e.loss.seen = false; e.seenParts.clear();
    }
    return result;
  }
}

type Display = {gain: boolean; gainLevel: number; loss: boolean; lossLevel: number;
  parts: Set<number>; fadingParts: Map<number, number>};
export const ENERGY_CYCLE_MS = 400;
export const ENERGY_FADE_MS = 100;
const NO_TINT: [number, number] = [0, 0];
export class EnergyActivityPresentation {
  private entries = new Map<string, Display>();
  private previous: number | undefined;
  private paused = true;
  private pending?: EnergyActivityFrame;
  phaseMs = 0;
  clear() {this.entries.clear(); this.phaseMs = 0; this.previous = undefined; this.pending = undefined;}
  setPaused(paused: boolean, now: number) {
    this.paused = paused; this.previous = now;
    if (!paused && this.pending) {const frame = this.pending; this.pending = undefined; this.accept(frame);}
  }
  accept(frame: EnergyActivityFrame) {
    if (this.paused) {this.pending = frame; return;}
    const received = new Set<string>();
    for (const row of frame) {
      received.add(row.id);
      let e = this.entries.get(row.id);
      if (!e) {
        e = {gain: false, gainLevel: 0, loss: false, lossLevel: 0, parts: new Set(), fadingParts: new Map()};
        this.entries.set(row.id, e);
      }
      e.gain = row.gain; e.loss = row.loss;
      // Preserve significant intervals crossed between rendered frames, without
      // queuing pulses or extending them for a complete cycle after activity ends.
      if (row.gain || row.gainSeen) e.gainLevel = 1;
      if (row.loss || row.lossSeen) e.lossLevel = 1;
      for (const part of e.parts) if (!row.parts.includes(part)) e.fadingParts.set(part, 1);
      e.parts.clear();
      for (const part of row.parts) e.parts.add(part);
      for (const part of row.seenParts) if (!e.parts.has(part)) e.fadingParts.set(part, 1);
    }
    for (const [id, e] of this.entries) if (!received.has(id)) {e.gain = e.loss = false;}
  }
  advance(now: number, paused: boolean, organisms: Pick<Organism, 'id' | 'dissolving'>[]) {
    const dt = this.previous === undefined || paused || this.paused ? 0 : Math.max(0, now - this.previous);
    this.previous = now; this.paused = paused;
    this.phaseMs = (this.phaseMs + dt) % ENERGY_CYCLE_MS;
    for (const [id, e] of this.entries) {
      if (!organisms.some(o => o.id === id && !o.dissolving)) {this.entries.delete(id); continue;}
      if (!e.gain) e.gainLevel = Math.max(0, e.gainLevel - dt / ENERGY_FADE_MS);
      if (!e.loss) e.lossLevel = Math.max(0, e.lossLevel - dt / ENERGY_FADE_MS);
      for (const [part, level] of e.fadingParts) {
        const next = level - dt / ENERGY_FADE_MS;
        if (next <= 0 || e.parts.has(part)) e.fadingParts.delete(part);
        else e.fadingParts.set(part, next);
      }
      if (!e.gainLevel && !e.lossLevel) this.entries.delete(id);
    }
  }
  intensity(id: string, part: number): [number, number] {
    const e = this.entries.get(id); if (!e) return NO_TINT;
    const wave = Math.cos(this.phaseMs / ENERGY_CYCLE_MS * Math.PI * 2);
    // Only one strong lobe at a time. A faint trough keeps crossed high-speed
    // intervals visible even when their short fade falls between intensity peaks.
    return [(.025 + .215 * Math.max(0, -wave) ** 2) * e.gainLevel,
      (.025 + .255 * Math.max(0, wave) ** 2) * e.lossLevel * (e.parts.has(part) ? 1 : e.fadingParts.get(part) ?? 0)];
  }
}

const GLOW_WIDTHS = [21, 15, 10, 6, 2];
const GLOW_STRENGTHS = [.25, .35, .50, .70, 1.3];

/** Translucent contours in CSS pixels, painted underneath the normal body. */
export function drawEnergyGlow(ctx: CanvasRenderingContext2D, presentation: EnergyActivityPresentation,
  id: string, part: number, zoom: number) {
  const [green, red] = presentation.intensity(id, part);
  if (!(green > 0 || red > 0)) return;
  ctx.save();
  ctx.lineJoin = 'round';
  // Wider, translucent falloff without blur/filter surfaces or extra geometry.
  // The existing path, phase and localized activity are unchanged.
  for (let pass = 0; pass < GLOW_WIDTHS.length; pass++) {
    ctx.lineWidth = GLOW_WIDTHS[pass] / zoom;
    const strength = GLOW_STRENGTHS[pass];
    if (green > 0) {ctx.strokeStyle = `rgba(34,220,105,${green * strength})`; ctx.stroke();}
    if (red > 0) {ctx.strokeStyle = `rgba(245,55,65,${red * strength})`; ctx.stroke();}
  }
  ctx.restore();
}
