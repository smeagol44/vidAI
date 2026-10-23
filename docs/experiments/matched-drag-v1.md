# Matched drag comparison: keep v3 for VIDA (#80 / draft #83)

**Recommendation: keep existing v3 unchanged.** For this artificial-life game it
offers the better demonstrated combination of affordable resistance, independent
joint control and stable locomotion. The present v4 profile adds cost and weaker
damping without a demonstrated gameplay advantage. This closes the bounded
benchmark investigation, not the physics release gates. No merge or deployment.

## Fair comparison

The old #81/#82 distances remain evidence about their complete regimes, but their
1250× mass/inertia mismatch makes them unsuitable for ranking drag formulas.
This private, built-Worker harness uses **v3 mass, inertia, work units, geometry,
motor ceilings, initial states, contacts, solver and safeguards for both laws**.
Only the fluid wrench changes. Both use explicit integration primarily; both also
have an implicit control. Biological upkeep is zero only inside this diagnostic;
the finite chemical reserve still prepays actual positive actuator work at the
unchanged 4:1 debit. Braking earns no credit. Saves and defaults are unchanged.

The 36 runs cover scissor, serpent and independent paddles, four cycles/16 s each:
both laws at 240/480/960 Hz, plus passive, fluid-off and implicit controls. Identical
literal 240 Hz torque tapes are held over physical substeps. No neural network,
translation impulse, coefficient change or creature tuning. These are v3-origin
tapes, so this tests identical forcing, not optimally evolved v4 controllers.

## Results

Native 240 Hz travel is actual centre-of-mass displacement from rest:

| Body | v3 px | v4 px | 480→960 Hz trajectory/work gate | Warmed v4/v3 cost |
|---|---:|---:|---|---:|
| Scissor | 2.68756 | 0.05541 | v3 fails; v4 passes, hinge flag fails | 1.73× |
| Serpent | 1.11831 | 0.02147 | v3 passes; v4 joint trajectory fails | 1.72× |
| Two paddles | 3.08830 | 0.02563 | v3 passes; v4 trajectory and work fail | 1.89× |

The predeclared gate requires vector error ≤max(0.01 px, 1% fine travel), joint
RMS ≤1°, positive-work change ≤5%. V3 serpent/paddles show 0.029°/0.027° joint
differences and 0.085%/0.203% work changes. V3 scissor differs by 12.97° and
0.216 px; its movement is **not validated swimming**. V4 serpent/paddles differ by
9.89°/51.92°. At native resolution v3 joints roughly follow ±30° traveling strokes;
v4 joints often strike ±90° stops. V4 paddle overlap reaches 0.0200 px (0.0305 px
in its implicit control). All three v4 native anchor errors exceed the separate
0.001 px flag. Do not classify their small travel as validated propulsion.

All passive bodies stay still; dry COM drift is ≤4.64e-12 px and both dry laws
give identical full states. Fluid interactions are necessary for net translation
here. Dry cases still have shape/contact artifacts, so they cannot subtract those
effects from wet motion. No guards, overspeed, energy limiting or torque mismatch
occur in these fixtures; earlier #79 guard limitations remain open. The unchanged
solver receives different trajectories, so contact losses are consequences of
the law/forcing response, not proof of a new solver defect. Implicit controls do
not restore v4 tracking or its missing travel.

Mechanical/chemical receipts balance: maximum chemical error 1.77e-10 J and phase
residual 5.23e-19 J. Native motor expenditure for scissor/serpent/paddles is
0.252/0.0430/0.0558 mJ (v3), 0.417/0.0979/0.0875 mJ (v4). More stop/contact losses
under v4 explain why weak drag need not mean cheaper actuation. Energy accounting
does not certify correct dynamics or exploit resistance.

## Why the laws differ

At identical 1×7 px body states, orientation 0, fluid at rest (common internal
force/torque units):

| Prescribed state | Component | v3 | v4 |
|---|---|---:|---:|
| vx=1 px/s | Fx | −0.063 | −0.00086 |
| vy=1 px/s | Fy | −0.36 | −0.00074 |
| vx=20 px/s | Fx | −1.26 | −0.0704 |
| vy=20 px/s | Fy | −7.2 | −0.0224 |
| ω=1 rad/s | torque | −10.32 | −0.005248 |

All 168 orientation/aspect/velocity wrench samples have nonpositive instantaneous
power. V4's current coefficients give much weaker, speed/geometry-dependent
resistance in the shared game reference. A modest universal coefficient change
is not established by these results; none was evaluated. V4's richer surface
law remains an option for a later owner decision, not a necessary realism goal.

Timings are medians of three counterbalanced, warmed headless fixture runs, not
browser FPS or ecosystem throughput. Same harness, but differing contact work
also affects cost. This bounded evidence favors v3; it proves neither that every
anatomy swims nor that any law is exploit-proof. No ecological campaign is needed
to choose the conservative option here.

[Methods, units and checks](matched-drag-v1-methods.md); [figure](matched-drag-v1.png);
[manifest](matched-drag-v1.json); [summary](matched-drag-v1-summary.json).
Preserved earlier reports and baseline checksums are unchanged. Stop for review.
