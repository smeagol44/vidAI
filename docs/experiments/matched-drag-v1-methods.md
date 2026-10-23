# Matched #80 methods and evidence

Branch `experiment/matched-drag-comparison-80`, draft #83, stacked on independent
#82 at `0b772cdbd582375ef42bbc0d968e88e4e1f93191`. Protocol published before coding
in seed `451273d70db37dd756b0e9fc71fc8c4ac4cb26f1`. Final head/CI/checkpoint are in
#80/#57/#83; no experimental branch is merged or deployed.

## Common mechanics and conversion

Host regime is always `passive-work-v3`, never v4 with rescaled motor gains.
For a 1×7 px part, effective mass=0.35 and inertia=1.4583333333 common units. The
7×7 paddle root has mass=0.4, inertia=3.2666666667. Both laws use these exact
values and the same per-joint ceiling `(Ichild+Iparent)/2 * 2200`.

| Common internal quantity | Reference equivalent |
|---|---|
| Length / time | 0.001 m / 1 s |
| Mass | 0.175 kg |
| Inertia | 1.75e-7 kg m² |
| Force | 1.75e-4 N |
| Torque / work | 1.75e-7 Nm / J |

These are conversion bookkeeping, not required SI biological calibration. V4's
existing surface formula sees dimensions/velocities in metres; divide its N/Nm
wrench by the common factors above. Do not use v4's native 8.575e-10 J/unit.
The implicit v4 control substitutes the common kinetic mass/inertia into the
existing drag solve, leaving resistance geometry/coefficient terms unchanged.
There is no remaining 1250× mass or ~204× work-conversion mismatch.

In local axes v3 is `Fx=-.05*mu*h*u`, `Fy=-2*mu*w*v`,
`torque=-mu*omega*(w³+h³)/6`, with empirical game viscosity mu=.18. V4 retains
its prototype eta=.001, rho=1000, Cd=1, 7 mm depth and shear-length closure; it
does not interpret v3's viscosity slider. Same still fluid and input states do
not make their distinct coefficient definitions equal. `matchedDrag.ts` records
both formulas' evaluated wrenches; `prismPhysics.ts` remains untouched.

## Fixtures and controls

Scissor and serpent reuse the exact archived v3 geometry, anchors, initial state
and native-feedback tape. Paddles: 7×7 root plus two independent 1×7 children at
opposing bottom corners, root anchors (−3.5,3.5)/(3.5,3.5), blade anchors
(0.5,−3.5)/(−0.5,−3.5). Each has ±90° limits. The ±30°/4 s/90°-delayed request
ramps over one cycle; unchanged 100/20 PD captures a v3 tape once, then all runs
replay it literally. Shape tracking is measured, never imposed. Initial contacts
are zero and the requested ±30° shape domain is clear, but actual overshoot can
cause contact. Private corner anchors/subgrid anatomy are not public save rules.

All runs last 16 s. Held 240 Hz commands with 4/8/16 physical substeps per 60 Hz
tick give 240/480/960 Hz physics. Primary explicit integration computes both
forces before the existing combined integration. The separate implicit control
for both laws applies drag after prepaid motor impulse, before unchanged guards,
constraints, pose projection and contacts. No solver constants/order or clamps
were changed. Passive controls disable motors; dry controls disable fluid only.

Biological overhead is zero only inside this mechanical diagnostic. Each world
has a funded 10,000 J reserve and existing energy ledger. Torque work is prepaid
on each actual impulse path, with 4×positive-work debit and no braking credit.
Gross positive/braking work, discrete drag work, implicit physical/numerical
losses, phase work, contact/constraint corrections, pose COM/momentum effects,
joint errors and guard reports are archived. Tiny positive discrete explicit
drag work at velocity reversals (e.g. ~2e-14 J scissor v4 total) is an integration
artifact; instantaneous drag power remains nonpositive. No continuous-energy
or physical-fidelity claim follows from a balanced discrete ledger.

## Native motion and actuator work

Rotation is change of the mean unwrapped segment angle; deformation contributes
to this measure, so it is not a fitted rigid heading. Joint RMS is target tracking
error, distinct from the refinement error in the main comparison.

| Body/law | Rotation ° | Joint tracking RMS ° | Positive / braking work µJ | Max anchor error px |
|---|---:|---|---:|---:|
| Scissor v3 | −0.000007 | 27.41 | 63.054 / 0.153 | 0.001314 |
| Scissor v4 | −0.892 | 57.71 | 104.327 / 0.00182 | 0.007142 |
| Serpent v3 | −1.607 | 7.28 / 7.33 | 10.748 / 0.379 | 0.0000383 |
| Serpent v4 | +1.771 | 41.30 / 56.12 | 24.476 / 3.379 | 0.003173 |
| Paddles v3 | −5.832 | 6.80 / 7.31 | 13.957 / 0.717 | 0.0000433 |
| Paddles v4 | +3.804 | 52.93 / 47.53 | 21.876 / 2.814 | 0.001383 |

## Evidence and focused verification

`matched-drag-v1.json` stores predeclared gates, seven old baseline/report hashes,
command hashes, archive hashes, timing trials and successful assertions.
`matched-drag-v1-{scissor,serpent,paddles}.json.gz` contain the 36 runs' sampled
trajectories, achieved angles, work, phase/solver metrics and full-state hashes.
`matched-drag-wrenches-v1.json` contains 168 prescribed-state force evaluations.
Summary/figure scripts read frozen data only. The four old native full states
reproduce exactly; original v3 scissor/serpent trajectories are exact. Active
Worker host snapshot and PRNG are unchanged. Both laws' audit-on/off final states
are exact; dry v3/v4 states are exact. Public saves still reject this anatomy.

Local checks: 304 fast tests + one metadata test, build/typecheck and five built
Worker checks (legacy, prism, scissor, serpent, matched) pass. After changing only
the read-only implicit residual receipt from a placeholder to its evaluated
value, focused unit tests/build/matched Worker pass again; both final implicit
paddle state hashes equal the frozen study exactly. Archived study bundle was
`simulation.worker-yu-Ol023.js`; this read-only correction changes no measurements.
No manual browser campaign; final remote CI results are recorded in #57/#83.

Excluded for formula ranking: earlier unmatched regime distances/costs; noisy
unwarmed audit timings; failed convergence/contact rows as proof of swimming;
dry shapes as a matched trajectory subtraction. Current cost is three warmed,
counterbalanced explicit runs per law/body with observers off, not production
FPS. V4 additionally evaluates surface resistance; contact counts also differ.

No tuning, coefficient search, solver investigation, muscle model, learning
change, evolution/ecology rerun, baseline refresh, Wiki update or deployment.
Keep v3 and stop after review; v4 remains an independent unpromoted experiment.
