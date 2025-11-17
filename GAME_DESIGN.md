# Frostfall Haven – Cozy Online Christmas Village

## Vision
- **Pitch:** A romantic, playful winter-date-night sandbox where long‑distance partners meet inside a softly lit, snowy village, customize their looks, and decorate cabins together in real time.
- **Tone & Emotions:** Comforting, magical, collaborative. Visual warmth (lanterns, glowing garlands) contrasted with gentle snowfall and soft chimes.
- **Target Platform:** PC / Mac (keyboard + mouse or controller) delivered through Unity 2022 LTS (URP) with headless dedicated server builds.

## Pillars
1. **Romantic Presence:** Avatars emote, hold hands, sit together on benches, exchange gifts, and trigger duo animations to reinforce closeness.
2. **Creative Collaboration:** Drag‑and‑drop decorations, synchronized gizmos, shared color palettes, and “My turn / Our turn” locking to avoid conflicts.
3. **Magical Ambience:** Dynamic weather, responsive lighting (lights brighten as decorations increase), layered audio and musical cues tied to co-op actions.

## Core Loop
1. Launch into the main lodge → invite / join partner with a short share code or friend list.
2. Walk hand in hand to claim an empty cabin plot.
3. Customize avatars at the wardrobe mirror (hair, outfits, accessories, holiday skins).
4. Enter decorate mode: select ornaments/lights, place, scale, recolor, animate.
5. Capture memories: photo mode, scheduled fireworks, deliver gifts, unlock new props.

## Feature Breakdown
### Multiplayer & Session Flow
| Feature | Description |
| --- | --- |
| Join Partner | One player hosts or generates an invite code; the other selects “Join Partner” and enters the 6‑digit code. |
| Dedicated Village Server | Runs authoritative simulation for weather, decoration placement, cabin ownership, and interactable states. |
| Presence Indicators | Map icons, UI callouts (“Partner is customizing outfit”), and subtle trails so finding each other feels effortless. |

### Avatar Customization
- **Wardrobe Stations:** Mirror UI with body preview, outfit tabs (Coats, Knitwear, Accessories, Footwear).
- **Cosmetics Data:** `ScriptableObject AvatarPiece` storing mesh, material variants, tint range, unlock data.
- **Collaborative Try‑On:** Partner can see outfit previews live; heart emote reaction button encourages feedback.

### Decorating Cabins
- **Claim Cabin Flow:** Walk up, interact with mailbox → choose theme preset (Gingerbread, Alpine Modern, Starlit Classic).
- **Placement Tools:** Translation/rotation gizmos, grid snapping toggle, surface projections for walls/roof/ground.
- **Decoration Types:** Strings/lights, wreaths, glowing ornaments, candles, animated snow globes, outdoor props.
- **Lighting System:** Each decoration contributes to a dynamic lightmap or baked emissive boost; color sync ensures both players see identical hues.
- **Shared Inventory:** Items unlocked via progression tree (complete a “Warm Wishes” challenge to unlock sparkling garland).

### Cozy Interactions
- Hand‑hold toggle, sit on swing, drink cocoa, snowball play, co-op emotes initiated via radial menu.
- Photo mode with timer, depth of field presets, postcard export and share overlay.
- Gift exchange: wrap decorations, add voice note, deliver to partner’s stocking.

## World & Art Direction
- **Layout:** Central lodge hub (spawn, wardrobe, cafe), surrounding pine forest, 6–8 cabin plots, frozen lake for skating mini-activity.
- **Lighting:** Golden hour skybox + volumetric fog; emissive fairy lights; shader graph snow sparkle rim.
- **FX:** GPU particle snowfall, footprints decal projector, interactive snow displacement around avatars.
- **Audio:** Layered ambience (wind, crackling fire), dynamic music that swells when both players decorate the same cabin, diegetic chimes from ornaments.

## Technical Architecture
### Networking Overview
- **Stack:** Unity Netcode for GameObjects (client prediction + server reconciliation) backed by Unity Transport; optional Unity Relay for NAT punch-through.
- **Server Build:** Headless Linux build deployed to a cloud VM / container. Server orchestrates cabin ownership, decoration transforms, and authoritative physics volumes.
- **Synchronization:**
  - Avatar movement → NetworkCharacterController (client side prediction, server authority, smoothing).
  - Decoration placement → `DecorationActionMessage` describing prefab ID, transform, material overrides, owner. Applied on server and multicast.
  - Customization → `AvatarLoadoutState` replicates equipment slots; server validates unlocks.
  - Interaction states → `InteractionStateComponent` handles emotes/hand-holding w/ TTL to prevent drift.

### Systems Diagram
```
[Client] --POST /session--> [Match / Relay Service] --assign--> [Village Server]
     \--gRPC skin catalog--> [Content CDN]
[Village Server] --Redis--> [Persistence] --S3--> decoration snapshots
```

### Data & Persistence
- **Profiles:** Account ID, cosmetics owned, favorited outfits.
- **Cabin Save:** Prefab references, transforms, color parameters, attached FX states.
- **Session Snapshots:** Auto-save every 120s + manual save on exit; conflict resolution uses last-writer-wins with undo buffer client-side.

### Tools & Pipelines
- **Content Authoring:** Unity Editor w/ ProBuilder for blockout, Blender for final meshes, Substance Painter for textures.
- **Decor Library Generator:** Scriptable import pipeline that ingests GLB decorations, applies LODs, assigns interaction colliders automatically.
- **LiveOps:** Remote config toggles for seasonal playlists, decoration unlocks, XP multipliers.

## Controls & UX
| Action | KBM | Controller |
| --- | --- | --- |
| Move | WASD | Left Stick |
| Look | Mouse | Right Stick |
| Interact | E | A / X |
| Hand in Hand | Q (near partner) | LT + A |
| Decorate | Hold F → decoration wheel | Hold X → wheel |
| Photo Mode | P | D-Pad Up |

- **UI Flow:** Title → Login → Main Menu (“Join Partner”, “Start Village”, “Customization”, “Settings”) → Loading screen (show tips & shared milestones) → Village.
- **Onboarding:** Snowflake-guided path, context-sensitive prompts, collaborative tutorial (“Place 3 lights together”).

## Production Plan
### Milestones
1. **Vertical Slice (6 weeks):** Small hub, 1 cabin, 10 decorations, join-partner flow, basic customization, networked placement.
2. **Alpha (10 weeks):** Full village layout, wardrobe expansion, photo mode, progression prototypes, voice chat integration.
3. **Beta (8 weeks):** Content polish, FX pass, accessibility, optimization, QA of networking, Steam demo.
4. **Launch (4 weeks):** Final content, marketing assets, release candidate, monitoring dashboards.

### Workstreams
- **Engineering:** Networking, placement tools, customization, persistence, emotes.
- **Art:** Environment, props, avatar outfits, VFX, UI.
- **Audio & Narrative:** Score, SFX, voice lines for cozy interactions, seasonal events.
- **QA & Playtest:** Latency testing, UX sessions with long-distance pairs, accessibility review.

### Risks & Mitigations
- **Networking Latency:** Use interpolation buffers and ownership handoffs; keep heavy operations server-side to avoid divergence.
- **Content Scope:** Prioritize modular decor sets; create recolor variants via shader parameters.
- **Emotional Tone:** Regular playtests with target audience, add duo prompts and micro-narratives to keep romantic focus.

## Next Steps
1. Stand up Unity project (URP, Netcode for GameObjects) and repository structure.
2. Implement minimal avatar controller + headless server build.
3. Prototype decoration placement with authoritative server validation.
4. Block out lodge + single cabin, import into engine, light and test ambience.
5. Build wardrobe customization UI using ScriptableObject data model.
