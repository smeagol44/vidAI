import type {Genome, Organism} from './simulation';

type Edge = {edge: string; slot: number};
export interface CompiledBrain {
  ih: Uint8Array; hh: Uint8Array; ho: Uint8Array;
  sensory: Array<Edge & {input: number; hidden: number}>;
  motor: Array<Edge & {output: number; hidden: number}>;
  sensorySlots: Map<string, number>; motorSlots: Map<string, number>;
}
type Entry = {inputs: Genome['inputKeys']; outputs: Genome['outputKeys']; hidden: Genome['hiddenIds'];
  disabled: Genome['disabledConnections']; disabledCount: number; scope: Genome['plasticMotorScope'];
  motorEnabled: boolean; sensoryEnabled: boolean; compiled: CompiledBrain};
const brains = new WeakMap<Genome, Entry>();

/** Transient topology only. Weights are always read from the actual genome.
 * Identity/length changes invalidate the plan; topology editors also explicitly
 * invalidate it, including same-length connection-mask edits. Never serialized. */
export function invalidateCompiledBrain(g: Genome): void { brains.delete(g); }
export function compiledBrain(g: Genome): CompiledBrain {
  const prior = brains.get(g), motorEnabled = (g.plasticityRate ?? 0) > 0;
  const sensoryEnabled = (g.sensoryPlasticityRate ?? 0) > 0;
  if (prior && prior.inputs === g.inputKeys && prior.outputs === g.outputKeys
    && prior.hidden === g.hiddenIds && prior.disabled === g.disabledConnections
    && prior.disabledCount === (g.disabledConnections?.length ?? 0)
    && prior.scope === g.plasticMotorScope && prior.motorEnabled === motorEnabled
    && prior.sensoryEnabled === sensoryEnabled) return prior.compiled;
  const inputs = g.inputKeys!, outputs = g.outputKeys!, hidden = g.hiddenIds!;
  const ih = new Uint8Array(hidden.length * inputs.length);
  const hh = new Uint8Array(hidden.length * hidden.length);
  const ho = new Uint8Array(outputs.length * hidden.length);
  const inputIndex = new Map(inputs.map((key, i) => [key, i]));
  const outputIndex = new Map(outputs.map((key, i) => [key, i]));
  const hiddenIndex = new Map(hidden.map((key, i) => [key, i]));
  for (const key of g.disabledConnections ?? []) {
    const [kind, target, source] = JSON.parse(key) as [string, string, string];
    const t = (kind === 'ho' ? outputIndex : hiddenIndex).get(target);
    const s = (kind === 'ih' ? inputIndex : hiddenIndex).get(source);
    if (t === undefined || s === undefined) continue;
    if (kind === 'ih') ih[t * inputs.length + s] = 1;
    else if (kind === 'hh') hh[t * hidden.length + s] = 1;
    else if (kind === 'ho') ho[t * hidden.length + s] = 1;
  }
  const motor: CompiledBrain['motor'] = [], sensory: CompiledBrain['sensory'] = [];
  const addMotor = (o: number, h: number) => {
    const slot = o * hidden.length + h;
    if (!ho[slot] && motor.length < 96)
      motor.push({edge: JSON.stringify(['ho', outputs[o], hidden[h]]), slot, output: o, hidden: h});
  };
  if (motorEnabled) {
    if (g.plasticMotorScope === 'all') {
      for (let h = 0; h < hidden.length && motor.length < 96; h++)
        for (let o = 0; o < outputs.length && motor.length < 96; o++) addMotor(o, h);
    } else for (let o = 0; o < outputs.length && motor.length < 96; o++) {
      if (outputs[o].endsWith(':Angle'))
        for (let h = 0; h < hidden.length && motor.length < 96; h++) addMotor(o, h);
    }
  }
  if (sensoryEnabled) for (let h = 0; h < hidden.length && sensory.length < 96; h++) {
    for (let i = 0; i < inputs.length && sensory.length < 96; i++) {
      const slot = h * inputs.length + i, key = inputs[i];
      if (!ih[slot] && key.startsWith('eye:') && /:(red|green|blue)$/.test(key))
        sensory.push({edge: JSON.stringify(['ih', hidden[h], key]), slot, input: i, hidden: h});
    }
  }
  const compiled = {ih, hh, ho, motor, sensory,
    motorSlots: new Map(motor.map(e => [e.edge, e.slot])),
    sensorySlots: new Map(sensory.map(e => [e.edge, e.slot]))};
  brains.set(g, {inputs, outputs, hidden, disabled: g.disabledConnections,
    disabledCount: g.disabledConnections?.length ?? 0, scope: g.plasticMotorScope,
    motorEnabled, sensoryEnabled, compiled});
  return compiled;
}

type Somatic = NonNullable<Organism['learnedMotorWeights']>;
const aligned = new WeakMap<Somatic, readonly {edge: string}[]>();
/** Keep saved, ID-keyed records, but reuse them after the first alignment. */
export function alignPlasticRecords(records: Somatic | undefined, edges: readonly {edge: string}[]): Somatic {
  if (records && aligned.get(records) === edges) return records;
  const previous = new Map(records?.map(r => [r.edge, r]));
  const result = edges.map(({edge}) => previous.get(edge) ?? {edge, delta: 0, eligibility: 0});
  aligned.set(result, edges);
  return result;
}

const deltas = new WeakMap<Organism, {plan: CompiledBrain; motor: Float64Array; sensory: Float64Array}>();
export function compiledDeltas(org: Organism, plan: CompiledBrain) {
  let result = deltas.get(org);
  if (!result || result.plan !== plan) {
    result = {plan, motor: new Float64Array(plan.ho.length), sensory: new Float64Array(plan.ih.length)};
    deltas.set(org, result);
  }
  result.motor.fill(0); result.sensory.fill(0);
  for (const record of org.learnedMotorWeights ?? []) {
    const slot = plan.motorSlots.get(record.edge);
    if (slot !== undefined) result.motor[slot] = record.delta;
  }
  for (const record of org.learnedSensoryWeights ?? []) {
    const slot = plan.sensorySlots.get(record.edge);
    if (slot !== undefined) result.sensory[slot] = record.delta;
  }
  return result;
}
