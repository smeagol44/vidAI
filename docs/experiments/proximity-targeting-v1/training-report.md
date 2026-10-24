# Graded moving nutrient and inherited mutation targeting — training complete; experiment incomplete

**All 500 original offspring, five founders and 50 strict generation decisions are preserved and audited. The 15 held-outs are unresolved after the execution runtime disconnected. None was repeated or assigned a zero score.**

Scientific implementation: f669e09a56e41a1b1c87ff5b8c6aaa5ec266d187. Preregistered protocol: d01d1fd1359b27ee4b8df6bd39356d0071717fb1, based on completed #101 at a44515e27cc82294fcb55cbadf523351e545b09d. Issue #103 and draft #104 remain unmerged.

## Training results

| Controller | Seed | Mutation algorithm | Founder J | Final J | Contact J | Noncontact J | Selected at | Improvements |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| legacy | 17 | original-random | 200.598234 | 30805.74929 | 10080 | 20725.74929 | g10/o3 | 7 |
| mutable | 17 | original-random | 0 | 0 | 0 | 0 | initial | 0 |
| mutable | 71 | parent-targeted-66 | 0 | 2.267425 | 0 | 2.267425 | g9/o9 | 1 |
| mutable | 1901 | original-random | 0 | 1150.74011 | 0 | 1150.74011 | g6/o3 | 2 |
| mutable | 4099 | parent-targeted-66 | 0 | 0.17309 | 0 | 0.17309 | g4/o6 | 1 |

MUTABLE17 retains its unchanged founder if its final score remains zero. The other rows identify the actual selected offspring. All replacements required strictly greater actual absorbed J. Zero ties retain the parent; all ten siblings use the same frozen genetic parent. No old physical diagnostic excluded or penalized an offspring.

The standard MUTABLE populations are seeds17/1901; the custom populations are71/4099. Seeds differ between the two groups, so their outcomes cannot establish a causal targeting advantage. The legacy comparison also changes architecture and learning genetics. Results are individual descriptive observations.

## All five generation curves

| Generation | legacy 17 | mutable 17 | mutable 71 | mutable 1901 | mutable 4099 |
| --- | --- | --- | --- | --- | --- |
| 0 | 200.598234 | 0 | 0 | 0 | 0 |
| 1 | 1403.838735 | 0 | 0 | 0 | 0 |
| 2 | 1403.838735 | 0 | 0 | 0 | 0 |
| 3 | 2809.06098 | 0 | 0 | 0 | 0 |
| 4 | 2809.06098 | 0 | 0 | 0 | 0.17309 |
| 5 | 8505.697502 | 0 | 0 | 144.179126 | 0.17309 |
| 6 | 20926.857326 | 0 | 0 | 1150.74011 | 0.17309 |
| 7 | 26086.936734 | 0 | 0 | 1150.74011 | 0.17309 |
| 8 | 27674.986289 | 0 | 0 | 1150.74011 | 0.17309 |
| 9 | 27674.986289 | 0 | 2.267425 | 1150.74011 | 0.17309 |
| 10 | 30805.74929 | 0 | 2.267425 | 1150.74011 | 0.17309 |

scores.csv and curves.json preserve all55 points at full precision. evolution-curves.png/.svg plot those values without fitting or smoothing.

## Real feeding and movement

The explicit proximity-90-v1 mode uses d=max(0, distance from source center to the actual mouth-capsule segment minus the two radii), then strength=clamp(1-d/90,0,1). One original gross mouth budget is scaled by strength and constrained by stock, remaining allowance and reserve capacity. Physical contact uses that same transfer, without a second bite. Eighty percent assimilates; the rest is heat. Gross removal is explicitly funded by external reservoir input while visible stock stays3000J/radius18. Contact input is true only for physical geometry; mouth intake and body feeding use actual received energy. Ordinary contact-only feeding is unchanged outside this isolated mode.

| Controller | Seed | Net COM px | Full15s path px | Last5s path px | Signed minimum mouth gap px | Contact ticks | Intake ticks | Detection ticks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| legacy | 17 | 323.532 | 332.995 | 118.394 | -21.436 | 210 | 847 | 749 |
| mutable | 17 | 1.182 | 1.262 | 0.024 | 98.358 | 0 | 0 | 838 |
| mutable | 71 | 17.538 | 39.443 | 7.531 | 87.888 | 0 | 5 | 151 |
| mutable | 1901 | 136.498 | 151.557 | 47.107 | 67.678 | 0 | 202 | 619 |
| mutable | 4099 | 30.555 | 87.442 | 23.247 | 89.621 | 0 | 1 | 282 |

| Controller | Seed | Feeding duration s | COM path in intake ticks px | Mean COM speed in intake ticks px/s | Last5s intake J | Intake-weighted gap px | Intake-weighted strength |
| --- | --- | --- | --- | --- | --- | --- | --- |
| legacy | 17 | 14.116667 | 325.480298 | 23.056456 | 13299.895681 | 12.461207 | 0.861542 |
| mutable | 17 | 0 | 0 | — | 0 | — | — |
| mutable | 71 | 0.083333 | 0.390895 | 4.690741 | 0 | 88.432536 | 0.017416 |
| mutable | 1901 | 3.366667 | 41.715301 | 12.390683 | 0 | 75.369048 | 0.162566 |
| mutable | 4099 | 0.016667 | 0.186497 | 11.189818 | 0 | 89.675456 | 0.003606 |

Signed raw gap is negative for physical overlap; feeding uses its nonnegative clamp. Motion in an intake tick means motion over the preceding1/60s interval ending in actual absorption. These movement metrics never influence selection. High noncontact intake can reflect remaining close to food and does not demonstrate physical mouth contact or active pursuit.

legacy 17: founder→final full COM path 256.687311→332.994968px; net displacement 128.326416→323.532251px. Final moving/paused/frozen intake is 23070.240429/7735.508861/0.000000J.

mutable 17: founder→final full COM path 1.262033→1.262033px; net displacement 1.181554→1.181554px. Final moving/paused/frozen intake is 0.000000/0.000000/0.000000J.

mutable 71: founder→final full COM path 40.104991→39.443440px; net displacement 10.694665→17.537524px. Final moving/paused/frozen intake is 2.253079/0.014346/0.000000J.

mutable 1901: founder→final full COM path 111.530573→151.557314px; net displacement 88.528638→136.498174px. Final moving/paused/frozen intake is 535.030082/615.710029/0.000000J.

mutable 4099: founder→final full COM path 127.316504→87.442228px; net displacement 45.440338→30.555413px. Final moving/paused/frozen intake is 0.173090/0.000000/0.000000J.

## Mutation targeting and lineage

Every child has eight ordered scalar receipts with stable IH/HH/HO/hidden-bias/output-bias identities, before/after values, repeated coordinates and genetic parent hash. Target sets contain only the distinct net changed coordinates from the selected parent’s own birth. Founder origin is null, so its children use exact original random mutation in any generation. Birth metadata remains outside genomes and neural inputs; acquired lifetime deltas never become targets or pass to newborns.

For an eligible custom child, a separate deterministic stream requests five targets with72% probability or six with28%, expected5.28/8=66%. Parental coordinates are sampled without replacement; shortfalls are filled uniformly outside the parent set. Other events remain random outside that set, with replacement. The original Gaussian stream consumes the same coordinate and two Box–Muller draws for each of the eight sigma.15 events. Bounds and the original nine-draw inherited-plasticity mechanism remain unchanged. Policy targeting and actual coordinate membership are reported separately for standard random children.

| Controller | Seed | Algorithm | Founder-parent children | Eligible custom children | Target events | Other events | Overall target % | Eligible target % | Requested5 | Requested6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| legacy | 17 | original-random | 10 | 0 | 0 | 800 | 0.0 | — | 0 | 0 |
| mutable | 17 | original-random | 100 | 0 | 0 | 800 | 0.0 | — | 0 | 0 |
| mutable | 71 | parent-targeted-66 | 90 | 10 | 56 | 744 | 7.0 | 70.0 | 4 | 6 |
| mutable | 1901 | original-random | 50 | 0 | 0 | 800 | 0.0 | — | 0 | 0 |
| mutable | 4099 | parent-targeted-66 | 40 | 60 | 316 | 484 | 39.5 | 65.833 | 44 | 16 |

mutation-statistics.csv/.json contains500 child summaries and exact current-parent coordinate sets. mutation-events.csv contains4000 ordered events, including reconstructed unbounded Gaussian values and applied deltas. training-ledger.json.gz preserves full origin records, rounding/selection draws, all trait/mask attempts and all50 choices. Ancestry reuse is observational; the mutation algorithm never targets the cumulative ancestry union.

## Actual learning and physical motor delivery

| Controller | Seed | Motor learned L1 | Sensory learned L1 | Nonzero motor/sensory edges | Learning cost J | Physical OSC samples | Late mode switches |
| --- | --- | --- | --- | --- | --- | --- | --- |
| legacy | 17 | 0.069884261 | 0.141681278 | 48/96 | 4.442360182 | 0 | 0 |
| mutable | 17 | 0 | 0 | 0/0 | 2.88 | 0 | 0 |
| mutable | 71 | 7e-09 | 3.3e-08 | 47/29 | 2.880080062 | 80 | 4 |
| mutable | 1901 | 0.001903064 | 0.00082523 | 48/47 | 3.028716939 | 3916 | 124 |
| mutable | 4099 | 1e-09 | 1e-09 | 48/25 | 2.850007996 | 3600 | 0 |

| Controller | Seed | Motor upkeep J | Motor rewrites J | Sensory upkeep J | Sensory rewrites J | Mode substeps | Motor work heat J |
| --- | --- | --- | --- | --- | --- | --- | --- |
| legacy | 17 | 1.44 | 0.034444427 | 2.88 | 0.087915755 | {"servo": 7200} | 16.27665077 |
| mutable | 17 | 1.44 | 0 | 1.44 | 0 | {"direct": 7200} | 14.465259458 |
| mutable | 71 | 1.410000475 | 1.3843e-05 | 1.470002168 | 6.3575e-05 | {"direct": 7120, "oscillator": 80} | 5.01503567 |
| mutable | 1901 | 1.450620057 | 0.112262582 | 1.414568556 | 0.051265745 | {"direct": 3284, "oscillator": 3916} | 30.361500726 |
| mutable | 4099 | 1.44 | 3.734e-06 | 1.41 | 4.262e-06 | {"direct": 3600, "oscillator": 3600} | 29.069279181 |

Legacy retains native servo semantics, rather than neural DIRECT/OSC labels. Hybrid OSC counts require actual nonzero delivered torque. Eligible masks, genetic learning rates, paid rewrites/upkeep and acquired state remain in the data. Per-edge changes independently reconstruct learning charges. Emitted zero initialization records are not evidence of nonzero learning. No learning-OFF ablation was authorized or run, so a causal learning benefit is not isolated.

## Energy,environment and numerical audit

All #101 conditions remain: original CUR-001 body/eyes/mouth,4800×3000,root2400/1500,training heading.37,env73,water.18,gravity0,passive-work-v3,normal mortality and funded10000J initial reserve. One source starts120px ahead of the mounted forward eye. The unchanged separate environmental stream presamples ten1.5s decisions with25%STOP,22px/s outward/sideways motion, inward-heading pause and permanent swept405px union-of-eye-disks freeze. No source coordinates or force are supplied to the brain/body.

Only the original400px/s and±20rad/s experimental clamps are disabled. Constraints,contacts,drag,actuators,strength and prepaid work remain. Finite solver anchor/joint residuals are disclosed imperfections; consistency does not establish complete physical realism.

| Diagnostic | All505 verified training trials |
| --- | --- |
| max_linear_px_s | 571.0700091519165 |
| max_angular_rad_s | 41.362200384303875 |
| max_anchor_px | 0.7007987296684515 |
| max_limit_overshoot_rad | 0.20583237180466962 |
| constraint_gain_J | 1.3877787807814457e-17 |
| delivery_error | 0 |
| chemical_error_J | 1.2332748156040907e-09 |
| partition_residual_J | 1.230546331498772e-09 |
| Actual clamp loss J | 0 |
| Alive trials | 505 |
| Former-flagged offspring | 382 |
| External-input reconciliation J | 8.731149137020111e-11 |
| Normalized oral-input residual J | 3.637978807091713e-12 |
| Learning reconciliation J | 4.440892098500626e-16 |
| Per-edge rewrite receipt residual J | 7.008282842946301e-16 |
| Per-edge upkeep receipt residual J | 2.220446049250313e-16 |

The inherited generic trial.reserveJ metadata label remains50000J from an older helper. Actual initial reserve is verified as10000J in every original request; stocks,expenditure and conservation calculations use those actual values. The stale label never affects physics or selection, and raw evidence is unchanged.

## Comparison with original #101

Original #101 used physical-contact-only feeding: all520 trials0J,no contact,no improvement and unchanged founders. The new90px rule changes real energy acquisition and its normal learning signal. Standard-random populations differ in that feeding rule; custom populations additionally change mutation targeting after an evolved parent exists. These are descriptive task differences, not evidence for a causal algorithm or architecture ranking.

## Runtime loss and unresolved held-outs

After all500 offspring were independently checkpointed, intent48f75676257297be155f71454c7d2b6cfea47992 was published for the15 held-outs. The execution service disconnected during a subsequent local operation. The available error does not identify whether the local intent receipt or the held-out process was active. No completed held-out checkpoint is remote. It is therefore unknown how many of the15 started or completed locally. No score is imputed and none is re-executed.

Recover the original runtime’s requests,packets,received receipts,champions and056-held-outs log/ZIP. If those cannot be recovered, an explicit owner decision is required before any uncertain held-out slot can be executed again. No offspring may be rerun. This experiment is not marked complete.

## Verified evidence and deliverables

The cloud recovery audit reads all505 original packets,500 exact genotypes/mutation histories,50 choices,454500 tick receipts and1818000 full-body/source substeps. Five final-training canonical Worker packets and five450+450 reset continuations match exactly. These are verification only and do not add or replace scientific outcomes. Frozen source,Worker and protected historical hashes match.

Fifty-six immutable original checkpoints preserve frozen sources,allfive founders andall50 generations. Each was independently Git-downloaded and part/ZIP/member-verified before advancing. evidence-index.json identifies descriptors and introduction commits. The primary complete-training head is5cefc73c3eecc22c0412319c620717be4d4ec3c7;48f7567 adds only the unresolved held-out intent.

scores.csv/curves.json: all55 curve points. finals.csv/trials.csv/summary.json.gz: all505 verified outcomes,founder/final comparisons,feeding,movement,learning,traits/masks and diagnostics. mutation-statistics.csv/.json,mutation-events.csv and ancestry-reuse.json: all500 birth histories and4000 scalar events. trajectories.json.gz: every founder and selected improvement,with3601 body/source points and900 feeding/ray samples. Five normalized trajectory ZIPs contain all505 original full-body/source trajectories,101 per population,plus feeding,rays,decisions and mode/joint traces; all-trajectories-index.csv/.json records each file hash. Raw primary packets remain independently restorable.

training-graph-data.zip is CRC/member/count verified and contains copyable CSV/JSON graph inputs. training-verification.json and training-completion.json document the audit and its limited scope. The initial355-test fast suite+metadata/build,production and focused Worker checks passed. Initial PR CI automatically ran an archived locomotion regression/browser smoke; exclusions now keep those separate from final branch checks.

STOP for original-receipt recovery and owner review. No merge,deployment,Wiki edit,production/testing release change,extra experiment orVIDA3D change.

