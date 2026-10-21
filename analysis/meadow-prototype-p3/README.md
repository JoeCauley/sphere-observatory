# Meadow P3 diagnostic prototype

Status: **target unmet, unpromoted**. The goal is a complete moving meadow with complete vegetation preparation MAX ≤ 2 ms. No production code, canonical placement, numeric cap, readiness rule or accepted appearance has been changed.

Read [the P3 report](../../docs/Observatory-Meadow-Prototype-P3-2026-10-05.md) and `last-run.json` first. The configuration points to an isolated runtime and fresh evidence directory. P1/P2 source and evidence remain pinned separately.

The fixed visual candidate is P2's experimental 12-stem volume. `submission-p3.js` uses ordered typed membership and reusable candidate/range pools. `supply-p3.js` memoizes registered exact generated/normalized windows. Its four-window, 1 m forward-retention experiment failed a return-to-origin warm-up at the unchanged total record limit. `bounded-supply-p3.js` narrows retention to at most two exact horizontal windows at the same row, with no forward prefetch. It changes neither current demand coordinates nor readiness flags. Receipt/hash validation, record uploads, native per-record selection, 65,536-reference work quantum, fences and commit/retirement remain original.

To reproduce the final diagnostic in a fresh owned browser, use the retained configuration. Do not rerun `prepare.cjs` over a historical runtime or reuse a phase name inside the same host. The host creates a new evidence folder and freezes sources. It enters through Explore → Watershed / Open meadow → Meadow study / on foot → Visit, then holds the app for direct renderer replay of the historical H1 poses. This is not an ordinary-app H1 protocol.

```powershell
node analysis/meadow-prototype-p3/run-p3.cjs --skip-baseline
```

Wait for `P3 READY`. Issue one command at a time and wait for `P3 READY` again. The first command loads the supply adapter while leaving it disabled; the second loads and selects the bounded policy.

```powershell
node analysis/meadow-prototype-p3/command-p3.cjs bootstrap-supply p3 load=supply-p3.js variant=typed routes=stationary frames=1
node analysis/meadow-prototype-p3/command-p3.cjs bounded-oracle p3 audit load=bounded-supply-p3.js variant=bounded routes=walk,turn-elevation frames=900
node analysis/meadow-prototype-p3/command-p3.cjs bounded-quiet p3 variant=bounded routes=stationary,walk,turn-elevation frames=900
node analysis/meadow-prototype-p3/command-p3.cjs p2-paired-quiet p2 routes=stationary,walk,turn-elevation frames=900
node analysis/meadow-prototype-p3/command-p3.cjs bounded-trace p3 trace variant=bounded routes=walk,turn-elevation frames=900
node analysis/meadow-prototype-p3/command-p3.cjs p2-images p2 images routes=walk,turn-elevation frames=900
node analysis/meadow-prototype-p3/command-p3.cjs bounded-images p3 images variant=bounded routes=walk,turn-elevation frames=900
node analysis/meadow-prototype-p3/command-p3.cjs finish
node analysis/meadow-prototype-p3/audit-p3.cjs
```

The one-frame bootstrap is setup, not performance evidence. Oracle and method traces include observer work. Image runs encode every thirtieth draw and cannot establish timing or cadence. Only quiet runs contain neither duplicate oracle nor PNG encoding. All work in the normal preparation telemetry remains charged. Failures retain their own source freeze and state snapshot where available; early failures did not have the later snapshot mechanism. The host owns only its newly launched browser/server and leaves existing servers alone.

Report all 900 moving frames, all route-start preparation and the worst preparation frame. Do not substitute p95 for the MAX limit, treat a rendered still as ready coverage, promote an old geometric snapshot to the current demand version, relax any cap, remove receipt/filter work from timing, or infer H1/appearance/ownership acceptance from diagnostic completion.

Required work remains in P3: bounded incremental receipt admission and geographic/view reference updates that keep up with movement. The current native filter/bank transaction is still not such an implementation. The report retains failure evidence and the observed limits rather than claiming that target is achieved.
