# Egg reserve display

**Scope:** implemented in VIDA 2D.
This VIDA 2D display is for human observation only.

## Meaning and rendering

`eggReserveLossFraction` calculates `clamp(1 - fundedReserve / initialFundedReserve, 0, 1)`.
Only usable reserve enters this ratio. Structural funding, the offspring's genome,
parent survival, hatch energy requirements and `hatchReserveTarget` are irrelevant.
The reference is assigned from `allocatedReserve` at laying before existing
closed-world initialization, and is never updated by feeding or uptake.

The existing radius-16 white shell gains a pink (`#f4a7c1`) sector starting at
12 o'clock and growing counterclockwise. Zero loss draws no pink; exhaustion
fills the shell. Subsequent structural damage does not add another color.
Existing reserve uptake can reduce the sector, including returning to fully
white; any reserve above the reference is clamped to white. The original texture,
shell outline, white glow, clockwise incubation ring and selection ring remain.
No new animation, timers, sensory channel or energy transfer is introduced.

For an exactly zero original reserve, zero or negative current reserve displays
fully pink; positive current reserve displays white because no positive baseline
exists for a proportional loss. Nonfinite runtime values or an invalid negative
reference display fully pink without producing invalid canvas coordinates. Import
validation rejects nonfinite/negative reference values rather than repairing
energy. Tiny finite denominators and overflow in the ratio are safely clamped.

The sector is neither incubation progress nor a viability prediction. A fully
pink egg continues under the existing uptake, hatch, blocking and expiry rules;
it is not forcibly killed or converted into carrion.

## Additive persistence metadata

The importer accepts two optional egg fields in historical schemas; current
forward-mouth snapshots use schema v16:

| Field | Meaning |
| --- | --- |
| `initialFundedReserve` | Nonnegative finite usable reserve at laying, or the known current reserve when migrating an egg without a reference |
| `initialReserveIsLegacy` | `true` means the original funding is unknown; the reference was initialized from known reserve at migration |

This is a backward-compatible optional metadata extension, not a new energy
stock or a simulation regime. The forward-mouth schema, brain and physics
semantics are unchanged; the integrated observer release is v0.38.1.
The existing importer accepts earlier schemas and validates these optional
fields if present. They survive JSON export, restore, exact world forks and
Worker render frames through the existing egg transport.

When a reference is absent, restore assigns the current `fundedReserve` once
and marks `initialReserveIsLegacy: true`. Snapshot creation does the same on its
serialized copy for historical in-memory callers, without mutating the live world.
The renderer has a read-only current-reserve fallback for such callers. No parent
or genome reconstruction occurs. This cannot reveal losses before migration:
a migrated egg with positive reserve initially appears white, and one with zero
reserve appears pink. Future exports retain that same reference and provenance.
Already stored references, including zero and references below current reserve,
are retained exactly. Worlds keep their historical ecology and physics.

## Authority, perception and checks

The authoritative egg stores the reference; rendering never writes it. Worker
frames carry it to the read-only replica. Optical rays still intersect the same
radius-16 egg and use `EGG_RGB = [1, 1, 1]` with the same attenuation/occlusion.
The pink sector, glow, incubation and selection rings never enter retinal RGB,
neural inputs, genes, predation decisions or contact geometry.

`tests/egg-reserve.test.ts` covers display boundaries, direction, recovery,
structural depletion, finite exceptional handling, laying, persistence, legacy
migration, validation and sensory/deterministic separation. `scripts/check-worker.mjs`
checks the actual production Worker while paused and at 5x with funded uptake and restore.
`e2e/egg-reserve.spec.ts` checks actual canvas paths/pixels, ring direction,
selection, import/export and paused/accelerated rendering in Worker and fallback.
`scripts/check-egg-reserve-baseline.ts <baseline-checkout>` compares 120 exact ticks
in each of four physics regimes and both economies against pre-change code,
including laying, hatching and closed-world expiry, excluding only display metadata.
