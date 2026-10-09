// 3D 장면 — three.js 로 그리기 · 움직이기 · 누르기만 한다. 계산은 src/lib 에 있다.
//
// 위 판은 오픈웹, 아래 판은 다크웹. 두 판은 같은 크기의 원형이고 섬은 가운데가 높게 층으로 쌓인다(Figma ③-0).
// 다크웹 판은 지도가 계산해 통합 Supabase 표에 올린 배치를 **칸 위치 그대로** 그린다 — 여기서 배치를 다시 계산하지 않는다.
// 그래야 2D 와 영토 모양 · 크기가 같다.
//
// 「무엇을 골랐나」 는 밖(React 쪽 화면)이 들고 있다. 이 장면은 눌린 것을 알리고(onPick · onHover · onAngle)
// 받은 고르기(setFocus)를 그린다.

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

import { axialToXZ, edgeSegments, plateBounds, type Layout, type Territory, type Web } from "@/lib/layout.ts";
import { focusOf, lineStyle, pickedLines, strandsOf, type LinkLine, type Pick, type Strand } from "@/lib/links.ts";
import {
  FOCUS_ZOOM,
  FOV_DEG,
  GAP_RATIO,
  H_FLOOR,
  H_TOP,
  START_ANGLE,
  TILT_DEG,
  blockHeights,
  clampTarget,
  clampZoom,
  fitCamera,
  focusAngle,
  nearestToMean,
  normAngle,
  pinchZoom,
  rayPlaneY,
  rotateY,
  shortestTurn,
  wheelZoom,
  zoomToward,
  type P3,
} from "@/lib/scene.ts";

/** 연결선 (설계서 6.5 · Figma) */
const LINK_COLOR = 0xc2400d;
/** 흐려진 블록이 섞이는 색 — 판 바탕에 가까운 옅은 회청색 (Figma ③-1 「연한 색」) */
const FADE = new THREE.Color("#E3E7F0");
/** 블록 반지름 — 칸(1)보다 작게 두어 칸 사이에 틈이 보이게 한다(Figma 블록은 한 칸씩 떨어져 보인다) */
const BLOCK_R = 0.9;
/** 알린 회전 각이 React 를 거쳐 돌아오는 데 넉넉히 잡은 시간 */
const ECHO_MS = 300;

export interface SceneEvents {
  /** 영토를 눌렀다(null = 빈 곳) */
  onPick(t: { web: Web; territory_id: string } | null): void;
  /** 마우스를 올린 영토가 바뀌었다 */
  onHover(t: { web: Web; territory_id: string } | null): void;
  /** 끌기 · 찾은 영토 보여 주기로 회전 각이 바뀌었다(정수 도) */
  onAngle(deg: number): void;
}

interface CellState {
  t: Territory;
  x: number;
  z: number;
  base: number;
  h: number;
  target: number;
  color: THREE.Color;
  cur: THREE.Color;
  want: THREE.Color;
}

interface Plate {
  layout: Layout;
  group: THREE.Group;
  mesh: THREE.InstancedMesh;
  cells: CellState[];
  segs: { cell: number; a: { x: number; z: number }; b: { x: number; z: number } }[];
  edgeGeo: THREE.BufferGeometry;
  bounds: { cx: number; cz: number };
  byTerritory: Map<string, number[]>;
}

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const V = new THREE.Vector3();
const S = new THREE.Vector3();

/** 연결선 아래 끝 표시 — 빨간 테두리 · 흰 가운데 동그라미(Figma ③-3) */
function endMarkerTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.arc(32, 32, 26, 0, Math.PI * 2);
  g.fillStyle = "#ffffff";
  g.fill();
  g.lineWidth = 9;
  g.strokeStyle = "#C2400D";
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SceneView {
  private readonly canvas: HTMLCanvasElement;
  private readonly events: SceneEvents;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.5, 6000);
  private readonly root = new THREE.Group();
  private readonly plateGroup = new THREE.Group();
  private readonly linkGroup = new THREE.Group();
  private readonly linkMats: LineMaterial[] = [];
  private readonly marker = endMarkerTexture();
  private readonly reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  private readonly ray = new THREE.Raycaster();
  private readonly ptr = new THREE.Vector2();

  private plates: { dark: Plate | null; open: Plate | null } = { dark: null, open: null };
  /** 지금 쌓은 판 자료(같은 것이 다시 오면 다시 쌓지 않는다) */
  private built: { dark: Layout | null; open: Layout | null } | null = null;
  private lines: LinkLine[] = [];
  private pick: Pick | null = null;
  private showAll = false;
  private fit = { radius: 40, gap: 72 };

  private angle = START_ANGLE;
  private reportedAngle = START_ANGLE;
  /**
   * 잠깐 전에 알린 각 — React 를 거쳐 한두 프레임 늦게 돌아온 값(메아리)을 밖의 새 값으로 잘못 받지 않게.
   * 알린 지 ECHO_MS 가 지난 값은 메아리로 보지 않는다(목록에서는 다음에 알릴 때 지운다) — 끌기를 마친 뒤 슬라이더를
   * 몇 도 되돌리는 것은 받아야 한다
   */
  private readonly echoes: { deg: number; at: number }[] = [];
  private view: { zoom: number; t: P3 } = { zoom: 1, t: { x: 0, y: 36, z: 0 } };
  private home: P3 = { x: 0, y: 36, z: 0 };
  private fitDist = 100;
  private goal: { angle: number; zoom: number; t: P3 } | null = null;

  private raf = 0;
  private last = 0;
  private fallback = 0;
  private hoverKey = "";
  private drag: { x: number; start: number; moved: boolean } | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinch: { d0: number; z0: number } | null = null;
  private readonly off: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, events: SceneEvents) {
    this.canvas = canvas;
    this.events = events;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7d88a8, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(-60, 160, 90);
    this.scene.add(sun);
    this.scene.add(this.root);
    this.root.add(this.plateGroup, this.linkGroup);
    this.listen();
    this.resize();
  }

  // ── 밖에서 부르는 것 ──────────────────────────────────────────────────────

  /**
   * 판 자료를 바꾼다. 판이 바뀌면 판 크기 · 카메라 맞춤을 다시 하고 보는 자리는 처음으로.
   * 판은 그대로고 연결만 바뀌면 선만 다시 그린다(보는 자리 그대로)
   */
  setData(dark: Layout | null, open: Layout | null, lines: LinkLine[]): void {
    this.lines = lines;
    if (this.built && this.built.dark === dark && this.built.open === open) {
      this.applyFocus();
      return;
    }
    this.built = { dark, open };
    this.clearPlates();
    const radius = Math.max(dark ? plateBounds(dark).radius : 30, open ? plateBounds(open).radius : 0);
    this.fit = { radius, gap: radius * GAP_RATIO };
    this.addDisc(0, radius, false);
    this.addDisc(this.fit.gap, radius, true);
    if (dark) this.plates.dark = this.buildPlate(dark, 0);
    if (open) this.plates.open = this.buildPlate(open, this.fit.gap);
    this.view = { zoom: 1, t: { ...this.home } };
    this.goal = null;
    this.resize();
    this.applyFocus();
  }

  /** 고른 것 · 「전체 관계 보기」 를 그린다 */
  setFocus(pick: Pick | null, showAll: boolean): void {
    this.pick = pick;
    this.showAll = showAll;
    this.applyFocus();
  }

  /**
   * 밖(슬라이더)에서 회전 각을 준다. 지금 각이거나 최근에 알린 각이면(알린 값이 늦게 돌아온 것) 그대로 —
   * 안 거르면 찾은 영토로 도는 중에 옛 각이 돌아와 움직임이 멈추고 각이 튄다
   */
  setAngle(deg: number): void {
    if (!Number.isFinite(deg)) return;
    const want = Math.round(normAngle(deg)) % 360;
    const now = performance.now();
    if (want === Math.round(this.angle) % 360) return;
    if (this.echoes.some((e) => e.deg === want && now - e.at < ECHO_MS)) {
      // 메아리로 보고 버린다. 멈춰 있을 때 버린 값이 사람이 고른 값이었다면 슬라이더와 어긋나므로 지금 각을 다시 알려 맞춘다
      if (!this.goal && !this.drag) this.events.onAngle(Math.round(this.angle) % 360);
      return;
    }
    this.goal = null;
    this.angle = normAngle(deg);
    this.reportedAngle = want;
    this.echoes.length = 0;
    this.render();
  }

  /**
   * 찾은 영토 보여 주기 — 판 옆 · 뒤쪽이면 앞으로 돌리고, 그 영토로 다가간다(이미 더 가까우면 그대로).
   * 없는 영토면 false. 고르기는 밖이 한다(LinkScene3D 가 onSelect 를 부른다)
   */
  show(web: Web, territoryId: string): boolean {
    const p = this.plates[web];
    if (!p?.byTerritory.has(territoryId)) return false;
    const at = this.anchor(p, territoryId, "top");
    if (!at) return false;
    const zoom = Math.max(this.view.zoom, FOCUS_ZOOM);
    // 갈 곳도 묶어 둔다 — 안 묶으면 판 가장자리 영토에서 카메라가 묶임에 걸려 끝없이 다가가려 한다
    this.goal = { angle: focusAngle(at.x, at.z, this.angle), zoom, t: this.clampView({ x: at.x, y: at.y, z: at.z }, zoom) };
    this.kick();
    return true;
  }

  resize(): void {
    const box = this.canvas.parentElement ?? this.canvas;
    const w = box.clientWidth || window.innerWidth;
    const h = box.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    for (const m of this.linkMats) m.resolution.set(w, h);
    const { dist, lookY } = fitCamera({ radius: this.fit.radius, gap: this.fit.gap, top: H_TOP, aspect: this.camera.aspect });
    const moved = { x: this.view.t.x - this.home.x, y: this.view.t.y - this.home.y, z: this.view.t.z - this.home.z };
    this.home = { x: 0, y: lookY, z: 0 };
    this.view.t = { x: this.home.x + moved.x, y: this.home.y + moved.y, z: this.home.z + moved.z };
    this.fitDist = dist;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.fallback);
    for (const f of this.off) f();
    this.clearPlates();
    this.clearLinks();
    this.marker.dispose();
    this.renderer.dispose();
  }

  // ── 판 쌓기 ───────────────────────────────────────────────────────────────

  private addDisc(y: number, radius: number, upper: boolean): void {
    // 판은 비쳐 보이게 깊이를 안 쓴다. 위 판은 거의 투명, 아래 판은 회청색 반투명(Figma ③-0)
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.6, 128),
      new THREE.MeshLambertMaterial({
        color: upper ? 0xffffff : 0x9aa6c6,
        transparent: true,
        opacity: upper ? 0.28 : 0.55,
        depthWrite: false,
      }),
    );
    disc.position.y = y - 0.3;
    // 둘레는 점선
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new THREE.Vector3(radius * Math.cos(a), y, radius * Math.sin(a)));
    }
    const rim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: upper ? 0x8e9ab6 : 0x6f7c9e, dashSize: 1.4, gapSize: 1.1 }),
    );
    rim.computeLineDistances();
    this.plateGroup.add(disc, rim);
  }

  /** 판 하나. 칸마다 육각 기둥 하나를 InstancedMesh 로 그린다 */
  private buildPlate(layout: Layout, y: number): Plate {
    const b = plateBounds(layout);
    const group = new THREE.Group();
    group.position.y = y;
    this.plateGroup.add(group);

    const heights = blockHeights(layout);
    const cells: CellState[] = [];
    const byTerritory = new Map<string, number[]>();
    const index = new Map<string, number>();
    for (const t of layout.territories) {
      const own: number[] = [];
      const color = new THREE.Color(t.color);
      for (const [q, r] of t.cells) {
        const p = axialToXZ(q, r);
        const base = heights.get(`${q},${r}`) ?? 0;
        index.set(`${q},${r}`, cells.length);
        own.push(cells.length);
        cells.push({ t, x: p.x - b.cx, z: p.z - b.cz, base, h: base, target: base, color, cur: color.clone(), want: color.clone() });
      }
      byTerritory.set(t.id, own);
    }

    // 뾰족 위 육각 기둥. three 의 원기둥 꼭짓점은 +z 에서 시작해 뾰족한 쪽이 z 축을 향한다 — 2D 와 같다
    const geo = new THREE.CylinderGeometry(BLOCK_R, BLOCK_R, 1, 6);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), cells.length);
    mesh.frustumCulled = false;
    group.add(mesh);

    // 영토 경계 — 블록 윗면 둘레에 옅은 흰 선(Figma 블록 윗면 테두리). 2D 영토 사이 선과 같은 변이다
    const segs = edgeSegments(layout).map((s) => {
      const c = axialToXZ(s.q, s.r);
      const k = BLOCK_R;
      return {
        cell: index.get(`${s.q},${s.r}`) ?? 0,
        a: { x: c.x + (s.a.x - c.x) * k - b.cx, z: c.z + (s.a.z - c.z) * k - b.cz },
        b: { x: c.x + (s.b.x - c.x) * k - b.cx, z: c.z + (s.b.z - c.z) * k - b.cz },
      };
    });
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segs.length * 6), 3));
    const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    edges.frustumCulled = false;
    group.add(edges);

    const plate: Plate = { layout, group, mesh, cells, segs, edgeGeo, bounds: b, byTerritory };
    this.writeInstances(plate);
    return plate;
  }

  private writeInstances(p: Plate): void {
    p.cells.forEach((c, i) => {
      M.compose(V.set(c.x, 0, c.z), Q, S.set(1, Math.max(c.h, 0.02), 1));
      p.mesh.setMatrixAt(i, M);
      p.mesh.setColorAt(i, c.cur);
    });
    p.mesh.instanceMatrix.needsUpdate = true;
    if (p.mesh.instanceColor) p.mesh.instanceColor.needsUpdate = true;
    const pos = p.edgeGeo.attributes.position.array as Float32Array;
    p.segs.forEach((s, i) => {
      const y = p.cells[s.cell].h + 0.02;
      const o = i * 6;
      pos[o] = s.a.x;
      pos[o + 1] = y;
      pos[o + 2] = s.a.z;
      pos[o + 3] = s.b.x;
      pos[o + 4] = y;
      pos[o + 5] = s.b.z;
    });
    p.edgeGeo.attributes.position.needsUpdate = true;
  }

  private clearPlates(): void {
    this.plateGroup.traverse((o) => {
      // 블록 묶음은 dispose 를 불러야 칸 자리 · 색 버퍼(GPU)가 풀린다
      if (o instanceof THREE.InstancedMesh) o.dispose();
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.plateGroup.clear();
    this.plates = { dark: null, open: null };
  }

  // ── 고르기 ────────────────────────────────────────────────────────────────

  /**
   * 고른 것에 따라 칸마다 갈 높이와 색을 정한다 (설계서 4.4 · Figma ③-1 ~ ③-3).
   * 고른 영토 · 섬, 그리고 반대쪽 층에서 그것과 이어진 영토만 쌓인 높이 · 진한 색을 지키고 나머지는 납작하게 흐려진다.
   * 관계를 고르면 그 두 끝 영토만
   */
  private applyFocus(): void {
    const layouts = { dark: this.plates.dark?.layout ?? null, open: this.plates.open?.layout ?? null };
    const f = focusOf(this.pick, layouts, this.lines, this.showAll);
    const picked = pickedLines(this.pick, layouts, this.lines, this.showAll);
    for (const web of ["dark", "open"] as const) {
      const p = this.plates[web];
      if (!p) continue;
      const keep = f.keep[web];
      for (const c of p.cells) {
        const on = !keep || keep.has(c.t.id);
        c.target = on ? c.base : H_FLOOR;
        c.want.copy(c.color);
        if (!on) c.want.lerp(FADE, 0.78);
      }
    }
    this.drawLinks(strandsOf(f.lines, picked));
    this.kick();
  }

  /**
   * 영토 한 점 (판 좌표) — 칸들의 평균에서 가장 가까운 그 영토 칸(`nearestToMean`). top 은 그 칸 윗면, bottom 은 판 아래.
   * settled 면 쌓인 높이 대신 고르기로 갈 높이(납작해질 블록이면 바닥)를 쓴다 — 연결선 끝이 블록 위에 뜨지 않게
   */
  private anchor(p: Plate, id: string, where: "top" | "bottom", settled = false): P3 | null {
    const idx = p.byTerritory.get(id);
    if (!idx?.length) return null;
    const c = p.cells[idx[nearestToMean(idx.map((i) => p.cells[i]))]];
    const h = settled ? c.target : c.base;
    return { x: c.x, y: p.group.position.y + (where === "top" ? h : -0.6), z: c.z };
  }

  private clearLinks(): void {
    for (const o of [...this.linkGroup.children]) {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose();
    }
    this.linkGroup.clear();
    this.linkMats.length = 0;
  }

  /**
   * 연결선 — 오픈웹 판 아래에서 내려와 다크웹 영토 윗면에 닿는 곡선, 아래 끝에 동그라미(설계서 4.4 · Figma ③-3).
   * 같은 영토 쌍은 선 하나(`strandsOf`). 진하지 않은 선(전체 관계 보기에서 고른 것 밖)은 옅고 가늘게, 동그라미 없이
   */
  private drawLinks(strands: Strand[]): void {
    this.clearLinks();
    const dark = this.plates.dark;
    const open = this.plates.open;
    if (!dark || !open) return;
    const w = this.renderer.domElement.width / this.renderer.getPixelRatio();
    const h = this.renderer.domElement.height / this.renderer.getPixelRatio();
    for (const l of strands) {
      const d = this.anchor(dark, l.darkId, "top", true);
      const o = this.anchor(open, l.openId, "bottom");
      if (!d || !o) continue;
      const from = new THREE.Vector3(o.x, o.y, o.z);
      const to = new THREE.Vector3(d.x, d.y + 0.05, d.z);
      const mid = new THREE.Vector3().lerpVectors(from, to, 0.5);
      // 살짝 바깥으로 휘게 — 곧은 선이 두 판의 블록을 가로지르지 않게
      const out = new THREE.Vector3(mid.x, 0, mid.z);
      if (out.lengthSq() > 1e-6) mid.add(out.normalize().multiplyScalar(this.fit.radius * 0.08));
      const pts = new THREE.CatmullRomCurve3([from, mid, to]).getPoints(40);
      const geo = new LineGeometry();
      geo.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const st = lineStyle(l.confidence);
      // 진한 선 1, 신뢰도가 빈 선 0.45, 고른 것 밖의 선 0.3
      const alpha = !l.strong ? 0.3 : st.faint ? 0.45 : 1;
      const mat = new LineMaterial({
        color: LINK_COLOR,
        linewidth: st.faint || !l.strong ? 1.2 : 2.5,
        dashed: st.dashed,
        dashSize: st.dash,
        gapSize: st.gap,
        transparent: alpha < 1,
        opacity: alpha,
      });
      mat.resolution.set(w, h);
      const line = new Line2(geo, mat);
      line.computeLineDistances();
      this.linkMats.push(mat);
      this.linkGroup.add(line);
      if (!l.strong) continue;
      // 동그라미도 선과 같은 세기로 — 신뢰도가 빈 선은 옅게
      const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.marker, depthTest: false, transparent: true, opacity: alpha }));
      dot.position.copy(to);
      dot.scale.setScalar(1.6);
      this.linkGroup.add(dot);
    }
  }

  // ── 움직임 ────────────────────────────────────────────────────────────────

  /** 그릴 것이 바뀌면 부른다. 움직임을 줄인 설정이거나 탭이 숨었으면 바로 끝 상태로 간다 */
  private kick(): void {
    if (this.reduced || document.hidden) return this.snap();
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }
    this.armFallback();
  }

  /** 끝 상태로 바로 간다 */
  private snap(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.goal) {
      this.angle = normAngle(this.goal.angle);
      this.view = { zoom: this.goal.zoom, t: this.goal.t };
      this.goal = null;
    }
    for (const p of Object.values(this.plates)) {
      if (!p) continue;
      for (const c of p.cells) {
        c.h = c.target;
        c.cur.copy(c.want);
      }
      this.writeInstances(p);
    }
    this.render();
  }

  /**
   * 화면이 숨지 않았는데도 다음 프레임이 안 오는 때가 있다(창이 다른 창 뒤에 있거나 미리보기 창이
   * 접혔을 때). 그러면 블록이 중간 높이에 멈추므로, 잠시 뒤에도 프레임이 안 왔으면 끝 상태로 간다
   */
  private armFallback(): void {
    clearTimeout(this.fallback);
    this.fallback = window.setTimeout(() => {
      if (this.raf) this.snap();
    }, 400);
  }

  private frame(now: number): void {
    this.raf = 0;
    clearTimeout(this.fallback);
    const k = 1 - Math.exp(-(now - this.last) / 110);
    this.last = now;
    let moving = false;
    for (const p of Object.values(this.plates)) {
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
      this.writeInstances(p);
    }
    if (this.goal && this.stepView(k)) moving = true;
    this.render();
    if (moving) {
      this.raf = requestAnimationFrame((t) => this.frame(t));
      this.armFallback();
    }
  }

  /** goal 쪽으로 한 걸음. 아직 움직이면 true */
  private stepView(k: number): boolean {
    const g = this.goal!;
    const turn = shortestTurn(this.angle, g.angle);
    const dz = Math.log(g.zoom / this.view.zoom);
    const d = { x: g.t.x - this.view.t.x, y: g.t.y - this.view.t.y, z: g.t.z - this.view.t.z };
    if (Math.abs(turn) < 0.05 && Math.abs(dz) < 0.002 && Math.hypot(d.x, d.y, d.z) < 0.02) {
      this.angle = normAngle(g.angle);
      this.view = { zoom: g.zoom, t: g.t };
      this.goal = null;
      return false;
    }
    this.angle = normAngle(this.angle + turn * k);
    this.view = { zoom: this.view.zoom * Math.exp(dz * k), t: { x: this.view.t.x + d.x * k, y: this.view.t.y + d.y * k, z: this.view.t.z + d.z * k } };
    return true;
  }

  /** 바라보는 점이 갈 수 있는 곳 — 판 둘레 안, 아래 판 바닥 ~ 위 판 꼭대기 (lib clampTarget) */
  private clampView(t: P3, zoom: number): P3 {
    return clampTarget(t, this.home, { radius: this.fit.radius, ylo: 0, yhi: this.fit.gap + H_TOP, zoom });
  }

  private render(): void {
    this.root.rotation.y = (this.angle * Math.PI) / 180;
    this.root.updateMatrixWorld(true);
    // 카메라는 바라보는 점에서 기울기 고정 방향으로 fitDist / 확대 만큼 떨어진다
    this.view.t = this.clampView(this.view.t, this.view.zoom);
    const w = rotateY(this.view.t, this.angle);
    const tilt = (TILT_DEG * Math.PI) / 180;
    const d = this.fitDist / this.view.zoom;
    this.camera.position.set(w.x, this.view.t.y + d * Math.sin(tilt), w.z + d * Math.cos(tilt));
    this.camera.lookAt(w.x, this.view.t.y, w.z);
    // 화각이 좁아 카메라가 멀다 — near · far 를 거리에 맞춰야 깊이 정밀도가 남아 블록 윗면 경계선이 안 깜빡인다
    const near = Math.max(0.5, d * 0.1);
    const far = d + 3 * (this.fit.radius + this.fit.gap);
    if (Math.abs(this.camera.near - near) > 1e-3 || Math.abs(this.camera.far - far) > 1e-3) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    const deg = Math.round(this.angle) % 360;
    if (deg !== this.reportedAngle) {
      this.reportedAngle = deg;
      const now = performance.now();
      while (this.echoes.length && now - this.echoes[0].at >= ECHO_MS) this.echoes.shift();
      this.echoes.push({ deg, at: now });
      this.events.onAngle(deg);
    }
  }

  // ── 누르기 · 끌기 · 확대 (휠 · 두 손가락만 — 화면 단추는 두지 않는다) ──────────

  private setPtr(cx: number, cy: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.ptr.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
  }

  private hitTerritory(cx: number, cy: number): { web: Web; territory_id: string } | null {
    this.setPtr(cx, cy);
    const plates = Object.values(this.plates).filter((p): p is Plate => !!p);
    const hit = this.ray.intersectObjects(plates.map((p) => p.mesh), false)[0];
    if (!hit || hit.instanceId == null) return null;
    const p = plates.find((x) => x.mesh === hit.object);
    return p ? { web: p.layout.web, territory_id: p.cells[hit.instanceId].t.id } : null;
  }

  /** 화면 한 점 아래의 판 좌표 — 블록, 아니면 위 판 · 아래 판 바닥면. 못 찾으면 null */
  private pointUnder(cx: number, cy: number): P3 | null {
    this.setPtr(cx, cy);
    const meshes = Object.values(this.plates).filter((p): p is Plate => !!p).map((p) => p.mesh);
    let hit: THREE.Vector3 | null = this.ray.intersectObjects(meshes, false)[0]?.point ?? null;
    if (!hit) {
      for (const y of [this.fit.gap, 0]) {
        const q = rayPlaneY(this.ray.ray.origin, this.ray.ray.direction, y);
        if (q && Math.hypot(q.x, q.z) <= this.fit.radius) {
          hit = new THREE.Vector3(q.x, q.y, q.z);
          break;
        }
      }
    }
    if (!hit) return null;
    const local = this.root.worldToLocal(hit.clone());
    return { x: local.x, y: local.y, z: local.z };
  }

  /** 확대를 z 로. 짚은 화면 점 (cx, cy) 가 제자리에 남는다 */
  private zoomTo(z: number, cx: number, cy: number): void {
    this.goal = null;
    const next = clampZoom(z);
    const at = this.pointUnder(cx, cy);
    if (at) this.view.t = zoomToward(this.view.t, at, this.view.zoom, next);
    this.view.zoom = next;
    this.render();
  }

  private spread() {
    const [a, b] = [...this.touches.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private hover(t: { web: Web; territory_id: string } | null): void {
    const key = t ? `${t.web}:${t.territory_id}` : "";
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.canvas.style.cursor = t ? "pointer" : "grab";
    this.events.onHover(t);
  }

  private listen(): void {
    const c = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (ev: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      c.addEventListener(type, fn as EventListener, opts);
      this.off.push(() => c.removeEventListener(type, fn as EventListener, opts));
    };
    const lift = (ev: PointerEvent) => {
      this.touches.delete(ev.pointerId);
      if (this.touches.size < 2) this.pinch = null;
    };
    on("pointerdown", (ev) => {
      // 마우스는 왼쪽 단추만 — 오른쪽 클릭으로 고르기가 풀리지 않게
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      this.touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      try {
        c.setPointerCapture(ev.pointerId);
      } catch {
        // 이미 끝난 포인터면 잡지 못한다 — 그래도 계속 받는다
      }
      if (this.touches.size === 2) {
        // 두 번째 손가락 — 돌리기 · 누르기를 멈추고 확대로
        this.drag = null;
        this.pinch = { d0: this.spread().d, z0: this.view.zoom };
        this.goal = null;
        return;
      }
      if (this.touches.size > 2 || this.pinch) return;
      this.goal = null;
      this.drag = { x: ev.clientX, start: this.angle, moved: false };
    });
    on("pointermove", (ev) => {
      if (this.touches.has(ev.pointerId)) this.touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.pinch && this.touches.size === 2) {
        const s = this.spread();
        this.zoomTo(pinchZoom(this.pinch.z0, this.pinch.d0, s.d), s.x, s.y);
        return;
      }
      if (this.drag) {
        const dx = ev.clientX - this.drag.x;
        if (Math.abs(dx) > 4) this.drag.moved = true;
        if (this.drag.moved) {
          this.angle = normAngle(this.drag.start + dx * 0.35);
          this.render();
        }
        return;
      }
      this.hover(this.hitTerritory(ev.clientX, ev.clientY));
    });
    on("pointerleave", () => this.hover(null));
    on("pointercancel", (ev) => {
      lift(ev);
      this.drag = null;
    });
    on("pointerup", (ev) => {
      lift(ev);
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      this.events.onPick(this.hitTerritory(ev.clientX, ev.clientY));
    });
    on(
      "wheel",
      (ev) => {
        ev.preventDefault();
        this.zoomTo(wheelZoom(this.view.zoom, ev.deltaY, ev.deltaMode), ev.clientX, ev.clientY);
      },
      { passive: false },
    );
  }
}
