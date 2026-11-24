import * as T from 'three';

function roundedRect(path: T.Path, half: number, radius: number): void {
  path.moveTo(-half + radius, -half);
  path.lineTo(half - radius, -half);
  path.quadraticCurveTo(half, -half, half, -half + radius);
  path.lineTo(half, half - radius);
  path.quadraticCurveTo(half, half, half - radius, half);
  path.lineTo(-half + radius, half);
  path.quadraticCurveTo(-half, half, -half, half - radius);
  path.lineTo(-half, -half + radius);
  path.quadraticCurveTo(-half, -half, -half + radius, -half);
}

export function createFrame(): T.Mesh {
  const outline = new T.Shape();
  const opening = new T.Path();
  roundedRect(outline, 1.575, .105);
  roundedRect(opening, 1.525, .045);
  outline.holes.push(opening);
  const geometry = new T.ExtrudeGeometry(outline, {
    depth: .1,
    bevelThickness: .022,
    bevelSize: .018,
    bevelSegments: 4,
    curveSegments: 8,
    steps: 1,
  });
  geometry.translate(0, 0, -.081);
  const material = new T.MeshStandardMaterial({ color: '#eed4ae', roughness: .94, metalness: 0 });
  return new T.Mesh(geometry, material);
}
