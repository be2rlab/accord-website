// The map viewer: one camera over one or two panes (side by side, or stacked on a tall screen), each holding a cloud,
// the laser scan and the trajectory. The clouds come from scripts/build_site.py (see decode below).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ERROR_RANGE_M = 255 * 0.002;                    // a stored distance of 1.0 (byte 255), as build_site.py stores it

const hex = h => `vec3(${[1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)).join(', ')})`;
const ramp = (name, stops) => `vec3 ${name}(float t) {
  t = clamp(t, 0.0, 1.0) * ${(stops.length - 1).toFixed(1)};
${stops.slice(0, -1).map((s, i) => `  if (t <= ${(i + 1).toFixed(1)}) return mix(${hex(s)}, ${hex(stops[i + 1])}, t - ${i.toFixed(1)});`).join('\n')}
  return ${hex(stops[stops.length - 1])};
}`;
// The paper's distance colours: on the scan the map is dark, off it turns red. Height: viridis.
export const DISTANCE_STOPS = ['#27323f', '#3d4a58', '#b8862f', '#e2571f', '#c2161a'];
const HEIGHT_STOPS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
export const SCAN_COLOUR = '#9fb0c6';

const VERTEX = `
attribute vec3 rgb;
attribute float err;
uniform float uSize, uScale, uPixelRatio, uSaturation, uHasRgb, uHasErr;
uniform int uMode;
uniform vec2 uHeight;
uniform vec3 uFlat;
varying vec3 vColour;
varying float vZ;
${ramp('distanceRamp', DISTANCE_STOPS)}
${ramp('heightRamp', HEIGHT_STOPS)}
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * uScale * uPixelRatio;
  vZ = position.z;
  int mode = uMode;
  if ((mode == 0 && uHasRgb < 0.5) || (mode == 1 && uHasErr < 0.5)) mode = 3;
  if (mode == 0) vColour = rgb;
  else if (mode == 1) vColour = distanceRamp(err * ${ERROR_RANGE_M.toFixed(3)} / uSaturation);
  else if (mode == 2) vColour = heightRamp((position.z - uHeight.x) / max(uHeight.y - uHeight.x, 0.01));
  else vColour = uFlat;
}`;
const FRAGMENT = `
uniform float uClip, uOpacity;
varying vec3 vColour;
varying float vZ;
void main() {
  if (vZ > uClip) discard;
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(vColour, uOpacity);
}`;

/** A cloud of build_site.py: count x 3 high bytes, count x 3 low bytes of the uint16 positions, then the colours
 * (count x 3) and the distances (count) if it has them; gzipped. Positions come back relative to ``origin``. */
export async function decode(meta, origin, onProgress) {
  const response = await fetch(meta.file);
  if (!response.ok) throw new Error(`${meta.file}: ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.min(1, received / meta.bytes));
  }
  let bytes = new Uint8Array(received);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {     // a server may have unzipped it already
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const n = meta.count, step = meta.step;
  const base = meta.offset.map((o, i) => o - origin[i]);
  const positions = new Float32Array(3 * n);
  for (let i = 0; i < 3 * n; i += 3) {
    positions[i] = base[0] + ((bytes[i] << 8) | bytes[3 * n + i]) * step;
    positions[i + 1] = base[1] + ((bytes[i + 1] << 8) | bytes[3 * n + i + 1]) * step;
    positions[i + 2] = base[2] + ((bytes[i + 2] << 8) | bytes[3 * n + i + 2]) * step;
  }
  let off = 6 * n;
  const rgb = meta.color ? bytes.slice(off, off += 3 * n) : null;
  const err = meta.error ? bytes.slice(off, off + n) : null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  if (rgb) geometry.setAttribute('rgb', new THREE.BufferAttribute(rgb, 3, true));
  if (err) geometry.setAttribute('err', new THREE.BufferAttribute(err, 1, true));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Blue at the start to red at the end: time along the trajectory. */
function timeColour(t) {
  const stops = [[0.20, 0.30, 0.85], [0.15, 0.62, 0.98], [0.10, 0.85, 0.75], [0.55, 0.95, 0.25],
                 [0.97, 0.70, 0.15], [0.92, 0.28, 0.05], [0.70, 0.05, 0.05]];
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.floor(x), f = x - i, a = stops[i], b = stops[Math.min(i + 1, stops.length - 1)];
  return new THREE.Color().setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, THREE.SRGBColorSpace);
}

function quantile(values, q) {
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export class Viewer {
  constructor(stage) {
    this.stage = stage;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setScissorTest(true);
    stage.prepend(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, 16 / 10, 0.05, 20000);
    // The maps are gravity-aligned with z up; OrbitControls takes its orbit axis from the camera's up when created.
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.uniforms = {
      uSize: { value: 2.5 }, uPixelRatio: { value: this.renderer.getPixelRatio() }, uMode: { value: 0 },
      uSaturation: { value: 0.15 }, uHeight: { value: new THREE.Vector2(0, 3) }, uClip: { value: 1e9 },
    };
    this.background = new THREE.Color(0xeef1f5);
    this.panes = [0, 1].map(() => ({ scene: new THREE.Scene(), cloud: null, scan: null, path: null }));
    this.split = false;
    this.spinning = false;
    this.focus = null;
    this.scanVisible = false;
    this.pathVisible = true;
    this.onPortrait = null;
    new ResizeObserver(() => this.resize()).observe(stage);
    this.visible = true;
    new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; }).observe(stage);
    this.controls.addEventListener('start', () => { this.spinning = false; this.onSpinStop?.(); });
    this.renderer.setAnimationLoop(() => this.tick());
  }

  material(flat, hasRgb, hasErr, opacity = 1, scale = 1) {
    const u = this.uniforms;
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: opacity < 1, depthWrite: opacity === 1,
      uniforms: { uSize: u.uSize, uPixelRatio: u.uPixelRatio, uMode: u.uMode, uSaturation: u.uSaturation, uHeight: u.uHeight,
                  uClip: u.uClip, uFlat: { value: new THREE.Color(flat) }, uHasRgb: { value: hasRgb ? 1 : 0 },
                  uHasErr: { value: hasErr ? 1 : 0 }, uOpacity: { value: opacity }, uScale: { value: scale } },
    });
  }

  /** Pane ``i`` shows ``geometry`` (null: nothing), drawn in ``colour`` where it has no colours of its own. */
  setCloud(i, geometry, colour) {
    const pane = this.panes[i];
    if (pane.cloud) { pane.scene.remove(pane.cloud); pane.cloud.material.dispose(); pane.cloud = null; }
    if (!geometry) return;
    pane.cloud = new THREE.Points(geometry, this.material(colour, !!geometry.getAttribute('rgb'), !!geometry.getAttribute('err')));
    pane.cloud.frustumCulled = false;
    pane.scene.add(pane.cloud);
  }

  /** The scan under both panes (null: none); a thinner, lighter cloud that never hides the maps. */
  setScan(geometry) {
    for (const pane of this.panes) {
      if (pane.scan) { pane.scene.remove(pane.scan); pane.scan.material.dispose(); pane.scan = null; }
      if (!geometry) continue;
      pane.scan = new THREE.Points(geometry, this.material(SCAN_COLOUR, false, false, 0.55, 0.75));
      pane.scan.renderOrder = -1;
      pane.scan.frustumCulled = false;
      pane.scan.visible = this.scanVisible;
      pane.scene.add(pane.scan);
    }
  }

  /** The trajectory (flat x, y, z relative to the origin) as a tube coloured by time, in both panes. */
  setTrajectory(flat, radius) {
    for (const pane of this.panes) {
      if (pane.path) { pane.scene.remove(pane.path); pane.path = null; }
    }
    if (!flat || flat.length < 6) return;
    const nodes = [];
    for (let i = 0; i < flat.length; i += 3) nodes.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
    const segments = Math.min(2400, nodes.length * 2);
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nodes), segments, radius, 8, false);
    const colours = new Float32Array(tube.attributes.position.count * 3);
    const rings = segments + 1, perRing = tube.attributes.position.count / rings;
    for (let r = 0; r < rings; r++) {
      const c = timeColour(r / (rings - 1));
      for (let k = 0; k < perRing; k++) c.toArray(colours, (r * perRing + k) * 3);
    }
    tube.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const solid = new THREE.MeshBasicMaterial({ vertexColors: true });
    // Behind a wall the route would vanish: a faint copy drawn over everything keeps all of it readable.
    const ghost = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthTest: false });
    for (const pane of this.panes) {
      pane.path = new THREE.Mesh(tube, solid);
      const behind = new THREE.Mesh(tube, ghost);
      behind.renderOrder = 10;
      pane.path.add(behind);
      pane.path.visible = this.pathVisible;
      pane.scene.add(pane.path);
    }
  }

  showScan(on) { this.scanVisible = on; for (const p of this.panes) if (p.scan) p.scan.visible = on; }
  showPath(on) { this.pathVisible = on; for (const p of this.panes) if (p.path) p.path.visible = on; }
  setSplit(on) { this.split = on; this.resize(); }
  setDark(on) { this.background.set(on ? 0x10141b : 0xeef1f5); }

  /** What the framing, the height colours and the ceiling cut are measured on: the points of ``geometry`` around the
   * trajectory (flat x, y, z), so that a few far stray points cannot shrink the scene. */
  setFocus(geometry, path) {
    const p = geometry.attributes.position.array;
    const stride = Math.max(1, Math.floor(p.length / 3 / 60000)) * 3;
    let box = null;
    if (path && path.length >= 6) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < path.length; i++) { lo[i % 3] = Math.min(lo[i % 3], path[i]); hi[i % 3] = Math.max(hi[i % 3], path[i]); }
      const margin = Math.max(3, 0.35 * Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]));
      box = [lo.map(v => v - margin), hi.map(v => v + margin)];
    }
    const xs = [], ys = [], zs = [];
    for (let i = 0; i < p.length; i += stride) {
      if (box && (p[i] < box[0][0] || p[i] > box[1][0] || p[i + 1] < box[0][1] || p[i + 1] > box[1][1]
                  || p[i + 2] < box[0][2] || p[i + 2] > box[1][2])) continue;
      xs.push(p[i]); ys.push(p[i + 1]); zs.push(p[i + 2]);
    }
    const lo = [quantile(xs, .01), quantile(ys, .01), quantile(zs, .01)];
    const hi = [quantile(xs, .99), quantile(ys, .99), quantile(zs, .995)];
    let mx = 0, my = 0;
    for (let i = 0; i < xs.length; i++) { mx += xs[i]; my += ys[i]; }
    mx /= xs.length; my /= xs.length;
    let xx = 0, xy = 0, yy = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - mx, dy = ys[i] - my;
      xx += dx * dx; xy += dx * dy; yy += dy * dy;
    }
    this.focus = {
      sample: { xs, ys, zs },
      centre: new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2),
      zlo: lo[2], zhi: hi[2],
      // degrees to the longest horizontal axis, so that a corridor lies across the frame
      axis: THREE.MathUtils.radToDeg(0.5 * Math.atan2(2 * xy, xx - yy)),
      size: Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]),
    };
    this.uniforms.uHeight.value.set(lo[2], hi[2]);
    this.camera.near = Math.max(0.01, this.focus.size / 2000);
    this.camera.far = this.focus.size * 40;
    this.camera.updateProjectionMatrix();
  }

  /** The ceiling cut: 0 to 1 of the height of the scene; 1 is no cut. */
  setCeiling(t) {
    const f = this.focus;
    this.uniforms.uClip.value = !f || t >= 1 ? 1e9 : f.zlo + t * (f.zhi - f.zlo);
  }

  paneAspect() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!this.split) return w / h;
    return this.portrait() ? w / (h / 2) : (w / 2) / h;
  }

  portrait() { return this.stage.clientWidth < this.stage.clientHeight * 0.95; }

  /** How far back the camera must sit along ``direction`` for (nearly) the whole scene to be in frame. */
  fitDistance(direction) {
    const f = this.focus;
    const forward = direction.clone().multiplyScalar(-1).normalize();
    let right = new THREE.Vector3().crossVectors(forward, this.camera.up);
    if (right.lengthSq() < 1e-12) right = new THREE.Vector3(1, 0, 0);
    right.normalize();
    const down = new THREE.Vector3().crossVectors(forward, right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2), tanH = tanV * this.paneAspect();
    const needed = [];
    const { xs, ys, zs } = f.sample;
    for (let i = 0; i < xs.length; i++) {
      const ox = xs[i] - f.centre.x, oy = ys[i] - f.centre.y, oz = zs[i] - f.centre.z;
      const x = ox * right.x + oy * right.y + oz * right.z;
      const y = ox * down.x + oy * down.y + oz * down.z;
      const z = ox * forward.x + oy * forward.y + oz * forward.z;
      needed.push(Math.max(Math.abs(x) / tanH, Math.abs(y) / tanV) - z);
    }
    return quantile(needed, 0.985) * 1.04;            // a quantile: a few stray points cannot shrink the scene
  }

  frame(view) {
    if (!this.focus) return;
    const across = this.focus.axis + 90;
    const shots = { hero: [36, across], top: [89.5, across - 180], side: [7, across + 90] };
    const [elevation, azimuth] = (shots[view] || shots.hero).map(THREE.MathUtils.degToRad);
    const direction = new THREE.Vector3(Math.cos(elevation) * Math.cos(azimuth), Math.cos(elevation) * Math.sin(azimuth),
                                        Math.sin(elevation));
    this.controls.target.copy(this.focus.centre);
    this.camera.position.copy(this.focus.centre).addScaledVector(direction, this.fitDistance(direction));
    this.controls.update();
  }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.stage.classList.toggle('portrait', this.portrait());
    this.stage.classList.toggle('split', this.split);
    this.onPortrait?.(this.portrait());
  }

  tick() {
    if (!this.visible) return;
    if (this.spinning && this.focus) {
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.0025);
      this.camera.position.copy(this.controls.target).add(offset);
    }
    this.controls.update();
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    const views = !this.split ? [[0, 0, w, h]]
      : this.portrait() ? [[0, Math.ceil(h / 2), w, Math.floor(h / 2)], [0, 0, w, Math.ceil(h / 2)]]
      : [[0, 0, Math.floor(w / 2), h], [Math.floor(w / 2), 0, Math.ceil(w / 2), h]];
    this.camera.aspect = views[0][2] / views[0][3];
    this.camera.updateProjectionMatrix();
    views.forEach(([x, y, vw, vh], i) => {
      const pane = this.panes[i];
      pane.scene.background = this.background;
      this.renderer.setViewport(x, y, vw, vh);
      this.renderer.setScissor(x, y, vw, vh);
      this.renderer.render(pane.scene, this.camera);
    });
  }
}
