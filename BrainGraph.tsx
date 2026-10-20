import React from 'react';
import {compiledBrain} from './neuralRuntime';
import {brainEdgeKey, getBrainLayout, OUTPUT_LABELS, OUTPUTS_PER_JOINT, type Organism} from './simulation';

export default function BrainGraph({organism: org, threshold}: {organism: Organism; threshold: number}) {
  const g = org.genome, layout = getBrainLayout(g);
  const hiddenIds = g.hiddenIds ?? org.neuralHidden.map((_, i) => `hidden:${i}`);
  const height = Math.max(300, Math.max(org.neuralInputs.length, hiddenIds.length, layout.outputs.length) * 12 + 20);
  const x = [105, 250, 400];
  const positions = (n: number) => Array.from({length: n}, (_, i) => 12 + i * (height - 24) / Math.max(1, n - 1));
  const inputs = positions(org.neuralInputs.length), hidden = positions(hiddenIds.length), outputs = positions(layout.outputs.length);
  const plan = compiledBrain(g);
  const learned = new Map((org.learnedMotorWeights ?? []).map(e => [plan.motorSlots.get(e.edge), e.delta]));
  const learnedRetina = new Map((org.learnedSensoryWeights ?? []).map(e => [plan.sensorySlots.get(e.edge), e.delta]));
  const acquiredCount = [...learned.values()].filter(value => Math.abs(value) > 1e-8).length;
  const acquiredRetina = [...learnedRetina.values()].filter(value => Math.abs(value) > 1e-8).length;
  const links: React.ReactNode[] = [];
  const link = (key: string, edge: string, fromX: number, fromY: number, toX: number, toY: number, weight: number, activation: number, recurrent = false) => {
    if (Math.abs(weight) <= threshold) return;
    const color = weight > 0 ? '6,182,212' : '244,63,94';
    const opacity = Math.min(recurrent ? .35 : .85, .08 + Math.abs(weight * activation) * .7);
    links.push(<path key={edge} data-synapse={edge} d={recurrent
      ? `M${fromX},${fromY} C${fromX + 52},${fromY - 10} ${toX + 52},${toY + 10} ${toX},${toY}`
      : `M${fromX},${fromY} L${toX},${toY}`}
      fill="none" stroke={`rgba(${color},${opacity})`} strokeWidth={Math.min(2, .4 + Math.abs(weight) * .5)}>
      <title>{key + ': weight ' + weight.toFixed(4) + ', source activation ' + activation.toFixed(4)}</title>
    </path>);
  };
  for (let h = 0; h < hiddenIds.length; h++) {
    for (let i = 0; i < inputs.length; i++) {
      const slot = h * layout.inputs.length + i;
      if (plan.ih[slot]) continue;
      const gene = g.weightsIH[h]?.[i] ?? 0, acquired = learnedRetina.get(slot) ?? 0;
      if (Math.abs(gene + acquired) <= threshold) continue;
      const edge = brainEdgeKey('ih', hiddenIds[h], layout.inputs[i]);
      const description = `${layout.labels[i]} → ${hiddenIds[h]}`
        + (acquired ? ` (inherited ${gene.toFixed(4)}, retinal memory Δ${acquired.toFixed(4)})` : '');
      link(description, edge, x[0], inputs[i], x[1], hidden[h], gene + acquired, org.neuralInputs[i] ?? 0);
    }
    for (let prev = 0; prev < hiddenIds.length; prev++) {
      if (plan.hh[h * hiddenIds.length + prev] || Math.abs(g.weightsHH[h]?.[prev] ?? 0) <= threshold) continue;
      const edge = brainEdgeKey('hh', hiddenIds[h], hiddenIds[prev]);
      link(`${hiddenIds[prev]} → ${hiddenIds[h]}`, edge, x[1], hidden[prev], x[1], hidden[h], g.weightsHH[h]?.[prev] ?? 0, org.neuralHidden[prev] ?? 0, true);
    }
  }
  for (let o = 0; o < outputs.length; o++) for (let h = 0; h < hiddenIds.length; h++) {
    const slot = o * hiddenIds.length + h;
    if (plan.ho[slot]) continue;
    const somaticOffset = learned.get(slot) ?? 0;
    const inheritedWeight = g.weightsHO[o]?.[h] ?? 0;
    if (Math.abs(inheritedWeight + somaticOffset) <= threshold) continue;
    const edge = brainEdgeKey('ho', layout.outputs[o], hiddenIds[h]);
    const label = `${hiddenIds[h]} → ${layout.outputs[o]}`
      + (somaticOffset !== 0 ? ` (inherited ${inheritedWeight.toFixed(4)}, acquired Δ${somaticOffset.toFixed(4)})` : '');
    link(label, edge, x[1], hidden[h], x[2], outputs[o], inheritedWeight + somaticOffset, org.neuralHidden[h] ?? 0);
  }
  return <div className="w-full max-h-72 overflow-y-auto">
    {((g.plasticityRate ?? 0) > 0 || (g.sensoryPlasticityRate ?? 0) > 0) && <div className="text-xs text-slate-400 px-2 py-1">
      Lifetime learning: genetically enabled (motor rate {(g.plasticityRate ?? 0).toFixed(3)}/s,
      retinal rate {(g.sensoryPlasticityRate ?? 0).toFixed(3)}/s,
      memory retention {(g.memoryConsolidationRate ?? 0).toFixed(3)}/s,
      forgetting {(g.forgettingRate ?? .1).toFixed(3)}/s),
      {' '}scope {g.plasticMotorScope ?? 'angle'},
      pain-aversion {(g.injuryAversionRate ?? 0).toFixed(3)}/s,
      {' '}{acquiredCount} adapted motor and {acquiredRetina} adapted retinal synapses,
      {' '}{[...(org.learnedMotorWeights ?? []), ...(org.learnedSensoryWeights ?? [])]
        .filter(s=>(s.consolidation ?? 0) > .01).length} stabilized synapses; energy cost {(org.plasticityEnergyRate ?? 0).toFixed(4)} J/s.
      Links show inherited weight + personal learned adjustment in both motor and retinal pathways.
    </div>}
    <svg viewBox={`0 0 460 ${height}`} className="w-full select-none" style={{height}} role="img" aria-label="Live recurrent neural network">
      {links}
      {inputs.map((y, i) => <g key={layout.inputs[i]}>
        <circle cx={x[0]} cy={y} r={3} fill={`rgba(6,182,212,${.25 + Math.min(1, Math.abs(org.neuralInputs[i] ?? 0)) * .75})`}>
          <title>{layout.labels[i] + ': ' + (org.neuralInputs[i] ?? 0).toFixed(4)}</title>
        </circle>
        <text x={x[0] - 6} y={y + 2.5} fontSize="7" textAnchor="end" fill="#94a3b8" fontFamily="monospace">{layout.labels[i]}</text>
      </g>)}
      {hidden.map((y, i) => <circle data-hidden-neuron={hiddenIds[i]} key={hiddenIds[i]} cx={x[1]} cy={y} r={4}
        fill={`rgba(${(org.neuralHidden[i] ?? 0) >= 0 ? '168,85,247' : '244,63,94'},${.3 + Math.abs(org.neuralHidden[i] ?? 0) * .7})`}>
        <title>{hiddenIds[i] + ': ' + (org.neuralHidden[i] ?? 0).toFixed(4) + ' · activation memory τ=' + (g.hiddenTimeConstants?.[i] ?? 0).toFixed(2) + ' s'}</title>
      </circle>)}
      {outputs.map((y, i) => <g key={layout.outputs[i]}>
        <circle cx={x[2]} cy={y} r={3.2} fill="#f59e0b">
          <title>{layout.outputs[i] + ': ' + (org.neuralOutputs[i] ?? 0).toFixed(4)}</title>
        </circle>
        <text x={x[2] + 6} y={y + 2.5} fontSize="7" fill="#fde68a" fontFamily="monospace">
          J{Math.floor(i / OUTPUTS_PER_JOINT) + 1}:{OUTPUT_LABELS[i % OUTPUTS_PER_JOINT]}
        </text>
      </g>)}
    </svg>
  </div>;
}
