# First implementation session · Install Track Meadow in Main

Work in `I:/Sphere/repositories/sphere-observatory`. Implement and demonstrate milestone 1 of the [owner-approved Main delivery plan](Observatory-Biome-Pack-Main-Delivery.md). Use the real Track Meadow service fixture. Finish this session at the pass condition or the stop rule below.

## What Joe must be able to do

1. From a fresh, dedicated browser profile, open the ordinary Observatory Main URL. Track Meadow is available to install and this world has no installed Track Meadow assignment.
2. Click **Install** once in Main. Verify the exact release, let the existing allocator select an eligible shade-track location, and publish the world binding through the real storage path. Show the installed release and assigned place in Main. A readable location listing is enough for this milestone.
3. Record the world ID, exact release ID/version and payload digest, published binding identity, and assigned region/cell identity or set. Close the Main tab. In a new tab, type the same ordinary URL on the same origin in the same profile. Main must recover the same values from durable storage and display the same installed place without another install.
4. Invoke **Install** for the same release again through the UI. Show the existing installation or an “Already installed” result. Verify that exactly one installation exists and the original placement has no duplicate regions or cells. If the UI labels an installed release differently, provide an ordinary way to exercise the repeat request.

Use a normal browser and Main's actual controls. Keep the user's existing profile, saves and reference builds intact. A local server on an unused port and a disposable profile are suitable. Keep the origin stable across the close/reopen test. The observer may read identities and counters. Test code must never write the assignment, populate storage, inject a pose, supply a location in the URL, or substitute a separate scene for Main.

## Where to start

Trace the shortest production route from Main's pack UI through release verification, placement, atomic publication and startup readback. Start with [the Main pack UI](../pack-library.js), [the catalogue](../packs/catalogue.v1.json), [registry](../biome-service/registry.js), [allocator](../biome-service/allocator.js), [binding builder](../biome-service/binding-builder.js), [publication](../biome-service/publication.js) and [Track Meadow provider](../biome-service/native/providers/fixture-track-meadow.js). The historical P01–P04 tests and their [implementation ledger](Observatory-Biome-Pack-Service-Implementation-Ledger.md) show which pieces already worked. Verify the current callers before changing them. If Main lacks an installable fixture entry, package one real, versioned, verifiable Track Meadow release through the supported catalogue or ingestion path.

Build the smallest complete route. Keep verification, automatic placement, atomic publication, idempotency and the 33,554,432-byte service metadata limit. Keep allocation and the UI free of fixture-specific coordinates or a special “installed” flag. Preserve prior releases, Watershed saves, the shared-world walk, other edits and sealed evidence. Use an isolated development copy if needed. Give Joe a repeatable ordinary Main launch path for the result.

If storage retention is the cause of failure, a versioned implementation may release or transfer completed working storage. Identify every remaining reader and the owner of the durable result. Demonstrate the memory charge through overlapping lifetimes and test any affected cancellation, rollback and retry paths. An alternate path must enforce the cap it uses. Do not raise it, disable a refusal or assume garbage collection pays the charge.

## Evidence and stopping

Capture a small browser record of the clean state, installed location, reopened location and repeat-install result. Include the visible UI, before/after identity values and counts, tested source identity and normal launch instructions. State how the touched path enforced the cap and what targeted checks ran. Distinguish logical reservations from any physical memory measurements. Keep broader formal qualifications on their own ledger.

On **PASS**, link the evidence beside Track Meadow's Install, Locate and Reopen entries in the delivery scorecard. Keep Visit and saved-view restoration open. Stop before milestone 2.

If the ordinary route fails, record the first reproducible failing operation, expected and actual behavior, exact evidence, and one materially different design explanation with a test that could disprove it. If browser execution itself is unavailable, report **NOT DEMONSTRATED** and its actual cause. On either outcome leave undemonstrated scorecard entries open and stop. One later attempt may test a materially different explanation. A repeat at the same boundary ends the implementation loop and returns the architecture decision to Joe.

Report **PASS**, **FAIL**, or **NOT DEMONSTRATED** and the shortest steps Joe can use to see the result. An improved decoder count, a component-only pass, a screenshot of the shared world, or another verified handoff cannot satisfy this milestone. The old private P05 Goal, model routing, time cutoffs and sealing routine are historical.
