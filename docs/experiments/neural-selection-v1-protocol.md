# Neural locomotion selection v1 — registered protocol (#63)

Owner-approved bounded artificial selection, offline only. Base draft#72 at
2ac6477298eff792c2c93f255cfb99285f64231a. All THREE architectures required:
legacy six-output, three-output signed/.06 hysteresis, retained-head hybrid/.06.
No trained neural weights: dense24 hidden, all IH/HH/HO weights and biases freshly
randomized. Shared trunk and semantically matched head rows use paired streams;
source-fan-in uniform weights ±1/sqrt(fan-in), biases ±.1, tau0. Hybrid starts all
legacy. Darter anatomy/organs, oscillator/motor parameters, capacity/cost/learning
traits unchanged. V3 only. Initial genotype seeds17/71/1901; no validity resampling.

Per architecture:3 independent(1+16) runs,12 generations,16 offspring/generation,
5s/300ticks per evaluation;192 offspring/run,576/architecture,1728 total plus9
initial parents. Same physical seed73, heading.37, viscosity.18, empty4800x3000,
gravity0. Finite50,000J reserve funded once through external ledger; normal
maintenance, mortality, work prepayment and safeguards remain. No live fitness.

Neural offspring mutate8 scalar parameters sampled uniformly with replacement
from all IH/HH/HO weights and biases, Gaussian sigma.15, weight bounds±3.5 and
bias bounds±1.5. Same indexed mutation seeds across architectures. No topology,
anatomy, muscle/gait-parameter or learning-trait mutation. Hybrid offspring0/1
instead flip only joint0/1 selector; remaining14 use the same8-event neural rule.
Both controller types always accessible; routing consumes2/16 hybrid proposals.
Strict deterministic elitism among VALID candidates by raw net COM displacement
only; ties keep parent. All offspring originate from generation-start parent.
If no valid parent exists, mutate the original randomized founder until one is
found; never label an invalid network champion. No neutral drift/resampling.

Validity fixed BEFORE evaluations: finite/full-duration living singleton, no
food/eggs/boundary interactions, positive reserve; zero speed guards or energy
limiting; substep anchor<.5px, limit excess<.05rad, accepted constraint gain<1e-12J,
chemical error<1e-5J, post-constraint/contact omega<=20.001rad/s; delivery error0,
prepaid debit=4xpositive work within1e-9J. Existing#72 gates plus explicit later
overspeed rejection. Failed rows retained, never rewarded by displacement.

Record every offspring mutation ledger/genome hash/result; each generation
best/median(raw and valid)/selected mutations/full selected genotype; preserve
initials and every final valid champion (explicit failure if none). Record energy,
positive/braking work, angles/modes, guards, constraints and progress. No efficiency,
late-speed or direction factor in selection. Reject known numerical problems,
without claiming this certifies absence of all exploits.

Held-out, never selected on: paired initial+champion, env seed811/heading-.7/10s,
977/2.3/15s,2301/pi/2/15s (54 trials if9 champions). All below unchanged18s maturity.
Nine passive and nine fluid-off5s champion controls for COM drift attribution,
explicitly separate from selection budget. No extra control/timestep/gain sweeps.
Head parameter counts, retained motor priors, differing motor semantics, initial
quality and hybrid proposal/neutral-mutation accessibility must be disclosed.

Stop after this budget, held-out evidence and recommendation. No second automatic
search, merger/deployment, bank/physics/#78/VIDA3D edits. Previous#72 reports and
closed fluid evidence remain untouched. This file will become the final report.
