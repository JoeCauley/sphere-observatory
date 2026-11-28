// Render one pixel per receiver under a damaged Shade. Red is the production
// footprint and green is the production finite-star eclipse at that location.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.SPHERE_PLAYWRIGHT || 'playwright');
const { executable } = require('./support/biome-browser.cjs');

async function run() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPHERE_BROWSER || executable() });
  try {
    const page = await browser.newPage();
    const modules = ['math', 'collection', 'biomes', 'world-palette', 'biome-packs', 'world', 'field-sites',
      'watershed-network', 'watershed-province', 'watershed-neighbourhood', 'shaders', 'shader-sections',
      'collection-shader', 'biome-shader', 'world-shader', 'neighbourhood-shader', 'surface-lighting',
      'silhouette-aa', 'station-shader-performance', 'geometry-renderer', 'volume', 'sphere-atlas', 'biome-surface'];
    for (const name of modules) await page.addScriptTag({ path: path.join(__dirname, '..', name + '.js') });
    const results = await page.evaluate(() => {
      const M = SphereMath, C = SphereCollection, gl = document.createElement('canvas').getContext('webgl2');
      const source = SphereBiomeSurface.assemble(SphereShaders.fragment, SphereAtlas);
      const fragment = source.slice(0, source.lastIndexOf('void main(){')) + `
uniform int probePlate;
uniform float probeRadius;
uniform bool probeShadeReceiver;
void main(){
  vec2 offset=vUV*2.-1.,uv=offset;
  uv.x*=uDiskAcross[probePlate];
  vec3 right=uDiskRights[probePlate].xyz, up=cross(uDiskNormals[probePlate].xyz,right);
  vec3 hit=uDisks[probePlate].xyz+uDisks[probePlate].w*(right*uv.x+up*uv.y);
  vec3 receiver=normalize(hit);
  if(probeShadeReceiver){
    float selected=visibleReceiverLight(1,receiver,vec3(0.),length(hit),probePlate);
    float back=visibleReceiverLight(1,-receiver,vec3(0.),-length(hit),probePlate);
    fragColor=vec4(collectionLightExcept(receiver*length(hit),probePlate),selected,back,1.);return;
  }
  float nearBank=localStructuralShadeMargin(offset*probeRadius,int(uDiskRights[probePlate].w));
  fragColor=vec4(float(diskSolid(uv,probePlate)),collectionLight(receiver),float(nearBank>=0.),
                 visibleReceiverLight(0,receiver,receiver,1.,probePlate));
}`;
      const { p: program, u: uniforms } = SphereGLProgram(gl, SphereShaders.vertex, fragment);
      const width = 52, height = 48, pixels = new Uint8Array(width * height * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(program);
      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.DITHER);
      gl.viewport(0, 0, width, height);
      const counts = { probes: 0, maskMismatches: 0, lightMismatches: 0, grazingSamples: 0, localMismatches: 0, hingeMismatches: 0,
        rowJoinProbes: 0, rowJoinMismatches: 0, receiverMismatches: 0, localSolid: 0, localOpen: 0,
        dark: 0, penumbra: 0, openSun: 0 };
      const examples = [], parents = new Set();
      for (const shape of ['disk', 'square', 'cap', 'trimmed']) {
        for (const samples of [7, 19]) {
          const state = { ...M.defaultState(), collection: true, time: 91451, era: 'after',
            starStation: false, shadeShape: shape, shadowSamples: samples };
          const plates = C.plates(state);
          C.upload(gl, uniforms, state, [0, 0, 0]);
          gl.uniform1f(uniforms.uRadius, state.radius);
          gl.uniform1f(uniforms.uStar, state.starRadius / state.radius);
          gl.uniform1i(uniforms.uLayout, state.layoutVersion);
          gl.uniform1i(uniforms.uMode, samples === 7 ? 0 : 5);
          for (const [index, plate] of plates.entries()) {
            if (plate.damage !== 2) continue;
            parents.add(plate.id);
            const tear = SphereWorld.shadeFracture.regions(plate.id).find(region => region.id === 'arrested-tear');
            // Rebase on a tear flank. Pick its middle on the side opposite the branch.
            const anchor = tear.points[1].map((n, k) => (n + tear.points[2][k]) / 2);
            gl.uniform4fv(uniforms['uFracturePlanes[0]'], SphereWorld.shadeFracture.offsets(...anchor, plate.id));
            gl.uniform1i(uniforms.probePlate, index);
            gl.uniform1f(uniforms.probeRadius, 2e-10);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            const whole = { ...plate, damage: 0 };
            for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
              const u = ((x + .5) * 2 / width - 1) * plate.size * plate.across;
              const v = ((y + .5) * 2 / height - 1) * plate.size;
              if (!C.diskContains(u, v, whole)) continue;
              const point = M.add(plate.center, M.add(M.mul(plate.right, u), M.mul(plate.up, v)));
              const solid = C.diskContains(u, v, plate);
              const sunlight = C.visibility(M.mul(M.norm(point), state.radius), state, samples);
              const k = (y * width + x) * 4;
              const wrongMask = (pixels[k] > 127) !== solid;
              // Decode discrete star samples before comparing with CPU. RGB8
              // conversion may round either way inside a single quantization bin.
              const gpuSamples = Math.round(pixels[k + 1] * samples / 255), cpuSamples = Math.round(sunlight * samples);
              let wrongLight = gpuSamples !== cpuSamples;
              if (wrongLight && Math.abs(gpuSamples - cpuSamples) === 1) {
                // A stellar limb ray can graze a panel while the orbital receiver
                // is rounded in float32. Only allow the sample if a CPU receiver
                // within 16 float32 ulps of plate UV reproduces the GPU result.
                const eps = 16 * 2 ** -23;
                const offsets = [-eps, 0, eps];
                const reproduced = offsets.some(dx => offsets.some(dy => {
                  const neighbour = M.add(point, M.add(M.mul(plate.right, dx * plate.size * plate.across), M.mul(plate.up, dy * plate.size)));
                  return Math.round(C.visibility(M.mul(M.norm(neighbour), state.radius), state, samples) * samples) === gpuSamples;
                }));
                if (reproduced) { wrongLight = false; counts.grazingSamples++; }
              }
              const nearU = anchor[0] + ((x + .5) * 2 / width - 1) * 2e-10;
              const nearV = anchor[1] + ((y + .5) * 2 / height - 1) * 2e-10;
              const localSolid = SphereWorld.shadeFracture.margin(nearU, nearV, plate.id) >= 0;
              if (localSolid) counts.localSolid++; else counts.localOpen++;
              counts.localMismatches += (pixels[k + 2] > 127) !== localSolid;
              counts.maskMismatches += wrongMask;
              counts.lightMismatches += wrongLight;
              counts.receiverMismatches += pixels[k + 1] !== pixels[k + 3];
              if ((wrongMask || wrongLight) && examples.length < 6)
                examples.push({ shape, samples, id: plate.id, x, y, solid, sunlight, gpu: Array.from(pixels.subarray(k, k + 2)) });
              counts.probes++;
              if (solid && sunlight === 0) counts.dark++;
              if (!solid && sunlight === 1) counts.openSun++;
              if (sunlight > 0 && sunlight < 1) counts.penumbra++;
            }
            // Coincident boundaries between the adjoining tear polygons must
            // transmit light at the exact common section, including close up.
            const mouth = SphereWorld.shadeFracture.regions(plate.id).find(region => region.id === 'seam-mouth');
            const hinge = mouth.points[2].map((n, k) => (n + mouth.points[3][k]) / 2);
            gl.uniform4fv(uniforms['uFracturePlanes[0]'], SphereWorld.shadeFracture.offsets(...hinge, plate.id));
            gl.viewport(0, 0, 1, 1);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            counts.hingeMismatches += pixels[2] > 127;
            gl.viewport(0, 0, width, height);
            if (shape === 'disk' && samples === 7) {
              const model = SphereWorld.shadeFracture;
              const bank = model.regions(plate.id).find(region => region.id === 'released-bay');
              // Cover every slope-to-flat join, for every load frame, over the
              // full local window. The real camera can sit on either side.
              for (const [j, vertex] of bank.points.slice(1, -3).entries()) {
                const radius = model.localRadiusUV;
                const x0 = vertex[0] + (j % 2 ? .21 : -.23) * radius;
                const y0 = vertex[1] + (j % 2 ? -.17 : .19) * radius;
                gl.uniform4fv(uniforms['uFracturePlanes[0]'], model.offsets(x0, y0, plate.id));
                gl.uniform1f(uniforms.probeRadius, radius);
                gl.drawArrays(gl.TRIANGLES, 0, 3);
                gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
                  const dx = ((x + .5) * 2 / width - 1) * radius;
                  const dy = ((y + .5) * 2 / height - 1) * radius;
                  const solid = model.margin(x0 + dx, y0 + dy, plate.id) >= 0;
                  counts.rowJoinMismatches += (pixels[(y * width + x) * 4 + 2] > 127) !== solid;
                  counts.rowJoinProbes++;
                }
              }
            }
            if (samples === 7) {
              gl.uniform1i(uniforms.probeShadeReceiver, 1);
              gl.drawArrays(gl.TRIANGLES, 0, 3);
              gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              for (let k = 0; k < pixels.length; k += 4)
                counts.receiverMismatches += pixels[k] !== pixels[k + 1] || pixels[k + 2] !== 0;
              gl.uniform1i(uniforms.probeShadeReceiver, 0);
            }
          }
        }
      }
      gl.deleteProgram(program);
      // These two plate-local points trade places between the historical and
      // revised break. Sample the weather passes' own shadow function, including
      // its diffuse light floor, in both the local and distant cloud programs.
      const weatherSamples = {};
      gl.viewport(0, 0, 1, 1);
      for (const pass of ['march', 'far']) {
        const weather = SphereVolume[pass];
        const probe = weather.slice(0, weather.lastIndexOf('void main(){')) + `
uniform vec2 probeUV;
void main(){
  float sunlight=weatherSun(normalize(vec3(probeUV,1.)),0.);
  scattering=vec4(vec3(sunlight),1.);transmission=vec4(0.);
}`;
        const { p, u } = SphereGLProgram(gl, SphereShaders.vertex, probe);
        gl.useProgram(p);
        SphereWorld.shadeFracture.upload(gl, u);
        gl.uniform1f(u.radius, 1);
        gl.uniform1i(u.weatherShadeCount, 1);
        gl.uniform1i(u.weatherShadeShape, 0);
        gl.uniform1f(u.weatherStarAngle, .001);
        gl.uniform4f(u['weatherShadeRight[0]'], 1, 0, 0, 0);
        gl.uniform4f(u['weatherShadeSize[0]'], 1, 1, .5, 0);
        weatherSamples[pass] = [0, 1, 2].map(damage => {
          gl.uniform4f(u['weatherShadeNormal[0]'], 0, 0, 1, damage);
          return [[.86, -.34], [.4, .7]].map(([x, y]) => {
            gl.uniform2f(u.probeUV, x, y);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels[0];
          });
        });
        gl.deleteProgram(p);
      }
      return { counts, parents: Array.from(parents), examples, weatherSamples, glError: gl.getError() };
    });
    console.log(JSON.stringify(results));
    assert.equal(results.glError, 0);
    assert(results.parents.length > 2 && results.counts.probes > 10000);
    assert(results.counts.dark && results.counts.openSun && results.counts.penumbra);
    assert(results.counts.localSolid && results.counts.localOpen);
    assert.equal(results.counts.maskMismatches, 0);
    assert.equal(results.counts.lightMismatches, 0);
    assert(results.counts.grazingSamples < results.counts.probes / 1000);
    assert.equal(results.counts.localMismatches, 0);
    assert.equal(results.counts.hingeMismatches, 0);
    assert(results.counts.rowJoinProbes > 200000);
    assert.equal(results.counts.rowJoinMismatches, 0);
    assert.equal(results.counts.receiverMismatches, 0);
    for (const samples of Object.values(results.weatherSamples))
      assert.deepEqual(samples, [[8, 8], [8, 255], [255, 8]]);
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
