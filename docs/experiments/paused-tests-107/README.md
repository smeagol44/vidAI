# Eleven paused tests: initial diagnosis and seven recovered checks

2026-10-26 · shared issue [#107](https://github.com/smeagol44/vidAI/issues/107) · contributor fork only

**Incomplete; not ready to integrate.** All eleven tests are active. Seven are
corrected without changing their historical goldens; four still fail with their
original assertions. No runtime code, mouth behavior, starter, controller,
physical coefficient, threshold, food placement, release metadata or save
migration has been changed. No new skip is introduced.

## Authority, base and coordination

Work branch: `hernansgarro/vidAI:feature/restore-paused-regression-tests`, from
updated fork main `1104d280222c58c6cef58e9cda6dd307fffed7a9`.
It contains upstream main `6f8f80c4cf771fa394fc12d2954380ea11365ade` and
the completed fork mouth feature. Fork testing remains
`ca9e89b59ab59be9d8837acbb69fbeca64e1c9ec`.
The verified pre-mouth reference is
`85217c8bd6cebef04018e5b4f4b1d4c1efcb690c`.

Read upstream AGENTS, #57, CONTRIBUTOR_WORKFLOW, FEATURE_ROADMAP,
PROJECT_STATUS, relevant current Wiki sources, fork PRs #11/#12/#13 and current
upstream issue/PR/branch inventories before edits. No dedicated same-test repair
was found. Related work: #59/#63 motor experiments; #60 muscle capacity/cost;
#66 ecological validation; #78 inherited reinforcement; #84 deferred angular
stops. Their experimental implementations and owner-review stops are unchanged.
Published records cannot establish the absence of unpublished contributor work.

Scope and the bounded investigation were registered in #107 before source edits.
Authentic `hernansgarro` status command
[6429436384](https://github.com/smeagol44/vidAI/issues/107#issuecomment-6429436384)
completed in [Action40417398221](https://github.com/smeagol44/vidAI/actions/runs/40417398221),
job121903027309, with actual readback **In progress**. Other Project fields are
not claimed synchronized. Detailed branch-protection reads return403; rulesets
are empty and branch inventory reports main/testing unprotected. No protection
was changed or bypassed.

The two supplied historical documents were read in full. Their grades were
explicitly hypotheses, not diagnoses. The later classification document does
not change the recorded eleven-case inventory. The current controlled evidence
refutes treating the two hunter failures as independent locomotion defects.

## Initial analysis of all eleven

Priority below is investigation priority within this task, not a claimed native
Project Priority-field edit. P1 needs an explicit acceptance decision; P2 is
representation compatibility with verified exact state.

| # | Test / protected condition | Current failure and cause | Priority / disposition |
|---|---|---|---|
|1|Twin Oar finite off-axis food: real visually guided feeding, finite meal, causal controls, bounded costs and ledger|One of eight accepted-forward-mouth conditions absorbs1440J in30 contact ticks instead of the historical full2400J in50; other seven still finish. Geometry-only reversal restores full meals.|P1; active/failing. Historical full-meal acceptance is incompatible with this measured accepted-geometry outcome.|
|2|Retained versus erased genuine experience: identical physical twins, real training, helpful/harmful/tied later ingestion, conserved energy|Original four cases become one benefit/three ties; there is no harmful case. Geometry-only reversal exactly restores historical results. Eight preregistered additional cases also have no harm.|P1; active/failing. Do not assert a harmful result that was not observed or keep searching until it appears.|
|3|CUR-003 v0.32.1 cold continuation|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|4|Runtime v0.30 plain continuation|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|5|Runtime v0.30 masked continuation, including topology/masks|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|6|Runtime v0.30 learned continuation, including acquired state|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|7|Runtime v0.30 masked-learned continuation|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|8|CUR-001 v0.34.0 surface-model continuation|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|9|CUR-006 v0.34.0 surface-model continuation|Only serialized oral field split; all other state exact.|P2; fixed, original hash retained.|
|10|Mobile Darter hunter: articulated swimming, actual injury, protective/harmful outcomes, no false escape from no contact|Final signed X gate fails in a feeding/injury encounter despite funded motion. Contact/outcome counts also differ. Geometry-only reversal exactly restores all historical rows.|P1; active/failing. No independent motor failure established.|
|11|Five prey morphologies: real predation, injury and variable response benefits|One hunter ends at rounded0px X after reaching12.206px excursion; original final-X gate fails. Outcome counts change. Geometry-only reversal exactly restores all historical rows.|P1; active/failing. Distinguish path/actuation from final signed displacement before replacing acceptance.|

Initial current execution: **43 total,32 pass,11 fail,0 skip** across the six
files. Verified pre-mouth checkout: **43/43 pass,0 skip**. Thus none of these
eleven failures has been demonstrated preexisting. This is not an attribution
to another contributor or a claim that every behavioral change is a defect.

## Seven representation-only corrections

`tests/support/legacy-mouth-state.ts` clones the serialized state and projects
only mouths in live organisms, eggs and lineage records: historical
`intakeWidth = intakeLength`, then remove `intakeLength`. It does not modify
the authoritative state, remove other keys, round numbers, filter diagnostics,
reset caches or run altered physics. It checks the current diet-specific
diameter and finite reach before projection, so malformed new diameters are
not hidden.

For all seven cases the projected current state equals the **entire** reference
state, including object serialization order. This includes positions,
velocities, joints, energy stocks/ledger, neural activations, masks, somatic
learning/traces/consolidation, memory, time, counters, food, lineage and PRNG.
The original seven SHA256 expectations pass unchanged. The four performance
cases exercise the finite-food fixture only through120ticks; this does not
claim later feeding interactions are unchanged.

A new regression checks that projection leaves its input untouched, that
round-tripping just the oral representation reconstructs every field of the
snapshot, and that an incorrect current diameter is rejected. Existing strict
save/Worker checks remain in place. The three corrected files pass **38/38**
after this extra check; the archived earlier `schema-fixed.tap` is37/37 before
the extra check, while `final-fast.tap` includes it.

## Physical evidence for the four unresolved tests

### Geometry-only causal control

`geometry-control.patch` is applied **only to a separate detached diagnostic
checkout** at1104d28. It restores the old centered transverse feeding segment
using the inherited reach; the feature branch retains the accepted forward
segment. Conservative broadphase bounds remain conservative. All current
brains, motor equations, costs, learning, diets, transfer rates, PRNG and
other code remain unchanged.

This single control exactly reproduces the reference arrays for the four
learning cases and all60 hunter rows (30 mobile and30 multi-morphology
connected/disconnected rows), including final body/joint data and motor
expenditure. It also restores2400J to every Twin Oar approach with all three
controls still at0J. This establishes a geometry-to-contact-to-feedback cause
in these conditions, not a justified production rollback or new physical law.

### Twin Oar

The only changed full-meal case is side+1, distance160, heading−1.2,
viscosity.22. Current actual absorbed intake is1440J =30ticks×48J/tick;
historical/control is2400J =50×48J. The finite starting nutrient is3000J;
specialist gross rate is60J/tick with80% assimilation, unchanged. Contact
duration, not a changed absorption coefficient, explains the difference.
The other seven conditions still absorb2400J; all24 catalogue/gait-only/
retinal-disconnected controls absorb0J. Every condition remains finite,
visible, alive, free of sampled cap ticks and chemically conserved. Largest
absolute energy residual among current rows is4.73e−11J. Expenditure in the
partial-meal case is430.677J versus429.981J catalogue; no hidden cheaper
metabolism or propulsion was introduced.

These observations preserve the causal feeding mechanism but do not satisfy
the original guarantee of a complete finite meal in all eight conditions.
Lowering that expectation without an explicit contract decision would erase
the measured loss of960 absorbed joules.

### Retained versus erased experience

Both twins originate from the same exact post-training save, with identical
genome, physical state and RNG; only acquired motor/retinal delta, eligibility
and consolidation are erased in the control. Training is genuine finite
mouth feeding, with all costs retained. The training patch provides3000 gross
J rather than historical2460J; acquired L1 changes from4.191315 to3.421941,
and training X travel from55.243492 to54.428722px. Changed experience precedes
the comparison; this is not an isolated unchanged-experience mouth test.

Original four subsequent gross-intake differences:

| seed / side / forward distance | Historical/control J | Current J |
|---|---:|---:|
|711 /0 /120|0|0|
|711 /−34 /130|+180|0|
|711 /+34 /130|−420|+1020|
|733 /0 /130|0|0|

These are **gross nutrient losses**, as measured by the existing test, not
absorbed joules. Corresponding absorbed differences are80% of these values.
The test conserves both complete ledgers. Personal learning remains nonzero
and causally changes trajectories/intake; these cases no longer demonstrate
a harmful intake result.

Before evaluation, #107 comment6429521180 registered exactly eight additional
placements: seed711, d∈{100,160}, side∈{−52,−16,+16,+52}. All results are retained
in `expanded-learning.json`: gross differences **720,0,0,60,540,0,0,240J**;
four beneficial/four tied/no harmful. No further placement search is authorized
by this diagnostic checkpoint. None was run. No training, controller,
coefficient, learning-rate, reserve or maturity change was made.

### Moving hunters

BodyCost and funded structural biomass stay4980J, matching the old reference.
Current mobile-row integrated motor expenditure spans0.445575–1.576929J;
multi-morphology rows span0.701520–0.716436J. Injury comes from actual prey
energy removed, producing the ordinary next-tick signal (up to.5 in the shown
omnivore encounters); it is not supplied by proximity or a diagnostic label.
The paired enabled/disconnected circuit and all ledger checks remain intact.

The failing mobile connected case (speed1.5,separation106) ends at+0.2 rounded
X displacement after a10.687px maximum X excursion, spending1.100263 motorJ.
The failing multi-morphology connected Darter case (overlap3) ends at rounded0
after12.206px excursion, spending.713731motorJ. Returning near the initial X
does not establish stationary behavior. These observations alone also do not
separate all collision-driven movement from self-propelled motion; a future
replacement must protect funded articulation/trajectory rather than silently
lower the original net-X thresholds.

| Scenario | Historical/control beneficial/harmful/tied | Current beneficial/harmful/tied | Historical → current untouched |
|---|---|---|---|
|15 mobile encounters|6/1/2|6/3/1|6→5|
|15 multi-morphology encounters|5/6/4|10/4/1|0→0|

The changed outcome counts remain visible. They are not evidence of universal
escape or generally improved ecology. The omnivore test fixture also stores
diameter9 although its current diet requires8; this should be corrected when
the fixture contract is reviewed. It is not the movement cause: runtime
contact radius already derives from diet and bodyCost depends on organ counts,
not width/reach. No bodyCost/physics/controller fix is justified by that typo.

## Validation and reproducibility

- `npm ci`: success. Node24.22.1/npm11.9.0 (see local version receipt in issue).
- Initial six-file run:43 tests,32pass,11fail,0skip (`current-initial.tap`).
- Pre-mouth six-file run:43pass,0fail,0skip (`reference-pre-mouth.tap`).
- Seven golden corrections: original hashes pass, with full semantic equivalence.
- Final `npm run test:fast`: **290 tests,286pass,4fail,0skip** (`final-fast.tap`).
- `npm run build`: success (`final-build.log`).
- `npm run test:worker`: success (`final-worker.log`): actual production Worker,
  exact exports, direct equivalence, funded commands and all eight contact modes.
- `git diff --check`: pass. No UI/runtime change; no browser campaign required
  or claimed. No feature PR/remote CI success, deployment or acceptance claimed.

The initial `excluded-current-duplicate.tap` is an accidental second current
run whose output path was originally mislabeled as pre-mouth. It is retained
and **excluded from reference evidence**. Its cwd was current, detected before
comparison. The true reference was run from the detached85217c8 checkout and
is separately retained. No scientific trial or unknown lost result was rerun.

Pure evidence verification, no simulations:

```sh
node --import tsx docs/experiments/paused-tests-107/verify-evidence.mjs
```

To reproduce current assertions, run the six files named by the original
inventory with `node --import tsx --test`. For the reference, create a detached
worktree at85217c8, install with `npm ci` and run those same six filenames there.
Do not accidentally run them from the feature cwd.

Portable diagnostic fixtures (paths must be absolute):

```sh
node --import tsx docs/experiments/paused-tests-107/snapshot-cases.mjs /absolute/checkout > /tmp/snapshots.json
node docs/experiments/paused-tests-107/behavior-cases.mjs /absolute/checkout learning
node docs/experiments/paused-tests-107/behavior-cases.mjs /absolute/checkout hunter
node docs/experiments/paused-tests-107/behavior-cases.mjs /absolute/checkout foraging
```

The snapshot script emits all seven raw states. Gzip archives in this directory
retain the actual compared initial current/reference states. Behavioral replay
extracts the recorded fixture functions from the chosen checkout and adds only
read-only observations. `expanded` is available solely to verify the already
registered eight outcomes, not authorize a new placement campaign. Apply the
geometry patch only in a separate detached1104d28 control worktree; never apply
it to the deliverable branch. `manifest.json` records evidence hashes.

## Decision needed and exact next action

Do not integrate a red suite. The feature branch is preserved for review; there
is no PR to testing yet because the user's complete-green prerequisite is not
met. Main/testing and their deployments remain unchanged.

Seven checks are ready. For the other four, decide whether to revise historical
acceptance to the explicitly measured forward-mouth behavior while preserving
causal contact, energy, learned-state isolation, real injury and funded motion,
or retain the historical behavioral requirements and authorize a separate
bounded functional investigation. The former must disclose the lost full-meal
and harmful-learning observations; the latter cannot presume a specific bug,
retune organisms or revert the accepted geometry. No additional search or
runtime change proceeds automatically from this checkpoint.

After that decision, finish all eleven, require a green fast/build/appropriate
Worker gate, publish a fork feature→testing PR, verify real CI and merge only
if allowed. Stop for Hernan's practical review. No main PR/merge, testing-overlay
copy/reset, upstream PR (including draft), experiment adoption, Wiki publication,
release or VIDA3D work is authorized now.
