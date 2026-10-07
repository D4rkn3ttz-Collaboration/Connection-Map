// 3D 연결 화면 시제품 — 설계서 4.4 「연결 3D」 (2026-10-04).
//
// 위 판은 오픈웹, 아래 판은 다크웹. 두 판은 같은 크기의 원형이고 섬은 가운데가 높게 쌓인다.
// 다크웹 판은 지도가 계산해 통합 Supabase 표(public.dark_layout)에 올린 배치를 **칸 위치 그대로** 그린다 —
// 여기서 배치를 다시 계산하지 않는다. 그래야 2D 와 영토 모양 · 크기가 같다.
//
//   ?dark=<주소>    다크웹 배치 결과 파일. 없으면 통합 Supabase 표(public.dark_layout)를 읽는다 —
//                   주소 · 공개 열쇠는 ./data/supabase.json. 그 파일이 없으면 ./data/dark-layout.json
//   ?dark=supabase  꼭 표에서 읽는다(설정 파일이 없으면 멈춘다)
//   ?open=<주소>    오픈웹 배치 결과(같은 칸 모양). 없으면 위 판은 빈 원판이다
//   ?links=<주소>   연결 공개 뷰 줄 목록(JSON 배열). 없으면 통합 Supabase 공개 뷰 links_public 을 읽는다 —
//                   뷰가 아직 없거나 공개 읽기가 안 열렸으면 연결선 없이 그리고 「연결 자료 없음」 을 적는다.
//                   뷰가 생기면 고칠 것 없이 선이 그려진다
//   ?links=supabase 꼭 공개 뷰에서 읽는다(설정 파일이 없으면 멈춘다)
//   data/supabase.json 이 있는데 꼴이 틀리면 「없음」 으로 넘어가지 않고 까닭을 적고 멈춘다
//
// 받은 글자는 textContent 로만 넣는다. innerHTML 에 자료를 넣지 않는다.

import * as THREE from 'three';
import {
  DARK_TABLE_SELECT,
  FOCUS_ZOOM,
  FOV_DEG,
  GAP_RATIO,
  H_FLOOR,
  H_TIERS,
  LINKS_VIEW_SELECT,
  TILT_DEG,
  axialToXZ,
  blockHeights,
  centerOf,
  clampTarget,
  clampZoom,
  edgeSegments,
  fitCamera,
  focusAngle,
  linksMissing,
  linksOf,
  matchLinks,
  parseLayout,
  parseSupabaseConfig,
  pinchZoom,
  plateBounds,
  rayPlaneY,
  rotateY,
  rowsToLayout,
  searchTerritories,
  shortestTurn,
  wheelZoom,
  zoomToward,
} from './lib.js';

const params = new URLSearchParams(location.search);
const SRC = {
  dark: params.get('dark'),
  open: params.get('open'),
  links: params.get('links'),
};
const WEB_LABEL = { dark: '다크웹', open: '오픈웹' };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
/** 흐려진 블록이 섞이는 색 — 판 바탕에 가까운 옅은 회청색 */
const FADE = new THREE.Color('#D3D9E4');
/** 연결선 (설계서 6.5) */
const LINK_COLOR = '#C2400D';
/** 처음 회전 각 (설계서 4.4 「초기 160°」) */
const START_ANGLE = 160;

const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

// ── 장면 ───────────────────────────────────────────────────────────────────

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.5, 6000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x7d88a8, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-60, 160, 90);
scene.add(sun);
const root = new THREE.Group();
scene.add(root);
const linkGroup = new THREE.Group();
root.add(linkGroup);

/** @type {{dark: Plate | null, open: Plate | null}} */
const plates = { dark: null, open: null };
let lines = [];
let selection = null;
let angle = START_ANGLE;
let fit = { radius: 40, gap: 72 };
/**
 * 보는 자리. 확대 1 은 두 판이 다 들어오는 거리(home · fitDist 는 resize 가 정한다). t 는 바라보는 점(판 좌표)이다.
 * goal 은 찾은 영토로 옮겨 가는 중일 때 갈 곳 — 사람이 끌거나 휠을 굴리면 버린다
 */
const view = { zoom: 1, t: { x: 0, y: 36, z: 0 } };
let home = { x: 0, y: 36, z: 0 };
let fitDist = 100;
let goal = null;

/**
 * 판 하나. 칸마다 육각 기둥 하나를 InstancedMesh 로 그린다.
 * @typedef {ReturnType<typeof buildPlate>} Plate
 */
function buildPlate(layout, y, radius) {
  const b = plateBounds(layout);
  const group = new THREE.Group();
  group.position.y = y;
  root.add(group);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 0.8, 128),
    // 판은 비쳐 보이게 깊이를 안 쓴다. 위 판이 아래 판 먼 쪽 블록을 가리지 않는다
    new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: layout.web === 'open' ? 0.55 : 0.8, depthWrite: false }),
  );
  disc.position.y = -0.4;
  group.add(disc);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.18, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x9aa5c0 }),
  );
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const heights = blockHeights(layout);
  const cells = [];
  const byTerritory = new Map();
  const index = new Map();
  for (const t of layout.territories) {
    const own = [];
    const color = new THREE.Color(t.color);
    for (const [q, r] of t.cells) {
      const p = axialToXZ(q, r);
      const base = heights.get(`${q},${r}`);
      index.set(`${q},${r}`, cells.length);
      own.push(cells.length);
      cells.push({ t, x: p.x - b.cx, z: p.z - b.cz, base, h: base, target: base, color, cur: color.clone(), want: color.clone() });
    }
    byTerritory.set(t.id, own);
  }

  // 뾰족 위 육각 기둥. three 의 원기둥 꼭짓점은 +z 에서 시작해 뾰족한 쪽이 z 축을 향한다 — 2D 와 같다
  const geo = new THREE.CylinderGeometry(0.95, 0.95, 1, 6);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), cells.length);
  mesh.frustumCulled = false;
  group.add(mesh);

  const segs = edgeSegments(layout).map((s) => ({ ...s, cell: index.get(`${s.q},${s.r}`) }));
  const pos = new Float32Array(segs.length * 6);
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: 0x2b2d33, transparent: true, opacity: 0.5 }),
  );
  edges.frustumCulled = false;
  group.add(edges);

  const plate = { layout, group, mesh, cells, segs, edgeGeo, bounds: b, byTerritory, labels: [] };
  writeInstances(plate);
  mesh.computeBoundingSphere();
  return plate;
}

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

function writeInstances(p) {
  p.cells.forEach((c, i) => {
    M.compose(V.set(c.x, 0, c.z), Q, S.set(1, Math.max(c.h, 0.02), 1));
    p.mesh.setMatrixAt(i, M);
    p.mesh.setColorAt(i, c.cur);
  });
  p.mesh.instanceMatrix.needsUpdate = true;
  if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
  const pos = p.edgeGeo.attributes.position.array;
  p.segs.forEach((s, i) => {
    const c = p.cells[s.cell];
    const y = c.h + 0.02;
    const o = i * 6;
    pos[o] = s.a.x - p.bounds.cx;
    pos[o + 1] = y;
    pos[o + 2] = s.a.z - p.bounds.cz;
    pos[o + 3] = s.b.x - p.bounds.cx;
    pos[o + 4] = y;
    pos[o + 5] = s.b.z - p.bounds.cz;
  });
  p.edgeGeo.attributes.position.needsUpdate = true;
}

// ── 고르기 ─────────────────────────────────────────────────────────────────

/**
 * 고른 것에 따라 칸마다 갈 높이와 색을 정한다 (설계서 4.4).
 * 고른 영토(섬)와, 반대쪽 층에서 그것과 이어진 영토만 쌓인 높이를 지킨다. 나머지는 바닥으로 내려가며 흐려진다.
 */
function applySelection() {
  const linked = linksOf(lines, selection);
  const keep = { dark: null, open: null };
  if (selection) {
    keep[selection.web] = new Set(selection.kind === 'territory' ? [selection.id] : selection.ids);
    keep[selection.web === 'dark' ? 'open' : 'dark'] = linked.other;
  }
  for (const web of ['dark', 'open']) {
    const p = plates[web];
    if (!p) continue;
    for (const c of p.cells) {
      const on = !keep[web] || keep[web].has(c.t.id);
      c.target = on ? c.base : H_FLOOR;
      c.want.copy(c.color);
      if (!on) c.want.lerp(FADE, 0.78);
    }
  }
  drawLinks(linked.lines);
  renderPanel(linked);
  if (selection?.kind === 'territory' && linked.lines.length === 0) toast('다른 층과 연결 없음');
  kick();
}

function select(sel) {
  selection = sel;
  applySelection();
}

function selectTerritory(web, id) {
  if (selection?.kind === 'territory' && selection.web === web && selection.id === id) return select(null);
  select({ kind: 'territory', web, id });
}

function selectIsland(web, island) {
  const p = plates[web];
  if (!p) return;
  if (selection?.kind === 'island' && selection.web === web && selection.island === island) return select(null);
  const ids = p.layout.territories.filter((t) => t.island === island).map((t) => t.id);
  select({ kind: 'island', web, island, ids });
}

/** 연결선 — 오픈웹 판 아래에서 내려와 다크웹 영토 윗면에 닿는다 (설계서 4.4) */
function drawLinks(hit) {
  while (linkGroup.children.length) {
    const m = linkGroup.children.pop();
    m.geometry.dispose();
    m.material.dispose();
  }
  if (!plates.dark || !plates.open) return;
  const mat = new THREE.MeshBasicMaterial({ color: LINK_COLOR });
  for (const l of hit) {
    const d = territoryAnchor(plates.dark, l.darkId, 'top');
    const o = territoryAnchor(plates.open, l.openId, 'bottom');
    if (!d || !o) continue;
    const mid = new THREE.Vector3().lerpVectors(o, d, 0.5);
    mid.y += 0.5;
    const curve = new THREE.CatmullRomCurve3([o, mid, d]);
    linkGroup.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.14, 6, false), mat));
  }
}

/** 영토 가운데 한 점 (root 좌표). top 은 그 영토 가장 높은 블록 위, bottom 은 판 아래 */
function territoryAnchor(p, id, where) {
  const idx = p.byTerritory.get(id);
  if (!idx) return null;
  let x = 0;
  let z = 0;
  let h = 0;
  for (const i of idx) {
    x += p.cells[i].x;
    z += p.cells[i].z;
    h = Math.max(h, p.cells[i].base);
  }
  const y = p.group.position.y + (where === 'top' ? h : -0.8);
  return new THREE.Vector3(x / idx.length, y, z / idx.length);
}

// ── 움직임 ─────────────────────────────────────────────────────────────────

let raf = 0;
let last = 0;

/** 고른 상태가 바뀌면 부른다. 움직임을 줄인 설정이거나 탭이 숨었으면 바로 끝 상태로 간다 */
function kick() {
  if (REDUCED || document.hidden) return snap();
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  armFallback();
}

/** 끝 상태로 바로 간다 */
function snap() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (goal) {
    setAngle(goal.angle);
    view.zoom = goal.zoom;
    view.t = goal.t;
    goal = null;
  }
  for (const p of Object.values(plates)) {
    if (!p) continue;
    for (const c of p.cells) {
      c.h = c.target;
      c.cur.copy(c.want);
    }
    writeInstances(p);
  }
  render();
}

/**
 * 화면이 숨지 않았는데도 다음 프레임이 안 오는 때가 있다(창이 다른 창 뒤에 있거나 미리보기 창이
 * 접혔을 때). 그러면 블록이 중간 높이에 멈추므로, 잠시 뒤에도 프레임이 안 왔으면 끝 상태로 간다
 */
let fallback = 0;
function armFallback() {
  clearTimeout(fallback);
  fallback = setTimeout(() => {
    if (raf) snap();
  }, 400);
}

function frame(now) {
  raf = 0;
  clearTimeout(fallback);
  const k = 1 - Math.exp(-(now - last) / 110);
  last = now;
  let moving = false;
  for (const p of Object.values(plates)) {
    if (!p) continue;
    for (const c of p.cells) {
      const dh = c.target - c.h;
      if (Math.abs(dh) > 0.002) {
        c.h += dh * k;
        moving = true;
      } else c.h = c.target;
      if (!c.cur.equals(c.want)) {
        c.cur.lerp(c.want, k);
        if (Math.abs(c.cur.r - c.want.r) + Math.abs(c.cur.g - c.want.g) + Math.abs(c.cur.b - c.want.b) < 0.003) c.cur.copy(c.want);
        else moving = true;
      }
    }
    writeInstances(p);
  }
  if (goal && stepView(k)) moving = true;
  render();
  if (moving) {
    raf = requestAnimationFrame(frame);
    armFallback();
  }
}

function render() {
  root.rotation.y = (angle * Math.PI) / 180;
  root.updateMatrixWorld(true);
  placeCamera();
  renderer.render(scene, camera);
  placeLabels();
}

/** goal 쪽으로 한 걸음. 아직 움직이면 true */
function stepView(k) {
  const turn = shortestTurn(angle, goal.angle);
  const dz = Math.log(goal.zoom / view.zoom);
  const d = { x: goal.t.x - view.t.x, y: goal.t.y - view.t.y, z: goal.t.z - view.t.z };
  if (Math.abs(turn) < 0.05 && Math.abs(dz) < 0.002 && Math.hypot(d.x, d.y, d.z) < 0.02) {
    setAngle(goal.angle);
    view.zoom = goal.zoom;
    view.t = goal.t;
    goal = null;
    return false;
  }
  setAngle(angle + turn * k);
  view.zoom *= Math.exp(dz * k);
  view.t = { x: view.t.x + d.x * k, y: view.t.y + d.y * k, z: view.t.z + d.z * k };
  return true;
}

/** 바라보는 점이 갈 수 있는 곳 — 판 둘레 안, 아래 판 바닥 ~ 위 판 꼭대기 (lib.js clampTarget) */
function clampView(t, zoom) {
  return clampTarget(t, home, { radius: fit.radius, ylo: 0, yhi: fit.gap + H_TIERS[H_TIERS.length - 1], zoom });
}

/** 카메라를 바라보는 점에서 기울기 고정 방향으로 fitDist / 확대 만큼 떨어뜨린다 */
function placeCamera() {
  view.t = clampView(view.t, view.zoom);
  const w = rotateY(view.t, angle);
  const tilt = (TILT_DEG * Math.PI) / 180;
  const d = fitDist / view.zoom;
  camera.position.set(w.x, view.t.y + d * Math.sin(tilt), w.z + d * Math.cos(tilt));
  camera.lookAt(w.x, view.t.y, w.z);
}

// ── 화면 크기 · 카메라 ─────────────────────────────────────────────────────

/**
 * 기울기는 고정이다 (설계서 4.4). 두 판이 다 들어오는 거리와 바라보는 높이를 확대 1 로 삼는다(lib.js fitCamera).
 * 카메라 자리는 render 때마다 placeCamera 가 정한다
 */
function resize() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const { dist, lookY } = fitCamera({ radius: fit.radius, gap: fit.gap, top: H_TIERS[H_TIERS.length - 1], aspect: camera.aspect });
  const moved = { x: view.t.x - home.x, y: view.t.y - home.y, z: view.t.z - home.z };
  home = { x: 0, y: lookY, z: 0 };
  view.t = { x: home.x + moved.x, y: home.y + moved.y, z: home.z + moved.z };
  fitDist = dist;
  camera.updateProjectionMatrix();
  render();
}

// ── 확대 (휠 · 두 손가락 · + − 0 키 · 「전체 보기」) ─────────────────────────

/** 화면 한 점 아래의 판 좌표 — 블록, 아니면 위 판 · 아래 판 바닥면. 못 찾으면 null */
function pointUnder(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const meshes = Object.values(plates).filter(Boolean).map((p) => p.mesh);
  let hit = ray.intersectObjects(meshes, false)[0]?.point ?? null;
  if (!hit) {
    for (const y of [fit.gap, 0]) {
      const q = rayPlaneY(ray.ray.origin, ray.ray.direction, y);
      if (q && Math.hypot(q.x, q.z) <= fit.radius) {
        hit = new THREE.Vector3(q.x, q.y, q.z);
        break;
      }
    }
  }
  if (!hit) return null;
  const local = root.worldToLocal(hit.clone());
  return { x: local.x, y: local.y, z: local.z };
}

/** 확대를 z 로. 화면 점 (cx, cy) 를 짚으면 그 점이 제자리에 남는다 */
function zoomTo(z, cx, cy) {
  goal = null;
  const next = clampZoom(z);
  const at = cx == null ? null : pointUnder(cx, cy);
  if (at) view.t = zoomToward(view.t, at, view.zoom, next);
  view.zoom = next;
  render();
}

function resetView() {
  goal = { angle, zoom: 1, t: { ...home } };
  kick();
}

canvas.addEventListener(
  'wheel',
  (ev) => {
    ev.preventDefault();
    zoomTo(wheelZoom(view.zoom, ev.deltaY, ev.deltaMode), ev.clientX, ev.clientY);
  },
  { passive: false },
);
$('fitView').addEventListener('click', resetView);
window.addEventListener('resize', resize);

// ── 섬 이름표 · 끌기 · 누르기 ──────────────────────────────────────────────

const labelLayer = $('labels');

function makeLabels(p) {
  for (const isl of p.layout.islands) {
    const cells = isl.territories.flatMap((t) => t.cells);
    const c = centerOf(cells);
    let top = 0;
    for (const t of isl.territories) for (const i of p.byTerritory.get(t.id)) top = Math.max(top, p.cells[i].base);
    const btn = el('button', `island-label ${p.layout.web}`, isl.name);
    btn.type = 'button';
    btn.title = `${WEB_LABEL[p.layout.web]} ${isl.name} — 누르면 이 섬과 반대쪽 층 연결만`;
    btn.addEventListener('click', () => selectIsland(p.layout.web, isl.id));
    labelLayer.append(btn);
    // 섬 가운데 가장 높은 블록 위에 띄운다. 어느 각도로 돌려도 섬 위에 있다
    p.labels.push({ btn, island: isl.id, at: new THREE.Vector3(c.x - p.bounds.cx, top + 2.5, c.z - p.bounds.cz) });
  }
}

const W = new THREE.Vector3();
function placeLabels() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  for (const p of Object.values(plates)) {
    if (!p) continue;
    for (const l of p.labels) {
      W.copy(l.at);
      p.group.localToWorld(W);
      W.project(camera);
      const vis = W.z < 1;
      l.btn.style.transform = `translate(-50%, -100%) translate(${((W.x + 1) / 2) * w}px, ${((1 - W.y) / 2) * h}px)`;
      l.btn.hidden = !vis;
      const on = selection?.kind === 'island' && selection.web === p.layout.web && selection.island === l.island;
      l.btn.classList.toggle('on', on);
    }
  }
}

const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const meshes = Object.values(plates).filter(Boolean).map((p) => p.mesh);
  const hit = ray.intersectObjects(meshes, false)[0];
  if (!hit || hit.instanceId == null) return null;
  const p = Object.values(plates).find((x) => x && x.mesh === hit.object);
  return { web: p.layout.web, t: p.cells[hit.instanceId].t };
}

const tip = $('tip');
let drag = null;
/** 화면에 닿은 손가락(포인터)들. 둘이면 벌리고 오므리기로 확대한다 */
const touches = new Map();
let pinch = null;
const spread = () => {
  const [a, b] = [...touches.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
};
canvas.addEventListener('pointerdown', (ev) => {
  touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  canvas.setPointerCapture(ev.pointerId);
  if (touches.size === 2) {
    // 두 번째 손가락 — 돌리기 · 누르기를 멈추고 확대로
    drag = null;
    pinch = { d0: spread().d, z0: view.zoom };
    goal = null;
    return;
  }
  if (touches.size > 2 || pinch) return;
  goal = null;
  drag = { x: ev.clientX, start: angle, moved: false };
});
const lift = (ev) => {
  touches.delete(ev.pointerId);
  if (touches.size < 2) pinch = null;
};
canvas.addEventListener('pointercancel', (ev) => {
  lift(ev);
  drag = null;
});
canvas.addEventListener('pointermove', (ev) => {
  if (touches.has(ev.pointerId)) touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  if (pinch && touches.size === 2) {
    const s = spread();
    zoomTo(pinchZoom(pinch.z0, pinch.d0, s.d), s.x, s.y);
    return;
  }
  if (drag) {
    const dx = ev.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved) setAngle(drag.start + dx * 0.35);
    return;
  }
  const hit = pick(ev);
  canvas.style.cursor = hit ? 'pointer' : 'grab';
  if (!hit) {
    tip.hidden = true;
    return;
  }
  tip.replaceChildren(el('strong', null, hit.t.name), el('span', null, `${WEB_LABEL[hit.web]} · ${hit.t.islandName}`));
  tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`;
  tip.hidden = false;
});
canvas.addEventListener('pointerleave', () => {
  tip.hidden = true;
});
canvas.addEventListener('pointerup', (ev) => {
  lift(ev);
  const d = drag;
  drag = null;
  if (!d || d.moved) return;
  const hit = pick(ev);
  if (hit) selectTerritory(hit.web, hit.t.id);
  else if (selection) select(null);
});
window.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && selection) return select(null);
  // 찾기 칸에 쓰는 글자는 건드리지 않는다
  if (ev.target instanceof HTMLElement && ev.target.closest('input, textarea, select')) return;
  if (ev.key === '+' || ev.key === '=') zoomTo(view.zoom * 1.25);
  else if (ev.key === '-') zoomTo(view.zoom / 1.25);
  else if (ev.key === '0') resetView();
});

// ── 회전 슬라이더 (설계서 4.4 「오른쪽 아래 슬라이더 0~360°」) ─────────────

const slider = $('angle');
const angleOut = $('angleOut');
function setAngle(a) {
  angle = ((a % 360) + 360) % 360;
  const deg = Math.round(angle) % 360;
  slider.value = String(deg);
  angleOut.textContent = `${deg}°`;
  render();
}
slider.addEventListener('input', () => setAngle(Number(slider.value)));

// ── 패널 (설계서 4.4 「패널」 — 개요 · 사건 · 연결) ─────────────────────────

const panel = $('panel');
let tab = 'overview';
for (const b of panel.querySelectorAll('[data-tab]')) {
  b.addEventListener('click', () => {
    tab = b.dataset.tab;
    renderPanel(linksOf(lines, selection));
  });
}
$('panelClose').addEventListener('click', () => select(null));

function territoryOf(web, id) {
  return plates[web]?.layout.territories.find((t) => t.id === id) ?? null;
}

function row(dl, k, v) {
  dl.append(el('dt', null, k), el('dd', null, v));
}

function renderPanel(linked) {
  const body = $('panelBody');
  body.replaceChildren();
  panel.classList.toggle('collapsed', !selection);
  if (!selection) return;
  for (const b of panel.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  const p = plates[selection.web];
  const other = selection.web === 'dark' ? 'open' : 'dark';

  if (selection.kind === 'territory') {
    const t = territoryOf(selection.web, selection.id);
    $('panelTitle').textContent = t?.name ?? selection.id;
    $('panelSub').textContent = `${WEB_LABEL[selection.web]} · ${t?.islandName ?? ''}`;
    if (tab === 'overview') {
      const dl = el('dl', 'facts');
      row(dl, '섬', t.islandName);
      if (t.kind) row(dl, '종류', t.kind);
      row(dl, '칸 수', `${t.cells.length}칸`);
      if (p.layout.quarter) row(dl, '기준 분기', p.layout.quarter.replace('-', ' '));
      if (p.layout.asOf) row(dl, '자료 시각', p.layout.asOf.replace('T', ' ').slice(0, 16));
      row(dl, '반대쪽 연결', `${linked.lines.length}건`);
      body.append(dl);
    }
  } else {
    const isl = p.layout.islands.find((i) => i.id === selection.island);
    $('panelTitle').textContent = isl?.name ?? selection.island;
    $('panelSub').textContent = `${WEB_LABEL[selection.web]} 섬`;
    if (tab === 'overview') {
      const dl = el('dl', 'facts');
      row(dl, '영토', `${isl.territories.length}곳`);
      row(dl, '칸 수', `${isl.territories.reduce((a, t) => a + t.cells.length, 0)}칸`);
      row(dl, '반대쪽 연결', `${linked.lines.length}건`);
      body.append(dl);
    }
  }

  if (tab === 'events') {
    body.append(el('p', 'note', '배치 결과에는 사건 목록이 없다. 사건은 각 웹 지도에서 본다. 어떤 칸으로 받을지는 두 팀이 칸 모양을 정할 때 같이 정한다.'));
  }
  if (tab === 'links') {
    if (!plates[other]) {
      body.append(el('p', 'note', `${WEB_LABEL[other]} 배치 결과가 아직 없어 연결을 그릴 수 없다.`));
    } else if (linked.lines.length === 0) {
      body.append(el('p', 'note', '다른 층과 연결 없음'));
    } else if (selection.kind === 'territory') {
      const ul = el('ul', 'links');
      for (const l of linked.lines) {
        const o = territoryOf(other, other === 'dark' ? l.darkId : l.openId);
        const li = el('li');
        const b = el('button', null, o?.name ?? '?');
        b.type = 'button';
        b.addEventListener('click', () => selectTerritory(other, o.id));
        li.append(b, el('span', null, [l.relType, l.confidence && `신뢰도 ${l.confidence}`].filter(Boolean).join(' · ')));
        ul.append(li);
      }
      body.append(ul);
    } else {
      // 섬 단위 요약 — 반대쪽 섬마다 건수 (설계서 4.4 「섬 단위 요약」)
      const count = new Map();
      for (const l of linked.lines) {
        const o = territoryOf(other, other === 'dark' ? l.darkId : l.openId);
        const k = o?.islandName ?? '?';
        count.set(k, (count.get(k) ?? 0) + 1);
      }
      const ul = el('ul', 'links');
      const me = p.layout.islands.find((i) => i.id === selection.island)?.name ?? '';
      for (const [k, n] of [...count].sort((a, b) => b[1] - a[1])) {
        ul.append(el('li', null, `${me} → ${WEB_LABEL[other]} ${k} · ${n}건`));
      }
      body.append(ul);
    }
  }
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 2400);
}

// ── 찾기 (설계서 4.4 「오픈웹, 다크웹 모두 검색. 결과 선택 시 3D 안에서 영토 선택」) ──

const search = $('search');
const results = $('results');
function showResults() {
  const hits = searchTerritories([plates.dark?.layout, plates.open?.layout], search.value);
  results.replaceChildren(
    ...hits.map((h) => {
      const li = el('li');
      const b = el('button', null, h.name);
      b.type = 'button';
      b.append(el('span', null, `${WEB_LABEL[h.web]} · ${h.islandName}`));
      b.addEventListener('click', () => {
        showFound(h.web, h.id);
        search.value = '';
        results.replaceChildren();
      });
      li.append(b);
      return li;
    }),
  );
  return hits;
}
search.addEventListener('input', showResults);
search.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  const [h] = showResults();
  if (!h) return;
  showFound(h.web, h.id);
  search.value = '';
  results.replaceChildren();
});

/**
 * 찾은 영토 보여 주기 — 고르고, 판 옆 · 뒤쪽이면 앞으로 돌리고, 그 영토로 다가간다(이미 더 가까우면 그대로).
 * 다시 눌러도 고르기가 풀리지 않는다(찾기는 늘 「이것을 보여 줘」 다)
 */
function showFound(web, id) {
  const p = plates[web];
  if (!p?.byTerritory.has(id)) return;
  if (!(selection?.kind === 'territory' && selection.web === web && selection.id === id)) select({ kind: 'territory', web, id });
  const at = territoryAnchor(p, id, 'top');
  const zoom = Math.max(view.zoom, FOCUS_ZOOM);
  // 갈 곳도 묶어 둔다 — 안 묶으면 판 가장자리 영토에서 카메라가 묶임에 걸려 끝없이 다가가려 한다
  goal = { angle: focusAngle(at.x, at.z, angle), zoom, t: clampView({ x: at.x, y: at.y, z: at.z }, zoom) };
  kick();
}

// ── 자료 받기 ───────────────────────────────────────────────────────────────

async function getJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`응답 ${r.status}`);
  return r.json();
}

/** 통합 Supabase 를 공개 열쇠로 읽는다. 열쇠는 apikey 머리글에만 — 공개 열쇠라 익명 역할로 읽힌다 */
async function getSupabase(cfg, path) {
  const r = await fetch(cfg.url + path, { cache: 'no-store', headers: { apikey: cfg.key, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`통합 DB 응답 ${r.status}`);
  return r.json();
}

/** 아직 안 읽음(undefined) · 읽음({cfg}) · 꼴이 틀림({err}) */
let supaCfg;
/**
 * data/supabase.json. 파일이 없으면 null 이고, 있는데 꼴이 틀리면 까닭을 던진다 — 한 번만 읽는다.
 * 없는 것과 틀린 것을 가른다. 같게 다루면 틀린 설정이 「설정 없음」 으로 보이고 다크웹 판이 말없이 파일로 넘어간다
 * (2026-10-06 공개 전 검토). 까닭 글에 열쇠 값은 안 넣는다(parseSupabaseConfig 글자 그대로)
 */
async function supabaseConfig() {
  if (supaCfg === undefined) {
    try {
      const r = await fetch('./data/supabase.json', { cache: 'no-store' });
      if (r.status === 404) supaCfg = { cfg: null };
      else if (!r.ok) supaCfg = { err: `응답 ${r.status}` };
      else supaCfg = { cfg: parseSupabaseConfig(await r.json()) };
    } catch (e) {
      supaCfg = { err: e instanceof SyntaxError ? 'JSON 이 아닙니다' : e.message };
    }
  }
  if (supaCfg.err) throw new Error(`data/supabase.json — ${supaCfg.err}`);
  return supaCfg.cfg;
}

/** 다크웹 판 — 주소를 주면 그 파일, 아니면 통합 DB 표, 설정이 없으면 ./data/dark-layout.json */
async function loadDark() {
  if (SRC.dark && SRC.dark !== 'supabase') return { from: '파일', layout: parseLayout(await getJson(SRC.dark), 'dark') };
  const cfg = await supabaseConfig();
  if (cfg) {
    const rows = await getSupabase(cfg, `/rest/v1/dark_layout?select=${DARK_TABLE_SELECT}&order=territory_id.asc`);
    return { from: '통합 DB', layout: parseLayout(rowsToLayout(rows, 'dark'), 'dark') };
  }
  if (SRC.dark === 'supabase') throw new Error('data/supabase.json(주소 · 공개 열쇠)이 없습니다');
  return { from: '파일', layout: parseLayout(await getJson('./data/dark-layout.json'), 'dark') };
}

/**
 * 연결 — 주소를 주면 그 파일, 아니면 통합 DB 공개 뷰 links_public.
 * @returns {{from, rows} | {none: string}} none 은 「연결 자료 없음」 까닭. 진짜 오류는 던진다
 */
async function loadLinks() {
  if (SRC.links && SRC.links !== 'supabase') {
    const raw = await getJson(SRC.links);
    return { from: '파일', rows: Array.isArray(raw) ? raw : raw?.rows };
  }
  const cfg = await supabaseConfig();
  if (!cfg) {
    if (SRC.links === 'supabase') throw new Error('data/supabase.json 이 없습니다');
    return { none: '통합 DB 설정(data/supabase.json)이 없다' };
  }
  const r = await fetch(`${cfg.url}/rest/v1/links_public?select=${LINKS_VIEW_SELECT}&order=link_id.asc`, {
    cache: 'no-store',
    headers: { apikey: cfg.key, Accept: 'application/json' },
  });
  if (!r.ok) {
    let body = null;
    try {
      body = await r.json();
    } catch {
      body = null;
    }
    const why = linksMissing(r.status, body);
    if (why) return { none: why };
    throw new Error(`통합 DB 응답 ${r.status}`);
  }
  const rows = await r.json();
  if (Array.isArray(rows) && rows.length === 0) return { none: '공개 뷰에 DB 반영이 켜진 줄이 아직 없다' };
  return { from: '통합 DB', rows };
}

function say(id, msg, bad = false) {
  const e = $(id);
  e.textContent = msg;
  e.classList.toggle('bad', bad);
}

async function main() {
  let dark = null;
  let open = null;
  try {
    const got = await loadDark();
    dark = got.layout;
    say('stDark', `다크웹(${got.from}) ${dark.quarter?.replace('-', ' ') ?? ''} · 영토 ${dark.territories.length} · 자료 ${dark.asOf?.replace('T', ' ').slice(0, 16) ?? '?'}${dark.skipped ? ` · 버린 줄 ${dark.skipped}` : ''}`);
  } catch (e) {
    say('stDark', `다크웹 배치 결과를 못 읽었다 (${e.message}). data/supabase.json 이나 data/dark-layout.json 을 두거나 ?dark= 로 주소를 준다`, true);
  }
  if (SRC.open) {
    try {
      open = parseLayout(await getJson(SRC.open), 'open');
      say('stOpen', `오픈웹 · 영토 ${open.territories.length}${open.skipped ? ` · 버린 줄 ${open.skipped}` : ''}`);
    } catch (e) {
      say('stOpen', `오픈웹 배치 결과를 못 읽었다 (${e.message})`, true);
    }
  } else {
    say('stOpen', '오픈웹 배치 결과 없음 — 닥스훈트 공개 결과가 오면 ?open= 으로 넣는다');
  }

  const radius = Math.max(dark ? plateBounds(dark).radius : 30, open ? plateBounds(open).radius : 0);
  fit = { radius, gap: radius * GAP_RATIO };
  if (dark) plates.dark = buildPlate(dark, 0, radius);
  if (open) plates.open = buildPlate(open, fit.gap, radius);
  else {
    // 같은 크기의 빈 원판 (설계서 4.4 「두 판 같은 크기의 원형」)
    const ghost = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.8, 128),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    ghost.position.y = fit.gap - 0.4;
    root.add(ghost);
  }
  for (const p of Object.values(plates)) if (p) makeLabels(p);

  try {
    const got = await loadLinks();
    if (got.none) {
      say('stLinks', `연결 자료 없음 — ${got.none}`);
    } else {
      const res = matchLinks(got.rows, dark, open);
      lines = res.lines;
      const n = Array.isArray(got.rows) ? got.rows.length : 0;
      if (!open) say('stLinks', `연결(${got.from}) ${n}줄 · 오픈웹 판이 없어 선은 아직 못 긋는다`);
      else say('stLinks', `연결(${got.from}) ${lines.length}건${res.unmatched ? ` · 양 끝을 못 찾은 줄 ${res.unmatched}` : ''}`);
    }
  } catch (e) {
    say('stLinks', `연결 자료를 못 읽었다 (${e.message})`, true);
  }

  setAngle(START_ANGLE);
  resize();
  applySelection();
}

main();
