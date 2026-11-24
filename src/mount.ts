import * as T from 'three';

// Close the back of a convex sculpture against the tile's mounting plane while
// preserving the rounded, forward-facing surface and its authored normals.
export function mountToPlane(geometry: T.BufferGeometry, height: number): T.BufferGeometry {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const front: number[] = [];
  const normals: number[] = [];
  const outline = new Map<string, [T.Vector3, T.Vector3]>();
  const key = (p: T.Vector3) => [p.x, p.y, p.z].map(value => Math.round(value * 1e6)).join(',');
  const back = (p: T.Vector3) => new T.Vector3(p.x, p.y, height);
  const down = new T.Vector3(0, 0, -1);
  const push = (p: T.Vector3, n: T.Vector3) => {
    front.push(p.x, p.y, p.z);
    normals.push(n.x, n.y, n.z);
  };

  for (let i = 0; i < position.count; i += 3) {
    const vertices = [i, i + 1, i + 2].map(index => new T.Vector3().fromBufferAttribute(position, index));
    const [a, b, c] = vertices;
    if ((b.x - a.x) * (c.y - a.y) <= (b.y - a.y) * (c.x - a.x) + 1e-10) continue;
    vertices.forEach((p, offset) => push(p, new T.Vector3().fromBufferAttribute(normal, i + offset)));
    for (const p of [a, c, b]) push(back(p), down);
    for (const [start, end] of [[a, b], [b, c], [c, a]]) {
      if (!outline.delete(`${key(end)}|${key(start)}`)) {
        outline.set(`${key(start)}|${key(end)}`, [start, end]);
      }
    }
  }
  for (const [a, b] of outline.values()) {
    const n = new T.Vector3(b.y - a.y, a.x - b.x, 0).normalize();
    for (const p of [a, back(a), back(b), a, back(b), b]) push(p, n);
  }
  const mounted = new T.BufferGeometry();
  mounted.setAttribute('position', new T.Float32BufferAttribute(front, 3));
  mounted.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  return mounted;
}
