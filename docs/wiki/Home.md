# VIDA — Current Feature Reference

Documentation for the **current 2D VIDA simulation**. Each page describes what the latest game does, how its mechanisms work, and its known limitations. Feature pages are **updated in place** rather than duplicated for each release.

## Simulation systems

- [Featured Starters and Specimen Bank](https://github.com/smeagol44/vidAI/wiki/Featured-Starters) — nine featured, mutable genotypes; 55 accessible legacy designs; selection and ecological limits.
- [Movement and Motor Control](https://github.com/smeagol44/vidAI/wiki/Motor-Control) — optional oscillators, direct joint positioning, inherited motor parameters, physical work and limits.
- [Senses and Visually Guided Behavior](https://github.com/smeagol44/vidAI/wiki/Sensory-Behavior) — true retinal rays, inherited neural steering, measured food approach and unresolved threat recognition.
- [Ecology Baseline and Energy Auditing](https://github.com/smeagol44/vidAI/wiki/Ecology-Baseline) — reproducible feeding, egg, death and conservation metrics, plus clearly stated population-level limits.
- [Waking Synaptic Learning](https://github.com/smeagol44/vidAI/wiki/Waking-Learning) — heritable learning capacity, acquired motor weights, reward from real feeding, energy costs and unproven ecological benefit.

More current-feature pages will be added as those systems are worked on; this is not an attempt to document all existing systems at once.

## Reading and maintaining this Wiki

- **[Play VIDA](https://smeagol44.github.io/vidAI/)** · **[Source repository](https://github.com/smeagol44/vidAI)**
- Keep pages concise, with diagrams, grounded settings and explicit limitations.
- No historical changelogs or milestone journals here. The repository's `docs/PROJECT_STATUS.md` records experiments and version changes separately.
- These pages are maintained from `docs/wiki/` in the main repository and synchronized into the Wiki by GitHub Actions. Future edits should update those source pages to avoid being overwritten at the next synchronization.
