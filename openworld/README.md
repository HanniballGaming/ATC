# LEITSTELLE DEUTSCHLAND – Open World integration contract

Branch: `leitstelle-openworld-development`. Do not merge into `leitstelle-deutschland-release` until the acceptance checks pass.

## Modules and load order

1. `openworld/geo-core.js` – geographic projection, GeoJSON import, spatial tiles.
2. `openworld/three-city.js` – optional Three.js road/building geometry.
3. `openworld/vehicle-core.js` – independent fixed-step vehicle state.
4. `openworld/life-core.js` – independent player needs, finances, shift flags.

The first module exports `window.LDOpenWorldGeo`; subsequent modules export `window.LDOpenWorldRenderer`, `window.LDOpenWorldVehicle` and `window.LDOpenWorldLife`.

## Integration example (not yet wired to the production game)

```js
const origin = { lon: 10.8985, lat: 48.3705 }; // Augsburg reference origin
const data = await fetch("/cities/augsburg.geojson").then(r => {
  if (!r.ok) throw new Error("Missing Augsburg GeoJSON");
  return r.json();
});
const model = LDOpenWorldGeo.loadGeoJSON(data, origin);
const view = LDOpenWorldRenderer.create(THREE, scene, { tileSize: 256, radius: 2 });
view.setModel(model);
const car = LDOpenWorldVehicle.create();
car.reset({ x: 0, z: 0, handbrake: false });
let accumulator = 0;
function simulationFrame(deltaSeconds, input) {
  accumulator = Math.min(accumulator + deltaSeconds, 0.25);
  while (accumulator >= 1/60) {
    car.step(1/60, input);
    accumulator -= 1/60;
  }
  const p = car.snapshot();
  view.update(p.x, p.z);
}
```

## Non-negotiable quality requirements

- Never claim a city is geographically accurate without an identified, licensed geodata source and date.
- GeoJSON input must contain coordinates in longitude/latitude (EPSG:4326).
- The city renderer currently uses a flat ground plane; elevation and collisions are **not** implemented.
- Tile assignment currently uses first-vertex ownership. Features crossing multiple tiles can disappear when their owner tile is outside the loaded neighborhood. Fix with clipped or independently indexed geometry before production.
- Building heights default to an estimate when data is missing.
- The vehicle module models planar kinematics, **not** suspension, tire slip, collision, or traffic laws.
- `life-core.js` does not yet calculate payroll or rent and is not integrated into shift operations.
- Run smoke checks in an actual JavaScript runtime and verify mobile performance before merging.
- Keep real dispatch simulation state separate from open-world state until versioned integration interfaces are defined.
- No real emergency calls, private residence details, or security-sensitive facility interiors should be exposed from raw data.

## Acceptance checklist

- [ ] Import and validate legally usable Augsburg data
- [ ] Render roads and buildings with correct orientation and dimensions
- [ ] Correct multi-tile feature loading
- [ ] Walking controller and vehicle entry/exit
- [ ] Vehicle collisions and road surface alignment
- [ ] Real locations for relevant public facilities
- [ ] Stable save migration and shared game clock
- [ ] iPad touch input and measured performance
- [ ] End-to-end integration with v0.22
- [ ] Tests and release review

## Release safety

The Render static site currently deploys the release branch. This development branch does not deploy automatically to the public URL. Do not modify the Render build command or release branch from this module development track.
