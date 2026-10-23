# First-event audit: unilateral angular-stop defect and bounded correction

**Final checkpoint, 2026-10-23 — this supersedes the preliminary no-defect
conclusion at 53ecc5b.** The algebraic impulse/work checks passed, but a separate
physical-admissibility check proved that the angular limit was being solved as a
bilateral equality: an upper stop pulled outward while the joint returned inward.
A single, explicitly selected **`unilateral-stop-v1`** diagnostic correction is
implemented. It does not solve overspeed, contact/hinge convergence or locomotion.
Stop here; no additional numerical study or speculative redesign.

Branch `experiment/prism-resistance-v4` → testing
`d7a68144b02225db37bb6a9583b057458ff47d52`, incremental draft #79; correction
parent **53ecc5b3651b642b9247cb0dbea9af5e5c796bb3**. Final head and CI are in #61/#57.
Draft/unmerged/undeployed. No production, testing deployment, Wiki or 3D changes.

## Localization preserved, not repeated

[Original event report, now labelled preliminary](solver-event-v1.md) and its
raw receipts/start-end snapshots remain. Existing CUR-006 snapshot/240 Hz held
command tape only, neural cadence60 Hz, original native ordering, existing
1920/3840 Hz. One-second prefixes equal archived trajectories exactly.

The first meaningful part-speed separation occurs at head P0–tail P6 contact:
.012608 rad/s gap at .125 s becomes **2.666545 rad/s at .125520833 s**. Fine contact
is detected at the .125260417 s endpoint with .00223533 px penetration; coarse
at .125520833 s with .0316571 px penetration. The latter crosses the existing
.02 px positional slop. Fine integration inserts another joint/contact response
within the common coarse interval. Those contact impulses have correct effective
masses, directions, velocity updates and dissipative work. Times are discrete
substep stamps, not exact continuous impact times.

First post-guard accepted-joint overspeed is .404427083 s fine (P5−20.103479rad/s)
and .410937500 s coarse (P4+20.052073). The original complete batches lose energy
and have acceptance scale1. That establishes aggregate passivity, not physical
admissibility of every constituent constraint or individual speed bounds.

## Proven defect: wrong constraint type at angular stops

For relative angle theta at the upper limit, the limit's **accumulated** impulse
on the child must be nonpositive; at the lower limit it must be nonnegative.
A return inward faster than the stabilizing target must be released. Positive
iteration increments may release prior negative pressure, so checking/clamping
each increment alone would also be wrong.

The old code always solves

```
deltaLambda = -(relativeAngularSpeed + bias) / (inverseIA + inverseIB)
```

when `abs(theta)>maxAngle`, regardless of force direction. This is an equality
solve. Netting all ten iterations, then accounting for the actual accepted batch
scale, proves **outward upper-stop reactions in all44 inspected old active batches**:
14 coarse,30 fine. This is not a mistaken interpretation of a single positive
release increment. In these windows scale1 accepts the full wrong-direction net.

Example fine upper-stop iteration at .403645833 s: theta=.900045988 rad exceeds
maxAngle=.9; incoming relative speed is **−1.112514rad/s**, already returning
inward, while bias is only +.03531893rad/s. The old stop adds outward impulse;
net over ten iterations is **+12.221861** mechanical angular-impulse units.
Maximum outward net is +32.908715 coarse. Contact and mass calculations were not
the error: **the range limit lacked the one-sided accumulated-impulse bound**.

The established inequality/force-bound distinction is described in Erin Catto's
[Modeling and Solving Constraints, GDC2009](https://box2d.org/files/ErinCatto_ModelingAndSolvingConstraints_GDC2009.pdf),
slides32–34, with accumulated impulses in its sequential-impulse treatment.
This reference supports the constraint contract; no fluid coefficients or complete
engine implementation are copied into VIDA.

The first checker only tested mass/Jacobian/equality/work identities. Its
no-defect conclusion was incomplete and is explicitly superseded. Its valid
numbers and all original raw data remain. The separate coordinate-roundoff
checker exclusion is unchanged and unrelated to this physical sign defect.

## One scoped versioned correction

Only `integration-experiment` with explicit
`jointLimits: 'unilateral-stop-v1'` enables the correction. It requires the existing
held tape, paused v4, native motor→drag order,1920/3840 Hz and <=60 ticks. It does
not change a saved setting or any default path. The update per active stop is:

```
proposed = accumulated - (relativeSpeed + bias) / inverseInertiaSum
newAccumulated = upper ? min(0, proposed) : max(0, proposed)
applyImpulse = newAccumulated - accumulated
```

Accumulation resets each physical substep; all ten existing iterations remain.
The original bias, detection/position projection, effective mass, motor capacity,
fluid, integration steps and guards remain. The existing complete-batch passivity
scale still bounds the whole correction before acceptance. No warm starting,
extra iteration, restitution, gain or clamp on angular speed was added.

Ordinary v4 and all old regimes execute their original arithmetic exactly.
There is **no schema18 or new persistent physical regime**: this is the existing
external diagnostic framework with an explicit method version. A candidate export
contains v4 physical state; continuation under this diagnostic requires explicitly
resupplying both tape/offset and `jointLimits` version. Snapshot/reset/fork equality
is verified with that contract. A future persistent release would need its own
version/save decision and release gates; it is not implemented here.

## Focused real-Worker correction evidence

Start each candidate from the exact same archived pre-window snapshot: original
tick7 for first contact, tick24 for overspeed. Replay only the containing **one
60 Hz tick** at each resolution, with the same torque tape. This isolates the
correction; it is not a candidate run from birth or a new five-second comparison.
Capture the same2.083ms contact and7.813ms overspeed trace windows. One extra tick
is used only for exact external-version fork continuation.

- Old/default execution reproduces all four archived end snapshots exactly under
  the new code. Historical semantics were not silently reinterpreted.
- Candidate observed/unobserved full snapshots, PRNG, motor work and outputs are
  exact. One+one tick export/reset equals two ticks when the method is resupplied.
- First-contact negative controls have no active angular limits and are **exactly
  unchanged**, including full snapshots. This defect does not explain the first
  contact-onset divergence.
- Old44/44 active batches have net outward reactions. The corrected trajectories
  have22 active batches (4 coarse/18 fine), **zero wrong-sign accumulated reactions**,
  and pass unilateral release/active-target checks. Changed counts reflect earlier
  release from the stop, not omission from telemetry.
- Independent generalized-coordinate velocity/work identities still pass;
  candidate max work residual2.13e-15J. No measured contact or accepted batch adds
  kinetic energy in these windows. Actual impulse-path motor prepayment, separate
  braking, no regeneration, ledger and chemical stocks remain unchanged.

Material negative results over the **containing tick**, not just the trace slice:

| Overspeed tick | 1920 Hz old → candidate | 3840 Hz old → candidate |
| --- | ---: | ---: |
| Peak post-contact angular speed rad/s |20.208056 →20.211216|20.386824 →20.469248|
| Existing guard events |11 →11|62 →64|
| Peak anchor error px |.001426212 →.001428297|.000384419 →.000379541|
| Positive actuator work J |3.08714e-5 →3.12832e-5|3.06960e-5 →3.14827e-5|
| Positive work change |+1.334%|+2.563%|

The corrected fine run first exceeds the post-guard threshold one fine substep
**earlier** in this same-state control. Correct limit reactions therefore do not
cure guard placement; physically admissible redistribution still exceeds the
pre-joint speed guard. No threshold or reporting was weakened. The true changed
velocities change the work bill; motor debit remains4×positive work and matches
the ledger within1e-12J, with no request mismatch/energy limiting and max chemical
discrepancy8.37e-11J. No efficiency or recovery claim.

Pose-only stabilization still leaves instantaneous velocities/kinetic energy
unchanged while shifting angular momentum. In the original inspected windows the
hinge-projection drift reaches6.61e-10Js/batch and split-contact correction reaches
3.25e-10Js/pair. This limitation remains; no momentum/constraint redesign is bundled.

## Classification and stopping point

| Required distinction | Final conclusion |
| --- | --- |
| Demonstrably invalid constraint calculation | Upper/lower angular stops used an unbounded equality reaction.44 old batches violate the required net stop direction; one named diagnostic correction removes that defect. |
| Permissible redistribution / guard placement | Candidate reactions are admissible and accepted batches dissipate energy, yet post-guard overspeed persists and can worsen. This limitation is independent of the corrected defect. |
| Different contact times / trajectory sensitivity | The earliest significant speed separation at P0–P6 contact is unchanged by the correction. Finite-step contact depth/slop and extra joint/contact responses remain demonstrated sensitivity. |
| Unresolved mechanisms | Long-time numerical/constitutive contributions, ideal simultaneous hinge/contact dynamics and pose-induced momentum errors remain unquantified. No evidence of locomotion/ecology recovery or convergence. |

**Stop after this correction and its focused verification.** Do not repeat the
convergence matrix, increase3840Hz, run ecology/swimming/evolution campaigns,
tune coefficients or founders, add/lower speed clamps, or initiate another solver
redesign. The wrong-direction stop defect justified this single bounded fix;
the remaining results do not justify further automatic numerical investigation.
Original v4 movement, ecology, performance and physical-model release gates stand.

## Evidence, compatibility and checks

- [Original signed-stop admissibility reconstruction](solver-stop-legacy-admissibility-v1.json).
- [Candidate raw short-window receipts, snapshots and controls](solver-stop-windows-v1.json.gz).
- [Candidate independent identities and one-sided checks](solver-stop-checks-v1.json).
- [Preliminary localization report/data](solver-event-v1.md), retained with its
  superseded conclusion clearly marked. All original prism/convergence baselines
  and tape bytes remain intact. No #59/#72, #60, #78 or3D modification.
- Unit controls cover both stop directions, inward release, outward opposition,
  release of accumulated pressure, actual frozen active-stop kernel behavior,
  retained overspeed, funding and default snapshot compatibility.
- Local**297 fast +1 testing metadata**, build/typecheck, legacy real Worker and
  prism real Worker pass. Actual Worker includes explicit-version fork and invalid
  version rejection. New-head CI status is in #61/#57/#79; no manual browser run.
- Optional `npm run check:unilateral-window` reproduces only these four same-state
  short controls. The independent checker accepts input/output paths so original
  algebra-only results need not be overwritten. Do not run old studies routinely.

Production main194d70d/v0.37.0 and deployed testingd7a6814/T1.1 remain unchanged.
Keep #61/#79 In progress and PR#79 draft/unmerged/undeployed. No Wiki update.
