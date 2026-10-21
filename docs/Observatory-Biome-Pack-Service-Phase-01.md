# Observatory Biome Pack Service Phase One Design

10 October 2026. Revision 1. **Status: proposed design for Phase One. Runtime implementation has not started.** The user's request authorizes this design work. This document defines the proposed implementation contract; it does not claim service conformance, installation of a new pack, or closure of older Observatory gates.

The Observatory will own a Biome Pack Service that accepts a compatible release, registers it, allocates persistent areas on the inner surface, and connects its content provider to the Observatory's world, travel, rendering and persistence services. A pack declares its requirements and supplies content. It cannot choose authoritative world coordinates, move another pack, replace a world clock, or create a second travel controller.

The first deployed content test is a new build of the accepted Meadow in Phase Two. Meadow is eligible along and beneath shade-track corridors and uses Duck Blind presentation. Infinite Industry is eligible outside those corridors and does not use Duck Blind. Both use the same ingestion, registration, allocation, addressing and lifecycle interfaces.

The service follows one principle throughout: **the stage follows the eye; the assigned landscape stays at its world address.**

## 1 Purpose and phase boundary

Phase One delivers the pack format, service implementation, actual Observatory connections, two small content-family fixtures, a public installation and exploration flow, and retained conformance evidence. The fixtures exercise real host interfaces. A mock renderer, a catalogue-only registration, or opening a separate HTML scene cannot establish Phase One integration.

Phase Two adapts the accepted Meadow to this contract. It preserves the accepted content as the visual reference, supplies a compliant provider and representations, and tests ingestion, assignment, approach, descent, walking, flight, reveal, return and reconstruction in the main application.

Phase One does not create Industry artwork, revise Meadow density or transitions, build a biome authoring language, implement the Unreal application, add a general ecological simulator, or establish arbitrary transitions between every future biome pair. It does provide the interfaces and refusal behavior needed to add those capabilities without changing assignment ownership.

The generic core must work without a Meadow pack installed. No pack ID, grass density, Duck Blind altitude or industrial structure type belongs in the allocation or registration algorithm.

## 2 Requirements from the user

The design treats these requirements as fixed:

1. Installing a compatible pack automatically registers it and assigns eligible areas under the target world's placement policy.
2. Assigned areas are real locations on the Sphere's inner surface, visible and approachable through the main Observatory.
3. Meadow belongs along and beneath shade-track corridors.
4. Industry belongs outside shade-track corridors and does not require Duck Blind.
5. The accepted Meadow appearance is the quality floor for Phase Two.
6. The render stage moves with the observer while content identity, roots and terrain stay geographically fixed.
7. The service is reusable across many content families.
8. Phase One builds the common service; Phase Two produces a new Meadow build as its first substantial test.
9. Existing work, accepted builds, saved places, evidence and running servers are preserved.

A successful automatic install is one operation with a target world and a configured placement policy. It does not require editing a destination list or answering an area question for each pack. Choosing a different area policy, replacing occupied territory, migrating a saved world, or activating a new executable provider extension are separate explicit operations.

## 3 Current implementation and the missing connection

The current delivered Meadow is a versioned scene served by the Observatory. It has asset validation, saves, eye-following scenery, cleanup and accepted content. It is opened by whole-document navigation. It has no installed-world binding or automatic geographic assignment.

| Existing interface | Verified current responsibility | Phase One treatment |
|---|---|---|
| world-address.js | Schema 2, six cube-sphere faces, levels 0 through 30, world revision metadata and separate shell or Shade addresses | Keep its topology and face ordering; add an explicit service address adapter and canonical ownership checks |
| world-topology.js | Deterministic cell keys, neighbours, shared edges and semantic sampling streams | Reuse for allocation adjacency and boundary identity |
| world-geography.js | Generated fields and explicit legacy geography adaptation | Add a binding-aware query layer without rewriting legacy meanings |
| collection.js and world.js | Designed shell layout, shade routes, moving plates, light visibility and legacy regional appearance | Supply track envelopes, protected areas, datum and physical lighting through host adapters |
| biome-packs.js | Watershed-specific registry and schema 1 packAddress | Retain as legacy; do not overload packAddress with a different schema |
| pack-library.js | Hardcoded Meadow entry and location.assign scene navigation | Retain the legacy scene entry; add a separate service-driven installed catalogue |
| travel-transaction.js and navigation-history.js | Serialized readiness, departure recovery, synchronous arrival commit and bounded history | Remain the single travel commit owners |
| renderer.js and ground-chunks.js | Existing WebGL context, preparation, drawing, terrain support and bounded derived caches | Add provider slots, common surface composition and resource leases |
| session-state.js | Synchronous browser-local session codec, version 1 and 2 reads, version 2 writes, paused restore | Add an opt-in service session path; retain old records and codec behavior |
| serve.cjs | Local static file serving and build metadata | Continue static serving; no server write endpoint is required |
| packs/runtime/v1 | Separate full-scene host with its own lifecycle and local pack address | Preserve unchanged; its API 1 is not this service's contract |

Source identities and the protected baseline are recorded in [the design work directory](../../../work/biome-pack-service-design-2026-10-10/README.md). These observations describe inspected source. Existing tests and historical evidence do not certify the new service.

The proposed Foundry Contract's ownership, exact release identity, world binding and canonical address concepts inform this design. Its wider grammar, events, ecology, Journey and governance programme remains proposed. This design binds a smaller Observatory service and must not be reported as implementation of that entire programme.

## 4 Architecture and ownership

The public façade is **SphereBiomeService**. It coordinates five components under existing host authorities:

| Component | Owns | Does not own |
|---|---|---|
| Release store | Verified descriptor bytes, asset bytes, exact release identities and dependency retention | Geography, camera or executable extension admission |
| Registry | Available and installed release records, compatibility reports and catalogue projections | Assignment decisions or active rendering |
| Allocator | Deterministic proposed footprints, eligibility certificates, boundary reservations and assignment proofs | Pack content generation or world-head publication |
| World binding store | Immutable assignment snapshots, active heads, session references and atomic install publication | Frame timing or movement |
| Provider coordinator | Read-only world context, readiness, bounded requests, resource leases and representations | New authoritative clock, global events, direct storage writes or independent travel commits |

The Observatory's existing world, renderer, travel controller and session owner retain their responsibilities. The façade passes requests to them through adapters.

~~~mermaid
flowchart TD
  Source[Local release or bundled catalogue] --> Ingest[Validate and retain exact release]
  Ingest --> Registry[Registry and compatibility]
  Registry --> Plan[Plan eligible persistent areas]
  Host[Sphere world and placement policy] --> Plan
  Plan --> Commit[Publish one complete world binding]
  Commit --> Map[Overview and geographic lookup]
  Commit --> Context[Read only world context]
  Map --> Travel[Existing travel transaction]
  Travel --> Ready[Prepare surface and provider resources]
  Context --> Provider[Content provider]
  Provider --> Ready
  Ready --> View[Existing renderer and movement owner]
  View --> Save[Binding aware session and export]
  Save --> Commit
~~~

The diagram describes proposed ownership. Installation publication and a later camera arrival are different transactions: publication changes the installed world binding; travel commits an observer pose only after readiness.

### Provider extensions

Version 1 accepts declarative pack data and invokes **host-admitted provider extensions** through a common ABI. It does not execute an arbitrary JavaScript entry found inside an imported archive.

A provider extension is reviewed application code with a stable ID, exact code digest, ABI version, supported recipe schema, backend profile and capabilities. Extensions are registered in a generated host catalogue. Pack descriptors pin those identities. The service itself has no branch for a specific biome.

Phase One includes a heightfield fixture extension and a modular structure fixture extension. Phase Two adds an admitted Meadow extension wrapping the accepted implementation. A later Industry pack may use the structure extension or add another admitted extension if its requirements exceed that profile.

This is an intentional boundary: automatic integration applies to packs whose required provider and capabilities are supported. A genuinely new execution backend requires an explicit host extension. An unknown provider is rejected before assignment; it is not imported on demand from pack data.

Admitted extensions run with application trust. API discipline and worker isolation are not claims of confinement against malicious application code. User-supplied data stays data; no eval, generated JavaScript, conversational model calls, undeclared network resources, package install hooks or executable ZIP entries are allowed by the pack format.

## 5 Identity and pack format

The new descriptor uses **sphere-biome-pack/1**, with contract version **1.0.0** and provider ABI **sphere-biome-provider/1**. These names are distinct from the delivered scene's manifest schema 1 and packs/runtime/v1.

A display version is descriptive. The payload digest identifies the exact artifact. A semantic generator ID identifies the rules that determine terrain, feature identity and persistent state. Geography and appearance revisions remain separate.

| Record | Purpose |
|---|---|
| manifest.json | Pack identity, exact provider, recipe, assets, capabilities, placement requirements, representation and persistence declarations |
| release.json | Payload digest, manifest byte count and hash, descriptor format; provenance and acceptance records remain separate references |
| assets directory | Declared data resources with exact lengths and SHA-256 hashes |
| dependency records | Exact resource release digests; no floating version ranges |

The transport archive is optional. The same payload may be ingested from a bounded local ZIP or a same-origin bundled catalogue entry. ZIP ordering, compression and timestamps are not payload identity. Transport metadata cannot redefine the descriptor.

The manifest contains no payload digest and does not list itself or release.json as an asset. Its inventory contains the hashes of every payload resource. Define:

~~~text
manifestHash = SHA256(exact UTF8 bytes of manifest.json)
payloadDigest = SHA256(UTF8("sphere-biome-pack/1\n") || exact manifest bytes)
~~~

An admitted payload must verify every listed resource against the manifest. The digest therefore pins the descriptor and all declared resource identities without a circular self-hash. Extra undeclared payload files are rejected. External evidence and decisions reference the payload digest and remain outside it.

Parsers reject duplicate object keys, non-finite values, unsafe integers, unsupported mandatory fields and unknown record formats. Structural validation precedes semantic validation. A JSON Schema match alone cannot prove compatibility, resource integrity, placement eligibility or runtime readiness.

IDs use bounded ASCII tokens. Paths are relative ASCII paths with forward slashes; absolute paths, drive prefixes, backslashes, empty segments, dot segments, percent escapes, query strings, fragments and case-folding collisions are rejected. Asset URLs never choose an executable provider.

### Descriptor contents

The machine-readable definition is [manifest.schema.json](../../../work/biome-pack-service-design-2026-10-10/schemas/manifest.schema.json).

| Field | Required meaning |
|---|---|
| packId and version | Logical family and display release |
| semanticGeneratorId | Stable semantic recipe identity; a semantic change requires a new ID |
| geographyRevision and appearanceRevision | Distinct geographic and visual revisions |
| provider | Exact admitted extension ID, ABI, digest and backend profile |
| recipeAssetId and recipeSchemaId | Validated provider data; schema must be supported by the pinned extension |
| addressProfile and timeProfile | sphere-world-address-v2 and sphere-clock-v1 |
| capabilities | Required and optional names, without duplicates or contradictory requirements |
| placement | Shell surface, track relation, track selection, clearance, allowed area range, recommended area, frame domain and transition width |
| terrainBoundsM | Conservative ground bounds relative to the declared host datum |
| representations | Overview, surface and detail tiers referring to the same semantic generator |
| fallback | Provider-supported coarse solid surface and appearance; no readiness gap |
| presentation | Duck Blind absent or explicitly enabled with a reveal profile and provisional altitude |
| budgets | Persistent and transient CPU/GPU bounds, jobs, stage radius, upload and preparation quotas |
| persistence | State schema, admitted codec and bounded provider state |
| assets and dependencies | Exact data resources and retained dependency identities |

Capabilities describe what a pack requires or offers; they do not activate a feature merely by naming it. The provider catalogue must support the same capability and profile. Unknown required capabilities fail. Unknown optional capabilities are reported unavailable and cannot be requested successfully.

Grass and Duck Blind are optional content capabilities. Basic ground support, an overview representation, bounded preparation, exact identity and cleanup are mandatory for this first shell-surface profile.

## 6 Host policy and automatic assignment

The **world policy** belongs to the Observatory. The pack supplies constraints, including a minimum and maximum useful core area. The policy supplies distribution choices, allocation limits and default target area.

For an ordinary install, the allocator requests one connected region with target area equal to the policy target clamped into the pack's declared area range. The recommended pack area is explanatory metadata; it cannot override the host policy. No new area question is needed.

The proposed initial pilot policy uses allocator level 14, one region per pack and a target of 10^16 square metres per region. On an AU-radius shell this is a very large landscape, approximately the area of a 100,000 km square; actual spherical area and shape are reported by the plan. These are configurable pilot defaults, not a currently allocated Meadow footprint. They preserve long exploration while keeping the assigned region distinct from whole-Sphere ownership.

Policy includes maximum installed releases, regions, cells, search work, index nodes, asset bytes, preparation and aggregate resident resources. A request that exceeds limits fails or returns a resumable planning checkpoint; it never changes density, weakens placement restrictions or silently allocates a smaller-than-minimum region.

Target-area overshoot may be at most the largest accepted allocation cell. The plan reports requested, actual and overshoot area. If overshoot exceeds a declared maximum area, refine within the policy's permitted level range and retry the same deterministic request. If no permitted resolution satisfies the bounds, return AREA_GRANULARITY_UNSUPPORTED.

The first policy permits levels 12 through 18 for allocation. Provider generation and rendering may use finer cells, up to the existing address profile's level 30. Allocation scale is unrelated to grass spacing, draw distance or the moving stage.

### Eligibility

Pack placement specifies one of:

- **within**: every core cell and its required external guard must lie wholly inside the eligible corridor of at least one selected track.
- **outside**: the core and guard must be outside the exclusion corridor of every track.
- **any**: no track affiliation restriction; all other world exclusions still apply.

All modes reject Wound apertures, protected authored sites, polar entry reservations, incompatible existing assignments and any other mandatory host exclusion. A pack cannot turn those exclusions off.

The host can return NO_ELIGIBLE_AREA only when a conservative cover proves that no eligible area exists. Exhausting a bounded search returns PLACEMENT_SEARCH_EXHAUSTED or a locked continuation; it does not prove absence. Automatic assignment is a deterministic attempt under declared constraints, not a guarantee that every pack fits every world.

## 7 Shade tracks and physical shadows

A **shade track** is the fixed route corridor on the shell over which the planned Shade family travels. Its eligibility mask is independent of current time, moving plate phase, plate destruction and the camera.

The host adapter derives versioned corridor envelopes from the designed world frame, route latitude, Shade shape, cross-track extent, trim and route geometry. It stores an eligible inner envelope and an exclusion outer envelope. The gap between them provides conservative classification and placement clearance.

Physical lighting remains a separate query of the actual star, plates, damage, cavity approximation, atmosphere and selected time. Being under a track does not mean a particular point is dark at every instant. A destroyed plate does not move a Meadow assignment into Industry territory.

For Meadow, within-track means its footprint and guard fit inside the selected track's eligible envelope. For Industry, outside-track means no part of that footprint and guard intersects any outer envelope. Duck Blind settings never participate in either decision.

### Conservative geometry

Testing only cell centres or four corners is insufficient. A cell can cross a corridor or an exclusion between samples.

The host returns a conservative certificate for the entire spherical cell and its geodesic guard. The first adapter uses outward-rounded interval bounds for the cube-sphere patch, route-axis dot products and latitude intervals, recursively tightening uncertain classifications within a fixed quota. It must account for interior extrema and edges, poles and face seams.

The tested halo is the pack transition width plus its minimum placement clearance plus the policy's numerical safety margin, initially 1 metre. The certificate contains the track profile digest, tested cell, halo, classification and numerical bound. Unknown or ambiguous classification is ineligible. Numerical uncertainty cannot be converted into an accepted centre test.

A track profile change requires an explicit world-layout revision and a new assignment plan. Time and cycle playback do not. Changes to radius, axis, waist width, route geometry or protected footprint geometry invalidate the old policy's eligibility certificates; they cannot silently reuse them.

## 8 Allocation algorithm

The allocator works against an immutable input tuple:

~~~text
worldId, worldSeed, hostWorldDigest, hostGeographyDigest, trackProfileDigest,
protectionProfileDigest,
existingBindingDigest, policyDigest, releaseDigest,
semanticGeneratorId, placementRequestKey
~~~

The placement request key is persistent and unique within the world. Repeating the same request against the same input returns the same plan. Timestamps, worker arrival order, installed catalogue ordering, camera position and cache state are excluded from geography.

The algorithm is:

1. Validate the release, host profile and request. Retain exact input identities.
2. Ask the host for a bounded eligible-domain cover. This cover can use conservative track bands and protected-area bounds; it is not a full scan of all shell cells.
3. Generate a fixed number of candidate anchors from the exact area-weighted, keyed sampler in the protocol. The sampler's cover, counter width, integer conversion and tie-break order are locked by allocator revision.
4. For each candidate in stable rank order, classify its cell and guard against all constraints.
5. Grow a connected four-neighbour frontier. Rank eligible frontier cells by decreasing dot product of cell-centre direction with anchor direction, then ascending keyed digest, then numeric face/level/x/y tuple.
6. Stop at the target area only after meeting minimum core area, maximum area, provider domain and transition constraints.
7. Derive shared boundary records and reserve external guards against existing cores and guards.
8. Build the spatial index and overview representation requests. Retain the selected anchor, orientation, actual cell set, area certificate, provider limits and rejection summary.
9. Return an immutable installation plan. Publication is a later atomic operation.

Candidate and frontier work is counted. Logical classification visits count equally whether computed or satisfied by a verified cache, so cache contents cannot change the chosen plan. The default job has at most 4,096 candidate anchors, 65,536 cell classification visits, 4,096 core cells per region and 65,536 total assigned core cells per world. A continuation resumes the same counters within the declared total quota; it cannot choose new random anchors or reset the quota. Extra total work requires an explicit new policy/request.

Workers may compute independent certificates, but accepted cells are consumed in canonical frontier order. A timeout cannot publish whichever worker finished first. Cancellation releases staged leases and leaves the current world head unchanged.

Already published assignments win. A new ordinary install fills unassigned eligible territory. Removal retains a retired reservation while any world or save pins it. Reallocation and replacement require an explicit operation naming the affected regions and expected current binding.

For a fresh multi-pack batch, sort requests by the policy's declared priority and then pack ID and request key. Committed install order may affect which remaining land is available; the journal records that order. The service does not claim that reversing a sequence of different committed installs produces the same map.

## 9 Footprints and boundaries

An assignment's core is a sorted union of allocation cells at one level. The host's address canonicalization owns exact edges and corners. Half-open ownership and numeric cell ordering follow the existing face order.

The core has one assignment owner. External guards reserve space for visual and support preparation. Guards do not grant a second core owner. Guard overlap is rejected unless an explicit compatible boundary record names both assignments and its transition provider.

Region IDs are derived from the world, request key and semantic generator identity. They are not display names, version numbers, browser object IDs or load counters.

A region stores a fixed geographic generator frame, separate from the moving render origin. It records an anchor address and orientation selected once during planning. Every cell of the footprint must remain within the provider's declared angular and metric frame domain.

The first frame profile uses a gnomonic chart in metres, with inward height measured from the host's shell datum. East and north axes are fixed by the region frame; they are not recomputed from the eye. A region may not cross that chart's singularity. A future multi-chart provider requires another declared profile.

### Boundary contract

The allocator does not invent a successful visual blend between arbitrary content families. A boundary record pins both semantic generators, its width, deterministic owner, support composer, appearance composer, connector schema and compatibility profile.

Version 1 supplies a host heightfield transition for compatible terrain bases. Let w be a stable boundary weight in [0,1]. Compose the support surface from the two authoritative samples using the declared smooth weight and derive its normal from that same composed surface. Renderer and collision consume the same composition revision.

Detailed structure, water or road connections require a supported connector profile. Incompatible required connectors prevent allocation beside that region. The allocator may find another eligible location; it may not disable collision, remove structures or report a generic colour fade as a completed connector.

The legacy host surface is a named boundary participant with conservative height and support bounds. Authored Watershed areas remain protected. A compatible base-atlas boundary can receive a transition reservation; the underlying atlas outside assigned territory retains its original meaning.

Phase One proves compatible heightfield transitions and a structure fixture meeting that base. It does not prove all future Grass/Industry ecotones. Unsupported adjacency is explicit and testable.

## 10 World binding and geographic lookup

The world binding is an immutable snapshot containing world identity, an exact host-world snapshot reference, policy and geometry digests, installed registry snapshot, assignments, boundary records and the spatial index digest. A small mutable world-head record selects the active binding.

The retained host-world snapshot supplies the actual radius, axis, layout, static Shade geometry, protected geography and supported host profile. A digest without those retained inputs cannot reconstruct a world. The first service install captures the current validated main world once; later sessions pin that snapshot. Dynamic time, camera and exposure remain separately selected host state.

Every assignment pins its exact release digest, semantic generator, geography and appearance revisions, provider identity, frame, footprint, area proof and boundary IDs.

CPU lookup converts a shell address to its canonical owner and searches a sparse per-face tree. A lookup returns one of:

~~~text
Assigned(regionRef, providerRef, boundaryContext)
BaseSurface(legacyProfileRef)
Excluded(exclusionRef)
Unavailable(reason, pinnedIdentity)
~~~

Unavailable content does not become a different pack or a freshly generated landscape.

The derived GPU overview index uses the same tree. A node contains four uint32 child references. Zero selects base surface; the high bit identifies an assignment table entry; other values identify a child node. Six root references use the existing face order. Node and assignment tables are content-keyed by binding digest and charged to service GPU budgets.

This tree describes area ownership. Detailed terrain, population and wind come from providers. The overview is a filtered representation of those same assignments, not a recoloured unrelated atlas.

CPU ownership is authoritative. GPU overview sampling can have a bounded visual boundary error at coarse pixel footprints, but it cannot supply collision or exact save addresses. The proposed fixture limit is 2 physical output pixels of geographic silhouette displacement at overview scale. This permits filtering, not a moved ownership edge. At readable local scales, the CPU supplies exact assignment and boundary context to local meshes. Face and boundary image tests must establish that tolerance.

The initial tree cap is 262,144 nodes, or 4 MiB for child records, plus bounded assignment metadata. If the index cannot fit, publication fails before changing the head. Truncating regions to fit is prohibited.

## 11 Address units and frame precision

The service retains **SphereWorldAddress schema 2**, levels 0 through 30, including the fixed six-face ordering. Its adapter canonicalizes equivalent directions by round-tripping through the host address profile, verifies revision metadata and preserves the original address separately when a legacy migration is explicit.

The new versioned pack's revisions are held in its assignment reference, not forced into the legacy address's integer revision fields. An observer reference combines:

~~~text
worldBindingDigest + canonical shell address + altitudeM
orientation + movement mode + optional provider state reference
~~~

The main Observatory currently uses kilometres in its world state. The service uses metres in its ABI. Conversion happens once at the host adapter boundary, using explicit field names. The provider never guesses units from magnitude.

Height is positive into the cavity from the shell datum. In the current host world, inward up is minus the outward shell direction. Walking eye height and grass tip height are separate from terrain height. Grass does not become collision merely because it is tall.

Position deltas are computed in double precision before converting to GPU floats. Frame rebasing changes render coordinates only. It preserves canonical addresses, generator coordinates, feature IDs, semantic hashes and geographic wind samples.

Fixture support and rebase comparisons use a proposed 1 mm local tolerance. Exact address ownership, pack identity and feature identity are discrete and must match exactly. This tolerance is a new service fixture criterion; it does not replace another programme's frozen precision or performance limits.

## 12 Provider interface

The complete ABI reference is [provider protocol](../../../work/biome-pack-service-design-2026-10-10/PROTOCOL.md). Its core methods are:

~~~text
describeCapabilities() -> ProviderDescriptor
validateRecipe(recipe, manifest) -> ValidatedRecipe
sampleSurface(query, semanticContext) -> SurfaceSamples
prepare(request, semanticContext, quotas, signal) -> PreparedLease
render(passContext, preparedLease) -> SubmissionReport
snapshotPersistentState() -> ValidatedProviderState
release(preparedLease) -> ReleaseReport
dispose() -> ReleaseReport
~~~

sampleSurface is bounded and deterministic. prepare may use workers and progressive outputs, but each completed output retains the requested semantic context and generation. Stale outputs are rejected and released.

Providers receive an immutable semantic context and a separate frame context:

| Semantic context | Frame context |
|---|---|
| World and assignment identity, provider and recipe digests | Eye and floating render origin |
| Canonical address range and fixed generator frame | Projection, lens, viewport and output purpose |
| Host datum, physical lighting snapshot and selected time | Residency demand, bounded preparation allowance and resource lease |
| Boundary record, support composition and stable wind domain | Frame ID and request generation |
| Provider state revision | Rendering time budget and capture latch |

Frame IDs, queue order and the eye cannot seed content. Wind is sampled from geographic positions and host time. A provider may offer a declared atmosphere or concealment treatment; it cannot change the authoritative star direction, clock or direct visibility result.

The host owns scheduling, worker admission, RAF, timers, camera controls, browser events, media tracks, resource accounting and persistent storage. A provider cannot start another animation loop or take over the document.

### Representation readiness

Overview, surface and detail are required tiers. All tiers name the same generator and semantic input. Readiness includes visual coverage, solid support, conservative bounds and valid persistent state. A ready image alone does not prove solid ground.

The old valid representation stays resident until its full replacement is ready. Peak accounting includes both, staging allocations and pending GPU use. A failure leaves the old view or a declared coarse representation visible and travel held safely.

Handoffs use geographic coverage and projected readability. They do not introduce a universal circular distance boundary for every provider. The service owns lifetime and coverage; the provider owns the visual representation and its accepted parameters.

## 13 Rendering and collision in the main application

Phase One adds a provider slot to the main Renderer. The existing context, frame scheduler and output target remain the owners. Providers render through bounded leases and an explicit pass interface. They restore required GL state and never clear or resize an unrelated target.

There is one authoritative sky and global shell context. A local provider may supply concealed-sky presentation, terrain and detail, but ascent reveals the actual assigned location in the host Sphere. It must not draw a separately oriented fictional Sphere above its local scene.

At overview altitude, the host uses the binding index and provider overview data. During approach it prepares surface and detail around the observer. Near ground, support queries and rendered terrain use the same generator and boundary composer. Away from assignments, existing main-world rendering remains on its legacy path.

The first native provider profile supports heightfields and static triangle/box structure collision. A later multilayer industrial district, moving machinery, fluids or navigation network must advertise and prove additional capabilities. The core ABI is extensible, but support is not implied by a descriptive biome label.

The terrain maximum used for collision-free level flight must be a conservative bound over the flight corridor and applicable transitions. It cannot be the maximum of a few nearby height samples. If a future corridor has unknown bounds or incompatible structures, the controller holds or requests a supported flight policy.

Phase Two preserves Meadow's existing distinction: terrain is solid; grass tips are passable. The accepted level cruise may graze grass while remaining above terrain. Structure collision is controlled by the host movement profile and cannot be disabled by a pack's visual shader.

## 14 Travel and continuous movement

All named visits use the existing SphereTravelTransaction owner. Service readiness becomes part of its preparation and ready predicates. The dependency set includes world binding, assignment, provider and boundary revisions. A concurrent change cancels or reprepares the request.

The transaction prepares the target while retaining or reacquiring departure support. Its final synchronous commit activates the validated observer reference, provider leases and navigation history together. There is no await between final readiness validation and in-memory arrival commit.

Continuous walking and flight query the binding at the observer's next corridor, prepare ahead of motion and update the eye-following stage. Crossing a compatible boundary changes content ownership through the shared transition record; it does not navigate to another document.

Prepare lookahead is at least two seconds of admitted travel at the current speed and includes stopping distance, controller footprint, preparation tail and safety margin. If the corridor cannot be ready in time, reduce admitted speed or hold before entering it. Do not move preparation outside measured work or move the landscape toward the observer.

Movement profiles distinguish walking, manual flight, terrain-following cruise and level cruise. Providers supply conservative solid-height/obstruction bounds; the host controller owns the route and safety response. Level cruise uses a fixed selected flight height above the admitted route's solid ceiling, including static structures when present. Grass tips are non-solid. If a future region has a higher ceiling, the host holds before it or explicitly changes the route/height profile; it cannot quietly turn level cruise into terrain-following flight. Phase Two maps Meadow's existing controls into these profiles while preserving their accepted local behavior.

Visit, approach, pointer selection, manual descent and re-entry resolve the same assignment. Location names are projections of geographic lookup. Changing a camera mode does not change region identity.

A retired assignment pinned by an older saved binding remains resolvable. A newer installed world does not silently reinterpret that saved address. The UI offers continuing the pinned world or a separate explicit migration.

## 15 Duck Blind and lighting

Duck Blind is a presentation capability, not a placement service and not a physical Shade.

The service supplies physical star direction, finite-source visibility, Shade identity and motion, exposure settings, declared cavity approximation and host time. The provider supplies its approved concealment/reveal profile and any declared local service-light treatment.

For Meadow, the Phase Two descriptor may retain the provisional 100 km Duck Blind altitude. Dimming and ordinary-sky concealment end through the declared reveal transition; once outside, the view uses the host Sphere. The service must not dim the whole Dyson interior as a substitute for night.

For Industry, presentation.mode is none. Installation, approach, walking and ascent must work with no Duck Blind assets, parameters, UI or reveal route.

Lighting and concealment are tested independently. Changing the selected physical time may change illumination but cannot relocate or reseed terrain. A matched Meadow appearance comparison holds pose, lens, light, exposure and wind phase constant.

## 16 Ingestion and discovery

The browser cannot enumerate the server's pack directories. Discovery uses a generated same-origin catalogue plus the local installed registry. Adding a release updates catalogue data or imports a transport; it never requires a hardcoded application destination.

Catalogue availability is separate from installation. A discovered release does not acquire territory until an install action targets a world under its policy.

Two inputs are supported in the first implementation:

1. A same-origin catalogue record naming exact release and manifest resources.
2. A local bounded ZIP containing release.json, manifest.json and declared assets.

Catalogue responses and fetched resource bytes are verified and retained. The runtime consumes the retained verified bytes, not a later unverified fetch of the same URL. Redirects that leave the permitted origin or path are rejected.

ZIP ingestion runs in an admitted decoding worker. It rejects duplicate or colliding paths, links, encryption, unsupported compression, excessive counts, per-entry limits, expanded-size limits, compression-ratio limits, undeclared files and traversal before activation. Limits apply to actual expanded bytes, not only headers. The implementation must lock the decoder version and prove cancellation and memory bounds.

The first transport profile accepts only ZIP methods 0 and 8, no multi-disk or ZIP64 input, at most 256 MiB compressed archive bytes, 64 MiB expanded bytes per resource, 256 MiB expanded resource bytes in total and a per-entry expansion ratio at most 1,000. Empty entries use an explicit zero-length case rather than division by zero. Manifest and release records are capped separately at 1 MiB and 64 KiB. Manifest assets plus these two records bound the entry count. These limits belong to the host policy; a pack cannot raise them. No archive content is written to the server filesystem.

Provider code is supplied by the host extension catalogue. Imported assets may include reference source only when declared as inert reference material; it is never executed. A release requiring an unavailable provider returns UNSUPPORTED_PROVIDER with no assignment.

The release store retains verified immutable data keyed by payload and resource digest. Dependencies are resolved by exact digest within the store or permitted bundled catalogue. Dependency cycles are rejected. Resource dependencies do not install their own regions implicitly.

Ingesting the same exact payload twice is idempotent. Reusing a pack ID and display version for different payload bytes is a version conflict. Different releases may coexist; a saved assignment never resolves a version range to latest.

## 17 Persistent storage and atomic publication

Use a new IndexedDB database named **sphere-biome-service-v1** scoped to the Observatory's origin and browser profile. Browser ports are different origins; another study server does not share this database automatically.

| Object store | Key and contents |
|---|---|
| resources | Resource digest; verified asset/proof/index/state bytes and reference accounting |
| releases | Payload digest; raw manifest, validated descriptor and verification record |
| releaseStatus | Payload digest; mutable lifecycle revision and retirement flag |
| hostWorlds | Immutable digest; validated static host world parameters and exact geometry/profile references |
| registrySnapshots | Immutable digest; installed release projection for one world binding |
| worldBindings | Immutable binding digest; assignments, boundaries and derived-index identity |
| worldHeads | World ID; active binding digest, revision and registry reference |
| installPlans | Plan digest; locked inputs, certificates, staged output references and terminal outcome |
| sessions | Session ID plus state revision; immutable binding-aware observer and validated provider state |
| sessionHeads | Session ID; latest state revision/digest, updated by expected-revision comparison |
| views | Immutable complete view snapshots for bookmarks, history, captures and session references |
| operations | Operation ID; idempotency key, expected heads and committed result |

Resource ingestion and plan preparation may use many bounded transactions. Their records remain unreferenced staging until publication. They cannot become the active world simply because all assets arrived.

The first install uses an expected absent head and stages a revision-zero empty base plus the complete revision-one assigned binding. A single create-world publication retains both and publishes only the assigned head. Competing tabs derive the same target world identity from the static host inputs; one wins and the other replans. Available verified releases are global to the origin, while installed projections belong to specific world bindings.

Publication uses one short readwrite transaction over registrySnapshots, worldBindings, worldHeads, installPlans and operations, with retained resources, releases, releaseStatus and hostWorlds included in its read scope. It rereads expected heads and release lifecycle revisions, verifies the staged references and writes the complete new immutable binding and head. No network, worker, GPU preparation or unrelated await occurs inside this transaction. Concurrent retirement and garbage collection share the relevant transaction scopes and cannot invalidate a checked dependency between validation and commit.

The IndexedDB transaction provides an atomic group of database writes. The service's in-memory renderer activation is subsequent and recoverable; it is not a second database half-commit. Transaction completion is the publication acknowledgement. See [IndexedDB transaction lifecycle](https://www.w3.org/TR/IndexedDB-3/#transaction-lifecycle).

Before publication, the current tab prepares a ready handoff to the new binding or a valid paused departure with retained support. After durable commit, it swaps the in-memory binding at a frame boundary. If that swap fails or the page closes, reopening resolves the committed head and stays held until required resources are ready. It does not overwrite the new head with the old view.

The committing operation retains its caller session, departure view and an activation-pending recovery intent in the same publication transaction. Boot resolves any committed pending intent for that session before ordinary autosave: prepare the committed binding at the retained compatible observer, activate it, then acknowledge activation. It never guesses success from an old session pointer. Other tabs and unrelated saved sessions may keep their explicitly pinned old bindings.

Only an operation explicitly requesting rollback may publish the retained previous binding as a new revision. Ordinary cancellation after the durable commit reports already committed.

Multi-tab correctness comes from expected-head comparison inside the serialized database transaction. Notifications through BroadcastChannel or storage events are advisory. Another tab may continue its pinned binding; it must not combine old provider state with a new index. Session writes retain their explicit binding reference and never change the world head.

Browser storage can be unavailable, cleared or evicted. A cleared database is absence, not a valid recovered world. The old legacy app remains usable; installed-world restoration refuses to invent replacement assignments. Export is the durable recovery path beyond origin-local storage.

## 18 Installation lifecycle

Separate release state, plan state, world publication and active rendering.

| State | Meaning |
|---|---|
| available | Advertised by a catalogue; unverified and unassigned |
| staged | Exact descriptor and resource bytes retained; no active assignment |
| verified | Structural, semantic, asset and compatibility checks pass |
| planned | Footprints, boundaries, index, budgets and expected heads are fixed |
| prepared | Current-tab departure and initial view handoff are ready |
| committed | Complete registry and world binding durably published |
| active | Current tab has prepared and activated that binding |
| retired | No new assignments; pinned references remain supported |
| failed or cancelled | Explicit terminal attempt retained without false activation |

The public Install action performs verify, plan, prepare and commit automatically under the world's configured policy. The UI shows progress and the actual assigned area. It has a cancel action before commit.

Installation of a second release never changes an existing region's release digest. Update requires an explicit migration plan naming old/new identities and affected saved state. Display-version equality is not semantic equivalence.

Uninstall retires a release and prevents new assignments. It cannot delete data referenced by active or saved bindings. Garbage collection is a separately bounded operation over proven unreferenced staging and derived caches; it never deletes the sole copy of a pinned release.

Version 1 keeps every published binding and its dependencies pinned by the publication journal. It has no automatic age-based deletion of published worlds. This deliberately avoids guessing whether another tab or an exported save still needs an old place. Collection handles unreferenced staging and rebuildable caches only; capacity exhaustion refuses further admission. A future explicit world-forget/compaction operation needs its own reference and recovery contract.

## 19 Saves exports and compatibility

The existing sphere-session-v1 key and old scene records remain intact. A world with no service binding uses the legacy codec. Opting into the service creates a new session record in IndexedDB; startup must complete its asynchronous lookup before applying that observer state.

A service session pins the world binding, canonical observer address, altitude, orientation, movement profile, provider snapshots, selected time and presentation settings. Camera velocities and automatic cruise start stopped on restoration, following existing safe resume behavior. A stored route can be resumed by a separate user action.

Provider state is bounded data validated by the pinned provider's admitted codec. It contains no live worker handles, frame IDs, GPU objects, timers, cache readiness or render origins. The service is the storage owner.

Version 1 supports persistent local provider state through this codec. It does not claim the broader Foundry event-reducer/wound-history system. A pack requiring that unavailable capability fails negotiation.

Saved bookmarks and the current observer are distinct records. Bookmarks and history carry a digest of a retained complete view snapshot, including orientation, movement profile, selected time, presentation and provider state. Their duplicated address and binding fields must agree with that snapshot. A provider state update, view snapshot and referencing session publish together in one session transaction; a snapshot cannot name a state revision that was never retained.

Session writes compare the expected session-head revision, retain the new immutable session revision and advance only that session's pointer. Competing writers receive a stale-session result rather than overwrite another tab's snapshot. A session pointer never selects a world head. Startup resolves the explicit session pointer, retaining its pinned binding even when the current world head is newer.

Exports have two scopes:

- **World save**: exact world snapshot, binding, policy, observer and provider state plus release digests. Import requires those exact releases to be installed or supplied; missing releases are reported before state replacement.
- **Portable world bundle**: the same save plus all required pack data resources, within declared bundle quotas. A target host must still have the admitted provider extensions and capabilities. Portability does not imply arbitrary executable plugin installation.

Import stages all required content and validates world/profile compatibility before changing any head or observer. Interrupted import leaves the previous state intact. An older accepted Meadow study save may be migrated in Phase Two only through an explicit adapter. Out-of-footprint coordinates, incompatible frames or unsupported state are refused; they are not clamped into a different place.

## 20 Resource and scheduling limits

Registration and geographic lookup are separate from expensive provider preparation. Planning and ingestion run in workers where supported, with bounded batches and cancellation. Per-frame work consumes an explicit service quota alongside existing renderer work.

Proposed initial limits are:

| Limit | Pilot value | Enforcement |
|---|---:|---|
| Manifest bytes | 1 MiB | Reject before parse |
| Expanded resources per release | 256 MiB | Count actual retained/expanded bytes |
| Expanded bytes per resource | 64 MiB | Reject before retaining oversized entry |
| ZIP bytes and expansion ratio | 256 MiB and 1,000 per entry | Count actual streamed input/output |
| Assets per release | 4,096 | Reject excess inventory or archive entries |
| Installed release records | 64 | Retain old pinned releases; refuse additional admission at capacity |
| Regions per world | 128 | Reject an oversized plan |
| Cells per region and per world | 4,096 and 65,536 | Count before index publication |
| Classification visits per plan | 65,536 | Stop with resumable checkpoint or explicit exhaustion |
| Metadata tree nodes | 262,144 | At most 4 MiB child records |
| Service metadata CPU including peak replacement | 32 MiB | Count old, new, staging and index storage |
| Service metadata GPU including peak replacement | 10 MiB | Count both 4 MiB tree banks plus assignment metadata |
| Provider state per assignment | 1 MiB | Reject before snapshot publication |
| World binding serialized bytes | 16 MiB | Reject before write |
| Planning batch | At most 256 classifications | Yield and inspect cancellation after each batch |
| Per-frame service maintenance CPU p95 | 0.5 ms | Matched native fixture measurement |
| Incremental service overview GPU p95 | 0.5 ms | Matched native fixture measurement with valid timer samples |

These are proposed service limits and must be tested on the actual Observatory host. They are not measurements or revised H1 limits. Provider budgets are charged in addition to service metadata and against the admitted host aggregate cap. Main renderer residency, workers, buffers, textures, collision, capture, staging and replacement remain visible in the full accounting.

Budget admission must consider simultaneous boundary providers and replacement peaks. It may reject or hold preparation; it cannot reduce accepted Meadow population or move timed work outside the measurement window.

No full-Sphere detailed geometry is generated at install. The service publishes sparse ownership and coarse representations. Detailed stages remain bounded around demand. The cost of visiting more unique cells should remain bounded by current demand and declared cache limits, rather than accumulate every visited grass patch.

## 21 Errors and recovery

All public failures carry a stable code, operation ID, relevant pinned identities, phase, recoverability and a readable explanation. Diagnostics must not change geographic inputs.

| Code | Required behavior |
|---|---|
| INVALID_DESCRIPTOR | Reject parsing or semantic mismatch before registration |
| UNSUPPORTED_CONTRACT | Preserve existing world; identify required contract |
| UNSUPPORTED_PROVIDER | Do not execute pack source or allocate land |
| UNSUPPORTED_CAPABILITY | Report the required feature; do not silently omit it |
| RESOURCE_CORRUPT or RESOURCE_MISSING | Quarantine staged reference; keep old binding |
| VERSION_CONFLICT | Preserve both attempts; do not overwrite the installed artifact |
| NO_ELIGIBLE_AREA | Retain verified release without committed placement |
| PLACEMENT_SEARCH_EXHAUSTED | Report bounded search failure without claiming that no land exists |
| PLACEMENT_QUOTA_EXHAUSTED | Retain locked continuation or fail explicitly |
| AREA_GRANULARITY_UNSUPPORTED | Refuse area bounds that permitted cells cannot satisfy |
| BOUNDARY_INCOMPATIBLE | Seek another eligible footprint or refuse the plan |
| DOMAIN_OUT_OF_RANGE | Reject unsupported frame/address; never wrap or clamp |
| BUDGET_EXCEEDED | Deny allocation, retain supported departure and report charged owners |
| STALE_WORLD_HEAD | Discard publication attempt; require replanning against the new head |
| STALE_SESSION_HEAD | Preserve both views; require explicit retry against the retained session revision |
| WORLD_PROFILE_CHANGED | Retain old binding; request explicit layout revision |
| STORAGE_UNAVAILABLE or STORAGE_QUOTA | Preserve current state and offer export |
| PREPARATION_FAILED or CONTEXT_LOST | Hold travel and retain/rebuild the same pinned representation |
| SAVE_INCOMPATIBLE or PROVIDER_STATE_CORRUPT | Preserve the last valid save; refuse reinterpretation |
| CANCELLED or ALREADY_COMMITTED | Report the actual durable outcome |

Recovery distinguishes before publication from after publication. Before publication, release unreferenced staging and keep the old head. After publication, restore the committed identity or remain safely held. A pretty fallback view must not conceal that recovery has failed.

## 22 User experience

The public flow belongs in the existing Explore panel:

1. Open **Biome Packs** and choose an available release or import a pack.
2. Select **Install**. The service validates and assigns territory under the current policy.
3. Show **Installed**, the assigned area and a short location description, such as “Along the Verdant shade track.”
4. Choose **Visit**, or approach the footprint through the Sphere.
5. Walk, fly, save or return through existing Observatory controls.

Technical digests, certificates, quotas and extension details belong in an optional inspection view and exportable report. The main flow explains failures in plain language.

Installed, available, unavailable provider, failed install and retired are distinct labels. A failed pack must not be shown as installed because its ZIP was read successfully.

Industry's flow contains no Duck Blind controls. Meadow's supported concealment and cruise modes appear from capability-driven UI. The menu is a view of the registry and assignments, not a second source of world identity.

## 23 Requirements and verification mapping

The following IDs are proposed local service requirements. They do not reuse IB, HR or Foundry lifecycle IDs.

| ID | Obligation | Conformance tests |
|---|---|---|
| BPS-R01 | Generic core operates with no Meadow installed | BPS-T01, BPS-T24 |
| BPS-R02 | Compatible install automatically registers and assigns | BPS-T02, BPS-T25 |
| BPS-R03 | Discover packs through catalogue/store, without directory enumeration or hardcoded destinations | BPS-T03 |
| BPS-R04 | Validate bounded descriptor structure and semantic relations | BPS-T04 |
| BPS-R05 | Pin exact descriptor, resources and dependencies | BPS-T05, BPS-T06 |
| BPS-R06 | Reject arbitrary executable entrypoints | BPS-T07 |
| BPS-R07 | Negotiate provider, ABI, graphics and capabilities | BPS-T08 |
| BPS-R08 | Idempotent ingest and explicit version conflict | BPS-T09 |
| BPS-R09 | Host owns authoritative placement | BPS-T10 |
| BPS-R10 | Meadow eligibility uses fixed track corridors | BPS-T11 |
| BPS-R11 | Industry stays outside all track corridors | BPS-T12 |
| BPS-R12 | Eligibility covers whole cells and guards | BPS-T13 |
| BPS-R13 | Protect wounds, authored sites and polar reservations | BPS-T14 |
| BPS-R14 | Deterministic bounded connected allocation | BPS-T15, BPS-T16 |
| BPS-R15 | Respect area limits, granularity and provider domain | BPS-T17 |
| BPS-R16 | Preserve existing assignments and retained reservations | BPS-T18 |
| BPS-R17 | Store exact footprint and canonical edge ownership | BPS-T19 |
| BPS-R18 | Share geographic ownership between CPU and overview | BPS-T20 |
| BPS-R19 | Publish a complete binding atomically | BPS-T21 |
| BPS-R20 | Recover correctly before and after commit | BPS-T22 |
| BPS-R21 | Detect stale heads across tabs | BPS-T23 |
| BPS-R22 | Expose actual assigned regions in the main world | BPS-T24, BPS-T25 |
| BPS-R23 | Same provider semantics across altitude tiers | BPS-T26 |
| BPS-R24 | Keep stage rebasing separate from geographic identity | BPS-T27 |
| BPS-R25 | Explicit metre/kilometre and inward-height conversion | BPS-T28 |
| BPS-R26 | Keep wind, physical time and shadows geographic | BPS-T29 |
| BPS-R27 | Duck Blind is optional and distinct from placement/light | BPS-T30, BPS-T31 |
| BPS-R28 | Use one host renderer, scheduler and sky context | BPS-T32 |
| BPS-R29 | Rendered terrain and collision agree | BPS-T33 |
| BPS-R30 | Retain support until replacements are ready | BPS-T34 |
| BPS-R31 | Existing travel transaction remains commit owner | BPS-T35 |
| BPS-R32 | Prepare and limit continuous travel safely | BPS-T36 |
| BPS-R33 | Compatible boundaries have shared support and ownership | BPS-T37 |
| BPS-R34 | Unsupported connectors refuse allocation | BPS-T38 |
| BPS-R35 | Persist sessions, bookmarks and history against exact bindings | BPS-T39 |
| BPS-R36 | Preserve legacy records and restoration | BPS-T40 |
| BPS-R37 | Updates, imports and missing releases never reinterpret places | BPS-T41, BPS-T42 |
| BPS-R38 | Resource leases include replacement and aggregate residency | BPS-T43 |
| BPS-R39 | Cleanup releases clocks, jobs, CPU/GPU and browser handles | BPS-T44 |
| BPS-R40 | Fixture performance measures all timed work under fixed limits | BPS-T45 |
| BPS-R41 | User UI shows truthful installation and optional features | BPS-T46 |
| BPS-R42 | Native evidence uses public app paths and retained source identities | BPS-T47 |
| BPS-R43 | Two content families prove shared core independence | BPS-T48 |
| BPS-R44 | Preserve accepted Meadow, prior evidence and existing servers | BPS-T49 |
| BPS-R45 | World profile changes require explicit layout revisions | BPS-T50 |
| BPS-R46 | Cancellation and stale worker outputs cannot publish partial worlds | BPS-T51 |
| BPS-R47 | Portable data does not imply executable extension portability | BPS-T52 |
| BPS-R48 | Integrity and document checks remain separate from runtime conformance | BPS-T53 |

The complete test inputs, expected outcomes and required evidence are in [conformance.json](../../../work/biome-pack-service-design-2026-10-10/conformance.json). Every runtime test is initially NOT_RUN.

### Required fixture families

**Track Meadow fixture** is a small heightfield with three fixed-height landmarks, one simple population, geographic wind and optional concealment. It uses within-track placement. It is a test provider, not the accepted Meadow.

**Open Industry fixture** uses a solid base, static blocks, a service passage and an overhead beam. It uses outside-track placement and no Duck Blind. It verifies structure support and clearances without implying finished industrial content.

Both fixtures have overview/surface/detail representations, deterministic feature IDs, static support, bounded state and cleanup. Test them separately, together, in reversed fresh-batch order, around face seams and poles, beside compatible base surface, under moving physical Shadows, and through save/reopen.

Negative fixtures cover corrupt assets, unsafe archive entries, unsupported providers, missing capabilities, impossible placement, narrow corridors, guard intersections between sampled corners, dependency cycles, stale heads, resource exhaustion and failure at every publication stage.

### Native qualification

Use the public main-app flow: Explore → Biome Packs → Install fixture → Visit. Repeat by approaching the assigned footprint through normal flight rather than using a private injected scene.

Retain matched overview, approach, descent, eye-level, grazing-flight, boundary and ascent captures. Test full turns, a pole, a cube-face seam, changing time, pausing, cancellation, reload and context loss. Inspect support and silhouette stability separately from appearance.

Measure fixed native routes with service disabled and enabled against the same base world and viewport. Each quiet timing window has at least 900 complete frames after declared warmup; recording and screenshot capture are separate from timing. Report CPU stages, valid GPU samples, frame intervals, uploads, allocation peaks, workers, queues and cancelled work. Missing timer support is UNMEASURED, not zero.

Run all standard Observatory regressions and new service suites against fresh source identities. Frozen historical fixture files and failed evidence remain unchanged. Passing service tests does not close the older HR-09/H1 programme or establish the Phase Two Meadow's native performance.

## 24 Phase One implementation sequence

| Step | Deliverable | Exit criterion |
|---|---|---|
| BPS-P01 | Adopted records, semantic validator and host/provider profile adapters | Positive and negative records agree with the contract; current source bindings reconciled |
| BPS-P02 | Verified store, catalogue and ingestion | Exact resources, idempotency, cancellation and unavailable-provider behavior pass |
| BPS-P03 | Track/protection certificates and deterministic allocator | Both placement families, guards, area bounds, seams, quotas and prior-region preservation pass |
| BPS-P04 | Binding store, sparse index and atomic publication | Fault injection and multi-tab expected-head tests retain complete valid snapshots |
| BPS-P05 | Native renderer/support/provider slots and fixture providers | Main overview and local views resolve the same actual assigned surfaces |
| BPS-P06 | Travel, continuous movement, location and capability-driven UI | Public install/visit and boundary routes use existing commit ownership |
| BPS-P07 | Binding-aware sessions, export/import, retirement and recovery | Legacy saves survive; exact service states reconstruct and missing releases refuse safely |
| BPS-P08 | Full native qualification and delivery record | All scoped conformance obligations and resource limits pass with retained source and preservation evidence |

Each step can retain partial evidence, but Phase One completion requires all eight exits. Steps do not authorize changing accepted Meadow artwork or closing older programme gates.

The implementation handoff names likely files and ownership points. It is a plan for new code, not a claim that proposed modules already exist.

## 25 Phase Two handoff

Phase Two begins only after the service contract and native fixture integration are implemented and verified.

Create a new Meadow release; do not edit infinite-meadow 1.0.0 or its sealed reference evidence. Its provider adapter receives the host context and submits through the host renderer. Its existing controller stops owning RAF, global camera, independent clock, storage and document navigation.

Wrapping is a meaningful integration task. The delivered Meadow currently creates a WebGL context and renders its own sky and Sphere. Those responsibilities must be adapted to the host while preserving its accepted terrain, grass, lighting response and stage behavior under matched conditions. A new manifest around the old independent HTML page does not satisfy Phase Two.

Map fixed generator coordinates into the assigned shell frame. Give overview and local terrain the same semantic source, keep landmarks at actual addresses, import study saves only within declared domains, and preserve both current view and distinct bookmark.

Required Meadow proof is: install → automatic within-track assignment → main overview → approach → descent → walk → terrain cruise → level cruise → reveal actual host Sphere → return to the same place → save/reopen. Native appearance comparison and source retention establish the quality floor. Faint accepted grass handoffs remain recorded rather than being silently retuned.

Industry then tests the same installed-world contract with different content, outside-track assignment, ordinary host sky and no Duck Blind. Its art and advanced machinery are subsequent content work.

## 26 Decisions and remaining implementation checks

The design selects a local static-server plus browser database architecture, exact data payloads, host-admitted provider extensions, canonical shell-cell allocation, conservative fixed track masks, persistent assignment ownership, atomic world-head publication and in-document native traversal.

The following are implementation checks rather than permission questions or unresolved ownership choices:

| Check | Required resolution |
|---|---|
| Track certificate mathematics | Implement outward-rounded bounds and prove seam/pole/interior-extremum fixtures |
| Main renderer provider slot | Measure GL-state restoration, shared sky/depth and overview/local matching |
| Browser database behavior | Verify quota, transaction abort, interrupted boot and multi-tab races on this host |
| ZIP decoder and schema engine | Select exact supported versions, retain locks and prove bounded behavior |
| Legacy datum and protected masks | Bind real host geometry revisions and conservative support bounds |
| Resource profile | Verify proposed limits against actual aggregate allocation and native timing |
| Meadow wrapper | Phase Two must demonstrate matched appearance; success is not implied by ABI compatibility |

No test result is invented for these checks. An implementation that fails one retains the failure and stops the affected dependent claim.

## 27 References and delivered artifacts

- [World Address v2](Observatory-World-Address-02.md).
- [Existing Biome Packs programme](Observatory-Biome-Packs.md).
- [Delivered Meadow Pack 01](Observatory-Meadow-Pack-01.md).
- [Proposed Foundry Contract](C:/Users/Joe/Documents/Codex/2026-09-25/referenced-chatgpt-conversation-this-is-an-2/outputs/Sphere_Biome_Foundry_Contract.md), particularly C-02 through C-04, C-09, C-13 through C-15 and C-21 through C-23.
- [Proposed Foundry Technical Requirements](C:/Users/Joe/Documents/Codex/2026-09-25/referenced-chatgpt-conversation-this-is-an-2/outputs/Sphere_Biome_Foundry_Technical_Requirements.md).
- [JSON Schema draft 2020 12 core](https://json-schema.org/draft/2020-12/json-schema-core). Companion schemas describe record structure; service semantic validation remains mandatory.
- [IndexedDB transaction lifecycle](https://www.w3.org/TR/IndexedDB-3/#transaction-lifecycle). The design relies on supported transaction semantics, not adoption of experimental API additions.
- [Artifact index](../../../work/biome-pack-service-design-2026-10-10/README.md), with schemas, examples, protocol, implementation test specification, handoff and design/preservation checks.

Phase One completion means a real Observatory service can ingest, register, place, visit and recover two supported content families at persistent shell addresses without biome-specific core changes. Phase Two completion means the accepted Meadow has actually passed through that service and retained its quality in the Sphere.
