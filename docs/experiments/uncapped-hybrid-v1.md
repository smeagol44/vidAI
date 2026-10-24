# Original #88 hybrid with uncapped physics — #94 / draft #95

**Completed fixed experiment; stop for owner review.** Founder intake was **0 J**.
All **225 offspring absorbed 0 J**. No improvement was accepted; strict ties
retained the original founder. Removing the caps and every threshold-based
selection exclusion did not produce nutrient-foraging evolution in this one
seed/habitat/budget. No general architectural or physics superiority is inferred.

## Reproducible method and isolation

Scientific baseline: #88 head `b64481eb02a4c253637cae3d91375a5051405fd1`.
Preregistered [protocol](uncapped-hybrid-v1-protocol.md) commit
`fd38301e1f0744228cd5ec0628c58fc5db69862b` precedes implementation/evolution.
Frozen implementation `2779de26130fa0a7a4d3a09ab6b2d61414420a00`.
Branch `experiment/uncapped-hybrid-intake-94` targets original
`experiment/nutrient-intake-87`, draft #95. Later #90/#93 stacks are excluded.

Original `neural-motor-v1` two independent Mode + Command outputs/joint,
OFF/DIRECT/OSCILLATOR thresholds -.30/+.30 and .06 hysteresis; original
oscillator/direct-torque semantics. Fresh fully randomized24-hidden recurrent
brain seed17, exact #88 initial genotype. All Darter anatomy, muscles, oscillator
genes, vision, mouth, initial reserve and normal motor/sensory lifetime learning
unchanged. No heritable-plasticity selection or revised controller thresholds.

One founder;15 generations×15 offspring×12s =225 offspring, run exactly ONCE.
Each generation descends from its frozen starting parent. Exactly8 neural scalar
mutations with replacement, sigma.15, original bounds/streams. Selection compares
strictly greater **actual absorbed nutrient J**. No neutral drift, secondary
score, feasibility-first selection or substitute zero for a failed trial.

Original1000×800px fixture;root500/400;heading.37;environment73;240 ordinary
3000J nutrients;65% clustered/35% uniform at12 sites,96px halfspread;gravity0,
viscosity.18,no inflow;normal10000J reserve;original12s nonlethal request.
Complete environment/genotype equality to #88 is verified after removing ONLY
the new schema/velocity-mode identity. Ordinary physical feeding, neural sensing,
learning, metabolism, prepaid work and energy accounting remain active. No
candidate depleted reserves, invoked nonlethal protection or limited motor work.

**Only engine change:** explicit saved `experimentalVelocityMode:
uncapped-hybrid-v1` with schema **94.0.0**, on original `passive-work-v3` and
`neural-motor-v1` two-output worlds. Both400px/s translation and±20rad/s angular
clamps are bypassed throughout actual Worker substeps. No replacement cap,
soft/adaptive limit or force retuning. Ordinary hinges/ranges, collision/wall
response, drag, actuator strength and prepaid work stay unchanged. Historical
schemas reject the flag; control packets cannot change it. Production defaults
and all old save meanings remain unchanged. New snapshots replay with identified
uncapped semantics; this flag is experimental, not a released save migration.

All old boundary/speed/anchor/joint/constraint/chemical/billing/post-contact gate
reasons are **diagnostics only**. Every finite intact proposal was eligible.
A nonfinite/unexecutable/corrupt trial would abort explicitly, preserving source,
genotype,mutation and raw V8 failure state (preserving NaN/Infinity). None occurred.
Old numeric tolerances never determine eligibility, scores or penalties.

## Selected intake by generation

| Generation | Best selected absorbed J |
| --- | ---: |
|0|0|
|1|0|
|2|0|
|3|0|
|4|0|
|5|0|
|6|0|
|7|0|
|8|0|
|9|0|
|10|0|
|11|0|
|12|0|
|13|0|
|14|0|
|15|0|

Founder0J;final0J;accepted improvements **none** (no accepted generation/offspring
IDs). Offspring fed **0/225**;energy distribution min/Q1/median/Q3/max/mean all0J,
225 exact zeroes. All225 proposals saw ordinary nutrients on all720 ticks; none
made mouth contact. Their net displacement range was .97854–21.13611px, never a
selection criterion. Allowing the105 formerly joint-limit-excluded proposals,
including the one former speed-trigger case, did not uncover a feeding proposal.
The old rejection rules therefore did not conceal an intake winner in this run.

## Modes, movement and actual learning

All **1,296,000 offspring joint-substep samples were DIRECT**;OFF0,OSCILLATOR0,
mode switches0. Founder and each held-out also used DIRECT exclusively (5760
joint-substeps/trial). The458 archived mode entries are initial per-joint mode
assignments across229 trials, **not458 switches**. Original Mode/Command genes
remain independently mutable; this budget did not discover another mode.

Final champion is the unchanged founder:5.520736px net displacement,
(dx,dy)=(-4.049087,-3.752788),path5.570010px;last4s displacement.210000px.
Joint trajectories show transient movement followed by persistent torque near
anatomical stops. It sees food from tick1 but has zero contact/intake and no
acquired motor/sensory weight offsets in training. No trained foraging behavior,
sustained swimming or learning benefit is demonstrated.

## Physical and energy diagnostics — never selection filters

Maxima below are observed receipts, not caps. Force/post-contact rows record
actual x/y/angle/vx/vy/omega every substep; accepted-constraint angular maxima
are independently recorded. Intermediate provisional solver-iteration linear
speeds are not claimed measured. "Former trigger" is the old guard-stage test,
not an applied clamp. **Clamp energy loss is exactly0J in every new trial.**

| Measurement |225 offspring|Final champion|3 held-outs|
| --- | ---: | ---: | ---: |
|Max sampled part translation px/s|280.765029|233.513280|286.351374|
|Max sampled angular speed rad/s|20.376830|17.086094|21.838333|
|Former force-stage guard triggers|1|0|4|
|>400px/s stage samples|0|0|0|
|>20rad/s force/contact stage samples|1|0|4|
|Max accepted-constraint omega rad/s|17.210665|14.690313|17.782636|
|Max post-contact omega rad/s|17.210665|14.690313|17.782636|
|Max substep anchor error px|.237715|.147877|.202630|
|Max joint-range overshoot rad|.118512|.036700|.080060|
|Max accepted constraint kinetic gain J|4.337e-19|0|0|
|Max chemical ledger error J|6.985e-10|6.985e-10|5.821e-10|
|Max food/work partition residual magnitude J|6.731e-10|5.579e-10|5.611e-10|
|Max motor bill minus4×positive work magnitude J|4.974e-14|1.243e-14|7.105e-15|
|Requested/paid delivery error|0|0|0|

Only **g2/o12** exceeded a former cap in training (IDs are zero-based offspring
indices):20.376830rad/s at the force stage. It remained eligible and absorbed0J.
No boundary-zone entries or former post-contact overspeed exclusions occurred.
105 offspring crossed the old.05rad joint-limit diagnostic; none was rejected.
No NaN/Infinity, executable failure, negative resource stock, numerical explosion
or corrupted food receipt occurred. Exceeding20rad/s alone is not classified as
instability. Finite joint-range overshoot and nonzero anchor error expose the
existing discrete constraint approximation; hinges are not enforced exactly.
Stop-pressing/stalled motion is a behavioral limitation. Tiny kinetic/chemical
residuals and energy closure do not prove fully physical/converged mechanics;
no solver correction or convergence study was performed.

Champion positive/braking work2.471683596/.010578964J,motor debit9.886734384J,
metabolic heat309.706J,total own expenditure319.592734383J,final reserve
9680.407265617J. Braking gives no regenerative credit;normal4×positive-work
prepayment is intact. No resource subsidy, free actuation or intake relabeling.

## Original held-outs — final champion only

Exactly three12s trials;original food layouts/headings verified against #88.
No held-out influenced selection. All three retained; no physical threshold
exclusion. Both feeders begin at tick1, so incidental initial food contact,
not newly learned approach, is demonstrated.

|Seed|Heading rad|Absorbed J|Intake ticks|Net displacement px|Max omega rad/s|Former triggers|Max anchor px|Max limit excess rad|
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
|811|-.7|4800|100|4.453335|21.838333|3|.202630|.080060|
|977|2.3|0|0|6.381987|15.709664|0|.133022|.017100|
|2301|pi/2|4080|85|4.973182|20.770633|1|.189098|.051663|

811's final acquired motor/sensory L1=.01461017/.02186827;2301=.01146669/
.01741535;977=0/0. These are ordinary true-feeding-driven within-life changes,
never inherited;their net functional benefit was not isolated. Held-outs use
DIRECT only, no reserve limiting/nonlethal intervention. Mean intake2960J,
median4080J. Original capped #88 hybrid held-outs were4800/0/3984J;the uncapped
2301 result is96J higher, without any evolved genotype change.

## Historical legacy comparison — descriptive only

Do NOT interpret this as a same-physics architectural ranking. The archived
legacy used **capped** physics;this repeat uses **uncapped** hybrid physics.
No legacy evolutionary search was rerun. The inherited CI also exercises
historical frozen compatibility fixtures;these are not new selection runs.

|Quantity|Historical capped legacy #88|New uncapped original hybrid|
| --- | ---: | ---: |
|Founder absorbed J|4800|0|
|Final absorbed J|16704|0|
|Held-out811 J|22320|4800|
|Held-out977 J|14064|0|
|Held-out2301 J|12288|4080|

One fresh brain, fixed body/habitat,12s horizon,strict zero ties and8-event
mutations do not establish that hybrids cannot forage or that caps are generally
harmless. Here the founder never reached either cap, all offspring failed to
contact food even without rejection, and evolution stayed on a zero-intake plateau.

## Durable evidence and verification

[Manifest](uncapped-hybrid-v1.json) indexes **246 immutable gzip archives**:
4 initial environments,founder,225 offspring,15 generation ledgers,champion,
3 held-outs (375,406,297 compressed bytes). Each offspring contains its FULL
inherited genotype,8-event mutation ledger,full final snapshot and complete
Worker packet. Generational ledgers preserve frozen parent,all proposal receipts,
strict elite decision and selected full genes. Append-only paths,fsync/readback
and SHA256 hashes. Original #88 and all inherited reports/data remain byte-exact;
[#90/#93 protected branch/tree identities](uncapped-hybrid-v1-protected-branches.json)
remain unchanged. No overwritten/recovered/repeated training evaluations.

Across229 primary trials:3,957,120 force/contact part-stage rows;164,880 tick
feeding/energy/neural/joint receipts;240,048 initial/acquired delta/consolidation
records,including zero initial records;458 initial mode assignments. Final full
snapshots preserve all somatic deltas/eligibilities/PRNG. Historical eligibility
alone is not stored at every tick unless a delta/consolidation change occurred;
every actual acquired-weight/consolidation change is stored. Genome+exact
settings/PRNG and code hashes reproduce the complete deterministic history.

[Archive/replay verification](uncapped-hybrid-v1-verification.json):all225
mutations/genotypes and15 decisions reconstruct;all229 packet/metric/feeding
receipts verify;all primary/protected hashes exact;original founder and4 complete
layouts exact;final full Worker packet (including trajectory,learning,metrics,
snapshot,PRNG) replays byte-value exactly;360+360 reset continuation snapshot/PRNG
exact. [Focused Worker checks](uncapped-hybrid-v1-worker-check.json) establish
host/quiet/fork equality,explicit mode/schema isolation,real144J feeding with
learning,and exact original capped HYBRID snapshot/PRNG compatibility. Synthetic
hot-state Worker reaches1140.783px/s and57.108rad/s with zero clamp loss;this is
verification,not an evolved specimen.322/322 fast tests plus1 metadata and
build/typecheck pass. Final CI/checkpoint details are in #94/#57.

Review commands after build:
`npm run test:uncapped-worker`, `npm run audit:uncapped-intake`.
`node --import tsx scripts/summarize-uncapped-intake.mjs` derives summaries only.
The experiment command refuses existing output paths;do not run it again.
[Summary](uncapped-hybrid-v1-summary.json),[generation CSV](uncapped-hybrid-v1-scores.csv),
[held-out CSV](uncapped-hybrid-v1-held-out.csv) and append-only run log accompany
all raw archives. No further search or default-throughput/learning-benefit claim.

**Stop:** owner review of #94/#95. No merge,deployment,actual Wiki or VIDA3D
change. Production main v0.37.0 and independent testing T1.1 remain unchanged.
