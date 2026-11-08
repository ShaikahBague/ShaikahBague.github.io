# Graph Report - ShaikahBague.github.io  (2026-11-08)

## Corpus Check
- 29 files · ~40,181 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .glb 2, .ico 1)

## Summary
- 329 nodes · 642 edges · 16 communities (12 shown, 4 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3f01307e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Page, Show & Axie API
- Story Timeline & Constants
- Package Dependencies & Lint
- Pages Deploy Workflow
- Astronaut & Sky Scene
- Design Direction Docs
- Campus Builder
- Planet Surface Builder
- Rocket Builder
- TypeScript Config
- Layout & Next Config
- Next.js Agent Notes
- Far Side Mock
- Star Atlas Mock
- graphify Project Rules
- jeepney.ts

## God Nodes (most connected - your core abstractions)
1. `buildCampus()` - 20 edges
2. `createSky()` - 20 edges
3. `compilerOptions` - 17 edges
4. `buildJeepney()` - 13 edges
5. `buildCraft()` - 11 edges
6. `Show()` - 11 edges
7. `dice()` - 8 edges
8. `canvas2d()` - 8 edges
9. `painted()` - 8 edges
10. `three` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Scroll-driven master timeline` --semantically_similar_to--> `Chapter-by-chapter snap scrolling`  [INFERRED] [semantically similar]
  .impeccable/surfaces/app-page-tsx.md → PRODUCT.md
- `Planetarium show thesis` --conceptually_related_to--> `Rocket and planets scroll story`  [AMBIGUOUS]
  .impeccable/surfaces/app-page-tsx.md → PRODUCT.md
- `Home()` --calls--> `Show()`  [EXTRACTED]
  app/page.tsx → components/show.tsx
- `createRocket()` --calls--> `statureAt()`  [EXTRACTED]
  components/rocket.ts → lib/story.ts
- `createRocket()` --calls--> `walkPath()`  [EXTRACTED]
  components/rocket.ts → lib/story.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Axie story system: mascot, rocket story, chatbot, org data** — product_axie_mascot, product_rocket_story, product_axie_chatbot_guardrails, product_org_json [EXTRACTED 1.00]
- **Hero direction candidates compared in decision mocks** — _impeccable_mocks_decision_assigned_lights_down_mock, _impeccable_mocks_decision_canon_category_standard_mock, _impeccable_mocks_decision_challenger_wpa_see_the_far_side_mock, _impeccable_mocks_decision_model_pick_star_atlas_topology_mock [INFERRED 0.85]

## Communities (16 total, 4 thin omitted)

### Community 0 - "Page, Show & Axie API"
Cohesion: 0.09
Nodes (35): allowed(), fail(), POST(), recent, Home(), AxieChat(), Crew(), CrewYear() (+27 more)

### Community 1 - "Story Timeline & Constants"
Cohesion: 0.10
Nodes (35): BEATS, buildShow(), stepAt(), AT, ATMOSPHERES, BRIDGE, CAMERA_GAP, CRUISE (+27 more)

### Community 2 - "Package Dependencies & Lint"
Cohesion: 0.07
Nodes (38): eslintConfig, dependencies, gsap@^3.15.1, react@19.3.0, react-dom@19.3.0, three@^0.187.0, devDependencies, eslint@^9 (+30 more)

### Community 3 - "Pages Deploy Workflow"
Cohesion: 0.06
Nodes (33): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+25 more)

### Community 4 - "Astronaut & Sky Scene"
Cohesion: 0.15
Nodes (27): FLOATING, paintSuit(), suitUp(), visor(), createRocket(), bake(), buildAsteroids(), buildConstellation() (+19 more)

### Community 5 - "Design Direction Docs"
Cohesion: 0.11
Nodes (19): Lights Down mock (assigned direction), Seat ticket Join CTA (Row A / Seat 55), Star projector illustration, Category standard mock (canon), Memorable moment: 54 lit seats and one empty seat, Lights Down form (seed 84c6e0078c5ee889), Scroll-driven master timeline, Open Graph image alt text (+11 more)

### Community 6 - "Campus Builder"
Cohesion: 0.27
Nodes (21): beam(), block(), buildBridge(), buildCampus(), canvas2d(), coloured(), dice(), distant() (+13 more)

### Community 7 - "Planet Surface Builder"
Cohesion: 0.19
Nodes (19): buildArchive(), buildBonds(), buildGround(), buildLinks(), buildListing(), buildMotes(), buildSky(), buildStage() (+11 more)

### Community 8 - "Rocket Builder"
Cohesion: 0.23
Nodes (18): buildBay(), buildCabin(), buildCraft(), buildDoor(), buildLiftDeck(), canvas2d(), cutDoorway(), DOOR_WORLD (+10 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 10 - "Layout & Next Config"
Cohesion: 0.18
Nodes (7): body, display, metadata, ticket, nextConfig, next@16.4.2, next

### Community 15 - "jeepney.ts"
Cohesion: 0.19
Nodes (17): box(), buildJeepney(), FORWARD, frontPaint(), grillePaint(), HEADING, horse(), lettering() (+9 more)

## Ambiguous Edges - Review These
- `Rocket and planets scroll story` → `Planetarium show thesis`  [AMBIGUOUS]
  .impeccable/surfaces/app-page-tsx.md · relation: conceptually_related_to

## Knowledge Gaps
- **8 isolated node(s):** `Next.js agent rules (read node_modules/next docs)`, `create-next-app README`, `See The Far Side mock (challenger WPA)`, `Star Atlas Topology mock (model pick)`, `graphify project rules` (+3 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 88 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `Package Dependencies & Lint` to `Astronaut & Sky Scene`, `Campus Builder`, `Planet Surface Builder`, `Rocket Builder`, `jeepney.ts`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `buildJeepney()` (e.g. with `frontPaint()` and `grillePaint()`) actually correct?**
  _`buildJeepney()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js agent rules (read node_modules/next docs)`, `create-next-app README`, `See The Far Side mock (challenger WPA)` to the rest of the system?**
  _8 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page, Show & Axie API` be split into smaller, more focused modules?**
  _Cohesion score 0.08787878787878788 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Layout & Next Config` to `Page, Show & Axie API`, `Package Dependencies & Lint`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `Story Timeline & Constants` be split into smaller, more focused modules?**
  _Cohesion score 0.0975609756097561 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Rocket and planets scroll story` and `Planetarium show thesis`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._