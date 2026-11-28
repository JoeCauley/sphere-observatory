# 27 Orchard Street, apartment 1A

Seed 713, world `sphere-ed6a59ab491a9a08`. The standard outside-track allocator selects the unoccupied plot `r14c14` at 23.333333° N, 75.6° W from the City–Marsh expedition. The installed instance is `infinite-new-york`. The block, building, apartment and furnishing slot are `orchard-01/27/1A/dining-chair`.

| Owner | Durable fields | Write |
| --- | --- | --- |
| Pack | Architecture, room origin and allowed positions A and B | Versioned geometry |
| Atlas | Installed instance, plot, named traveler poses | Install, mark |
| Browser profile | Last manual camera pose and explicit camera bookmark in this world and instance | Save, retire |
| Local world service | Last accepted room-local chair pose and yaw, revision and action receipts per furnishing | Confirm placement |
| Active visit | Carry, preview, held keys | Temporary |

Room coordinates start on the finished floor at the rear left corner. A faces east at the table. B faces the front window, 3.71 m from A and a quarter turn clockwise. The complete furnishing key has six components and excludes both camera coordinates and pack version. Looking up an untouched chair derives its initial pose from the pack.

The expedition branches from `0274c787042e6578ac985e5438193f38aa541f2f`. QA and the pilot use independent copies of the installation register and its five station records. Pilot port 8852 and QA port 8854 belong to this checkout.

## Local tester

Open `I:\Sphere\Launch-New-York-First-Apartment.cmd`. On ALPHA the pilot uses `http://127.0.0.1:8852/?apartment=1A`. The launcher verifies the served checkout and register before opening its dedicated browser profile. If ordinary Chrome exits during startup in a managed Windows shell, the local Playwright driver opens the installed browser in that same profile. The explicit entry starts at the sidewalk mark on every launch and reads the chair from that register.

Walk with WASD and drag to look. Stand beside the chair and use the visible pickup button or E. Approach the other position until the place control is enabled. E confirms, and Esc cancels a preview. Camera & travel saves and restores a profile-local viewpoint. Explore → Atlas places → 27 Orchard Street · Sidewalk returns to the numbered stoop.

For a fresh expedition, create sibling `pilot` and `qa` directories beside the checkout. Copy the City–Marsh `installed-biomes.json` and `installed-biomes.json.border-atlas` directory into each. The first open installs the pack through the same allocator used by Explore. Normal relaunches reuse the original register. The QA option on the same launcher uses port 8854.

## Verification

`npm run test:apartment:model` exercises the storage contract on an isolated HTTP server. `npm run test:apartment:browser` exercises on-foot handling, competing tabs, an actual Meadow trip, service restart and both camera restore paths. The tests use temporary profiles and registers by default. To record a field visit on a seeded QA copy, set `SPHERE_APARTMENT_QA_STORE` to its register, set `SPHERE_APARTMENT_EVIDENCE` to a capture directory, and run `node tests/apartment-browser.cjs --film`.

The room's walls, openings and walk heights come from the same geometry used for collision. The renderer owns the block and chair meshes, the filtered material array and a depth texture. Retiring a visit releases its WebGL objects. A fresh visit loads the accepted pose before declaring its first frame ready.
