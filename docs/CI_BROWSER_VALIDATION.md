# Browser CI validation

Tracking: upstream issue #123. This selected proposal preserves every existing
canonical Worker/Chromium/Firefox command and its assertions. It runs the
production Worker independently and uses three browser groups on separate
GitHub-hosted runners: side-window/tube controls, existing Chromium regressions,
and existing Firefox regressions plus the new tube scenarios. Tube controls and
the observer mask are therefore exercised in both engines. Each runner keeps one Playwright worker to
avoid software-rendering contention. `fail-fast: false` retains all results.

The required `browser-smoke` name remains an aggregate. It succeeds only when
the Worker and every browser shard succeed. No skipped/failed dependency can
make the aggregate green. Permissions, dependency installation, branch
protection, Pages publication and scientific baselines are unchanged.

Run fast tests and build while developing. Use focused browser checks for UI
changes and the actual built Worker for kernel/command/persistence changes.
Before merge, review all required checks on the exact candidate. A YAML edit
alone is not evidence of a speed improvement. Separate runners reduce serial
waiting but can increase total runner-minutes; do not claim better game FPS.
Do not repeat full campaigns after prose-only edits unless required checks or
new concerns call for them. Never shorten assertions or refresh baselines to
hide failures. Use recorded run links rather than repeatedly polling slow jobs.

This source is pending upstream acceptance; successful contributor validation
is not upstream merge/release authority. Independent toolbar and observer
feature PRs may add their own groups when accepted; they are not dependencies
of this selected port.
