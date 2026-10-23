# Matched drag-law comparison and two-paddle benchmark (#80)

Owner gameplay criterion: stable, affordable, reasonably believable aquatic motion,
evolvable locomotion and resistance to numerical exploits. Exact real-water/SI
biological calibration is not a release requirement. No solver investigation.

Separate private actual-Worker experiment. Common host/reference is v3: identical
geometry, v3 bodyMass/inertia, work conversion1.75e-7J/unit, capacity, initial states,
contacts/constraints/guards. Select only the v3/v4 drag formula. Convert v4's SI
wrench into that common reference; never reuse v4's lighter mass or old204x torque
conversion. Fixed chemical reserve, no biological upkeep in this mechanical-only
private fixture. Normal saves/defaults remain unchanged.

Before evaluation: identical prescribed-velocity/orientation drag-wrench grid;
primary explicit-force integration for BOTH laws isolates the formula, with a
post-motor implicit-drag control for BOTH to expose integration/splitting effects.
Reuse archived v3 scissor/serpent240Hz torque tapes. Add one main7x7px body with two
independent1x7px paddles, narrow-end corner hinges,30degree/4s/90degree phased
requests with one-cycle startup and unchanged100/20 PD/ceiling; capture its v3 tape
once. Replay literal identical tapes for both drag laws at240/480/960Hz, four cycles.
Passive and fluid-off controls; no mandatory swimming success or per-body tuning.

Same local gates: vector error<=max(.01px,1% fine travel), joint RMS<=1degree,
positive work difference<=5%; separate0guards, .001px anchor/overlap,1e-7px dry COM,
1e-8J chemical error. Report failed gates, achieved motion, work, losses and cost.
Reversed-order warmed timings; no coefficient adjustment unless a specific modest
single change is justified, no open search/evolution. Stop with one short comparison
and recommendation; no merge, promotion, deploy, Wiki,3D or new muscle model.
