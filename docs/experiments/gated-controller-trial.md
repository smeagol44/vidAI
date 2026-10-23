# Gated motor-control comparison (isolated experiment)

Tracking: https://github.com/smeagol44/vidAI/issues/59

This branch is based on **testing**, not main. The experiment compares neural
OFF / DIRECT / OSCILLATOR gating using two versus three output channels,
with versus without mode hysteresis. It must not silently alter shipped
physics, stored genes, neural input/output layouts, Worker behavior or saves.

Phase 1 checks deterministic mode switching, emergency transitions, and
controller interpretation. It **does not** establish useful swimming,
reproduction, or evolutionary search quality; those need real Worker/physical
comparisons after the muscle and units decisions in #60/#61.
