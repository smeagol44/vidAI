# Causal torque-demand audit — issue #59 / draft #72

**Implemented on the experimental branch; unmerged and undeployed.**
This audit preserves the completed [four-controller study](gated-controller-comparison.md)
and its [raw report](gated-worker-v1.json). New receipts/results are in
[torque-demand-v1.json](torque-demand-v1.json). No evolutionary search, ecology
rerun, strength sweep, drag change, catalogue tuning or baseline reset occurs.

## Scope and causal controls

Darter (CUR-001), Twin Oar (CUR-002) and Branchstalker (CUR-009) use the same
three seed/heading/viscosity conditions and normal reserves as the completed
study. Each of 54 actual built-Worker trials advances 300 fixed ticks:

- Original six-output servo/CPG, with its frozen inherited neural head.
- A fresh-head **legacy servo** null: only copied HO rows/biases change, keeping
  all six legacy meanings, enabled topology, recurrent/sensory genes, body,
  oscillator, force limits, learning, economy and environment. The first three
  rows use the candidates' latent draw stream; the extra three use an independent
  stream with the identical weight/bias distribution. This is a single matched
  initialization control, with no selection or optimization.
- The four unchanged two-/three-output × hard/hysteresis candidates.

Fresh-head legacy is a deliberate offline counterfactual, not a modified
starter or silently converted historical save. Different channel meanings and
row counts prevent calling it a perfectly equivalent policy. The nine paired
legacy controls isolate the effect of **this** head reset under the old actuator;
they do not estimate an architecture-independent initialization penalty.

## Implemented read-only instrumentation

`actuationObservation.ts` defines frozen scalar receipts. An optional observer
reads every physical substep: normalized neural command; raw pre-limit torque;
bounded requested torque; actual paid torque; oscillator wave/strength;
proportional and damping terms; relative angle/velocity; available reserve,
budget scale, positive/braking work and chemical debit; individual speed guards;
accepted constraint angular velocities; and post-contact substep joint errors.

Simulation torque, work and integration arithmetic/order are unchanged. No
observer return is consumed. Receipts never enter brains, genomes, snapshots,
Worker frames or production controls. `experiment-step` opts in with
`auditTorque: true` only on a paused, explicit experimental passive-work-v3 world;
ordinary runs do not collect these receipts. Histories retain only initial
samples/first guard examples; aggregate counters cover **all** substeps.
Raw `maxAngularSpeed`/`maxLinearSpeed` fields are peaks among guard receipts;
post-solve peaks are reported separately, including trials with no guard.

Normalized demand means torque divided by the **common unmodulated**
`Iavg * 2200` reference. Ceiling utilization instead divides by the actual ceiling
(which the old servo can modulate). Raw servo clipping, waveform clipping,
near-ceiling demand and reserve limiting are separate counters. A fresh legacy
head can internally clip its PD demand while later engagement lowers delivered
utilization; those stages must not be conflated.

All **45 existing representative metric rows match the archived report exactly**
through the actual built Worker. Full authoritative snapshots, PRNG and metrics
also match observed/unobserved host and built-Worker controls. The original
report's SHA-256 is retained and checked before/after the audit. No physics/save
schema, prior result, guard or release gate is changed.

## Confirmed findings

### 1. Funding and capacity saturation do not explain the gated loss

Across **115,200 gated joint/substep samples**, budget limiting is zero and
applied torque equals requested torque exactly. No candidate raw torque or
waveform is clipped; none reaches 95% of its ceiling. Maximum utilization is
**91.25%**. The ceiling is functioning primarily as the neural gain in
`torque = normalizedDemand * ceiling`, rather than as a binding limiter here.

Every original legacy reference torque also fits within the unmodulated
candidate envelope: maximum absolute normalized request **0.8429**. Thus the
candidate envelope can represent each sampled legacy torque as a DIRECT demand
`u = torque / ceiling` without increasing strength. This is an envelope check,
not proof that a fresh recurrent head can generate that trace or close the same
feedback loop. It does not validate inertia-based muscles biologically.

### 2. Head initialization alone causes major loss under unchanged old physics

| Frozen family | Original median travel | Fresh-head legacy median | Gated median (all four, three conditions) |
| --- | ---: | ---: | ---: |
| Darter | 190.50 px | 32.81 px | 1.50 px |
| Twin Oar | 39.05 px | 2.71 px | 7.92 px |
| Branchstalker | 64.70 px | 5.81 px | 12.78 px |

All nine fresh-head legacy controls lose travel: **75.75–94.10%, median 91.05%**
relative to their paired original controllers. This demonstrates that comparing
calibrated old heads with fresh new heads cannot isolate actuator quality.
It cannot be converted into a percentage of the earlier four-controller loss:
these are three representative families, one initialization distribution and
non-equivalent channel meanings, without a matched trained new policy.

### 3. Demand/feedback problems are distinct from scalar strength shortage

The same normalized gain has different effects across bodies. Gated RMS demand
is **1.92–2.59×** the original Darter demand and **7.71–10.39×** Twin Oar's.
For Branchstalker it is **0.39–1.03×**, yet travel still regresses and guards rise.
Therefore neither “all muscles are too weak” nor “all commands are uniformly too
large” fits these results.

Original references spend **0%** of joint samples requesting torque outward
while at ≥95% of anatomical angular travel. Gated groups spend **36–39%** there
in aggregate (including passive time), with substantial OFF occupancy too.
The old proportional/damping feedback has been replaced by fresh signed/CPG
commands; a torque sinusoid is not the old sinusoidal position servo.
These are observed ineffective/unstable policies, not a demonstrated ceiling on
what the new brain could eventually learn or evolve. No smaller gain is selected.

### 4. Guard causes include current forcing and constraint redistribution

| Configuration | Angular guards | Motor necessary in this force step | Already overspeed on entry | Constraint-created overspeed samples |
| --- | ---: | ---: | ---: | ---: |
| Original legacy | 0 | 0 | 0 | 0 |
| Fresh-head legacy | 46 | 43 | 4 | 6 |
| Two, hard | 2,050 | 1,752 | 360 | 368 |
| Two, hysteresis | 2,289 | 2,087 | 232 | 240 |
| Three, hard | 2,266 | 1,960 | 358 | 379 |
| Three, hysteresis | 2,310 | 2,045 | 318 | 331 |

All **8,915** gated guard events are angular; no linear speed guard fires.
Holding the actual incoming state and external-force increment fixed, removing
only that substep's motor increment would avoid **7,844 crossings (87.99%)**.
This is an algebraic one-force-step counterfactual; no control trajectory is
modified. The decomposition reconciles within 1.4e-14 rad/s. It is not a claim
that 88% of the *whole-run travel regression* has been causally allocated.

There are **1,268** guards whose incoming angular speed already exceeds 20 rad/s.
Accepted joint batches separately create **1,318** below-to-above-20 samples,
with peaks up to **25.63 rad/s**, despite batch kinetic passivity. These categories
can overlap and are not a partition. Passive energy redistribution can increase
an individual part's speed; placing the guard before that solve does not enforce
a final per-part speed bound. This confirms an additional solver/guard interaction,
not a warrant to remove guards or assume the entire solver is energy-conserving.
Broader contact and pose effects are not excluded by this diagnostic.

Substep observation also catches Branchstalker three-output/hysteresis seed 71
anchor error **0.568 px**, versus its tick-sampled 0.433 px. The original result
is retained; the added observation reveals an unsampled peak and does not reset
or relax any movement/pose acceptance criterion.

## What is not established

No unique percentage attribution among initialization, changed feedback, waveform
semantics and command normalization is identified. A sufficiently trained new
policy is absent. A universal amplitude reduction is contradicted as a complete
explanation by Branchstalker's lower RMS demand. No anatomical capacity, muscle
mass/force-speed/isometric cost, preferred output architecture or hysteresis
constant is chosen. The 60-second ecological failures remain in the prior report;
this five-second audit does not establish their complete causal chain or sustained
survival, feeding, learning or natural selection.

## Physical decisions needed — #61 and #60

| Issue | Established diagnostic | Decision still needed |
| --- | --- | --- |
| #61 units | Existing work factor is 1.75e-7 J per simulated M·px²/s². Code comments split it into 1 px=0.001 m and 1 M=0.175 kg; time advances in simulated seconds. | Adopt or replace that dimensional reference explicitly; choose physical depth/areal density and a fluid regime before deriving coefficients. The energy factor fixes a product, not unique length/mass/depth references. |
| #61 drag | Unchanged isolated drag Euler damping fractions are ≤0.0321 per substep for these bodies, within dissipative free-drag bounds. | Choose a defensible fluid/traction law and viscosity normalization, including longitudinal/rotational consistency. This local check does not validate the calibrated fluid law or exclude coupled artifacts; rejected #52 remains rejected. |
| #60 capacity | Inertia×2200 is an unused clipping ceiling but an active neural gain; all reference torques fit it. At full command it implies a free relative angular-velocity kick of **18.66–57.20 rad/s per 1/240s** for these joints, before drag/constraints. | Define anatomical muscle budget/cross-section/lever and physical torque/cost/force-speed limits independently of a desire to recover a starter's movement. Decide how dimensionless activation relates to that capacity. Raising strength is unsupported by this evidence. |
| #60 cost | Work is prepaid with 25% efficiency; negative mechanical work is observed separately, and no isometric activation charge exists. Dense-24 reference-normalized neural upkeep remains unchanged. | Decide activation/maintenance/braking costs and extra output-head complexity costs; do not infer realistic biological efficiency from chemical-ledger closure. |
| #59 controller/solver | Fresh heads are uncalibrated, direct torque removes inherited PD feedback, and accepted constraints can re-create angular overspeed. | Preserve independent, immediate signed control; review policy comparability and constraint/guard interaction separately. No arbitrary smoothing, gain fitting, speed-cap relaxation or guaranteed gait. |

A pure change of unit labels cannot change these dimensionless trajectories or
guard counts. Resolve physical references first, then judge a new physical law
in an explicit versioned experiment; neither a unit table nor ledger closure
constitutes successful swimming.

**Precise next action:** take the current conversions and scale table to #61,
record the chosen dimensional reference/depth/fluid regime (or explicitly retain
the calibrated approximation), then scope #60's anatomical capacity and activation
cost against it. Keep the controller study unpromoted. Before any future claim
about actuator superiority, require a policy-comparable control; do not repeat
the evolutionary search or tune the catalogue to compensate for this head reset.
The demonstrated constraint/guard interaction remains a separate measured
foundation limitation, with current safeguards retained.

## Reproduce

```sh
npm run build
npm run audit:torque
node --import tsx --test tests/torque-audit.test.ts
npm run test:gated-worker
```

`audit:torque` performs only the 54 bounded physical trials, not the search/ecology
study. Fast tests/build, legacy real Worker and instrumented gated Worker checks
protect continuation and receipt accounting. CI verifies the branch; no merge,
Wiki publication or deployment is part of this audit.
