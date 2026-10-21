# VIDA 2D — Development Priorities

The [current Wiki](https://github.com/smeagol44/vidAI/wiki) describes shipped
features and the original phase status. [Project status](PROJECT_STATUS.md)
records experiments and release history. This file tracks remaining work;
listed extensions are not implementation promises.

## Current position

Original Phases 1–4 have their core implementation: variable neural architecture,
inherited topology mutations, egg/trait trade-offs and activation-memory
timescales. Phase 5's bounded waking-learning feature set is implemented;
robust learned ecological benefit is unresolved. Phase 6 sleep/rest and replay
is optional and unimplemented.

The separate B-A–B-D movement/behavior/measurement workstream is complete as a
bounded prototype. Nine featured starters coexist with 55 legacy designs.
Three featured gaits use selected offline-evolved motor alleles; Twin Oar has
reviewed mouth-first paddle timing and a stronger mutable retinal prior. Worker/render
separation and the spatial/neural/contact/lineage optimizations are deployed.
These capabilities do not establish sustainable ecology or the original
roughly 100-creature/1,000-part performance ambition.

## Foundation status and swimming recovery

v0.34.1 restores established drag, muscle strength and simultaneous actuation
for new worlds, retaining prepaid positive work, reserve-limited actuation and
retirement of the unused reproduction-threshold promise. Schema v12 preserves
all three stored regimes. Existing surface-model worlds can explicitly repair
swimming while keeping their ecosystem. Starter/body/brain/diet tuning stays frozen.

The four-face/geometric-muscle replacement is **not closed**: its absolute
normalization destroyed movement. A future replacement needs demonstrated
physical validity and functional movement, with material positive/negative
changes disclosed before production. Formula tests alone cannot approve release.

## Closed energy budget and egg lifecycle — implemented foundation

New application worlds use the finite recycled energy pool, independent nutrient
cap (default Unlimited), budget/debt control and funded conversion. Closed eggs
reserve population slots when laid, absorb bounded shared funding towards their
hatch reserves and expire into carrion after three incubation durations. Parents
can fund laying during debt, but hatching waits for debt recovery. Existing open
saves preserve exact behavior until explicit authoritative conversion. Schema v13
persists the pool, age and hatch target independently of physics; v12 remains open.

Mechanism and continuation checks cover transfers, deficits and zero crossings,
partial egg feeding/recovery, expiry, lowered caps, capacity aggregation and real
Worker operation. Frozen starters retain identical movement/expenditure under an
accounting-only comparison. The current Wiki describes the shipped rules; paired
observations are in project status and `docs/experiments/closed-energy-v1.json`.

Still open: longer multi-generation ecological validation; whether the initial
10% incubation reserve topup and three-incubation lifespan give useful selection;
recycling/uptake allocation alternatives; measured increases to population/egg/
particle/save capacity. Retain the visible computational safeguards for now.
Ledger closure does not establish useful ecology or solve mechanical-energy
errors. No starter/body/brain/diet retuning or 3D/sleep work accompanies this change.

## Next ecological goal

Close the loop through **unassisted food acquisition → enough net energy →
funded laying → successful hatching → viable offspring across generations**.

1. Use the existing acquisition census on representative current starters to distinguish absent/undetected edible stimuli, inadequate approach, mouth-access failures and insufficient net energy.
2. Correct specific demonstrated control, geometry or cost problems. Preserve mutable behavior and avoid prolonged manual brain tuning, hidden targeting, automatic survival aid or a mandatory diet quota.
3. Make naturally earned reproduction repeatable across seeds for a representative grazer, then extend to omnivores and predators. Pre-funded adults and deliberately placed test food remain controlled mechanisms, not proof of ecosystem viability.
4. Evaluate selection and retained-versus-erased learning after the food/reproduction loop works. A short survivor count or a larger brain alone is not an ecological success criterion.

Use bounded, causal comparisons. Extinction remains a legitimate outcome;
no guarantee that every genotype or seed survives is intended.

## Foundations and corrections

| Work | Current gap |
| --- | --- |
| Solver mechanical energy | Actuator work is prepaid and acceleration-aware in paid-work worlds. Constraint bias/projection, contact and joint-limit energy remain unproven; chemical closure does not bound their error. |
| Fluid and tissue fidelity | The default retains calibrated anisotropic drag and inertia-scaled strength. A coherent surface/geometric replacement with justified absolute normalization and useful motion remains open; the surface mode is preserved only for stored-world continuation. |
| Closed ecological energy budget | Core pool, transfers, debt, controls, egg slots/uptake/expiry and explicit save conversion are implemented. Longer ecological evaluation and capacity increases remain open. |
| Contact fidelity | Discrete collision substeps, flexible directly hinged-neighbor intersections, and simplified food/egg response remain. |
| Remaining trait trade-offs | `reproductionThreshold` is explicitly retired; child/parent funding remains unchanged. A broad audit/redesign of other biological trade-offs is outside this correction. |
| Scale | Current anatomy is capped at seven parts; larger worlds/brains and any increased part limit need measured throughput and correct continuation. |

## Larger future systems

- Physical body growth, local tissue injury/repair and gradual senescence; current lifecycle labels do not implement these.
- Modular body-associated controllers and coordinated body/control duplication; within-life structural brain development remains absent.
- Optional rest/sleep and bounded experience replay after useful waking behavior: real vulnerability/costs, no replayed calories, and equal-compute comparisons. Predictive world-model dreaming is a further optional extension.
- Optional currents, chemical sensing/signaling and creature-generated acoustic communication. Abiotic nutrient Blooms already exist; display music/SFX are not creature communication.
- Named experiment archives, longer event history, rewind/replay and cross-seed comparisons. Current world forking clones/replaces the active state; it is not a multi-world archive.
- Optional deformable bells or fluid jets, requiring new physics rather than a setting on rigid hinged jellyfish.

## Smaller additions

Bank favorites/sorting, named environment profiles, CSV statistics export and
population anatomy/neural summaries remain available future improvements.
Existing Bank filters, world snapshots and inherited-versus-learned connection
inspection already work.

Continue in bounded branches/PRs with appropriate automated checks. Keep the
actual Wiki current in place; retain historical measurements in project status.
Avoid treating a mechanism's implementation as proof of useful behavior.
