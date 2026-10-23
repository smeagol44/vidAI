# Retained inherited head: bounded continuity experiment (#59 / draft #72)

**Outcome:** exact preservation of the retained legacy policy is demonstrated in
three frozen organisms. Switching to their independently initialized signed heads
still regresses movement and stability. This is a safe experimental inheritance
scaffold, **not a behavior-equivalent conversion to torque, recovered swimming,
architecture approval or a release candidate**. Stop for review.

Branch `experiment/gated-controller-comparison-t1` → `testing`, parent
`73f73981b61f37db6a439e5802e11ff7d5efe44f`; final head/CI in #59/#57/#72. V3 remains
accepted. Closed fluid experiments and #84 are untouched; no merge/deployment.

## One explicit approach

`retained-head-v1` preserves each joint's six old rows and meanings (Angle, Drive,
Torque, Stiff, Amp, Engage) **under the original servo/oscillator controller**.
Three additional keyed rows (Mode, DirectTorque, OscillatorStrength) form a
separate signed head, initialized from the same fixed unselected latent seed and
distribution as the previous three-output candidate. Legacy weights are never
copied into different semantic roles. Sensory/recurrent weights, memory constants,
masks, anatomy and all biological/motor genes remain intact on the copied parent.

An inherited `signedJoints` list selects the active controller by stable child-part
ID. Empty initially means retain every legacy joint. Each joint may mutate its
selector independently (trial probability .12×existing mutation chance, no
phenotype selection here); removed IDs are pruned and new joints default to
legacy unless that offspring's selector mutates. There is no blend, timer or
mandatory transition. A signed joint has the existing three-output OFF/DIRECT/
OSCILLATOR semantics and .06 hysteresis: OFF supplies zero active torque; DIRECT
commands signed torque; OSCILLATOR uses its inherited mutable waveform and neural
strength. Decisive changes still take one neural update. Mechanical coupling does
not make commands dependent.

Dormant output heads remain genetic/evaluated, but do not consume the active
learner's existing 96-edge eligibility budget. Old active edge identities/order,
learned deltas and teaching rules are preserved when legacy is selected. Selecting
signed control makes that head eligible under the existing scope rules. No #78
reward/valence feature is implemented. The extra head increases HO rows 50% versus
legacy; the existing enabled-edge budget and reference-normalized upkeep rule are
unchanged. At 24 hidden neurons the studied upkeep is identical; other brain
sizes/masks can incur different costs under that same rule. Full energetic
continuity is not claimed for all possible expanded brains.

## Save and physical boundaries

The explicit world flag is `motorExperiment:'retained-head-v1'`, **schema18**,
brain v7, v3 physics. Schema16/gated and schemas3–15 retain their meanings and
execution; schema17 belongs to the independent closed fluid experiment and is
not imported here. Validators reject missing/mismatched flags, wrong layouts,
unknown/duplicate/root selector IDs, missing gate state and cross-version genes.
The new schema allows up to54 output activations for seven parts; old schemas retain their36-output bound. No automatic historical/living-animal conversion exists. The offline fixture
constructor accepts only untouched t=0 organisms; ordinary import never calls it.
Newborn genotype construction copies hereditary genes, not personal learning.

Unchanged v3 drag, mass/inertia, contact/joint algorithms, guards, four physical
substeps, 60Hz neural cadence, chemical reserves and costs. Retained joints keep
exact legacy peak/engagement modulation; signed joints reuse #72's existing
unmodulated average-inertia×2200 envelope, not a stronger or new muscle law.
Consequently the two established controllers' effective envelopes/modulation are
not asserted identical. This experiment varies the policy selector, not capacity
constants. All torque still enters the existing equal/opposite coupled integrator,
with actual positive work prepaid at 4×chemical debit and no braking credit.

## Frozen actual-Worker evidence

15 five-second/300-tick trials: CUR-001 Darter, CUR-002 Twin Oar, CUR-009
Branchstalker; existing condition seed17/heading.37/viscosity.18. Original legacy,
fresh legacy-head null, retained all-legacy, first joint signed, all joints signed.
No search, starter/weight/gain tuning or further condition sweep. Raw sources,
final snapshots/PRNG, sampled joint/COM trajectories, all torque/work/guard receipts
and checks are in [the compressed archive](retained-head-v1.json.gz), with hashes
and readable metrics in [the summary](retained-head-v1-summary.json).

| Body | Legacy travel px | Fresh-head null px | Retained legacy px | First signed px | All signed px |
|---|---:|---:|---:|---:|---:|
| Darter | 190.502 | 32.809 | 190.502 | 3.600 | 13.375 |
| Twin Oar | 39.050 | 3.883 | 39.050 | 7.156 | 17.765 |
| Branchstalker | 64.697 | 11.821 | 64.697 | 21.856 | 10.610 |

For every body, retained-legacy metrics, raw live torque receipts and sampled
trajectories are exact against legacy. The **entire final snapshot** is exact
under a read-only comparison projection removing only added head genes/outputs,
unused gate state and explicit experiment/schema tags. This projection is never a
save converter or simulation input. Six old control rows and recurrent state are
retained, not replaced. Nonzero somatic learning/eligibility/consolidation and
ledger/PRNG equality also pass focused tests under both existing learning scopes.

The six archived legacy/fresh-control metric rows and JSON torque receipts match
exactly. All-signed metrics/receipts also exactly match the three archived
three-output/hysteresis cases: retaining an **unused** old head alone does not
improve a new policy. This latter check used frozen files, with no additional run.

| Body | Motor J legacy / fresh / first / all | Guards legacy / fresh / first / all |
|---|---|---|
| Darter | 2.002 / 1.911 / 2.476 / 3.219 | 0 / 0 / 4 / 3 |
| Twin Oar | 1.372 / 7.824 / 6.672 / 30.210 | 0 / 26 / 92 / 532 |
| Branchstalker | 6.627 / 3.143 / 11.225 / 23.854 | 0 / 8 / 155 / 442 |

Retained legacy expenditure/guards also exactly equal legacy. Max chemical error
across15 runs is 2.70e-10J; no funding limiting or delivery mismatch. Max substep
anchor error grows from .025–.075px legacy to .104–.171px first-signed and
.200–.212px all-signed. Constraint redistribution still crosses guards: all-signed
Twin Oar reaches21.5345rad/s (102 new overspeed samples), Branchstalker24.9656rad/s
(7); first-signed Branchstalker23.0652rad/s (122). Safeguards/reporting are intact;
these policies are not acceptable locomotion improvements. Positive/braking work,
actual angles/mode sequences and signed displacement remain available in data.
No ecological survival or evolutionary discoverability benefit is claimed.

## Checks, exclusion and remaining decisions

Local304fast+1metadata, build/typecheck and all three built-Worker checks pass:
production, original gated and retained. The new Worker check covers exact direct
host/audit/trace/quiet states, schema18 snapshot fork, independent +/- torques,
passive OFF, unchanged prepaid work, mode-switch rejection and a real physical
bite causing OFF→OSCILLATOR with funded torque on the next sensory update.
Mutation tests verify selectable inheritance without parent edits, keyed pruning,
brain budgets and no performance selection. Four earlier report hashes remain
unchanged. Final remote CI, exact SHA and publication state are in #59/#57/#72.
A final schema-only validation fix for seven-part/54-output specimens is covered by a real-Worker save/fork; the final built Worker also reproduces the archived all-signed Twin Oar full snapshot hash. No dynamics changed and the matrix was not rerun. No manual browser campaign is needed for this offline controller change.

The first harness attempt aborted on its first legacy row: live damping torque
contained −0, while historical JSON stores +0. Metrics already matched. Archived
receipt comparison now uses exact JSON roundtrip semantics (no tolerance or
baseline change); within-run retained/live controls still use strict raw equality.
The bounded matrix then completed once; no complete study was repeated.

**Review decisions:** whether to retain a dual-head genetic scaffold and its
complexity cost; the per-joint discrete selector/mutation prior; active-head-only
learning allocation; how useful signed policies should arise without destructive
initialization. Three-output/.06 is one existing candidate, not a winning
architecture; shared-command alternatives remain unselected. No automatic rollout,
policy distillation, coefficient/strength adjustment, broad search, #78 change or
solver correction follows from these results. Stop with the old behavior preserved
where retained, and the switched-policy regressions disclosed.
