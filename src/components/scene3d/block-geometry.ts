import * as THREE from "three";

/** 반지름 1인 칸 안에서 이웃 블록과 간격을 유지한다. */
export const BLOCK_RADIUS = 0.9;
const BEVEL_WIDTH = 0.06;
const BEVEL_HEIGHT = 0.06;
export const BLOCK_TOP_RADIUS = BLOCK_RADIUS - BEVEL_WIDTH / Math.cos(Math.PI / 6);

/** 바닥 0, 윗면 1인 육각 기둥. 인스턴스의 Y 배율로 높이만 바꾼다. */
export function createBlockGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const x = Math.sin(angle) * BLOCK_TOP_RADIUS;
    const y = -Math.cos(angle) * BLOCK_TOP_RADIUS;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1 - BEVEL_HEIGHT * 2,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: BEVEL_HEIGHT,
    bevelSize: BEVEL_WIDTH,
    bevelSegments: 3,
    curveSegments: 1,
  });
  // 깊이축을 높이축으로 옮기고, 베벨 아래쪽도 판 위에 닿게 맞춘다.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, BEVEL_HEIGHT, 0);
  return geometry;
}
