# Nutrient-intake artificial selection v1 (#87 / draft #88)

**Complete; stop for owner review.** In this single paired run, the legacy
six-output controller improved absorbed nutrient intake from4,800 to16,704J
(+248%). The neural Mode+Command hybrid remained at0J in the training habitat.
These are two particular fresh brains and their descendants, not a general
architecture ranking. No controller, genome or experiment was promoted.

## Registered method and implementation

[Pre-evaluation protocol](nutrient-intake-v1-protocol.md) was committed at
4919742bd0425519089b926f9c4b048e2ecaedc9 and linked from #87 before coding.
Branch `experiment/nutrient-intake-87` / draft #88 targets #86's
`experiment/neural-modes-food-63` at211025a3f9d5144b3fafa8679ee882c426cee64a.
#72/#85/#86 remain independent draft, unmerged experiments with unchanged raw data.

The **only score is nutrient energy actually absorbed in joules**. All450
proposals ran for12s:15 generations x15 offspring for EACH architecture;2
founders and12 held-out evaluations bring the selection/held-out dataset to464
rows. Strict elitism compares only valid intake with strict greater-than; ties
retain parent. No distance, reserve, visibility, contact or energy-efficiency
secondary score. All offspring in a generation start from its frozen parent;
only original inherited genes pass forward, never acquired learning or state.

Legacy is the original six-output servo (Angle/Drive/Torque/Stiff/Amp/Engage),
NOT oscillator-only. Hybrid is #86 neural-motor-v1, Mode and shared Command for
EACH joint, exact #72 OFF/DIRECT/OSCILLATOR semantics, .06 hysteresis and immediate
decisive transitions. No retained-head genetic selector or extra legacy head.
Both joints can change independently. Both have entirely randomized IH, HH,
HO and biases,24 recurrent hidden neurons, seed17 and paired trunk initialization;
no trained sensory/recurrent/motor weights remain. Parameter counts2172 versus1972;
HO streams and meanings differ, so identical draws do not imply identical motor
behavior. Eight scalar neural mutations with replacement, Gaussian sigma.15,
existing bounds per offspring; same mutation seeds, differing parameter slot
counts. All proposals can mutate both Mode and Command;8 did so in this run.
CPG/nonneural traits remain inherited Darter priors and unchanged in this
neural-only mutation budget. Ordinary genetic oscillator mutation support remains.

CUR-001 Darter anatomy/mouth/eyes, motor capacity, v3 physics and chemical rules
are unchanged. Arena1000x800px, root500,400 atheading.37, gravity0, viscosity.18,
seed73;240 ordinary3000J nutrients (300/million px²). Existing abiotic bloom
recipe:65% cluster probability at12 seeded grid sites,96px square halfspread,
35% uniform. Placement does not depend on creature behavior or score. No rejection
of initial contacts, food repositioning, attraction, targets or inflow/respawn.
Full settings, nutrients and PRNG states for training and held-outs are archived.
Normal10000J founder reserve is funded once through the ordinary external ledger;
no top-up or unlimited reserve. Normal capsules, ray vision, assimilation.8,
feeding/depletion, metabolism, physical contacts and lifetime learning run normally.
Darter maturity18s exceeds12s, so normal reproduction needs no intervention.

### Nonlethal protection and measurement

The sole biological exception is an **ephemeral request-scoped**
`nonlethalEvaluation: nutrient-intake-v1` option on paused experimental Worker
stepping. It accepts a singleton herbivore v3 world, no eggs/inflow, within12s.
A final mortality callback records and suppresses starvation/senescence marking
AFTER ordinary spending and feeding. It never edits reserves, age, forces,
velocities, brains or PRNG. Nothing is added to settings/genomes/save schemas;
normal ticks and continuation from exported snapshots have ordinary mortality.
No predation exists in this singleton herbivore fixture. Production mortality
and reproduction rules are unchanged. No training candidate actually invoked
protection or energy limiting, but zero-energy and old-age verification proved
its behavior separately:120 zero-reserve ticks per architecture, zero motor
work/chemical error,960 correctly limited joint impulses, no new energy; ordinary
continuation then dies/removes normally. Old age is not reset.

Actual absorbed J sums post-tick ordinary mouth feedback times the real per-tick
allowance; it is not food removed or a capped recent-feeding history. Separate
physical-contact verification gives144J absorbed from180J ordinary consumption
in3 ticks for BOTH architectures, with ordinary learned offsets and closure.
A residual-depletion unit check distinguishes48J absorbed,12J assimilation heat
and.5J discarded remainder. Gross food loss includes remnants; those are
recorded losses, never score. Exact partition:

`initialReserve - finalReserve + grossFoodLoss = motorHeat + metabolicHeat + recordedLosses`.

Metabolic heat includes unabsorbed assimilation energy. The reported creature
chemical expenditure is `initialReserve - finalReserve + absorbedJ`, excluding
assimilation loss. Positive motor work is prepaid at the existing4x chemical
factor; signed braking gets no credit/regeneration. Correct energy limiting and
zero reserve are allowed valid resource states, not a score or a reason to grant
energy. Paid-scale delivery errors remain checked.

Validity gates were fixed before evaluation: finite singleton, full duration,
no eggs; no entry into the100px boundary zone, no speed guards; substep anchor
error<.5px, limit excess<.05rad, constraint gain<1e-12J,
post-constraint/contact omega<=20.001rad/s; chemical error<1e-5J and motor billing
residual<1e-9J. Boundary exclusion is conservative removal of boundary-influenced
trials, not proof of a numerical defect. Invalid trajectories never select.
No safeguards or gates were weakened, no solver investigation performed.

## Training results

| Measurement | Legacy six-output | Neural hybrid |
|---|---:|---:|
| Founder absorbed J |4800|0|
| Final valid absorbed J |16704|0|
| Gain over founder |11904J /248%|0|
| Valid offspring /225 |201|120|
| Fed offspring (all / valid) |224 /200|0 /0|
| Accepted improvements |5|0|
| Final selected specimen |g15/o10|unchanged founder|
| Founder → final displacement px (diagnostic) |95.48 →279.22|5.52 →5.52|
| Final contact/intake ticks /720 |348|0|
| First final intake tick |130 (2.167s)|none|
| Final positive / braking work J |3.85770 /.688897|2.47168 /.0105790|
| Final motor chemical J |15.43081|9.88673|
| Final own chemical expenditure J |325.23967|319.59273|
| Final reserve J |26378.76033|9680.40727|
| Final motor / sensory learned L1 |.077885 /.130214|0 /0|
| Final guards / post-constraint overspeed samples |0 /0|0 /0|
| Final substep anchor px / limit excess rad |.08024 /.02266|.14788 /.03670|
| Median instrumented12s Worker wall ms |112.26|109.60|

Wall time includes full reset, IPC, vision, observation, trajectory and snapshot
serialization on this host; it is not steady gameplay FPS or a controlled runtime
speed ranking. Founder warmup times are excluded from these medians. Per-trial
measurements are retained. One sequential Worker ran selection; architecture
order alternated each generation.

Legacy improved atg1/o13(10176),g2/o11(13680),g10/o4(13968),g11/o8(15648),
g15/o10(16704J). Most proposals worsened intake; strict elitism preserved every
accepted benefit. Per-generation best/median/fed/valid counts and every mutation
and genotype hash are in the raw archives and [derived summary](nutrient-intake-v1-summary.json).
Legacy exclusions:23 boundary-zone entries and1 speed-guard candidate. Hybrid:
105 joint-limit violations, including1 guard candidate. These invalid rows remain
reported with their actual intake, never as winners. Maximum raw substep anchor
.23772px, limit excess.11852rad; up to4 guard events in a candidate. No solver
fix or proof that all remaining motion is artifact-free is claimed.

All1,296,000 hybrid offspring joint-substep samples remained DIRECT; no OFF or
OSCILLATOR use, no mode switches or beneficial mutation. The anatomy has
independent joint outputs, but this search did not discover useful mode switching.
The hybrid's joints tend to press stops and produce a short transient (~.21px
late displacement over the last4s for the retained founder). A valid zero-intake
founder plus strict zero ties prevents neutral drift across the food-free score
plateau. This is a demonstrated outcome of this protocol, not proof the hybrid
can never forage. No food movement or extra score was introduced to escape it.

Both final specimens see ordinary nutrients fromtick1 through all720ticks.
Legacy final has348 actual feeding ticks versus100 for its founder; first intake
improves fromtick297 to130. Nonzero learned motor/sensory offsets follow real
feeding and change effective synapses within life; contact traces preserve their
time course. They are not inherited. Their net functional benefit is NOT isolated
by this study; no learning-off ablation was performed or universal new reward
rule implemented. Directed food seeking rather than incidental encounter is not
proven merely by intake or displacement. #78's separate contextual genetically
evolvable positive/negative/zero reinforcement requirements remain untouched.

Training chemical error<=6.985e-10J and partition residual<=6.731e-10J; all motor
delivery residuals/billing gates passed. No resource depletion/would-be deaths,
minimum remaining reserve9675.48J. Existing mechanical passivity/guard limitations
remain; chemical closure is not proof of physically exact dynamics.

## Unseen arrangements (not selected)

Same density/recipe/duration, seed811/977/2301 and heading-.7/2.3/pi/2. Each
initial and final genotype gets each condition,12 held-out rows. Because the
hybrid never changes, its paired initial/final trials reproduce identically.

| Seed | Legacy initial → final absorbed J | Final valid? | Hybrid initial = final J | Hybrid valid? |
|---|---:|---|---:|---|
|811|15168 →22320|yes|4800|NO: guards/limit|
|977|14208 →14064|yes|0|yes|
|2301|10224 →12288|yes|3984|NO: guards/limit|

Legacy improves2/3 and regresses1/3 by144J; mean13200→16224J (+22.91%),
median14208→14064J. No uniformly robust improvement. Hybrid's feeding rows are
real absorption/learning, but physically invalid and excluded as success; its
only valid held-out has zero intake. Twelve seconds was sufficient for actual
feeding in this habitat, but not for meaningful interaction in every trajectory.
A zero-intake trial alone does not prove failed food seeking or sensory incapacity.

## Evidence, verification and limitations

[Manifest](nutrient-intake-v1.json) indexes35 immutable gzip files: environment
snapshots,2 founders,30 generations,2 champions and12 held-outs. All450 proposal
genotypes reconstruct exactly from frozen parents and8-event ledgers; selected
full genomes and sampled joint/COM trajectories are retained. Append-only unique
filenames, fsync and readback hashes avoid overwriting in-flight checkpoints;
manifest checks every receipt. [Runner log](nutrient-intake-v1-run.log) preserves
all30 generation summaries. No training reruns or lost/recovered receipts.
The only final hybrid champion is explicitly its unchanged zero-intake founder.

Focused verification:5 new static tests;319/319 fast plus1 testing metadata;
typecheck/build; production/gated/retained/#85/#86 actual-Worker checks pass.
#87 Worker/host, observed/quiet, reset/fork, food assimilation/learning, zero-reserve,
normal mortality, senescence and malformed bounded-request checks pass.
Two #86 and three #85 frozen final states remain EXACT despite the new Worker
bundle. The audit reconstructs450 genotypes/elite choices and replays BOTH final
specimens plus split360+360-tick reset continuations exactly (snapshots/PRNG,
metrics and serialized trajectories). These are verification, not new selection.
An initial replay assertion treated an undefined legacy mode property as different
from its JSON-omitted archive property; JSON-normalizing the comparison fixed
the verifier. Numerical values/snapshots and training were unchanged; no rerun
of the search. All protected #72/#85/#86 evidence hashes remain unchanged.

Reproduce ONLY if deliberately authorized: `npm run build` then
`npm run experiment:intake` in a clean checkout without these result paths
(the runner refuses overwrite). Normal review: `npm run test:fast`,
`npm run build`, `npm run test:intake-worker`, `npm run audit:intake`.
`node --import tsx scripts/summarize-nutrient-intake.mjs` regenerates derived
summary only. Existing #86 verifier remains pinned to its original Worker;
CI uses the new intake audit plus explicit old-state compatibility checks.
No repeated old evolutionary/ecological study, manual browser campaign or solver
investigation. Remote CI and exact final GitHub head are in #87/#57.

**Recommendation:** legacy demonstrates increased actual collection in this one
run, with limited held-out transfer. The neural hybrid shows no training
improvement and substantial joint-limit fragility. Do not select or promote an
architecture from one initial brain. Stop for owner review of the frozen evidence;
if more evidence is wanted, preregister an equal-budget independent paired-seed
replication, rather than changing scores or tuning physics/organisms. No automatic
new search. Main194d70d1/v0.37.0 and testingd7a6814/T1.1 remain unchanged. No
merge, deployment, baseline/starter/muscle/learning-schema/Wiki/3D change.
