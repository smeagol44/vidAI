# Energy Activity Overlays

The overlays are implemented in VIDA 2D and show actual authoritative transfers.

Green glow follows every body segment during significant actual feeding uptake
from nutrients, carrion, eggs or living prey. Red glow follows the body segment
identified by an actual extracting predator mouth. Several mouths can mark
several contacted segments. A single mouth uses the first contacting segment
already selected by the authoritative feeding path; it does not run a new
contact search or guess how a bite is distributed across tissue.

Metabolism, movement, neural upkeep, egg funding, failed contact and food
proximity produce no red signal. Gains and losses are independent even when the
organism's net reserve change is zero or negative. Existing mouth animations,
selection, reproductive markers, eyes, grid lines and geometry remain intact.

## Significance and timing

The collector sums actual transferred joules in a rolling 250ms **simulation**
window (15 fixed ticks). Each direction uses the largest pre-transfer usable
reserve plus structural biomass stock in that window. Its denominator is at
least 1% of the larger inherited reserve capacity or body construction cost,
with a numerical floor of 1e-9J. This prevents exhausted reserves from producing
unbounded sensitivity while retaining meaningful tissue extraction. Activation
requires 0.5%; an active signal persists down to 0.35% to avoid threshold chatter.
These presentation constants are in `energyActivity.ts`, not simulation settings.

Both signals share a 400ms pause-aware **presentation** cycle, independent of
transfer count, amount and playback multiplier. Smooth squared-cosine lobes
alternate their peaks by 200ms. A faint 0.025 activity-envelope trough keeps even short
completed intervals visible between peaks; only one color exceeds that faint
trough at any phase, avoiding strong mixed-color peaks. The existing rounded
body path is stroked with five translucent contour bands, never filled with activity
color. Their total widths are 21, 15, 10, 6 and 2 CSS pixels, independent of zoom;
the outermost band reaches 10.5 pixels outside the body, three times the original
compact halo's reach. Individual peak alpha is .06/.084/.12/.168/.312 green and
.07/.098/.14/.196/.364 red (outside to core). The broad translucent falloff gives
a glass-like glow rather than a brighter hard edge. The normal body fill and
outline are painted over the glow, retaining pigmentation and readable anatomy. No shadow blur, canvas filter or body scaling is used.
An inactive signal fades for at most 100ms of unpaused presentation time.

While the host is paused, phase and fade freeze. Late in-flight activity packets cannot start new
signals while paused. Existing host pause controls and overlay are unchanged. The separate #113
proposal supplies canonical interactive x0; this feature does not import it. Resume
uses a new wall-clock baseline, so stopped wall time never becomes a burst.
World replacement/reset clears all signals; death/removal clears the affected
creature. Signals are transient and never exported or saved.

## Authority and speed

The Worker emits primitive receipts only after real uptake/extraction is known.
A host-owned collector retains active intervals crossed between delivered
frames, including in MAX. It sends small activity rows with existing render
frames, with no additional messages or per-organism timers. If an interval has
already ended, it gets only the short fade, not a queued full pulse cycle.
Multiple subframe transfers never generate a pulse each. At extreme speeds,
individual completed intervals may be brief; no decorative history is replayed.

The main-thread fallback shares the same collector and renderer. All metadata
stays outside genomes, authoritative world state and persistent schemas. Optical
sensing still reads the original inherited pigmentation and physical geometry.
The decorative glow never enters RGB rays, neural inputs, decisions or physics.
Tests compare complete observer-free and instrumented saved-state continuation,
including optical and neural data, energy and PRNG, with exact equality.

Lethal extraction follows existing mortality: a dissolving victim loses its
transient indication immediately. No extra corpse animation or altered lifespan
is introduced. The translucent glow keeps a stable screen width at different zoom levels without
enlarging collision geometry. Closely packed contours can overlap briefly.
