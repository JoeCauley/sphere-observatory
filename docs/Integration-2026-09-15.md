# Observatory integration status · 15 September 2026

Implemented in the independent `sphere-observatory` checkout on `codex/sphere-integration`, based on reviewed commit `5cdb0985691a99b2068ce4c01e7157b6cab7677a`. The parent Sphere repository and Unreal requirements are unchanged. This is a local integration preview, not a published release.

## Delivered foundation

- **Travel transaction:** Places, pointer/G, Return, exact coordinates, saved viewpoints/imports, overview shortcuts, field sites, Watershed links and staged studies use the coordinator. Preparation validates declared world dependencies; explicit navigation/cancellation or a newer submitted trip invalidates pending work. Draft browsing and idle pose updates do not.
- **Ownership and recovery:** Candidate walking-controller construction is separate from activation. A departure with connected terrain or walking support uses an explicit temporary hold because the current ground provider has one active neighbourhood. Other departures, including moving Shades, continue running. Destination and recovery work serialize; departure support is prepared before resuming after a failed/cancelled request. If recovery itself fails the view stays held and Retry remains available.
- **Commit:** Current user exposure, speed, quality, playback, weather and lens preferences survive ordinary travel unless a camera preset explicitly owns its framing. Attached Shade poses are resolved in the current parent frame. Saved scenes and Return restore their saved world/clock while preserving playback and speed preferences. Return consumes an entry only after commit.
- **Destination routes:** Shared arrival descriptors and API availability expose all six Watershed presets plus separate On foot. The 6 m terrace stays in flight. Ruin/Wounds before the attack explain unavailability and link to World. Polar walking is explicitly bounded; Shade arrivals are close flight.
- **Identity and pins:** Composition, parent and geographic identity drive the location strip, history and capture titles. Identity is reevaluated on actual geographic departure, with composition boundary hysteresis. Marks retain shell/geometry or parent-relative Shade addresses through settling, rotation, resizing and parent motion. Invalid marks clear their label and tooltip together; failed trips retain marks.
- **Interface:** Explore / Journey / World / Capture, persistent location and Return, one visible clock, World illumination/weather, Instruments, quiet-view recovery and a narrow bottom sheet. Existing specialist controls keep their IDs/handlers and are reachable in World disclosures. Tab roles, arrow-key navigation, status announcements and focus restoration are implemented.
- **Persistence:** Session schema 2 stores journey schema 1 with at most 24 previous visits. Schema-1 sessions still load. Invalid history entries are skipped independently. Portable scene schema and explicit terrain/geography/art/Shade revisions are unchanged. Storage errors do not stop travel.
- **Timing:** Local movement receives real elapsed time in steps at most 1/60 second, capped at 250 ms per frame. Excess movement time is dropped; world time and attached parent transport consume the remaining interval. Hidden-tab pause remains. Frame interval statistics and dropped time are exposed through `SphereTiming.diagnostics`. Local available-speed reads do not accelerate the controller.
- **Capture:** Photo and panorama have separate progress/cancel/error state and retain playback. Motion studies build staged candidates without visiting them or appending history. Normal exports include semantic identity, title, source SHA-256, reviewed commit, local modification status and asset manifest identity and a SHA-256 identity for all 45 asset files through the updated local server. Scene state retains all representation revisions. The build is never labelled a release merely because package version is 1.5.0.
- **Renderer maintenance:** Named shader sections assert integration slots. Modern, legacy and geometry-primary GLSL are byte-identical to the reviewed baseline, checked against retained fingerprints. Upload allocation/byte counters and exceptional synchronous upload time supplement complete draw CPU timing. WebGL2 and CPU/GPU geometry contracts remain.

## Control migration inventory

| Control group | Visible destination | Travel ownership |
|---|---|---|
| Places, seven Watershed arrivals | Explore | Transaction, current world |
| Mark, Go, G | Scene / Explore marked summary | Transaction, anchored address |
| Return, chronological trail | Location strip / Journey | Transaction, saved world and clock |
| Bookmarks, import/export | Journey | Transaction for restoration; original portable formats |
| Coordinates, lens, speed, rotation | Explore → Exact address, lens & speed | Coordinate transaction; explicit rotation intent |
| Overview / Shade fleet / Wounds / Star | Explore → Overview | Transaction |
| Original study views, staged lighting, field expeditions, old Watershed selector | World → Specialist destinations & staged scenes | Transaction adapters; staging remains explicit |
| Era, play, scrub, rate | Persistent clock | Same state owner; no independent console clock |
| Weather and illumination studies | World | Same world state |
| Geometry, generation, atlas link, engineering, legacy model | World disclosures | Existing handlers; incompatible changes cancel travel |
| Sampling, materials, quality, atmosphere | World → Rendering quality & advanced lighting | Existing handlers |
| Measurements and exports | Measure area / Instruments | Original measurement subsystem retained |
| Photo, panorama, motion, save viewpoint | Capture | Capture state, conflict guard and original viewpoint store |

The browser export gate writes an exhaustive ID/label/panel inventory to `work/integration/control-inventory.json`.

## Verification

- Original **32 suites passed before edits**. Final **34 numerical suites pass**, including new transaction/timing/session tests and byte-identical shader assembly checks. Two existing tests were updated for deliberate contracts: seven categories and unsupported Wound arrivals, and explicit activation after pure candidate construction.
- `tests/integration-browser.cjs` exercises **visible controls with the real frame loop**: cold forest, settle/look/resize/anchored Go, receiving lake, failed Return and Retry, running Shade, delayed departure/Return, live preference changes, draft selection, incompatible era change, all seven Watershed choices and persisted Return after reload. Capture cancellation/failure and layouts at 1440×900, 1024×768, 390×844 and 844×390 are included. No internal busy flag or destination setter is used to bypass the journey.
- `tests/integration-export-browser.cjs` checks actual photo/panorama downloads and metadata, playback restoration, supported program compilation, tab keyboard navigation, quiet-view recovery and the effective 200% CSS viewport. That effective viewport is a layout fixture, not certification of every browser zoom implementation.
- Evidence is retained under `docs/evidence/integration-2026-09-15/`; raw working screenshots and records are under `work/integration/`.
- Browser hardware observed: Chrome / ANGLE Direct3D11 / NVIDIA GeForce RTX 5080. Cold forest preparation in the final journey run was about **37.2 s**; receiving-lake preparation was about **2.2 s**; warm Watershed presets were about **33–35 ms**, and walking about **482 ms**. These are observed preparation latencies, not a hardware performance guarantee. Initial browser loading/driver work remains expensive.

Run `npm test`, then `npm run test:integration` against a locally running server. Set `SPHERE_URL`, `SPHERE_BROWSER` and `SPHERE_PLAYWRIGHT` when needed. The browser tests also accept a configured package path via `NODE_PATH`.

## Remaining plan gates

This change delivers the coherent travel/UI foundation and implements the bounded timing, capture and shader-maintenance foundations. The complete multi-milestone plan is **not finished**:

1. **Timing/readiness acceptance:** Cold worker/asset budget stress across representative hardware, complete input-to-response measurements, explicit safe/coarse/complete provider tiers and an agreed end-to-end frame-time target remain. Synchronous safety fallbacks are retained and now measured; the source upload budget is not treated as an end-to-end limit.
2. **Strict cold-capture repeatability:** The existing diagnostic remains unresolved. Settled captures, metadata and shader equality do not certify exact cold PNG replay.
3. **One deeper place:** The receiving-lake shore/promenade and 300×300 m ramp/stair/bridge/underpass/stacked-floor/low-ceiling traversal benchmark are not added in this foundation change. Render/collision acceptance must precede broad environment expansion.
4. **Later moving-surface milestones:** Connected polar arrivals and walking both Shade faces remain separate work. Existing bounded polar and close-flight Shade modes are labelled accurately; historical revisions are preserved.
5. **Broader release certification:** The full registry matrix over representative seeds/radii, unavailable-storage browser cases, all old browser suites and exhaustive accessibility/performance certification remain broader gates. The targeted gates above state exactly what was exercised.

No commit, push, release publication or Unreal migration was performed.
