# Rendering and authoritative simulation

**Scope:** The independent Sphere Observatory browser application. This note applies only to that browser scene and does not alter the outer Sphere Unreal simulator's requirements or status.

> Rendering may use stage tricks freely: LOD, impostors, skyboxes, culling, compressed visual distances and seamless transitions. The authoritative simulation keeps the real dimensions, positions, distances and physical relationships that govern movement, interactions and the environment. Visual shortcuts must stay consistent with that underlying world.

This clarification separates visual representation from authoritative world state. It does not relax or replace any existing numerical precision, world-coordinate or physical-relationship requirement, resource or performance budget, readiness threshold, verification gate, acceptance criterion, evidence requirement, or recorded implementation status, failure, or blocker. Existing Observatory criteria and status reports remain controlling; this note does not imply a pass or waive a gate. The outer Unreal simulator is documented separately in `I:/Sphere/docs/Rendering-and-Simulation-Clarification.md`.
