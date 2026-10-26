Warning: truncated output (original token count: 35610)
Total output lines: 2251

# Project status — 2026-10-21

## Contributor ChatGPT status access — proposed (#105)

- Owner authorized `hernansgarro` to use the shared issue/PR status workflow through his own GitHub-connected ChatGPT. Verified contribution fork: `hernansgarro/vidAI`.
- Scope: extend both workflow and script author checks to the two named accounts; preserve trusted-main execution, repository/project/state restrictions, existing intake and native field readback. Tests and contributor instructions are in progress.
- This branch is a proposal only. Activation requires an accepted upstream-main merge and an authentic contributor-authored command with verified Project Status readback. No merge, deployment, Wiki or simulation change is part of this task.

## Coherent fluid drag and anatomical muscle trial — rejected without runtime changes

- A bounded experiment compared two proposed replacements independently and
  together in the real passive-v3 solver (nine unchanged featured genomes at three
  heading/viscosity conditions each, five seconds, normal reserves). Default
  simulations, saved rules, Worker, starter bodies/brains and diet strengths were
  untouched. Formula, complete kinetic-batch, ledger and fast/build checks passed,
  but these do **not** justify movement-changing promotion.
- The consistent anisotropic surface-traction model preserved the established
  axial/transverse force coefficients and instead integrated the **same** 1/40
  axial face coefficient into rotational drag. Its largest travel loss was
  **−32.53% for Broadwake**; seven of 27 paired swims added speed guards.
- Geometric muscle strength used contact section × internal lever, scaling
  uniformly doubled torque as 4× instead of historical inertia-based 16×.
  The initial arbitrary 14×7 px reference collapsed up to **93.78%** of travel.
  Replacing it once with an actual, explicitly identified Darter P0–P1 reference
  (35×21 / 35×14 px) recovered Darter (+1.86%, 190.50→194.04 px) but still
  collapsed Branchstalker up to **−98.67%** and increased Lantern's travel by up
  to **215.27%**. Under standard conditions Broadwake gained **147.07%**
  travel and guards rose **1,106→1,273**; some cases spent over **70%** more
  reserve. The combined variant's worst loss was **−98.40%**.
- All candidates are **rejected for production**. PR #52 was deliberately closed
  unmerged. No repeated reference search, gene retuning, weakening of movement
  gates, new regime or save migration was performed. The existing calibrated
  passive-work-v3 remains the current model and the speed limits remain known
  approximations. Additional biological strength and fluid units require
  independent justification before another model is promoted.
- Raw measured summaries and representative rows:
  `docs/experiments/coherent-fluid-muscle-trial-v1.json`.
  Karl Sims's 1994 paper motivates normal-resistance swimming and strengths
  based on part cross-section; it does not supply VIDA's absolute coefficients
  or prove equivalence to its simplified 2D lamina model.

## Bounded speed-guard cause control — diagnostic only, v0.37.0 unchanged

- A read-only five-second motor-off control was run for the three frozen passive-v3
  featured swimmers with known guards, preserving all anatomy, control, contact
  and simulation code. Powered Lantern/Forktail/Broadwake recorded 352/116/1106
  guard events and lost 0.119/0.088/2.485 J to hard speed caps. Unpowered
  copies recorded zero clamps and zero travel. Forktail had no contact impulses
  even while powered; Lantern stationary/unpowered retained contact observations
  without clamp loss. Thus powered actuation is necessary in these samples,
  and contacts are not a necessary source across all three designs.
- This causal control does not prove motor scaling is wrong, remove possible
  contact/pose contributions during active swimming, or identify angular
  versus translational overspeed. It revealed no specific demonstrated
  movement-preserving solver correction. Leave clamps, physics, save regimes,
  Worker and starter/body/brain/diet tuning unchanged. Revisit drag/muscle
  normalization separately against justified physical units and swimming gates.
- Record: `docs/experiments/guard-causality-v1.json`, reproducible
  `tests/guard-causality.test.ts`. This is a bounded conclusion, not a new
  physics release or proof of ecological performance.

## Passive joint-velocity batch — v0.37.0

- New application worlds use passive-work-v3, retaining working drag, inertia-
  scaled muscles, simultaneous commands and prepaid work. Ten provisional joint
  iterations retain their historical arithmetic. The accepted aggregate increment
  is bounded by its quadratic kinetic work; dissipative batches stay unchanged.
  When no non-energizing fraction exists, pose repair changes no velocities.
- Schema v15 persists v3 independently of contact/economy. Historical v12–v14
  modes continue exactly; explicit settings stabilization preserves authoritative
  paused state. Reset selects v3; control packets cannot switch regimes.
- `docs/experiments/solver-passivity-v3.json` retains rejected candidates and
  accepted comparisons. Resting/coasting invalid joints repair without motor
  charges or kinetic injection. In 27 frozen five-second swim pairs, largest
  travel change is +0.1276%; no additional isolated speed guards. Maximum measured
  positive accepted-batch change is 3.47e-18 J. Hinge error stays below 0.126 px
  and measured angular excess below 0.0255 rad. Known guards remain unresolved.
- Two closed 60s ecosystem pairs produce one additional offspring each (living
  9→10 and 11→12). Seed 17 nutrient absorption 51672→58992 J; seed 73
  60720→97872 J (+61.2%), prey 4200→0 J. All four have zero deaths. Larger final
  populations can change aggregate guard counts; isolated per-design guard gates
  remain unchanged. Closed-ledger error stays below 1.5e-8 J. These material effects
  were disclosed before production. Short divergent trajectories establish no
  sustained ecology, carnivore improvement or browser performance claim.
- Local validation: 279 fast tests, build and production real-thread Worker pass,
  including all eight physics/economy combinations with capsule contact. Browser
  upgrade/reset checks and publication are required before declaring release live.
- Corrected: demonstrated kinetic injection by complete joint-velocity batches.
  Open: speed-clamp dependence, broader contacts, pose-induced momentum/potential
  artifacts, coherent fluid/muscle normalization and long-term ecological benefit.
  Starter/body/brain/diet genes, 3D and sleep work are untouched.

## Full mouth contact geometry — v0.36.0

- New application worlds opt into capsule-v1: prey rectangles now contact the
  full inherited span thickened by the existing radius, matching food/egg contact.
  Tank outlines and Bank previews show the real aperture. No inherited widths,
  radii, rates, assimilation, anatomy, controller or swimming forces are retuned.
- Existing saves retain their original line-plus-centre-disk prey shape and
  schemas v12/v13. Explicit UI upgrade changes only the model on an authoritative
  snapshot. New schema v14 strictly stores the model, independently of all three
  physics regimes and either economy. Worker control cannot change it.
- `docs/experiments/mouth-contact-v1.json`: 375-position contact grid detects 74
  old/139 corrected contacts, 65 additions and no losses. The endpoint kernel
  control absorbs 0 → 48 J per tick; head-on and slight body overlap both 48 → 48 J;
  clear misses 0 → 0 J. Geometry includes tangent, degenerate, containment, collinear
  and independently rotated prey checks. Funding and chemical closure remain exact
  within floating-point error.
- All nine frozen five-second food-free swims retain exactly equal complete
  states, not just displacement (Darter 190.4994 px). Two unassisted 60 s showcase
  pairs (seeds 17/73) retain 9/11 living, zero deaths and 0/2 offspring in both
  contact modes. Seed 17 intake is unchanged. Seed 73 prey absorption increases
  1968 → 4200 J (+113.4%), nutrients 64032 → 60720 J (-5.17%); total reserve 121496 J
  versus 125417 J. This material feeding effect was disclosed before production.
  Max closed-stock error is below 1.5e-8 J. No reliable pursuit or sustained ecology
  claim follows from these short pairs. All prey intake in these samples is by
  omnivores; specialist carnivores eat nothing in either model. Per-diet intake
  and diagnostic timings are retained in JSON.
- Local 273 fast tests, build and real production Worker pass. Worker/direct
  equality and forbidden mode switches are checked for all six combinations of
  contact-enabled physics/ecology. Browser coverage checks exact explicit upgrade,
  old imports, current reset and displayed version in Worker/fallback modes.
- Corrected a release-label oversight: the 0.35.1 code patch was deployed with
  BUILD_VERSION still 0.35.0. Current UI/export build is 0.36.0 and a version check
  guards consistency with package.json. No retrospective code rollback occurred.
- Closed: endpoint hit-area inconsistency and undersized aperture visualization.
  Open: biological mouth/diet balance, reliable hunting, solver bias/limit energy,
  speed-clamp dependence and coherent drag/muscle normalization. Starter/brain
  tuning, 3D and sleep/replay remain untouched.

## Transient UI corrections and kinetic audit — v0.35.1

- Centralized notification expiry at 2500 ms wall time. Every caller now expires,
  repeated identical text restarts the timer, replacements cancel old timers and
  unmount cleans up. Paused worlds use the same wall clock. Hinge canvas markers
  are removed; physical joints, Worker payload and constraint work remain.
- Optional offline kinetic observer attributes force/motor integration, guards,
  anchor constraints, angular limits, contact impulses and pose projection without
  changing equations, order, genes or persisted state. Exact observed/unobserved
  continuation is checked across all three physics and both ecology regimes.
- `docs/experiments/mechanical-audit-v1.json` records five isolated 0.1-second
  controls and nine five-second frozen swims. One-pixel unpowered anchor error
  produces 0.00148176 J gross kinetic addition, almost all later removed. The
  isolated limit control also injects energy. These are real velocity-bias
  defects, not proof of a net ecological subsidy. Inelastic single-part contact
  removes its initial 0.000105 J. Projection changes pose with zero immediate
  kinetic change; it may influence subsequent bias/forces. Stage reconciliation
  error is below 2.5e-14 J across this audit.
- Frozen swim distances remain the v0.34.1 recovery values (Darter 190.4994 px
  in five seconds); Lantern/Forktail/Broadwake retain 352/116/1106 guard events.
  No movement, drag/muscle, diet, mouth reach, brain or starter changes are made.
  Solver correction, speed-clamp dependence and coherent drag/muscles remain open.
- Mouth sizes/hit areas are now an explicit next correction: visible span,
  inherited aperture, rotated/end contact and body obstruction need joint review.
  No brain or diet tuning accompanies that review.
- User accepts persistent nutrient debt after extinction; no abiotic decay is
  needed. Manual additions still require funds. Previous limitation measurements
  remain below as historical evidence, not a pending feature request.
- Alternating 120-tick throughput comparisons (15 creatures, 78 nutrients,
  221 carrion) preserve exact final state: baseline/current 377/388 ms in the
  first round, current/baseline 325/332 ms in the second. These short headless
  measurements do not demonstrate a meaningful speed change or browser FPS.
- Local fast checks: 268 tests passed; production build and real Worker operation
  passed. Focused Chromium/Firefox notification lifecycle checks run in PR CI.

## Closed ecological energy and finite eggs — v0.35.0

- New application worlds have a finite pool initialized from actual seeded
  stores, initially 275 food particles plus funded founders, with zero reserve.
  Nutrient cap defaults to Unlimited; conversion and all manual food/life spend
  reserve. Budget edits can introduce debt. Expenditure, unassimilated food,
  clearing and carrion return energy exactly once. Cumulative counters are
  diagnostics, excluded from current closed stocks.
- Population slots include eggs. Laying clamps each clutch to available slots;
  hatching replaces a reserved slot even above a lowered cap. Parent-funded
  laying during debt is allowed. Hatching waits for debt, funding and clearance.
- Parent egg costs and all starter/brain/body/diet genes remain unchanged. New
  closed eggs have a reserve target 10% above the parent's paid reserve, capped
  by inherited capacity, plus an uptake rate of 10% of target per incubation
  duration. Positive world reserves fund shared uptake proportionally. Bites
  can prevent a hatch or permit later recovery. This is abstract incubation
  energy, not a local heat simulation. Maximum age is three incubation periods;
  expired eggs transfer all funding to carrion, which later repays world debt.
- Food capacity remains 2200 ordinary slots; overflow remains aggregate into
  carrion, with one extra carrion slot if all ordinary slots are plants. Merging
  restarts that carrion's decay timer. No capacity loss of energy. Population
  defaults to 30 combined slots, adjustable to 150; the 75-egg safety limit remains.
  Closed worlds continue recycling after extinction rather than auto-pausing.
- Schema v13 persists pool and egg targets/timers. Old schemas retain exact open
  ecology and all saved physics modes. Explicit conversion uses current stores,
  zero reserve and known incubation age only, never accumulated historical sinks.
  Reset creates a new closed world. Brain stays v7; no 3D or sleep/replay work.
- Mechanism checks cover conserved transfers, partial physical egg predation,
  recovery/expiry/debt, slot-neutral hatching, capped laying, overflow aggregation,
  exact save continuation and Worker/direct equivalence. The nine frozen starters
  retain byte-identical canonical organism state after five accounting-only
  seconds; existing recovery and historical complete-state hashes remain gates.
- Paired unassisted 60-second nine-starter showcase observations (seeds 17/73):
  open and closed both end with 9/11 living creatures and 0 eggs. Closed nutrient
  counts are 271/267 versus open 275/275. Closed budget remains 972000 J; open
  external inputs rise to 1017000/1026000 J. Maximum closed stock error is below
  1.5e-8 J. One seed naturally hatches two offspring in both modes; this does not
  establish sustained multigeneration ecology or prove the incubation constants.
- Timing: the first ecological closed run has a 27.6s wall-time outlier versus
  6.3s open; the other pair is 9.2s closed versus 8.7s open. Alternating same-state
  ten-second comparisons isolate accounting from food differences and retain
  identical aggregate distance. Full values, including repeat timing and CPU
  usage, are retained in `docs/experiments/closed-energy-v1.json`. These are
  diagnostic timings, not a browser FPS claim.
- Still open: coherent normalized replacement drag/muscles, solver constraint/
  contact/limit energy, legacy clamp dependence, longer ecology, evaluation of
  incubation constants and allocation priorities, and higher capacity defaults.
- Verified design limitation: plant nutrients never decay. With no consumers,
  two 3000-J nutrients and a lowered 3000-J budget retain reserve -3000 J after
  60 seconds (accounted total 3000 J). Conservation holds, but passive debt
  recovery is not guaranteed. Clearing food or increasing the budget resolves
  this state. Abiotic nutrient decay remains a user design decision.

## Swimming recovery — v0.34.1

- The v0.34.0 default caused a severe locomotion failure. Formula/accounting
  checks passed while frozen starters lost nearly all travel; treating that as
  an acceptable model consequence was a release error. Coherent drag and
  geometric muscle scaling are **not closed foundations**. This entry supersedes
  the closure claim below, which remains an experiment/release record.
- New worlds use `paid-work-v2`: restored calibrated drag, established inertia-
  based muscle gains/caps and the original simultaneous motor/force update.
  The initial recovery candidate's sequential actuation still disrupted Lantern
  and Broadwake, so it was rejected before release. No genes, starter anatomy,
  brain weights, rhythm phases, food economics or reserve amounts are retuned.
- Paid work is retained. Every joint samples the same pre-step state; positive
  and negative actuator work integrate over the combined angular velocity
  change, including shared-part motors and external torques. Split reversals,
  no negative-work cross-joint credit or regeneration. A conservative common
  torque-scale bound enforces available reserves BEFORE forces act; bill the
  resulting measured positive work at 25% efficiency. No 40-J billing cap.
- Both older regimes retain exact continuation. Two new pre-fix full-state
  surface-model hashes (Darter/Broadwake) are regression references, alongside
  existing legacy hashes. Schema stays v12, brain v7. New worlds/reset select
  recovery; surface-model imports keep their mode unless the user explicitly
  clicks **Repair swimming in this world**. That action resets the authoritative
  snapshot with recovery physics, preserving the complete ecosystem and PRNG.
- Frozen observation: all nine current genotypes, ordinary reserves, seed 711,
  heading .37, viscosity .18, five food-free seconds:

| Starter | Pre-v0.34 distance px | v0.34.0 distance px | Recovery distance px | Total expenditure vs pre-v0.34 |
| --- | ---: | ---: | ---: | ---: |
| CUR-001 | 190.499 | 0.618 | 190.499 | +0.95% |
| CUR-002 | 39.050 | 0.922 | 39.050 | +0.60% |
| CUR-003 | 40.967 | 0.135 | 40.967 | +4.54% |
| CUR-004 | 44.781 | 2.399 | 44.781 | +2.82% |
| CUR-005 | 80.962 | 0.272 | 81.096 | +8.21% |
| CUR-006 | 21.828 | 0.248 | 20.711 | +9.36% |
| CUR-007 | 29.493 | 1.026 | 29.493 | +2.20% |
| CUR-008 | 88.995 | 0.300 | 88.995 | +1.93% |
| CUR-009 | 64.698 | 0.171 | 64.699 | +2.43% |

  Eight designs remain within 0.2% of their original distance; Broadwake loses
  5.12%. More complete motor billing increases total five-second expenditure
  0.60–9.36%, not free energy or hidden reserve refills. Darter's motor bill is
  2.002 J versus the old estimator's 0.767 J. These effects were disclosed to
  the user BEFORE production. Measurements do not establish long-term ecology.
  Data: `docs/experiments/swimming-recovery-v2.json`; `npm run audit:foundation`.
- A read-only pre-clamp counter in a scratch kernel confirmed prior legacy
  speed-guard counts of 352/117/1136 for Lantern/Forktail/Broadwake under the same
  assay. Recovery counts are 352/116/1106; the other six remain zero. The default
  audit reports uninstrumented legacy counters as null, not a false zero.
  Existing speed-clamp dependence remains an unresolved numerical limitation.
- Verification: 250 fast tests, build, real production Worker, all four original
  profile hashes, original cold continuation hashes, two surface-model hashes,
  and paired Darter/Twin Oar finite off-axis food-acquisition recovery. Added
  two-sided movement/total-cost regression gates for all nine frozen designs
  and no added guard dependence. Tests must not silently refresh/relax these
  baselines for a changed model. CI covers Chromium/Firefox import/reset and
  explicit in-place repair; the Wiki's diagrams and indexes are retained.
- Release policy: disclose material measured positive OR negative changes to the
  user before production. A 10% numeric movement/cost tripwire adds a hard gate,
  but qualitative drastic effects also require disclosure. Passing formulas,
  conservation checks or CI cannot waive release judgment.
- Still open: a justified functional surface/geometric replacement, constraint/
  contact/limit mechanical-energy bounds, existing clamp usage and sustained
  ecological benefit. No 3D work, sleep/replay or creature/brain tuning.


## Physics/biological foundation closure — v0.34.0

- New `surface-work-v1` worlds integrate uniform normal resistance over four
  unit-depth rectangular faces, including connected/covered faces. This removes
  the extra axial 1/40 calibration and uses the same surface law for torque.
  No wake/exposure clipping/fluid-motion claim. Sims section 4 is the conceptual
  source; explicit 2D integration and coefficients are VIDA choices.
- Muscle peak strength now uses attachment cross-section times an internal
  lever. With depth held at one, doubling 2D lengths yields 2x force and 4x
  torque, rather than 16x inertia-derived strength. PD damping uses reduced
  pair inertia. Conversion, stress, gains and efficiency are specified in the
  current Movement Wiki; they are model parameters, not calibrated tissue.
- Corrected actuation applies sequential equal/opposite torque impulses and
  measures torque-only work including acceleration from rest. Positive and
  negative work are separated at reversals. Positive work costs chemical energy
  at 25% efficiency, before the impulse; insufficient reserves shorten the
  impulse. Negative work dissipates without regeneration. No 40-J billing cap.
  The existing motor-heat field remains chemical expenditure, not literal
  instantaneous thermodynamic heat. Constraints and drag act afterward.
- Causal kernel test reproduces unpaid legacy actuation at zero reserves and
  demonstrates zero corrected motor impulse/cost at zero reserves. Contact
  food acquired afterward funds only subsequent motor impulses. Chemical
  closure, no external-force COM propulsion, passive joint correction and
  bounded sampled hinge gaps are checked. Numerical speed clamps remain
  dissipative guards with per-tick diagnostics; non-finite muscle torque fails
  visibly. This is NOT complete mechanical-energy conservation of the solver.
- `reproductionThreshold` is explicitly retired compatibility data. Corrected
  offspring keep its value without mutating it; legacy mutation and PRNG order
  remain exact. No arbitrary new fullness gate or changed egg funding. Maturity,
  cooldown, clutch, child structural/reserve costs and parent floor still govern
  laying/inspection. Broad biological redesign remains outside this milestone.
- Save schema v12 requires the persisted regime. v3–v11 imports choose legacy;
  existing current brain revision remains v7. UI imports, exports/forks,
  fallback, Worker reset and commands agree; live regime switches are rejected.
  Reset starts current physics. Historical complete-state goldens are unchanged;
  prior behavioral/calibration assays explicitly select legacy physics.
- Bounded observation: nine identical current starter genomes, two regimes,
  seed 711, heading 0.37, viscosity 0.18, five food-free seconds, ordinary reserves.
  No founder/anatomy/brain/diet tuning and no optimization. Results:

  | Starter | Legacy displacement px | Corrected displacement px | Legacy motor J | Corrected motor J |
  | --- | ---: | ---: | ---: | ---: |
  | CUR-001 | 190.499 | 0.618 | 0.7667 | 0.0224 |
  | CUR-002 | 39.050 | 0.922 | 0.5588 | 0.1704 |
  | CUR-003 | 40.967 | 0.135 | 4.1458 | 0.0736 |
  | CUR-004 | 44.781 | 2.399 | 0.6992 | 0.1548 |
  | CUR-005 | 80.962 | 0.272 | 4.1856 | 0.1481 |
  | CUR-006 | 21.828 | 0.248 | 3.3676 | 0.2913 |
  | CUR-007 | 29.493 | 1.026 | 2.1312 | 0.1357 |
  | CUR-008 | 88.995 | 0.300 | 1.7576 | 0.1612 |
  | CUR-009 | 64.698 | 0.171 | 2.8981 | 0.0825 |

  Corrected starters swim substantially less effectively. This is a reported
  model consequence, not compensated with hidden thrust, cost subsidies or new
  calibration. Maximum post-tick corrected anchor gap is 0.0153 px; no numerical
  speed guard fires. Chemical discrepancy stays below 1e-6 J. This five-second
  observation establishes neither food acquisition nor sustained ecology.
  Full results: `docs/experiments/foundation-v1.json`; `npm run audit:foundation`.
- Verified locally: 235 fast tests (including nine new analytical/causal checks),
  TypeScript/Vite build, actual production Worker in both regimes, legacy physics
  audit, all four historical profile hashes and all existing fast continuation
  hashes. CI additionally exercises Chromium/Firefox import/reset/fallback
  smoke and reproduces the historical bounded search. Wiki source diagrams,
  Home index and Sidebar are preserved.
- Closed: coherent drag specification/implementation; justified unit-depth
  muscle scaling; prepaid actuator work and identified unpaid-actuation path;
  retirement of the disconnected reproduction-threshold promise; old-save
  regime handling. Still open: full solver-wide mechanical-energy error bounds
  for bias/projection, limits and contact, real-fluid/tissue fidelity, useful
  corrected-world swimming/foraging and sustained ecological benefit. Those
  are not implied by passing chemical or actuator checks. No 3D or sleep work.


## Twin Oar physical food approach — v0.33.1

- Followed the acquisition census with three 10-second and six 40-second
  sighted/retinal-disconnected showcase observations at the current 275-food
  target. Grazers already make real intake and reserve gains. In the original
  seed-41 sighted world, Darter earned two funded eggs and one Gen-2 hatch;
  this isolated outcome does not establish reliable multigeneration ecology.
- Twin Oar was a concrete control obstacle: little mouth-first travel and
  weaker natural intake with its original visual controller in two of three
  short comparisons. Exploratory budget: 36 ten-second steering-only trials,
  32 paddle-phase trials, and 20 combined timing/steering trials. Steering
  alone did not overcome the original gait. Selected the smaller successful
  combined prior, reusing the reviewed Darter grazer gains, rather than the
  largest trial gain. No ongoing search or runtime fitness code was added.
- New CUR-002 genomes shift only the SOUTH paddle phase by pi and use strong
  retinal/Angle gains in balanced mode. All genes remain mutable. Anatomy,
  sensors, mouths, lifecycle economics, neural architecture, metabolism and
  physics are unchanged. All other eight featured and 55 legacy genomes are
  bit-identical; stored genomes never pass through founder calibration.
- Eight held-out 16-second finite-food conditions use +/-0.45-radian food
  offsets, distances 135/160 px, headings 0.8/-1.2 and viscosities 0.15/0.22.
  Current genes absorb the full 2,400 J in 8/8, gaining about 1,970 J reserves.
  Original, gait-only and retinal-disconnected controls absorb zero in 8/8
  each. Expenditure rises less than 1%; no sampled work cap or invalid pose,
  and chemical discrepancy stays below 1e-5 J. These are physical assays with
  explicit finite food, not randomly encountered resources or learned behavior.
- Three 40-second, nine-juvenile showcase pairs use normal 275-food Uniform
  initialization and inflow, differing only in CUR-002's initial calibration:

  | Seed | Original absorbed J | Current absorbed J | Original reserve gain J | Current reserve gain J |
  | --- | ---: | ---: | ---: | ---: |
  | 17 | 2,400 | 3,936 | 1,325 | 2,860 |
  | 29 | 2,400 | 7,200 | 1,325 | 6,124 |
  | 41 | 4,800 | 2,592 | 3,725 | 1,516 |

  Total intake rises 43%, but one seed regresses substantially. No Twin Oar
  eggs are laid in these intervals. This supports corrected food approach,
  not universal natural foraging, earned Twin Oar reproduction, selection,
  learned benefit or sustainable ecology. Do not tune indefinitely against
  these seeds. Reproduction across representative seeds remains the next goal.
- `npm run audit:foraging -- --output report.json` reproduces the paired
  observations. Full measured values: `docs/experiments/twin-oar-foraging-v1.json`.
- Verification: 226 fast tests, TypeScript/Vite build, production Worker check,
  original bounded swimming search, all four historical complete-state profile
  hashes, and a new cold v0.33.0 CUR-002 continuation hash pass. Historical
  fixtures pin both catalogue options; no golden hashes were rewritten.


## Current-reference diagrams

- Restored current schematics for the lifecycle, starter construction, recurrent
  brain, personal learning, motor/sensory feedback, chemical-energy transfers,
  egg lifecycle and Worker/display ownership after the reference cleanup removed
  too much visual explanation. Added a Home index and sidebar link for discovery.
- Diagrams retain the concise current text and distinguish personal learning
  from inheritance, chemical accounting from mechanics, and rendering from
  authoritative state. Documentation only; no runtime or version change.

## Current-reference documentation cleanup

- Reconciled all eight maintained Wiki files against the v0.33 implementation,
  separating implemented capability from unproven ecological outcomes. Removed
  historical trial narratives in favor of links to this experiment record.
- Corrected learning/sleep status, 275-food/30-creature defaults, 18 initial
  creatures, deployed Worker ownership, current save schema and bounded starter
  calibration. Preserved physics/work-accounting and measurement limitations.
- Replaced stale, contradictory README/roadmap text with concise current scope,
  linked feature references and remaining priorities. No runtime or version change.
- Checked internal documentation targets and source constants; normal PR CI
  validates fast tests/build, followed by actual Wiki publication on merge.

## Sims-inspired bounded swimming development — v0.33.0

- User approved auditing drag/muscle scaling and a small offline search using
  existing motor genes. No live physics algorithm, coefficient, solver iteration,
  initial reserve, neural weight, anatomy, mouth or lifecycle gene is changed.
  Only new CUR-003/008/009 constructors apply selected mutable motor alleles.
  All other six CUR and all 55 FND remain unchanged. Old saves retain exact genes.
- Actual-kernel audit: rotated translational decay matches the analytic local-
  axis Euler substeps, passive spin dissipates without translation, and zero
  viscosity preserves free momentum. Current axial drag is 1/40 of the uniform
  four-face normal-drag reference; rotation uses full-face damping. Uniformly
  doubling 2D dimensions yields 16× actual muscle torque (inertia-based gains),
  rather than attachment-area/lever-arm scaling. These are calibrated modeling
  departures, not newly corrected coefficients. Work is sampled using pre-update
  joint speed and capped at 40 J per complete tick; its old substep comment is
  corrected. Chemical ledger conservation is not full mechanical conservation.
- Offline (1+8) asexual search for three generations: 25 training evaluations
  per each of nine separate families (225 total), fixed anatomy and intact brain,
  sensing, learning and life-history genes. Eligible parameters are existing
  frequency, muscle force, joint phase, amplitude and smooth harmonics. No fitness
  code is imported by the live engine or UI. Trials use normal funded founder
  reserves and no food or reproductive subsidies.
- Six-second training excludes the first second from displacement/path metrics,
  rewards COM progress/straightness/final-third progress with a bounded total-
  chemical-energy penalty, and requires ongoing late motor expenditure. Four
  held-out screens: three 9-second swims at viscosities 0.15/0.18/0.22 and rotated
  headings, plus a 15-second swim at 0.18/heading 0.37. Screens require >5% progress
  and >2% progress/J improvement, preserved original travel direction, nonlower
  late speed, ≤5% extra total reserve expense, no sampled speed/work cap, drift,
  non-finite pose, exhausted reserve or accounting error. A new seed alone is not
  an independent environment here: the empty-water controller is deterministic.
- Selected candidates passed every screen. Fifteen-second results, measuring
  net COM progress after one second of settling; costs include the whole trial:

  | New starter | Original progress px | Selected progress px | Progress ratio | Total reserve J, original → selected |
  | --- | ---: | ---: | ---: | ---: |
  | CUR-003 Tidewheel Browser | 114.40 | 224.65 | 1.96× | 455.80 → 459.70 |
  | CUR-008 Hammerhead Pursuer | 263.91 | 398.36 | 1.51× | 482.58 → 483.92 |
  | CUR-009 Branchstalker | 80.28 | 152.36 | 1.90× | 458.82 → 460.59 |

  All three have higher late speed and progress per total reserve joule, zero
  sampled caps, <0.12px final-tick hinge drift and <1e-5 J chemical discrepancy.
  Motor heat itself increases; efficiency claims use total chemical expenditure,
  not reduced motor work. Screens preserve prior route direction, not mouth-
  first travel. No improved food capture, live hunting, learning or ecological
  sustainability has been established. Substep spikes/all numerical exploits
  are not excluded by final-tick guards; future physical model work is separate.
- Six candidates were withheld. Darter's short training gain did not retain
  late speed/longer progress. Twin Oar and Hooktail changed route too much.
  Forktail/Broadwake failed held-out conditions. Lantern's original training
  trial hit a solver/work cap, preventing a clean baseline comparison. Do not
  retune or weaken screens until every starter can be declared a winner.
- Full reproducible settings, original genome hashes, every baseline/candidate,
  selected alleles and audit findings are in
  `docs/experiments/locomotion-search-v1.json`. `search:locomotion -- --check`
  reproduces and checks the constructor output for selected and unchanged designs.
- Verification: nine new bounded tests cover physics audit, fitness pitfalls,
  deterministic search budgets, genotype isolation, screening, longer native
  movement, unchanged founders and the pre-calibration CUR-003 cold-save hash.
  Four historical kernel-profile state hashes remain exact by pinning original
  founder genes/phases in the profile fixture. All 224 fast tests, the TypeScript/
  Vite build and real production Worker-thread check pass locally; the default
  `--check` reproduces all nine constructor outputs. CI repeats the bounded search.
- Next movement work, if pursued: explicitly version/evaluate literal face-drag
  and geometric muscle limits, improve mechanical-work accounting, then test
  mouth access and sensory-guided intake for these gaits. Modular controllers
  and body/control co-duplication remain future architecture, not this release.

## Contact, learning-buffer and lineage overhead — v0.32.1

- User approved all three remaining bounded optimizations. Rectangle SAT uses
  pass-current cached rotations and two numeric clipping buffers; current centers,
  original SAT/clip/vertex ordering, centroid sums, all eight contact passes and
  hinge projections are retained. Returned contact records do not alias scratch.
- Compiled learning buffers skip clearing when verified aligned records overwrite
  every eligible slot directly. Imported/reordered/shrunk lists clear only eligible
  slots and use ID lookup; changing topology creates fresh zeroed buffers. Genome
  weights, learned-record identities and neural arithmetic remain authoritative.
- Render hosts subscribe to lineage edits, seed existing IDs once on reset/import,
  then coalesce changes from all four production mutation sites: external spawn,
  hatch, egg laying and completed death. No per-frame historical scan or saved
  journal; headless worlds retain no journal. Future lineage edits must mark IDs.
- Local same-process component comparison, three alternating-order rounds against
  main 03a4802 (v0.32.0), medians:

  | Component | Baseline ms | Candidate ms | Work |
  | --- | ---: | ---: | --- |
  | Overlapping rotated rectangle clipping | 62.36 | 18.04 | 100,000 calls |
  | 96-hidden-neuron acquired-delta preparation | 245.01 | 82.65 | 100,000 calls |
  | Unchanged 10,000-record lineage | 162.99 | 0.94 | 300 empty-world frames |

  These isolate overhead, with exact contact/delta agreement. The lineage fixture
  shares one genome and excludes initial transfer, rendering and living entities;
  it demonstrates avoiding historical scans, not whole-tank performance.
- Final sequential CPU-sampled kernel comparison, 20 warm-up + 120 measured ticks:

  | Synthetic workload | Baseline ms | Candidate ms | Throughput ratio |
  | --- | ---: | ---: | ---: |
  | 15 founders, 200 food, 180 remains | 402 | 394 | 1.02x |
  | 30 generation-2 animals, same food/remains | 709 | 546 | 1.30x |
  | Same 30 with 75 blocked eggs | 797 | 651 | 1.22x |
  | 34 Gen-6 animals, 272 food, 27 eggs, 3 remains | 672 | 599 | 1.12x |

  All four pre-existing complete-state hashes match exactly, including learning
  and PRNG. The separate 15/78/221 reversed-order differential also matches exact
  states, with noisy timings (342/295 ms baseline, 366/285 ms candidate). An earlier
  profile of the first implementation showed little net gain and prompted removing
  redundant clears on aligned records. Do not promise browser multipliers or treat
  short server timings as stable speed guarantees.
- The first CI profile also preserves all hashes: throughput ratios
  0.82x / 1.06x / 1.08x / 1.11x. Its first small-world sample was slower.
  A bounded follow-up on that exact 15-founder/200-food/180-remain fixture,
  with 360 ticks and four alternating-order rounds in one process, gave
  baseline 952/910/863/815 ms versus candidate 885/730/764/684 ms, with
  identical full states in every round. This supports a net gain once warm,
  while retaining the cold/sampled timing limitation. CI components agree:
  median clipping 65.14→26.11 ms, learning 273.10→89.08 ms and unchanged
  history 193.37→1.43 ms for the same bounded call counts above.
- Verification: 215/215 fast tests, TypeScript/Vite build and actual production
  Worker thread check. New regression coverage compares 4,000 seeded rectangle
  contacts and boundary cases to a frozen v0.32 oracle; checks returned-value
  ownership, edited/removed learning records, topology invalidation, real lineage
  spawning/laying/hatching/death, complete cold reset and no unchanged-history scan.
  The PR runs the bounded comparison and focused Chromium/Firefox Worker checks.

## Spatial/neural execution and lightweight inspection — v0.32.0

- User requested further optimization and quieter creature selection. One
  physical-bounds index now supplies ray-corridor candidates for food, eggs
  and body parts, deduplicated in legacy group/array order. Separate
  post-physics indexes serve mouth apertures; descending prey/egg/food
  competition is unchanged. Food deletions trigger rebuilding before the
  next mouth, egg predation invalidates immediately, and new eggs are seen
  by later mouths. All physical substeps, sensing/feeding rates, geometry,
  energy accounting, neural sum order and PRNG are retained.
- Dense neural rows avoid per-edge mask checks; masked rows iterate compiled
  enabled source lists in original order. Weights are always current genome
  values, somatic deltas are still separate additions and caches are unsaved.
  Contacts reuse bounded generation-stamped cell buckets and deduplicate by
  first common cell in the original pair order. Hinge projection precomputes
  unchanged masses/local anchors but recalculates moving pose every iteration.
- Clicking a creature opens only general status. Explicit Inspect, toolbar
  or keyboard opening sets display pruning to 0.5 before graph rendering.
  Weak graph edges are filtered before constructing string IDs/SVG nodes.
  Heavy selected neural transport is requested only with diagnostics open.
  Display pruning never changes actual genetic or acquired connections.
- New-world cap 30; plant target 275; initial UI seed comes from the browser's
  random source and remains editable/reusable on reset. Initial population
  stays 18. Imports keep explicit settings; absent historical cap/target
  retain 100/400 so old continuations are not silently changed.
- Same-run CPU sampling, 120 measured ticks after 20 warm-up ticks; comparing
  main be6e625/v0.31.1 to the implementation commit:

  | Synthetic workload | Baseline ms | Candidate ms | Throughput ratio |
  | --- | ---: | ---: | ---: |
  | 15 founders, 200 food, 180 remains | 600 | 413 | 1.45x |
  | 30 generation-2 animals, same food/remains | 959 | 608 | 1.58x |
  | Same 30 with 75 blocked eggs | 1047 | 708 | 1.48x |
  | 34 Gen-6 animals, 272 food, 27 eggs, 3 remains | 1105 | 697 | 1.59x |

  All four complete-state hashes match exactly, including learning and PRNG.
  The fourth matches the user's reported counts, not their actual exported
  tank. These are profiled server kernels, not a browser speed promise.
  Reversed-order masked-brain 15/78/221 differential also matches exactly:
  baseline 548/394 ms vs candidate 399/366 ms; short timings remain noisy.
- Verification on implementation 82d7c75: 211/211 fast tests and TypeScript/
  Vite build pass. Actual production Worker thread transport passes; both
  Chromium and Firefox pass the original Worker smoke and new UI regression
  for defaults, random-source seed initialization, status-only selection
  and pruning reset. The intentional 100-animal stress test now explicitly
  selects cap 100 instead of inheriting a changed new-world default.
- Ray geometry, neural evaluation and body contacts remain CPU work. Native
  packaging, WASM, reduced sensor/physics fidelity and more simulation Workers
  were not needed for this bounded change. VIDA 3D is untouched.

## Simulation throughput correction — v0.31.1

- Follow-up to smooth 60 FPS rendering but inadequate simulation speed. The
  Worker now queues overdue batches through MessageChannel instead of adding
  timer idle time. Light worlds sleep until a tick is due; paused worlds use
  an idle timer. The fixed 1/60-second clock, 8 ms batch yield and bounded
  render updates remain intact.
- CPU sampling reproduced a concrete slowdown with 30 mutated generation-2
  animals, 200 nutrients, 180 remains and 75 ready-but-blocked eggs. Rebuilding
  every living-body bound separately for each egg consumed 55–59% of tick time.
  The egg pass now shares those bounds and immediately appends each newborn.
  Clearance is still checked every tick in all eight original orientations.
- Reuse velocity-constraint geometry only within its unchanged ten-iteration
  solve; cache exact vision corners only before movement; use numeric spatial
  grid coordinates and reusable contact wrappers with fresh AABBs each pass.
  No reduced physics substeps, sensing frequency, neural capacity or behavior.
- One same-run CI CPU profile measured these 120-tick kernels after 20 warm-up
  ticks (milliseconds, including profiler overhead):

  | Workload (200 nutrients, 180 remains) | v0.31 | v0.31.1 |
  | --- | ---: | ---: |
  | 15 founders | 847 | 620 |
  | 30 second-generation animals | 1148 | 994 |
  | Same 30 with 75 blocked eggs | 2678 | 988 |

  The egg-heavy sample rose from about 45 to 121 ticks/s. All three complete
  snapshot hashes exactly match v0.31, including PRNG and learning. These are
  synthetic server kernels, not measurements of the user's unavailable tank
  export, and not a promise of 2x/5x speed on every computer.
- Separate masked-brain 15-creature/78-nutrient/221-remains differential:
  baseline 710/495 ms vs candidate 623/408 ms in reversed-order rounds;
  complete state matches. Vision/neural work and contacts remain significant.
- Verification on the code commit: 208/208 fast tests, TypeScript/Vite build,
  actual production Worker thread check, Chromium UI/Worker smoke and the same
  smoke in Firefox all pass. Existing sibling-hatch, funding, save, learning,
  sensory and contact regressions remain green. No 3D changes.
- An opt-in CPU profiling script and workflow retain three complete-state
  references. Routine verification remains fast tests/build/Worker check;
  avoid turning every future feature into a benchmark campaign.


## Performance branch — v0.31.0

- User-authorized performance work now takes priority over the former
  deferred Worker milestone. Branch starts from main d3d7465/v0.30.0;
  all newer ecology/contact fixes are retained. No 3D files are involved.
- Cached numeric neural masks/plastic indices and in-place acquired records
  eliminate inner-loop JSON edge creation and repeated learning all…13610 tokens truncated… dense-24 edge count. Thus legacy 24-node dense
  controllers keep *exactly* their prior metabolic rate; extra enabled
  edges cost energy, disabled/pruned ones save it. Metabolic accounting
  remains in the same conserved reservoir/heat ledger.
- Inspectors show each individual's actual enabled/disabled synapse counts
  and metabolic costs. Current brain v5/save schema v9 remain unchanged;
  v3–v8 import support and v9 deterministic continuation are preserved.
- GitHub Actions PR run #39380193256 on commit `fbb688ef` passed
  **95/95 fast tests**, TypeScript and production build. The eight new
  controlled topology cases cover all operations, size limits, weak insertion,
  parent isolation, zero-mutation inheritance, deterministic offspring,
  snapshot continuation and energy conservation. No long ecosystem or
  browser suites were run. Larger structures have not demonstrated
  better behavior.



## Phase 1 neural architecture — version 0.8.0 (PR validated)

- Short wiring audit: retinal channel ordering, body/mouth feedback, six-joint
  motor outputs, recurrent state and founder steering priors agree with the
  source's stable channel IDs; no justified behavioral fix was found.
- Supports 1–96 identity-stable hidden neurons, bounded at 65,536 enabled
  synapses, with explicit disabled-edge identities. All original 55 founders
  retain their 24 dense hidden nodes, initialization PRNG sequence, weights,
  biases, gait parameters and mutable retinal steering pathways.
- Identity-aware remapping preserves surviving hidden weights, biases and live
  recurrent memory alongside eye/mouth/joint input and output channels.
  New hidden neurons and pathways start neutral; no structural mutation,
  lifetime weight learning or behavior assistance is added.
- Brain v5/schema v9 validate IDs, dimensions, edge references and node/edge
  bounds. Previous schemas v3–v8 remain importable. Current snapshots preserve
  neural state and exact continuation; pre-v9 dense weights remain enabled.
- Inspector shows the real hidden-node count/IDs and only enabled synapses.
  Existing neural energy upkeep is scaled by actual neuron count, without
  introducing extra edge charges ahead of Phase 2 cost calibration.
- New focused tests cover identity migration, variable sizes, masked-edge
  execution/display, v8 compatibility, exact continuation, invalid imports
  and a truly over-budget genome built from valid anatomy.
  GitHub Actions PR run #39378991393 on commit `8e97e7b4`: **87/87
  fast tests passed**, TypeScript and production build passed. The full suite
  and browser tests were intentionally skipped; this PR did not deploy Pages.



## Four jellyfish variants — version 0.7.0

- Bank expanded to **55 designs**, including five Bell swimmers. Existing 51
  blueprints are unchanged. Added Lantern (compact five-part herbivore), Sailbell
  (broad five-part herbivore), Ribbon (seven-part omnivore with segmented trailing
  tentacles), and Crown (seven-part carnivore with terminal paddles).
- Each has a distinct physical anatomy, stable IDs, pigment, seed, stroke settings
  and life history. They use existing evolvable recurrent controllers and physical
  hinges/drag; no artificial thrust. Available through Bank filters/search and
  automatically eligible for the usual up-to-five-design random startup.
- Added nine bounded tests: all 55 anatomies/organ slots validate unchanged in
  both brain modes; all five jellyfish are in the Bank; each new design translates
  in two simulated seconds in both modes while its passive control stays still,
  with finite poses, positive reserves and conserved energy.
- **81 fast tests passed**, plus TypeScript/production build. Updated catalogue
  counts in opt-in tests, without running the full simulation or browser suites.
- New [feature roadmap](FEATURE_ROADMAP.md) distinguishes small additions, bigger
  missing systems and known model limitations using the current source. Short
  gait checks do not demonstrate long-term survival or competent foraging.

## Alternate music — version 0.6.2

- Added a compact Track 1 / Track 2 selector to the shared start/pause menu
  audio controls. Track 1 remains the default; the choice persists locally.
- Track 2 is Coral Depths, the default music referenced by vidAI3D
  (`dca99b924ccd2204d7fda136fd91568c2c42cb30`, `constants.ts`). Bundled a local
  copy from https://storage.googleapis.com/assets-gen-playground/musiclibrary/coral_depths.mp3
  so playback does not depend on that external host. Both tracks use the same
  volume/mute controls. Switching stops and cleans up the previous player.
- Validation: **72 fast tests passed**, TypeScript/production build passed and
  emitted both local MP3 assets. Confirmed both MP3s decode and contain different
  audio. No browser checks or extended simulation runs.

## Independent audio volumes — version 0.6.1

- Start and pause menus share separate SFX/Music sliders (0–100%), percentage
  readouts and existing independent mute controls. Volumes persist locally across
  reloads; defaults remain 60% SFX and the configured music volume.
- Changing SFX volume while muted now updates its independent master gain, so
  unmuting restores the selected level. Music uses its existing reactive gain.
- Menu panels scroll on short screens to keep the added controls accessible.
- Validation: all **72 fast tests passed**, plus TypeScript/production build.
  No browser checks or extended simulation runs for this focused UI update.

## Hatch clearance and internal senses — version 0.6.0

- Confirmed existing normalized reserve/capacity and per-mouth contact/intake
  inputs. Added aggregate actual-feeding flag (previous completed tick) and
  normalized COM depth, clamped surface 0 / floor 1. No duplicate raw-J energy input.
- Brain v4/schema v8 preserve old channels and activations by stable IDs, with
  zero weights/values for added old-save channels. Founder pathways are evolvable.
  v3–v7 snapshots remain importable; current snapshots continue exactly.
- Root cause of tangled births: completion checked funding and population only,
  then spawned the full body at the egg regardless of occupied space. Hatching
  now requires a clear whole-body envelope, including gaps between limbs, and
  tank containment. Eight fixed orientations are checked at the same egg location.
  A blocked egg remains ready, funded and edible; its initial random heading is
  stored once. Same-tick siblings see previously hatched bodies as obstacles.
- Does not rearrange existing tangled adults or add continuous collision detection.
  Empty-envelope checks are conservative, so dense surroundings may delay hatching.
- Validation is deliberately short: **72 fast automated tests**, including nine
  targeted sense/migration/hatching cases, plus TypeScript/production build.
  No long ecosystem runs, manual playthroughs, or browser suite for this release.
- Per user direction, routine CI uses fast tests/build; full simulations and browser
  checks are available only through explicit extended workflow validation. This
  replaces the former mandatory full-suite/browser policy.

Earlier release measurements below describe their own versions, not this update.

## Surface anatomy, founder selection and jellyfish — version 0.5.0

### Implemented

- Each face accepts no attachment, one physical connection, or up to three
  nonphysical organs **combined**. Both ends of a hinge occupy their local faces.
  Stable center/side slots are shared by eyes and mouths. The common `SurfaceOrgan`
  representation supports defining future organ types without reserving fake organs.
- The former five-eye/three-mouth global limits are removed. Import validation and
  neural buffer bounds account for expanded layouts. Body trees remain limited to
  seven parts. More eyes have real metabolic and computational costs.
- Eye rays, mouth contact, body markers, debug ray origins and Bank previews use
  `getOrganAnchor`. Glyphs scale to fit small faces; contact aperture overlays retain
  their real physical size. The retinal strip scrolls rather than leaving the viewport.
- Mutation chooses free slots, remaps pruned hosts by stable part IDs, and repairs
  conflicting placements deterministically. A prune unable to carry all inherited
  organs is rejected. Slot placement, IDs, brain channels and weights are inherited;
  symmetry is not enforced on descendants. Zero mutation preserves the entire genotype.
- Bank now contains **51 distinct designs**: 50 revised originals and Moonbell
  Jellyfish. FND-021/022 have matching opposing limbs; FND-024/034/035 gain a
  counterpart to an unpaired branch. Twenty-eight designs gain more symmetric eye
  arrangements. Asymmetric and irregular families remain distinct.
- Moonbell Jellyfish is a compact five-part bell/rim/tentacle swimmer. Phased joints
  generate displacement through the existing drag model. Its initial motor weights
  are quiet and evolvable; balanced mode adds the existing weak retinal steering prior.
  No direct body thrust or swimming assistance is added.
- Default startup distributes **18 organisms among five randomly selected distinct
  designs**, or fewer designs if the requested population is below five. Selection
  is uniform without replacement, using the world PRNG; each organism has its own
  genome, recurrent state and identity. No forced diet quota is used.
- Fresh worlds default to **400 plants**. Saved settings continue to override defaults.
  Showcase starts up to all 51 designs, subject to the population cap.
- Specialist gross intake is **2,400 J/s**; omnivore intake is **1,200 J/s**, twice
  the old rates. Per-mouth shared budgets, diet permissions, storage limits,
  kin protection and the 20% assimilation loss remain. Carrion still yields 68%
  after its additional digestion factor. Anatomy panels show slots and current rates.
- Save schema **v7** preserves slots and expanded neural buffers. v3–v6 remain
  importable. Legacy live organ positions, body geometry, hidden memory and weights
  are preserved. Mutated descendants fit the new organ slots. Old overlapping
  Flapper/Glider fin anchors are repaired in new preset bodies and descendants,
  without rewriting the saved parent. Feeding after import uses current rates.

### Measured verification

- `npm test`: **115/115 passed**. The 23 anatomy cases include mixed organ slots,
  both hinge endpoints, atomic rejection, expanded neural buffers, actual slot-based
  feeding, rotated retinal origins, 700 mutation generations, independent startup
  clones, deterministic sampling and legacy compatibility.
- `npm run build`: TypeScript and production build passed.
- Isolated catalogue check: all **51** distinct bodies remained finite, alive and
  translated more than 5 px over 15 simulated seconds at viscosity .22.
- Jellyfish, 15s in still water, no food or reproduction:

  | Brain mode | Viscosity | COM displacement | Final reserve |
  | --- | ---: | ---: | ---: |
  | Balanced | .18 | 139.81 px | 9,600.41 J |
  | Balanced | .22 | 169.89 px | 9,600.65 J |
  | Unbiased | .18 | 97.00 px | 9,600.26 J |
  | Unbiased | .22 | 72.72 px | 9,600.37 J |

  All four corresponding motor-off trials had **zero displacement**. It curves;
  these are net displacements, not constant straight-line cruise speeds.
- Reference swimmer remains **1,206.42 px / 15s**, motor-off drift zero, final
  hinge error .1194 px. Existing forces, drag and reference gait were not boosted.
- Actual default world at 60s: seed 4242 **18 living/0 deaths**, seed 71 **18/0**,
  seed 1901 **17/1**, with one egg in the last seed. Absolute ledger error remained
  below 2e-8 J. Population outcomes are not forced to match between seeds.
- `npm run benchmark -- --seed 4242 --seconds 300`: **16 living**, 20 cumulative
  births, 4 deaths, generation **2**, 400 plants and 12 remains. Absolute ledger
  error **6.28e-7 J**. No hidden refills or rescue organisms are used.
- `npm run benchmark:behavior`: seven isolated control trials, all 51 catalogue
  bodies and 16 paired visual/blind scenarios (32 runs) completed. Mean credited
  intake was **3,170 J with vision / 4,377.5 J blind** for the two tested founders.
  This is evidence that the existing weak prior is not reliable food seeking;
  the new slots and extra eyes do not imply trained intelligence.
- **13 browser scenarios verified locally** (full run plus focused expanded-layout
  rerun). Coverage includes existing UI/persistence scenarios plus 400-food
  defaults, five-design seeding, jellyfish spawning/preview, and expanded organ
  imports with a horizontally scrollable retina on a narrow screen. Final GitHub
  checks gate deployment. Raw simulation/control results are in
  `release-validation-0.5.0.json`.

### Limits

- The jellyfish has rigid rectangular parts, not deformable tissue or simulated jets.
- Organ count can grow substantially; high-eye-count populations and large live
  brain diagrams cost CPU. The existing 25 MB snapshot import limit remains.
- Uniform random communities can be ecologically poor, including predator-heavy
  samples. There are no diet quotas, automatic replacements or extinction guarantees.
- Existing legacy individuals retain their prior layout until a future mutation;
  legacy zero-mutation clones remain faithful to their saved anatomy.

Earlier releases below are historical records of their own code and defaults.

## UI, vision, feeding and body contact — version 0.4.0

### Implemented

- Current version appears at the bottom right. Feed/Feed All moved next to the
  playback controls; the Eel, Predator, Flapper, Tadpole, Glider and Random
  shortcut row is removed. The Bank, all 50 bodies and existing effects/audio remain.
- Canvas logical dimensions follow its actual CSS area between the toolbars,
  including device-pixel ratio. Wide and narrow screens show different areas of
  the same world with equal X/Y scale, rather than stretching or letterboxing.
- All five floating panels are bounded by that area, scroll and have native
  resize handles. Moving/resizing panels or changing screen size reclamps their
  full rectangles, keeping content above the bottom toolbar. Main menu/guide
  overlays retain their independent scrolling.
- Canvas selection now consumes pointer events directly. Previously a press and
  release entirely between frames could be lost by polling the held state.
  Selection, dragging, wheel/pinch zoom and tracking remain available.
  Notifications ignore pointer input, and successful import notices expire, so
  banners cannot obstruct panel controls.
- Empty retinal space is exactly black. Walls, water, bubbles, grid, selection
  indicators and glows supply no RGB or distance hit. Creatures, food particles
  (including pink carrion) and eggs retain nearest-surface occlusion. Surface RGB
  attenuates exponentially toward black with distance; distance channels remain.
- Eggs have a stable white physical shell and equal RGB surface channels. Their
  display glow/ring carries no retinal signal. Nutrient cores keep fixed geometry
  and pigment while only their display glow pulses; consuming energy can still
  legitimately shrink the physical food radius.
- Mouths have animated dark openings and bite ripples driven by that mouth's
  actual absorbed intake/recent feeding. The animation changes no contact reach,
  optical body geometry, intake budget or neural inputs.
- Every mouth absorbs 80% of removed chemical energy, recording the rest as heat.
  Existing carrion/tissue digestion loss multiplies this factor (0.8 x 0.85 =
  68%). Gross intake rates and the shared per-mouth budget remain unchanged.
  Storage limits removal before assimilation, so full creatures do not destroy
  surplus food. Reciprocal feeding cannot amplify the combined chemical reserves.
- Carnivore mouths still cannot consume plant nutrients. Default-on kin
  protection excludes living parents/offspring, same-clutch and same-generation
  shared-parent siblings, and related eggs. Unrelated generation peers are edible;
  disabling protection permits cannibalism. Remains carry no kin protection.
  Different specialist mouths can still coexist, classified overall as Omnivore;
  there is no fourth Mixed diet label or HUD count.
- Initialization, automatic inflow, Feed and Feed All use one capped nutrient
  creation function. Lowering the limit retains existing food but prevents more
  creation at/above it. Zero also disables manual plant-food creation. Carrion is
  funded animal biomass, not an external refill: mineralization waits for a plant
  slot without deleting its stored energy. Death/egg remains retain their global
  particle safety cap and existing loss accounting.
- Rotated body rectangles now collide with other living creatures and their own
  nonadjacent parts. Directly hinged neighbors are exempt to allow bending.
  Physics advances all creatures on one common substep clock (at most 1/240s at
  the tested timesteps), then resolves inelastic frictionless impulses and split
  position/hinge repair before feeding. Mass and rotational inertia enter impulse
  resolution. A deterministic spatial hash limits contact candidates. Positional
  recovery does not add separation velocity or charge biological motor work.
- Existing v6 snapshot fields suffice: no controller remapping or neuron changes.
  V3/v4/v5/v6 imports remain supported; current saves continue exactly under this
  build's updated rules. Old imports preserve neural weights and recurrent memory.
  Default founder reserves, body/gait genes, drag and force conversion are retained.

### Executed validation

All 92 simulation tests passed (62 existing, 30 new). The new cases cover black empty space/walls,
white and distance-faded eggs, nearest-surface occlusion, pulse-independent food
vision, 80%/68% assimilation and heat, manual/inflow/decay caps, kin toggle cases
for living prey and eggs, reciprocal predation, rotated geometry, momentum and
kinetic-energy behavior of the impulse, high-speed contact at 1/30, 1/60 and
1/120s, nonadjacent self-contact, exact snapshot continuation and intact hinges.

All 50 original bodies remained finite/alive for 15s at viscosity .22. Net
translations ranged from about 7 to 1488px; this includes curving/circling and
is not a claim of equal cruising ability. The controlled 15s reference remains
1206.42px, with zero motor-off drift and 0.1194px hinge error.

All 18 default founders survived 60s for seeds 4242, 71 and 1901, with no eggs or
deaths at that time. Absolute ledger discrepancies were 5.59e-9, 2.75e-8 and
7.92e-9 J. Detailed current measurements are in `docs/release-validation-0.4.0.json`.

All eleven production-browser scenarios passed across the full local suite and
focused follow-up runs. These include 1920x900,
520x900 and 1024x480 windows, native resizing, dragging against viewport edges,
scrolling to each panel's final content, re-clamping after a 700x500 resize,
version/obsolete-button checks, actual Feed/Feed All limits, and existing catalogue,
snapshot/diet/remains behavior. A double-density canvas check verifies the white
egg pixels and actual animated mouth openings. The same check also passed after
adding quick selection, pan and wheel-zoom assertions. TypeScript/build passed.

The first CI run caught an import race: the world ref changed before React's
pause/settings render committed, so an old animation callback could step the new
zero-food world using the previous inflow. World swaps/resizing now carry a render
epoch; mismatched callbacks cannot advance the new world. A new browser regression
imports the same snapshot three times from MAX speed with 4x CPU throttling,
verifying exact saved time and zero food before resuming. The failing food-display
case and this stress check both pass in CI. The software-rendered wide-window
layout scene exceeded its 90s budget in CI, including with one worker. Layout
checks now use a genuine imported empty/paused snapshot, isolating bounds/scroll/
resize from ecological rendering workload. The separate startup/pause check runs
its full default ecosystem at 1920x900. The isolated wide-layout local rerun took
21.5s, with all its bounds/scroll/resize assertions retained. CI remains serial.

A controlled active swimmer struck a passive body moving at 100px/s: maximum
hinge error over 5s was 0.1585px and contact penetration 0.0210px. A deliberately
folded passive chain resolved root/leaf self-contact to about 0.02px slop with
hinge error below 1e-9px and COM drift below 1e-6px, without motor work.

Five-minute default ecosystem, seed 4242, production kernel at 1/60s:

| Simulated time | Living | Eggs | Highest generation | Recorded deaths |
| --- | ---: | ---: | ---: | ---: |
| 60 s | 18 | 0 | 1 | 0 |
| 120 s | 18 | 0 | 1 | 0 |
| 180 s | 20 | 0 | 2 | 0 |
| 240 s | 24 | 1 | 2 | 0 |
| 300 s | 24 | 1 | 2 | 1 |

Final ledger discrepancy: 2.98e-7 J. Reproduce with
`npm run benchmark -- --seed 4242 --seconds 300`. This is one finite ecological
sample, not proof of indefinite stability or improved intelligence.

### Remaining focused work

Contacts use discrete substeps and allow small solver slop; this is not continuous
collision detection or a full fluid solver. Directly attached rectangles may
intersect while bending. Food/eggs retain their existing circle/contact model,
not rigid-body collision response. Spatial indexing currently accelerates body
contacts, not all eye rays. Reliable foraging/escape, unused reproduction traits,
growth/injury/repair, evolving neural structure and longer ecological evaluation
remain pending.

## Previous release: neural motor control and longitudinal drag — version 0.3.0

### Implemented

- Six outputs per joint: the original angle, frequency, torque and stiffness
  channels, plus stroke amplitude and motor engagement. Amplitude ranges from
  0 to 1.75 times the inherited gait. Engagement ranges from 0 to 1; zero applies
  no active motor torque or active motor damping. Passive constraints remain.
- New commands ramp with a 0.12-second response time. This smooths transitions;
  an off command settles to exact zero. Gait phases continue during rest so
  resuming does not reset the inherited oscillator.
- New outputs initialize neutrally (full inherited amplitude/engagement). Legacy
  commands and weights map by part ID/channel, never by a changed array stride.
  Founders keep their 24-neuron recurrent core, original bodies and gait genes.
  New output connections can evolve; this is not within-lifetime learning.
- Two oral inputs per mouth: edible contact and normalized actual absorbed intake.
  Signals arrive from the previous completed tick, so no future target data is
  exposed. Contact sensing still functions at full storage. Oral sensing adds
  0.9 J/s per mouth to the existing approximate sensory upkeep calculation.
- Longitudinal drag coefficient 0.05 replaces zero in the existing anisotropic
  model. Normal and angular drag, torque constants, metabolic conversion and
  10,000 J founder reserves remain unchanged. No propulsion boost was added.
- Live inspector/brain graph/report expose the six commands and actual motor
  engagement/amplitude. The established interface, windows, effects and audio
  remain intact.
- Brain schema 3 and save schema v6 preserve ramps and oral feedback for exact
  continuation. V3/v4/v5 worlds and saved genomes migrate old commands and hidden
  memory by channel identity. New channels initialize neutral, not randomized.
  Current malformed channel identities and invalid motor/feedback values reject.

### Executed validation

- 62 simulation tests passed, including 13 new controller/physics/migration cases.
  Tests cover independent joint disengagement, zero motor work after settling,
  smooth rest/resume, zero amplitude with active pose holding, opposite turns,
  a faster-rhythm burst, energy costs at 1/30, 1/60 and 1/120s, passive coasting,
  causal oral feedback driving the real recurrent controller, and exact save
  continuation during a ramp. The legacy fixture was produced by 0.2.1's actual
  kernel: seven body parts, 24 old motor outputs, existing memory and PRNG state.
- All five production-browser scenarios passed locally. They include old v5
  import/export with unchanged old motor weights, all 36 new output slots,
  inspector telemetry, catalogue, settings, food/remains, save/load, dragging,
  and production-path startup/pause. TypeScript and the production build passed.
- All 50 original founders remained finite, alive and swimming for 15 isolated
  simulated seconds. Net displacements were 55.35–880.48px at viscosity 0.18.
  Median displacement was 87.4% of the 0.2.1 baseline at unchanged gait/force
  genes; individual ratios ranged from 68.9% to 106.0%. Net displacement includes
  turning, not just cruising speed. No universal faster-swimming claim is made.
- Six longitudinal drag candidates (0, .02, .05, .1, .2, .4) were compared before
  selecting .05. Stronger values increasingly reduced catalogue movement.
  The reference passive-coast check at viscosity .18 starts at 60px/s; speed
  after 10s was 45.85px/s with .05 versus 60px/s with zero drag. Resting does not
  mean an instant stop. At zero viscosity, momentum remains conserved.

Controlled reference swimmer, 10 seconds, viscosity .18, no food/reproduction:

| Neural command | Net displacement | Motor work heat | Basal + sensory heat |
| --- | ---: | ---: | ---: |
| Neutral inherited gait | 728.46 px | 11.286 J | 303.50 J |
| Motors disengaged, including initial ramp | 46.67 px | 0.167 J | 303.50 J |
| Gentle amplitude (0.4×) | 305.98 px | 1.729 J | 303.50 J |
| Faster rhythm (+28%) | 867.66 px | 16.615 J | 303.50 J |
| Maximum amplitude (1.75×) | 274.41 px | 11.658 J | 303.50 J |

Motor work after disengagement settles is exactly zero; initial ramp/coasting
explains residual displacement. Maximum amplitude is not automatically efficient:
it causes the reference to turn/fold more. Opposite angle commands produced
opposite lateral displacements (+161.31 and -163.81px). These are controlled
actuation results, not evolved hunting. The in-game 15s reference verification
at viscosity .22 measured 1206.42px, zero motor-off drift and .1194px anchor error.

Paired food-seeking protocol: two untrained balanced founder types, eight seeds
each, 40 food particles in the same 1000px-square patch, 30 simulated seconds,
no inflow and reproduction disabled. The comparison holds retinal input at its
empty-water baseline while keeping anatomy, costs and internal feedback intact.

| Build | Mean intake with vision | Mean intake with retinal input held at baseline |
| --- | ---: | ---: |
| 0.2.1 baseline | 2323.75 J | 2106.25 J |
| 0.3.0 | 2092.50 J | 2175.00 J |

This small heterogeneous sample establishes no consistent vision advantage and
no improved foraging claim. Bodies, drag and temporal feedback affect encounters;
these means are not a general intelligence score. New motor authority works,
but reliable food-seeking/escape still needs deliberate controller evaluation.
Reproduce current measurements with `npm run benchmark:behavior`; recorded
trial data and the drag sweep are in `docs/behavior-results-0.3.0.json`.

Default initialization, 60 seconds at 1/60s: all 18 founders survived for seeds
4242, 71 and 1901. Seed 4242 also hatched one offspring (19 living). Absolute
ledger discrepancies were 1.21e-8, 6.98e-9 and 1.40e-9 J respectively.

Five-minute default ecosystem, seed 4242:

| Simulated time | Living | Eggs | Highest living generation | Recorded deaths |
| --- | ---: | ---: | ---: | ---: |
| 60 s | 19 | 0 | 2 | 0 |
| 120 s | 23 | 1 | 2 | 0 |
| 180 s | 28 | 0 | 2 | 0 |
| 240 s | 33 | 2 | 3 | 0 |
| 300 s | 41 | 1 | 3 | 0 |

Final ledger discrepancy: 3.29e-7 J. Reproduce with the standard 300s benchmark.
This sample does not establish indefinite ecological stability; founder age
turnover, natural selection and hunting need longer dedicated evaluation.

### Remaining focused work

Solid inter-organism and nonadjacent self-contact remains next. Other pending
work includes unused reproduction genes/trade-offs, growth/injury/repair,
controller training or stronger evaluated founder priors, evolving brain
structure, spatial indexing, UI-thread separation, niches and experiment archives.

## Previous release — version 0.2.1

This release changes ecological outcomes. The 0.2.0 results below are historical,
not expected results for the corrected feeding model.

### Implemented

- Independent inherited body pigment, with no mouth-driven recoloring or excluded
  green band. Heritable `colorMutationRate` scales the world's pigment mutation
  probability. Zero preserves parental hue, saturation and lightness in the next
  offspring; the variability gene itself can mutate. This does not add conscious
  color selection or neural control of pigment.
- Rendering and optical sensing share the per-part body pigment, including the
  existing low-energy shading. Founder anatomy, gaits, oscillator/motor equations,
  drag, energy-conversion constants and the interface layout are preserved.
- Three diet labels: herbivore, carnivore and omnivore. Different specialist mouths
  give an omnivorous overall diet without changing any individual mouth's food
  permissions. Bank diet filters use the same overall classification. Mouth
  anatomy remains visible separately.
- One intake allowance per mouth per simulated tick, shared across prey, eggs,
  nutrients and remains. Capacity limits intake before food is removed; full
  storage no longer destroys surplus food. Omnivore mouths retain their half-rate
  trade-off. Resource visitation order is still deterministic and sequential.
- The bite exhausting a living prey's reserve immediately records lethal predation,
  so the victim cannot subsequently be mislabeled as starving in its own update.
  Existing reserve-first predation remains a simplified model, not tissue injury.
- Corpses and nonviable eggs leave pink edible remains. Carnivore/omnivore mouths
  can scavenge these at 85% assimilation, with the remainder recorded as heat.
  Uneaten remains become plant nutrients after 60 simulated seconds, preserving
  their remaining chemical energy. This is a simple timed conversion, not a
  microbial decomposition model. Existing particle-cap loss accounting remains.
- HUD/report counts distinguish plant food and remains. Remains do not suppress
  plant-food replenishment, and Clear Free Nutrients removes only plant food.
- Save schema v5 retains food type, decay timers and pigment variability, with
  exact continuation in this build. V3/v4 saves still import; their untyped food
  stays plant food. Older saves run under the updated simulation rules.

### Executed validation

- 49 simulation tests passed (29 existing, 20 new). Coverage includes the six-food
  intake reproduction at 1/30, 1/60 and 1/120s; shared mixed-resource intake;
  permissions for all mouths against plant food and remains; lethal predation in
  both organism orders; finite-storage feeding; conserved body/egg energy;
  remains decay; color inheritance; optical pigment; validation and v5 exact
  continuation through decay, plus v3/v4 import compatibility.
- All four production-browser tests passed locally, including import/render of a
  green creature with different specialist mouths and a distinct pink remains
  particle. HUD/report show one omnivore, one remains particle and zero nutrients.
  Existing catalogue, inspector dragging, live neural graph, sandbox, save/load,
  Pages-subpath startup and pause/resume checks remain covered.
- TypeScript and production build passed. Controlled swimming remains 1263.19px
  COM displacement in 15s, with zero motor-off drift and 0.1197px final anchor error.
  No frame-rate or learned-behavior claim is inferred from headless execution.

Default initialization, 60 simulated seconds at 1/60s:

| Seed | Living | Eggs | Recorded deaths | Absolute ledger discrepancy |
| --- | ---: | ---: | ---: | ---: |
| 4242 | 18 | 1 | 0 | 7.0 × 10⁻⁹ J |
| 71 | 18 | 0 | 0 | 8.4 × 10⁻⁹ J |
| 1901 | 18 | 0 | 0 | 2.3 × 10⁻⁹ J |

Five-minute default ecosystem, seed 4242:

| Simulated time | Living | Eggs | Highest living generation | Recorded deaths |
| --- | ---: | ---: | ---: | ---: |
| 60 s | 18 | 1 | 1 | 0 |
| 120 s | 23 | 1 | 2 | 0 |
| 180 s | 29 | 2 | 2 | 0 |
| 240 s | 37 | 1 | 3 | 1 |
| 300 s | 49 | 5 | 4 | 1 |

Final ledger discrepancy: 1.36 × 10⁻⁷ J. Reproduce with
`npm run benchmark -- --seed 4242 --seconds 300`. This is one short ecological
sample; it does not establish indefinite sustainability or reliable hunting.
No reserve inflation, replacement creatures or survival immunity were added.

### Next focused work

- Give brains control over oscillator amplitude/motor engagement, with useful
  feeding/contact feedback and controlled behavioral comparisons.
- Add inter-organism and nonadjacent self-contact; calibrate nonzero longitudinal
  drag while retaining effective active swimming.
- Retire or implement the unused reproduction genes; establish meaningful trait
  trade-offs before expanding brain structure. Growth, injury/repair and gradual
  senescence remain future biology features.
- Spatial indexing, UI-thread separation, environmental niches and selectable
  experiment archives remain pending. Preserve honest measured limits.

## Previous release — version 0.2.0

VIDA now develops and builds directly from this repository. The established
interface, movable windows, camera, mouth/raycast effects, bubbles, eggs, audio
and Pages asset handling are retained. The simulation kernel is in
`simulation.ts`; the UI re-exports its API for existing integrations.

### Implemented

- Original 50 distinct founder anatomies, ten families, 30 herbivores, ten
  omnivores and ten carnivores. Existing Bank supplies previews, filters, safe
  individual spawning, and a new-world catalogue showcase. Built-ins stay
  separate from the 25 user-saved slots.
- Standard initialization samples 18 diverse founders (12 herbivores, four
  omnivores, two predators). Legacy archetype/preset controls remain available.
- Fixed unselected-trait clamping, including the motor-force jump from about 3
  to at least 8. Zero mutation preserves traits and weights exactly; only
  descendant identity, parent IDs and generation change.
- Every eye has five RGB/distance rays, every articulated joint has normalized
  angle/velocity inputs, and all four motor channels remain functional. Stable
  eye/part channel IDs preserve surviving neural paths through topology changes.
  Hidden recurrence remains 24 neurons. The graph displays live signals and
  recurrent connections with adjustable pruning and tooltips.
- Balanced/unbiased founder modes. Both retain seeded oscillator gaits; balanced
  adds weak heritable retinal color steering. This is a starting prior, not
  trained foraging or hunting, and uses no hidden world coordinates.
- Branch addition, leaf removal and branch relocation validate attachment
  rules, occupied faces, tree order and neutral-pose overlap. Organ hosts are
  remapped by surviving part IDs. Parent/offspring lineage uses organism IDs.
- Nutrient target 0–800, tank width 800–4800, height 600–3000, gravity -200…200
  px/s² and living-population cap 1–150 (default 100). Resizing translates each
  articulated body intact. Gravity uses consistent acceleration units for
  bodies, eggs and particles. Lowering capacity never removes existing life.
- Clear Free Nutrients records removed chemical energy in the ledger. A zero
  target prevents environmental replenishment; carcass/egg decomposition can
  still return nutrients. Initial seeding immediately uses the selected target.
- Copy Diagnostic Report, current-schema snapshots with complete state/settings,
  deterministic PRNG-funded organism IDs, legacy v3 sensory migration, validated
  imports and nonblocking isolated verification tests. Current saves continue
  exactly; v3 saves cannot recover environment settings they did not contain.
- Credits: “By Hernán Garro & Federico Regueira”.

### Executed validation

- 27 gameplay regression tests plus two additional legacy/verification checks
  passed locally (29 tests total). The combined suite is also run by CI.
- All 50 exact anatomies are unique and valid, with no initial positive-area
  body overlap. All remained finite and alive for 15 simulated seconds in
  isolated zero-food swimming checks. Measured net movement: approximately
  81–1114 px over that interval, depending on the body/controller.
- Zero-mutation preservation tested for all 50 founders over ten generations.
  A 500-generation structural mutation chain retained valid geometry and hosts.
- Exact current-snapshot round trip and continuation tested through fractional
  inflow and a hatching event, including IDs, activations, counters and PRNG.
- Three production-browser scenarios passed locally: Pages-path startup and
  pause/resume; catalogue/spawning/saved specimens/live graph/window dragging;
  sandbox settings/zero nutrients/diagnostic report/snapshot import/export.
  Browser execution used local headless Chromium; no 60-FPS claim is inferred.
- TypeScript and the production Vite build passed.

Default initialization, 60 seconds at 1/60s, 800 food, inflow up to 15/s, viscosity
0.18, cap 100, balanced founders:

| Seed | Living at 60s | Total births including 18 founders | Deaths | Absolute energy discrepancy |
| --- | ---: | ---: | ---: | ---: |
| 4242 | 20 | 20 | 0 | 7.5 × 10⁻⁹ J |
| 71 | 18 | 18 | 0 | 8.9 × 10⁻⁹ J |
| 1901 | 18 | 18 | 0 | 1.9 × 10⁻⁹ J |

Longer run, seed 4242, same settings:

| Simulated time | Living | Eggs | Highest living generation | Deaths |
| --- | ---: | ---: | ---: | ---: |
| 60 s | 20 | 0 | 2 | 0 |
| 120 s | 26 | 1 | 2 | 0 |
| 180 s | 36 | 1 | 3 | 0 |
| 240 s | 46 | 2 | 4 | 0 |
| 300 s | 60 | 4 | 5 | 0 |

The final ledger discrepancy was 1.24 × 10⁻⁷ J. Reproduce with
`npm run benchmark -- --seed 4242 --seconds 300`.

Controlled physical-swimming verification uses the reference 126px body with
neural motor modulation disabled and its traveling-wave CPG intact: 1263.19px
COM displacement in 15s; disabled motors and zero drag each produced less than
10⁻⁴px drift. This is distinct from random-controller ecological performance.
Six isolated unfed legacy starters starved after approximately 247–329 seconds
in fixed 1/60s checks. Separate regressions cover positive-reserve age death.

### Limits

These checks establish startup stability, reproduction, inheritance, geometry,
accounting and reproducible continuation. They do not establish indefinite
sustainability, reliable hunting, or learned intelligence. Neutral-pose validation
is not full self-collision avoidance throughout every moving gait. CPU limits
still reduce effective acceleration; HUD throughput reports actual performance.
Named branching still forks the active in-memory experiment; it does not yet
provide a selectable archive of independent running worlds.

## Historical validation before version 0.2.0


## Latest export update

Integrated `project-files (11).zip` using the previous export as a merge base.
This retains all new game changes: inherited target clutch size and maturity age,
budget-limited clutches, nutrient-distinct creature colors, new trait displays,
and diagnostics-window closing without clearing the creature selection.

The standalone Pages build, bundled asset URLs, exported configuration defaults,
configured population cap, zero-valued settings, and previously tested energy
accounting repairs are preserved. The hosted Playground SDK is still unused.

Local validation: **12 simulation tests passed** and `npm run build` passed.
The added coverage exercises inherited clutch limits, partial affordable clutches,
inherited maturity, and energy-conserving egg funding through the gameplay kernel.
The existing single-egg regression now uses the explicit one-egg budget instead
of the new desired-clutch budget.

In the same seeded 60-second workload described below, all 18 founders survived,
one offspring hatched, one egg remained, and no deaths occurred. The energy ledger
discrepancy was approximately **1.4 × 10⁻⁸ J**. This remains a short startup check;
long-term ecological sustainability is unverified. Chromium execution and Pages
deployment are checked by the existing GitHub Actions workflow on push.

## Initial GitHub Pages import

## Scope

This is the **2D** VIDA project from `project-files (10).zip`, not the separate 3D
experiment. The attached source and assets are retained alongside a standalone
React/TypeScript/Vite build. Tailwind CSS is compiled locally, and the application
no longer initializes Google's hosted Playground SDK. `playground_config.json`
values initialize the standalone configuration (including 18 founders, 900 food,
0.18 viscosity and a 45-organism cap).

GitHub Actions validates pushes and pull requests; only pushes to main or manual
runs deploy to Pages. Dependencies are pinned and the lockfile is committed.

## Focused game repairs

- Respect an egg's actual reserve at hatching; remove the unfunded 100 J minimum.
- Count nonviable egg energy as nutrient energy **or** removed energy, once.
- Record decomposition energy lost when the nutrient cap prevents recycling,
  including discarded small remainders.
- At starvation, record only expenditure actually paid from the remaining reserve.
- Record tiny discarded food and egg remainders after feeding.
- Prevent negative storage room from producing negative absorption.
- Recompute reproduction readiness immediately after laying.
- Honor valid zero-valued environmental settings and the configured population cap.

No changes were made to motor torques, water drag, controller weights, energy
conversion constants, or inherited lifespan policies in this import.

## Executed local validation

`npm test`: **10 tests passed** against the gameplay `stepSimulation` module.
Coverage includes damaged and nonviable eggs, decomposition at the resource cap,
starvation accounting, all three mouth types, reproduction below the retired
capacity threshold, cooldown, positive-reserve age death, and a seeded ecosystem.

The seed-4242, 18-founder workload ran 60 simulated seconds at 60 ticks/s with
900 initial nutrients, 15 nutrients/s inflow and 0.18 water viscosity. Results:
**18 survivors, 0 deaths, 0 eggs, 0 hatches**; energy ledger discrepancy was
approximately **7 × 10⁻⁹ J**. This short workload verifies startup stability and
accounting; it does not establish long-term ecological sustainability.

`npm run build`: TypeScript checks and production compilation passed.
The browser test loads the built game below `/vidAI/`, checks startup assets,
starts the ecosystem, waits for simulated time to advance and pauses/resumes it.
Chromium downloads were unavailable in the local environment; browser execution
is therefore a required GitHub Actions check before deployment.

## Existing limitations / follow-up work

- The simulation and React UI remain mostly in the large `App.tsx` module.
- Save/load is not yet a complete deterministic continuation: settings,
  accumulator/counters and some histories are not all preserved, imports need
  deeper validation, and organism IDs still use `Math.random()`.
- The existing “Branch this Ecosystem” action clones the active state in memory;
  it does not yet retain independently selectable named experiments.
- The reference diagnostic still needs stronger isolation from the global PRNG
  and an audit of every displayed pass criterion.
- Functional sensory channel expansion and spatial indexing remain separate work.
- The brief startup run does not prove successful multigeneration evolution.

Keep these distinctions when reporting results. No hidden energy refill,
replacement population, or immunity was added.
