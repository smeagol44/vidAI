"""Read-only analysis of the preregistered #91 archives. Never runs a simulation."""
import gzip
import json
import statistics as st
from collections import Counter
from pathlib import Path

ROOT = Path('docs/experiments')
P = 'architecture-plasticity-v1'
SEEDS = [17, 71, 1901, 4099, 8191]
ARCHS = ['legacy', 'two-output', 'three-output']
FIELDS = ['plasticityRate', 'sensoryPlasticityRate', 'forgettingRate', 'memoryConsolidationRate', 'injuryAversionRate']

def read(name):
    b = (ROOT / (P + name)).read_bytes()
    return json.loads(gzip.decompress(b) if name.endswith('.gz') else b)

def dist(values):
    v = [x for x in values if x is not None]
    return {'n': len(v), 'values': values, 'median': st.median(v) if v else None,
            'min': min(v) if v else None, 'max': max(v) if v else None}

def mode(t):
    counts, nonzero, weighted = Counter(), Counter(), Counter()
    for k, g in t['modeAudit']['groups'].items():
        m = k.rsplit('/', 1)[-1]
        counts[m] += g['samples']
        nonzero[m] += g['nonzeroApplied']
        weighted[m] += g['appliedTorqueRms'] ** 2 * g['samples']
    return {'samples': dict(counts), 'nonzeroApplied': dict(nonzero),
            'appliedTorqueRms': {m: (weighted[m] / n) ** .5 for m, n in counts.items()},
            'transitions': len(t['modeAudit']['transitions']),
            'lateTransitions': sum(x['time'] > 1 for x in t['modeAudit']['transitions'])}

def trial_stats(rows):
    valid = [t for t in rows if t['valid']]
    reasons = Counter(r for t in rows for r in t['reasons'])
    modes, nz = Counter(), Counter()
    head_delta, head_trials = Counter(), Counter()
    for t in valid:
        m = mode(t)
        modes.update(m['samples']); nz.update(m['nonzeroApplied'])
        changed = set()
        for r in t['learningAudit']['somatic']['motor']:
            if r['delta']:
                head = json.loads(r['edge'])[1].rsplit(':', 1)[-1]
                head_delta[head] += abs(r['delta']); changed.add(head)
        head_trials.update(changed)
    costs = lambda ch, field: sum(t['learningAudit']['totals'][ch][field] for t in rows)
    return {'n': len(rows), 'valid': len(valid), 'validFed': sum(t['absorbedJ'] > 0 for t in valid),
            'invalidFed': sum(t['absorbedJ'] > 0 and not t['valid'] for t in rows),
            'reasonsOverlapping': dict(reasons),
            'validAbsorbedJ': sum(t['absorbedJ'] for t in valid),
            'validContactTicks': sum(t['food']['contactTicks'] for t in valid),
            'validIntakeTicks': sum(t['food']['intakeTicks'] for t in valid),
            'validContactEpisodes': sum(sum(i == 0 or r['tick'] != t['nonlethal']['contacts'][i-1]['tick']+1 for i, r in enumerate(t['nonlethal']['contacts'])) for t in valid),
            'validDetected': sum(t['food']['detectionTicks'] > 0 for t in valid),
            'modeValidSamples': dict(modes), 'modeValidNonzeroApplied': dict(nz),
            'validSwitching': sum(mode(t)['transitions'] > 0 for t in valid),
            'validLateSwitching': sum(mode(t)['lateTransitions'] > 0 for t in valid),
            'validSwitchingFeeders': sum(mode(t)['transitions'] > 0 and t['absorbedJ'] > 0 for t in valid),
            'validOscillatorTrials': sum(mode(t)['samples'].get('oscillator', 0) > 0 for t in valid),
            'validOscillatorFeeders': sum(mode(t)['samples'].get('oscillator', 0) > 0 and t['absorbedJ'] > 0 for t in valid),
            'learning': {ch: {f: costs(ch, f) for f in ['upkeepJ', 'rewriteJ', 'requestedRewriteJ', 'costJ']} for ch in ['motor', 'sensory']},
            'actualMotorChanges': sum(t['learningAudit']['motorL1'] > 0 for t in rows),
            'actualSensoryChanges': sum(t['learningAudit']['sensoryL1'] > 0 for t in rows),
            'validActualMotorChanges': sum(t['learningAudit']['motorL1'] > 0 for t in valid),
            'validActualSensoryChanges': sum(t['learningAudit']['sensoryL1'] > 0 for t in valid),
            'unfedValidWithAcquiredChanges': sum(t['absorbedJ'] == 0 and (t['learningAudit']['motorL1'] > 0 or t['learningAudit']['sensoryL1'] > 0) for t in valid),
            'validMotorHeadDeltaL1Sum': dict(head_delta), 'validMotorHeadChangedTrials': dict(head_trials),
            'motorL1': dist([t['learningAudit']['motorL1'] for t in valid]),
            'sensoryL1': dist([t['learningAudit']['sensoryL1'] for t in valid]),
            'learningCostJ': dist([t['learningAudit']['costJ'] for t in valid]),
            'motorJ': dist([t['motorJ'] for t in valid]), 'positiveJ': dist([t['positiveJ'] for t in valid]),
            'brakingJ': dist([t['brakingJ'] for t in valid]),
            'chemicalExpenditureJ': dist([t['chemicalExpenditureJ'] for t in valid]),
            'netReserveChangeJ': dist([-t['spentJ'] for t in valid]),
            'wallMsAll': dist([t['wallMs'] for t in rows]),
            'maxChemicalErrorJ': max((abs(t['chemicalErrorJ']) for t in rows), default=0),
            'maxPartitionResidualJ': max((abs(t['partitionResidualJ']) for t in rows), default=0),
            'maxDeliveryError': max((t['deliveryError'] for t in rows), default=0),
            'guardsAll': sum(t['guards'] for t in rows), 'energyLimitedAll': sum(t['energyLimited'] for t in rows),
            'wouldBeDeathTrials': sum(bool(t['nonlethal']['wouldBeDeaths']) for t in rows)}

summary = {'version': P, 'seeds': SEEDS, 'groups': [], 'ablations': []}
for stage in ['off', 'mutable']:
    manifest = read('-' + stage + '.json')
    champs = read('-' + stage + '-champions.json.gz')['champions']
    held = read('-' + stage + '-held-out.json.gz')['heldOut']
    ablated = read('-mutable-ablations.json.gz')['ablations'] if stage == 'mutable' else []
    for arch in ARCHS:
        runs, all_trials, coverages = [], [], []
        for seed in SEEDS:
            c = next(c for c in champs if c['architecture'] == arch and c['seed'] == seed)
            r = next(r for r in manifest['runs'] if r['architecture'] == arch and r['seed'] == seed)
            previous = c['initial']['trial']['absorbedJ'] if c['initial']['trial']['valid'] else None
            improvements = feasibility = 0
            accepted = []
            for gen in range(1, 16):
                d = read(f'-{stage}-{arch}-{seed}-g{gen:02}.json.gz')
                all_trials.extend(o['trial'] for o in d['offspring'])
                coverages.extend(o['coverage'] for o in d['offspring'])
                if d['selectedIndex'] >= 0:
                    if previous is None:
                        feasibility += 1
                    elif d['bestJ'] > previous:
                        improvements += 1
                    accepted.append({'generation': gen, 'index': d['selectedIndex'], 'J': d['bestJ'],
                                     'previousValidJ': previous, 'mutation': d['selectedMutation']})
                previous = d['bestJ']
            t = c['champion']['training'] if c['champion'] else None
            g = c['champion']['genome'] if c['champion'] else c['initial']['genome']
            runs.append({'seed': seed, 'founderJ': r['initialJ'], 'founderValid': r['initialValid'],
                         'championAvailable': bool(t), 'finalJ': r['finalJ'],
                         'improvementJOverValidFounder': t['absorbedJ'] - r['initialJ'] if t and r['initialValid'] else None,
                         'strictIntakeImprovements': improvements, 'feasibilitySelections': feasibility,
                         'accepted': accepted, 'selectedAt': r['selectedAt'],
                         'traits': {f: g.get(f, 0) for f in FIELDS},
                         'masks': g['plasticConnections'], 'coverage': c['champion']['coverage'] if t else c['initial']['coverage'],
                         'championMetrics': None if not t else {k: t[k] for k in ['absorbedJ', 'distance', 'motorJ', 'positiveJ', 'brakingJ', 'chemicalExpenditureJ', 'spentJ', 'remainingJ', 'food', 'anchorPx', 'limitRad', 'guards', 'peakConstraintOmega', 'peakPostContactOmega']},
                         'championMode': mode(t) if t else None,
                         'championLearning': None if not t else {k: v for k, v in t['learningAudit'].items() if k != 'somatic'},
                         'curve': [r['initialJ'] if r['initialValid'] else None] + [d['bestJ'] for d in r['generations']],
                         'medianOffspringCurve': [d['medianValidJ'] for d in r['generations']]})
        h = [r for r in held if r['architecture'] == arch and r['championAvailable']]
        fallback = [r for r in held if r['architecture'] == arch and not r['championAvailable']]
        group = {'stage': stage, 'architecture': arch, 'runs': runs,
                 'finals': dist([r['finalJ'] for r in runs]),
                 'strictIntakeImprovements': sum(r['strictIntakeImprovements'] for r in runs),
                 'feasibilitySelections': sum(r['feasibilitySelections'] for r in runs),
                 'offspring': trial_stats(all_trials),
                 'offspringCoverage': {'motorCountRange': [min(c['motor'] for c in coverages), max(c['motor'] for c in coverages)],
                                       'sensoryCountRange': [min(c['sensory'] for c in coverages), max(c['sensory'] for c in coverages)],
                                       'anyOutputUncovered': sum(any(n == 0 for n in c['outputs'].values()) for c in coverages)},
                 'champions': trial_stats([c['champion']['training'] for c in champs if c['architecture'] == arch and c['champion']]),
                 'heldOut': trial_stats([r['trial'] for r in h]),
                 'heldOutRows': [{'seed': r['seed'], 'environmentSeed': r['condition']['seed'], 'valid': r['trial']['valid'], 'J': r['trial']['absorbedJ'], 'reasons': r['trial']['reasons']} for r in h],
                 'failedFallbackHeldOut': trial_stats([r['trial'] for r in fallback])}
        summary['groups'].append(group)
        if stage == 'mutable':
            pairs = []
            for r in h:
                a = next(x for x in ablated if x['architecture'] == arch and x['seed'] == r['seed'] and x['conditionIndex'] == r['conditionIndex'])
                x, y = r['trial'], a['trial']
                pairs.append({'seed': r['seed'], 'environmentSeed': r['condition']['seed'],
                              'onValid': x['valid'], 'offValid': y['valid'], 'onJ': x['absorbedJ'], 'offJ': y['absorbedJ'],
                              'onMinusOffJ': x['absorbedJ'] - y['absorbedJ'],
                              'onReasons': x['reasons'], 'offReasons': y['reasons'],
                              'onCostJ': x['learningAudit']['costJ'], 'offCostJ': y['learningAudit']['costJ'],
                              'onMotorL1': x['learningAudit']['motorL1'], 'onSensoryL1': x['learningAudit']['sensoryL1'],
                              'onMotorJ': x['motorJ'], 'offMotorJ': y['motorJ'],
                              'onChemicalJ': x['chemicalExpenditureJ'], 'offChemicalJ': y['chemicalExpenditureJ']})
            both = [r for r in pairs if r['onValid'] and r['offValid']]
            summary['ablations'].append({'architecture': arch, 'pairs': pairs, 'bothValid': len(both),
                                         'onBetter': sum(r['onMinusOffJ'] > 0 for r in both),
                                         'offBetter': sum(r['onMinusOffJ'] < 0 for r in both),
                                         'equal': sum(r['onMinusOffJ'] == 0 for r in both),
                                         'differenceJ': dist([r['onMinusOffJ'] for r in both])})
(ROOT / (P + '-summary.json')).write_text(json.dumps(summary, indent=2) + '\n')

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
colors = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#D55E00']
fig, axes = plt.subplots(2, 3, figsize=(14, 8), sharex=True, sharey=True)
for ax, group in zip(axes.flat, summary['groups']):
    for i, r in enumerate(group['runs']):
        values = [np.nan if v is None else v for v in r['curve']]
        label = str(r['seed']) + (' (no valid champion)' if r['finalJ'] is None else '')
        ax.plot(range(16), values, color=colors[i], marker='.', linewidth=1.3, label=label)
    ax.set_title(group['stage'].upper() + ' / ' + group['architecture'])
    ax.set_xticks([0, 5, 10, 15]); ax.grid(alpha=.2)
    ax.legend(fontsize=7, loc='upper left')
for ax in axes[1]: ax.set_xlabel('Generation (0 = randomized founder)')
for ax in axes[:, 0]: ax.set_ylabel('Best valid absorbed nutrient energy (J)')
fig.suptitle('Fixed #91 experiment: all 30 independent runs; gaps mean no valid parent', fontsize=13)
fig.tight_layout(); fig.savefig(ROOT / (P + '-curves.png'), dpi=150); plt.close(fig)

fig, ax = plt.subplots(figsize=(11, 5))
for i, group in enumerate(summary['groups']):
    for j, r in enumerate(group['runs']):
        if r['finalJ'] is not None:
            ax.scatter(i + (j-2)*.06, r['finalJ'], color=colors[j], s=48)
    if group['finals']['n']:
        ax.hlines(group['finals']['median'], i-.25, i+.25, color='black', linewidth=2)
    ax.text(i, 18800, f"{5-group['finals']['n']}/5 no valid\nchampion", ha='center', fontsize=8)
ax.set_xticks(range(6), [g['architecture'] + '\n' + g['stage'].upper() for g in summary['groups']])
ax.set_ylabel('Final valid champion absorbed energy (J)'); ax.set_ylim(-500, 22000); ax.grid(axis='y', alpha=.2)
ax.set_title('Five-seed distributions; black line = valid-run median; failures excluded, never imputed zero')
for j, seed in enumerate(SEEDS): ax.scatter([], [], color=colors[j], label=str(seed))
ax.legend(title='Starting brain seed', ncol=5, loc='upper center', fontsize=8)
fig.tight_layout(); fig.savefig(ROOT / (P + '-distribution.png'), dpi=150); plt.close(fig)
print(json.dumps({'groups': [{k: g[k] for k in ['stage', 'architecture', 'finals', 'strictIntakeImprovements', 'feasibilitySelections']} for g in summary['groups']],
                  'ablations': [{k: a[k] for k in ['architecture', 'bothValid', 'onBetter', 'offBetter', 'equal', 'differenceJ']} for a in summary['ablations']]}, indent=2))
