# Integration preview · historical implementation notes

This preview was incorporated into [v1.6.0](v1.6.0.md), alongside the Wound repair and performance pass. The notes below describe the pre-publication integration.

The travel/UI foundation is implemented locally: transactional arrivals and recoverable Return, anchored marks, semantic place names, the complete Watershed route, persistent Journey, four panels, one clock and capture provenance. Bounded movement substeps and checked shader assembly accompany it.

See [integration status and verification](../Integration-2026-09-15.md) for delivered behavior, test evidence and the outstanding performance, cold-capture and environment gates. The package remains version 1.5.0; normal exports identify this checkout as locally modified. This document does not announce a release or change the historical v1.5.0 release record.

A follow-up [Wound-edge repair](../Wound-edge-repair-2026-09-15.md) removes detached terrain slabs and collision floors from the openings.

The [traversal performance pass](../Observatory-Performance-2026-09-15.md) addresses frame pacing, terrain-worker cancellation, repeated CPU work and GPU shading costs. It includes measured before/after routes, native and adaptive 4K checks, and image/capture verification.
