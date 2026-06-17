# Microcosm — Design Spec

**Date:** 2026-06-17
**Status:** Approved vision; M0 is the first slice to take into implementation planning.

---

## 1. Vision

Microcosm is an always-on, browser-based, massively-multiplayer **evolution sandbox**. One
giant shared, grid-based "petri dish" runs on an authoritative server 24/7. Each player is a
**designer**: they spend a point budget on microbe traits, seed a strain into the shared soup,
and then **natural selection takes over** — microbes reproduce, mutate across generations,
compete for food and space, prey on rival strains, and either adapt or die out.

Players earn an in-game currency as their strain thrives and spend it to intervene (mutate,
re-seed, drop food, cull). A **daily login keeps a strain alive**; neglected strains decay and
die, and their lineage is reclaimed. This keep-alive rule is the core mechanic that makes
"always-on shared world" compatible with "lightweight server cost": the server only ever
simulates strains that players actively care about.

**Reference points:** *WorldBox* (god-sandbox spirit) × *Conway's Game of Life* (grid substrate)
× *The Bibites / Thrive* (genome-driven evolution) × *agar.io* (shared competitive space).

### Project goals
- A **real product** intended to launch — architecture must be sound, not throwaway.
- A **learning vehicle** — game simulation, netcode, and live-service systems.

### Core constraints
- **Lightweight server / cheap to host** is the dominant non-functional requirement.
- **One single giant shared persistent world** (not instanced rooms).
- Runs in a **browser** on normal hardware.

---

## 2. Architecture overview

**Chosen approach: single authoritative server process (monolith), with the simulation written
as a pure, isolated, deterministic module** so it can later be swapped to a Rust/WASM core or
region-sharded without rewriting the game around it. Rejected for now: region-sharding
(premature complexity) and a Rust/WASM core (higher upfront cost — but the portable boundary
keeps it open as a later optimization).

**Stack:** TypeScript end to end to start.
- Server: Node.js + WebSockets (`ws`, or uWebSockets.js if needed for throughput).
- Client: Canvas/WebGL renderer (grid uploaded as a texture — cheap on the GPU).
- E2E / browser testing: **Playwright** (real-client flows, UI, and visual checks of the rendered grid).
- Persistence: **Neon** (serverless Postgres, scale-to-zero — fits the "cheap to host" constraint).
- Auth + object storage: deferred to M3 (they don't appear before then). Likely **Cloudflare R2**
  for snapshot storage and a lightweight auth lib (Auth.js / Lucia) or managed (Clerk).

### Four units (each one job, well-defined interface)

1. **Sim Core** — pure, deterministic library. No I/O, no networking, no DB, no concept of
   players-as-connections. Input: `(state, actions[])`. Output: `(nextState, events[])`. This is
   the portable piece. Implemented in TS now; swappable to Rust/WASM later.
2. **Server (authoritative host)** — runs the fixed-tick loop, calls Sim Core each tick, manages
   WebSocket connections, validates and queues player actions, computes per-client viewport
   deltas, and snapshots state to persistence.
3. **Client (browser)** — renders the grid via WebGL, shows strain stats + currency balances,
   provides the point-buy genome UI and intervention controls, sends actions, and interpolates
   between server updates for smooth visuals. Never authoritative.
4. **Persistence + Accounts** — Postgres (Neon) for player profiles, strain genomes, currency
   balances, last-login timestamps, and purchase records; object storage for periodic world
   snapshots. Auth and object storage are selected at M3.

### Per-tick data flow
```
clients --actions--> Server --(state, actions)--> Sim Core
Sim Core --(nextState, events)--> Server --viewport deltas--> clients
```

---

## 3. Simulation core (the heart)

### World substrate
- The world is a 2D **grid of cells**.
- Each cell holds: a **food/nutrient level**, and **at most one microbe** (single-occupancy
  keeps simulation cheap and avoids stacking math).
- A microbe belongs to a **strain** (a player's lineage) and carries a small **genome**.
- Each microbe tracks an **energy** value (accumulated from eating, spent on metabolism and
  reproduction).

### Genome (point-buy traits)
A starting budget (e.g. 100 points) is allocated across:

| Trait | Effect |
|---|---|
| **Metabolism** | Food consumed per tick to stay alive. Low = hardy; high = needs rich cells. |
| **Reproduction threshold** | Energy required to split into a neighboring cell. |
| **Spread / Motility** | How aggressively it colonizes neighbors. |
| **Diet** | Spectrum from eating cell nutrients to eating *other strains'* microbes (predation). |
| **Resilience** | Resistance to hazards, crowding, and starvation. |
| **Mutation rate** | How much offspring genomes drift. High = adapts faster but riskier. |

Predation (the **Diet** trait reaching into eating rival microbes) is included in **v1**.

### Per-tick rule (per microbe)
1. **Consume**: gain energy from the cell's nutrients (herbivore end of Diet) and/or from an
   adjacent eatable rival microbe (carnivore end of Diet); pay **metabolism** energy cost.
2. **Die** if energy hits zero (starvation), or to a successful predation/hazard, or to
   crowding beyond resilience.
3. **Reproduce** if energy ≥ reproduction threshold and a target neighbor cell is available
   (empty, or occupied by an eatable rival for predators): spawn offspring there with
   **genome = parent ± mutation** (magnitude scaled by mutation rate). Split the energy.

This single rule set produces genuine evolution: genomes drift across generations and selection
favors whatever survives current local conditions and neighbors.

### Determinism
The Sim Core is fully deterministic given `(state, actions, seed)`. Randomness (mutation,
tie-breaks) flows from a seeded PRNG carried in state. Same inputs always yield the same output
— this is what makes evolution scenarios reproducible as tests.

### Player interventions (actions)
Spent against earned currency, validated server-side, rate-limited by cooldowns:
- **Seed** microbes into chosen cells.
- **Inject mutation** into a strain.
- **Drop nutrient bloom** to enrich a region.
- **Cull** part of a strain.

### Economy & keep-alive
- **Biomass** (earned only, never purchasable): accrues passively from a strain's living biomass
  over time. The currency for most interventions. Keeps core competition fair.
- **Credits** (purchasable, also slowly earnable): for cosmetics, slots, insurance, analytics,
  season pass. **Never buys power.**
- **Vitality / keep-alive**: each strain has a vitality value that decays daily. Logging in
  refills it. At zero, the strain's microbes begin dying off and the lineage is reclaimed —
  bounding the active simulation set to daily-active players.

---

## 4. Netcode & data flow

- **Server-authoritative**, fixed world tick (target 5–10 ticks/sec). Visual smoothness comes
  from **client-side interpolation**, not a faster authoritative rate.
- **Interest management**: each client reports its viewport (camera rect + zoom). On subscribe,
  the server sends a full snapshot of that region; thereafter it sends **per-tick deltas** (only
  changed cells) for that region. Zooming out switches to **downsampled / coarser** data so the
  payload stays roughly flat regardless of zoom.
- **Actions**: small client→server messages (`seed`, `mutate`, `drop food`, `cull`), validated
  server-side against the player's Biomass/Credit balances and cooldowns. The client predicts
  visuals only; it can never fake authoritative state.
- **Anti-cheat**: trivial by construction — the server owns all state; clients can only *request*
  actions they can afford.

---

## 5. Persistence

- **Postgres (Neon, serverless, scale-to-zero) tables (initial):**
  - `players` — auth link, profile, credits, last_login.
  - `strains` — owner, genome, biomass, vitality, cosmetics, alive/dead status.
  - `purchases` — credit transaction records.
- **Auth:** selected at M3 — a lightweight auth lib (Auth.js / Lucia) or a managed provider
  (Clerk). The game server reaches Postgres directly with a service credential, so RLS / a
  client-facing DB SDK are not required.
- **World state** is too large and hot for row-per-cell SQL. It lives in **server memory** and is
  **snapshotted as a compact binary blob** every N seconds, plus an **append-only action log** so
  a crash replays forward from the last snapshot. World restart = load latest snapshot (+ replay
  tail). Snapshots can write to a local disk/volume through M2; object storage (likely Cloudflare
  R2, S3-compatible) is introduced at M3.

---

## 6. Error handling & testing

- **Sim Core**: pure & deterministic → **golden tests** (same state + actions + seed = same
  output). Evolution scenarios become reproducible fixtures. Tests assert non-degenerate behavior
  (strains don't trivially explode to fill everything or instantly die).
- **Server**: client reconnect logic; action validation with explicit rejection messages;
  snapshot/restore round-trip tests; graceful degradation when a client falls behind (fall back
  to periodic keyframes instead of deltas).
- **Client / E2E (Playwright)**: drive the real browser client to verify rendering, the point-buy
  genome UI, and intervention flows; capture **screenshots for visual smoke/regression** of the
  rendered grid. Starts at M1 (single-player browser). In M0 a single Playwright screenshot test
  can smoke-check that the local canvas renders an evolving colony. From M2, modest-N Playwright
  sessions validate real multiplayer end to end.
- **Load testing**: use lightweight **synthetic WebSocket clients** (not full browsers) to
  simulate many viewport subscriptions and find the per-box player ceiling — this validates the
  "lightweight" claim far more cheaply than spinning up N real browsers.

---

## 7. Build order (milestones)

Each milestone is independently demoable. Each gets its own spec → plan → implementation cycle.

- **M0 — Sim Core proof** *(first slice to spec & build)*: the pure grid + genome +
  reproduce/eat/predate/mutate rules, run headless, rendered to a local canvas. No server, no
  accounts. **Goal: confirm evolution produces interesting, non-degenerate, watchable results.**
  This is the riskiest, most fundamental piece — everything else is plumbing around it.
- **M1 — Single-player browser**: wire Sim Core to a WebGL view + point-buy genome UI + basic
  interventions. One person, one world, in a tab.
- **M2 — Authoritative server + multiplayer**: move the sim to the server; add WebSocket viewport
  sync; multiple players in one shared world.
- **M3 — Accounts & persistence**: auth (Auth.js / Lucia / Clerk), Neon-backed saved strains,
  snapshots to object storage (R2), daily keep-alive/vitality.
- **M4 — Monetization & polish**: Credits, cosmetics, strain slots, spore insurance,
  analytics/replays, season pass.

---

## 8. Monetization (north-star, lands in M4)

**Posture: strictly fair — Credits never buy power.** Two-currency split (Biomass earned-only;
Credits purchasable) protects the shared world and keeps a healthy free playerbase.

Credit offerings:
1. **Spore Insurance / Cryo-stasis** — protect a strain through missed days / vacations. Capped
   (e.g. max 7 days) so it doesn't undermine cost-bounding. The most natural credit sink because
   it directly addresses the daily-login pain point.
2. **Extra strain slots** — free tier runs 1 strain; paid runs several in parallel. "More game,"
   minimal balance impact, strong recurring seller.
3. **Cosmetics** — strain colors, bioluminescence, patterns, animated split/death effects, named
   strains, profile flair. The game is intensely visual, so cosmetics sell well and are non-P2W.
4. **Analytics + replays** — population graphs, genome-drift charts, lineage trees, territory
   heatmaps, exportable time-lapse GIFs/videos. Replays double as a viral growth loop.
5. **Season Pass** — themed recurring seasons (e.g. "survive the ice age") with free + premium
   tracks. Retention + revenue engine well-suited to a persistent evolving world.

Explicitly **excluded**: selling Biomass directly, and pay-for-power consumable boosters.

---

## 9. Open questions (defer to relevant milestone)
- Exact grid dimensions and tick rate (tune in M0/M2 against the "lightweight" load tests).
- Concrete trait value ranges and the point-buy cost curve (tune in M0 for non-degenerate
  evolution).
- World topology: bounded rectangle vs. toroidal wrap (decide in M0).
- Biomass accrual rate and intervention costs/cooldowns (balance pass, M1–M2).
