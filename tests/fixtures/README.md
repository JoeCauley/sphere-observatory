# Fixed capture scenes

`polish-scenes.json` contains four deterministic v1.4 Wound and Shade camera states used for renderer comparisons. These are benchmark scenes, not a saved personal browser session. They were extracted from the original polish review capture so fresh source downloads do not need ignored local output files.

With the local server running and Playwright available:

```sh
node tests/polish-capture-browser.cjs
node tools/capture-polish-4k.cjs
```

Run them sequentially. `SPHERE_URL` selects the local server; `SPHERE_PLAYWRIGHT` and `SPHERE_BROWSER` can select a local Playwright package and browser executable. Results are generated under `work/screenshots/polish/4k/`.
