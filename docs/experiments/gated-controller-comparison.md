# Gated torque controller comparison — draft #72

Issue [#59](https://github.com/smeagol44/vidAI/issues/59), branch
`experiment/gated-controller-comparison-t1` → `testing`. **Unmerged, not deployed,
not selected for promotion.** Production v0.37.0 and testing T1.1 are unchanged.
Raw results: [gated-worker-v1.json](gated-worker-v1.json).

## Implemented experimental interface

An explicitly constructed genome has `motorController.version: gated-torque-v1`
and a new identity-keyed head, with either `Mode, Command` or
`Mode, DirectTorque, OscillatorStrength` **per joint**. The old six rows are never
relabelled as torque. Offline construction clones a parent and initializes new
head rows; the source parent's complete six-output genome remains unchanged.
The recurrent/sensory genes, anatomy, learning traits and lifecycle remain fixed.
This is a new controller specimen, not a migration of an existing animal.

- OFF: exact zero active torque, with a physically passive, unlocked hinge.
- DIRECT: signed output × bounded maximum torque; no position target or PD servo.
- OSCILLATOR: inherited phase/frequency/harmonics and clipped `cpgAmp * waveform`
  generate torque demand. Strength is `(output + 1) / 2`, so zero means 50%.
  Two-output reuses Command for strength; three-output has its own strength row.
- Previous mode is somatic per-joint state, initialized DIRECT at birth, saved
  exactly and never inherited as a parent's personal state. Gate selection has
  no dwell, cooldown, ramp or forced engagement smoothing. Decisive mode/sign
  changes act within one neural update (1/60s); ordinary finite inertia remains.
- The existing coupled prepaid-work integrator applies equal-and-opposite torques
  and scales the complete motor batch before motion when reserves are short.
  The passive-work-v3 joint solve and all guards remain intact.

The explicit world setting `motorExperiment: gated-torque-v1` requires
`passive-work-v3`. Snapshot schema **16** requires that marker and persists the
controller type, keyed weights, activations, learned weights and mode state.
Schemas 3–15 retain legacy semantics and reject experimental controller fields.
Unknown/missing mode/controller state is rejected, never inferred. Experimental
exports are deliberately rejected by the currently deployed old applications;
use this branch to resume them. Existing old saves remain supported unchanged.
No UI default, starter catalogue, release/version or deployed lane is changed.

Ordinary keyed neural mutation, hidden/connection topology, anatomy remapping,
reproduction and waking learning support the new layouts. The old Angle-only
learning scope addresses Command/DirectTorque on **new** controllers; `all`
includes their gates/strength. Somatic learning remains funded and uninherited.

## Provisional assumptions, not #60/#61 decisions

The comparison holds the calibrated drag, mechanical-to-chemical conversion,
efficiency, solver and existing maximum `Iavg * 2200` fixed. There is no neural
peak-torque multiplier on the candidate ceiling. This is an inertia-based bound,
**not an anatomical strength law**. Legacy motorForce/PD stiffness, engagement,
oscillatorMix and Drive/Amp modulation have no role in the new head. cpgAmp is
explicitly used as normalized torque-wave amplitude on this new controller type,
not as the old angle amplitude. These are experimental semantics only.

No new isometric activation cost, force-speed law, absolute fluid units, muscle
mass budget, artificial propulsion or live-ecosystem fitness is introduced.
Mode boundaries ±0.3 and hysteresis 0/0.06 remain candidate constants. Preserving
a ceiling does not equate typical requested torques or make the old and new
policies equally calibrated. Strength=50% at a centered output is an exploration
bias. #60 muscle/cost and #61 units/drag decisions remain unresolved.

## Measurements

All measurements run through the **actual Vite-built browser Worker**, adapting
only its port to a real Node Worker thread. The paused `experiment-step` message
accepts 1–3600 complete fixed ticks only in an explicit experimental world. It
returns snapshots and read-only metrics, never target coordinates or scores.
Control packets cannot switch the marker. No score code is imported by runtime.

Nine unchanged body plans × three seed/heading/viscosity conditions × four new
configurations plus the old six-output controller: **135 five-second swims**.
Positions, anatomy, reserves, internal/sensory genes and environment are matched.
All candidates consume the same latent Mode/Direct/Strength initialization draws;
two-output shares Direct as Command. Hysteresis pairs start with identical genes.
Baseline starters and historical movement gates are neither tuned nor refreshed.

| Configuration | Median travel (px) | Median motor cost (J) | Mode changes (sum) | Guard events (sum) | Valid / 27 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Legacy six outputs | 45.96 | 5.77 | 0 | 4,756 | 18 |
| Two, hard thresholds | 11.28 | 17.05 | 3,238 | 13,762 | 2 |
| Two, hysteresis | 12.97 | 19.74 | 2,568 | 14,715 | 3 |
| Three, hard thresholds | 9.85 | 19.62 | 3,233 | 15,626 | 1 |
| Three, hysteresis | 8.79 | 17.08 | 2,548 | 17,948 | 1 |

Validity requires finite, living bodies; no guards/boundary influence; anchor
error <0.5 px; limit excess <0.05 rad; positive accepted constraint gain <1e-12 J;
chemical discrepancy <1e-5 J. Existing legacy guard failures remain visible.
Movement is measured even for rejected cases, but those cannot win a search.
Torque variation is a tick-sampled raw simulation-unit metric; it is not a
substep-wide bound or a biologically calibrated jitter measure.

Median **paired** travel changes are −79.3%, −78.6%, −79.9% and −80.4% respectively.
Individual changes range from −99.8% to +273%; positive outliers do not override
failed guards. Hysteresis reduces switches by ~21%, but guards increase in both
aggregated hysteresis groups and movement/energy effects are mixed. Maximum
candidate angle-limit excess reaches 0.152 rad versus legacy 0.0254 rad.
Batch passivity/chemical closure do not make these trajectories acceptable.

## Bounded offline discovery

Three frozen families (Darter, Twin Oar, Branchstalker), three seeds and all four
configurations: **36 cells**, each one initial parent plus two generations of six
mutations (**468 training evaluations**) and two held-out heading/viscosity checks
(**72 held-out evaluations**). Newborn bodies use normal reserves/learning; no
food, target coordinates or intervention. Selection is OFFLINE ONLY. The score
requires sustained late displacement, straightness and reserve efficiency;
any failed guard/pose/accounting gate gives zero. No score enters the ecosystem.

One joint and one latent Mode/Direct/Strength/phase/frequency mutation operation
are drawn per offspring with matched seeds/deltas. The two-output candidate maps
both Direct and Strength mutation choices to Command; three-output keeps them
separate. This means different effective row-mutation frequencies, explicitly a
consequence of sharing. These small, particular priors/budgets are not evidence
that either architecture is intrinsically easier to evolve.

All 12 Darter cells eventually have valid best candidates (roughly 0.47–16.07 px
in five seconds); 11 improve their initial offline score. Seven of those pass
both held-out stability screens. All 24 Twin Oar/Branchstalker cells fail to find
a valid candidate within this budget. No selected specimen is installed in the
catalogue. Valid movement does not establish food seeking, learned benefit,
reliable emergency escape or competitive movement versus the legacy starts.

## Sudden sensory response and ecology

An ordinary physically contacting omnivore bites a controlled specimen. On the
next neural update its inherited test circuit selects OSCILLATOR directly from
OFF and applies nonzero funded torque, in **all four** built-Worker cases. No
injury input is injected and no emergency reflex is installed in production.
This proves bounded response latency, **not successful escape**. Earlier isolated
threshold-noise tests still show 119→0 switches; decisive changes remain one step.

Established nine-founder showcase, 275 nutrients, closed economy, 60 seconds,
seeds 17 and 73: **10 Worker ecosystem runs**. Only the explicit head conversion
differs at t=0. Seeded positions, food, PRNG, genes and energy are preserved.

| Configuration | New offspring (17 / 73) | Motor cost J (17 / 73) | Guard events (17 / 73) |
| --- | ---: | ---: | ---: |
| Legacy | 1 / 3 | 740 / 733 | 9,635 / 9,576 |
| Two, hard | 0 / 0 | 2,651 / 2,232 | 47,375 / 48,884 |
| Two, hysteresis | 0 / 0 | 2,943 / 2,327 | 55,717 / 56,361 |
| Three, hard | 0 / 0 | 3,357 / 1,927 | 61,569 / 44,331 |
| Three, hysteresis | 0 / 0 | 3,468 / 1,948 | 62,407 / 43,024 |

No deaths or remaining eggs occur in these short cases; that does not establish
sustainability. Maximum closed-stock discrepancy is below 1.8e-8 J. Raw final
recent-feeding receipts are labelled **retainedRecentIntakeJ**, not complete intake
ledgers (the source buffer is capped/coalesced). Do not infer diet-wide benefit.
The first ecology harness pass erased initialized new output weights during an
incorrect legacy-key remap. Its zero-motor rows are preserved under
`excludedHarnessRun`, explicitly invalid; only ecology was rerun after fixing the
conversion. Swim/search results did not use that conversion and were retained.

## Reproduce and continue

```sh
npm ci
npm run test:fast
npm run build
npm run test:worker
npm run test:gated-worker
npm run experiment:gated
```

The JSON records base SHA, built-Worker digest, all raw metrics, search draws via
seed/cell and selected-genome digests. `--ecology-only` reuses committed swim/search
results when investigating that harness; use the full command for a fresh study.

**Conclusion:** interfaces, funding, saved continuation and immediate response are
implemented and verified. These starts/assumptions substantially regress movement
and ecology. No preferred architecture, threshold, muscle law or release is
approved. Next isolate normalized demand versus the provisional ceiling with #60,
then coordinate #61; retain this evidence, frozen starters and release gates.
Broader search, meaningful sensor-driven swimming and multi-generation natural
selection remain unproven. Do not silently reduce torque, tune founders, waive
failures, merge #72 or publish the experiment on the basis of closure/CI alone.
