# Brain-free two-joint serpent benchmark (#80)

Approved bounded continuation after the scissor. Separate branch
`experiment/brain-free-serpent-80`, stacked against draft #81 at
`8a2119a1be16e450b8c0df9ed50a15d5c04a864a`. #79/#81 evidence stays unchanged.

Three1×7px rectangles, serial narrow-end opposite-corner anchors
parent(+.5,+3.5), child(-.5,-3.5), permitting bends of either sign without
folding material through a face-centered hinge. Private non-importable fixture,
existing contacts enabled; normal saves/solvers/brains unchanged.

Predeclared mechanical program:30degree sinusoidal relative-angle amplitude,
4s period,90degree delay between independently controlled joints; first-cycle
sin-squared amplitude ramp from zero, then three full cycles. Funded PD torques
sampled/held240Hz, unchanged scissor gains100/s² and20/s, existing inertia×2200
ceiling. No target-pose overrides, neural evaluation, artificial propulsion or tuning.

Compare native240Hz, fixed-native-tape480/960Hz, refined feedback, passive,
reverse-wave, in-phase reciprocal command,180degree rotation and fluid-off controls.
Same scissor finest-pair criteria: vector error≤max(.01px,1% fine travel), joint
RMS≤1degree, positive work difference≤5%; separate0guard, .001px anchor/overlap,
1e-7px dry COM and1e-8J chemical flags. No adaptive refinement or gain search.
Measure achieved joint trajectories/shape-loop area, COM/rotation, signed work,
chemical cost, fluid/constraint/contact losses, numerical safeguards and bounded
reversed-order Worker timing. No required propulsion result. Stop for review.
