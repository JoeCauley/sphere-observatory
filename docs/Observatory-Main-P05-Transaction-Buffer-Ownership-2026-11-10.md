# Main publication · transaction buffer ownership

10 November 2026. **Install/location/persistence behaviors pass; formal P-05 remains OPEN.** Joe requested a bounded continuation toward P-05 and explicitly authorized design changes and new ideas. The work builds on the owner-adopted Main delivery plan and completed-allocation handoff, preserving the historical private sources and their failures.

## Design

The preceding Main adapter reserved four times a complete returned row, then another four times the complete write row. Publication updates a resource's metadata with `bytes: resource.bytes`: both JavaScript wrappers refer to the same actual ArrayBuffer. The new versioned adapter retains source-buffer identity for the full transaction and separately reserves each write's database copy. It does not recycle capacities or presume garbage collection.

| Retained item | Admission and lifetime |
| --- | --- |
| Incoming row and orchestration workspace | Existing 8 MiB reservation remains live through owner disposal. Row size stays bounded to 1 MiB. |
| Source payload buffer | Two full backing-buffer capacities per distinct ArrayBuffer identity. The source set roots every admitted buffer until transaction settlement. A small typed-array view pays for its whole backing buffer. |
| Database write | Two full capacities per serialized payload write, even for repeated writes using the same source object. Each charge remains until complete/abort. |
| Row, strings and callback/identity metadata | Existing fourfold structural estimate plus identity bookkeeping and the shared budget's ownership-record charges. |
| Abort or cap refusal | The actual database abort rolls back all queued writes. The wrapper releases its complete transaction charges only after the backing promise settles. |
| Result after settlement | The caller's existing bounded working slot and retained service owners cover readback results; no source or copy charge is retired during an active transaction. |

All owners still use the unchanged 33,554,432-byte common metadata budget. These are conservative logical declarations, not measurements of native heap or IndexedDB implementation memory. No physical memory saving or full service GPU qualification is claimed.

The new files are bounded-storage.v1.js, Main install-v3, browser boot-v4 and service profile-v3, plus their generator and scoped tests. Only bootstrap.js and main-install-ui.js changed among the 89 inventoried existing runtime inputs. Allocator, handoff, binding-builder-v2, publication-v2, original implementations, pilot policy, provider/codec closure and every Track Meadow 1.0.0 release byte remain unchanged. The exact tested 99-file selection and prior copies are retained in [the WORK](../../../work/p05-publication-20261110-060541/README.md).

## Browser result

Ordinary Main at http://127.0.0.1:8879/ started without a published head or assignment. One normal Install click verified and published Track Meadow 1.0.0 at its allocator-selected eligible place. A new tab opened the identical root URL after closing the first tab and recovered the same identities. Repeating Install returned Already installed with zero writes.

| Observation | Value |
| --- | --- |
| World | world-554946f1d04cf486a939e70770b13f92 |
| Payload | 82d3def0955d5f042ad4e41569ad400cc2d47e55be7c008ec4d63a8377da87ce |
| Binding | d804c1e5bf5abae3a1de2dcd39ed96a322138d11e2c09f4396ed88f5336d73bb |
| Assignment | region-5a0b0af51532e115d553154106a5c8d1; face 0 / level 14; first cell 12912,12124 |
| After install, reopen and repeat | One installation, one region, the same 59 distinct cells |
| Aggregate logical peak | 21,422,637 B |
| Publication transaction requested peak | 9,939,754 B |
| Repeat writes | 0 |

[Browser data and screenshots](evidence/p05-publication-20261110-060541/README.md) retain the actual UI record. Automation only used Main controls and read the existing Installation details text. It did not write browser storage, supply placement or pose, use a location URL, or replace Main with another scene.

Validation used a new unused origin with observed empty storage in the existing Chrome Work profile. It did not demonstrate a newly created dedicated profile. A separate profile launch was rejected by automatic approval with only “blocked by policy” reported; the supported browser route preserved existing origin-local saves. The in-app browser lost its graphics context during startup; Chrome completed the actual checks. These limitations are recorded in the evidence.

## Scoped checks and remaining gate

Buffer identity/write-copy/lifetime/cap/abort/disposal checks pass. Browser boot loads 31 classic modules and refuses 35 missing namespaces plus the missing lifecycle member. Component installation/readback/repeat tests pass with both the allocator helper's world and Main startup settings. Unchanged publication-v2 passes all 385 transaction fault positions in eight groups with 394 expected refusals. The fresh evidence verifier checks exact source pins, prior preservation, release and assignment identities, readback, zero-write repeat and the unchanged cap.

Formal P-05's exit remains: **Main overview and local views resolve the same actual assigned surfaces.** The new browser result displays an assignment; it does not yet render or provide ground support for that installed fixture. Start the next bounded implementation with Track Meadow through Main's renderer and existing travel owner, then exercise Open Industry. Keep whole-view/fragment/support correctness and GPU ownership explicit. P06-P08 exits, owner acceptance, release and real-pack adaptation are not established by this result.
