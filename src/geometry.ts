import * as T from 'three';

type Vertex = { position: T.Vector3; normal: T.Vector3 };
type Axis = 'x' | 'y';
type Cut = { axis: Axis; value: number; sign: number };

export function cellPosition(index: number): T.Vector3 {
  return new T.Vector3(index % 3 - 1, 1 - Math.floor(index / 3), 0);
}

function clip(polygon: Vertex[], { axis, value, sign }: Cut): Vertex[] {
  const result: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const from = polygon[i];
    const to = polygon[(i + 1) % polygon.length];
    const d0 = (from.position[axis] - value) * sign;
    const d1 = (to.position[axis] - value) * sign;
    if (d0 >= 0) result.push(from);
    if ((d0 >= 0) !== (d1 >= 0)) {
      const fraction = d0 / (d0 - d1);
      result.push({
        position: from.position.clone().lerp(to.position, fraction),
        normal: from.normal.clone().lerp(to.normal, fraction).normalize(),
      });
    }
  }
  return result;
}

const precision = 1e-6;

function sectionCap(segments: [T.Vector3, T.Vector3][], cut: Cut): Vertex[][] {
  const pointKey = (p: T.Vector3) => {
    const u = cut.axis === 'x' ? p.y : p.x;
    return `${Math.round(u / precision)},${Math.round(p.z / precision)}`;
  };
  const points = new Map<string, T.Vector3>();
  const links = new Map<string, Set<string>>();
  for (const [a, b] of segments) {
    const first = pointKey(a);
    const second = pointKey(b);
    if (first === second) continue;
    points.set(first, a);
    points.set(second, b);
    for (const [from, to] of [[first, second], [second, first]]) {
      if (!links.has(from)) links.set(from, new Set());
      links.get(from)!.add(to);
    }
  }

  const normal = new T.Vector3();
  normal[cut.axis] = -cut.sign;
  const triangles: Vertex[][] = [];
  const contours: T.Vector3[][] = [];
  const removeEdge = (a: string, b: string) => {
    links.get(a)!.delete(b);
    links.get(b)!.delete(a);
  };
  for (const [start, edges] of links) {
    while (edges.size) {
      const contour = [points.get(start)!];
      let previous = start;
      let next = edges.values().next().value;
      while (next !== undefined && next !== start) {
        contour.push(points.get(next)!);
        removeEdge(previous, next);
        previous = next;
        next = links.get(next)!.values().next().value;
      }
      if (next !== start) continue;
      removeEdge(previous, start);
      if (contour.length >= 3) contours.push(contour);
    }
  }

  const project = (position: T.Vector3) =>
    new T.Vector2(cut.axis === 'x' ? position.y : position.x, position.z);
  const edgeA = new T.Vector3();
  const edgeB = new T.Vector3();
  for (const contour of contours) {
    for (const face of T.ShapeUtils.triangulateShape(contour.map(project), [])) {
      const [a, b, c] = face.map(i => contour[i]);
      if (edgeA.subVectors(b, a).cross(edgeB.subVectors(c, a)).dot(normal) < 0) {
        triangles.push([a, c, b].map(position => ({ position, normal })));
      } else {
        triangles.push([a, b, c].map(position => ({ position, normal })));
      }
    }
  }
  return triangles;
}

function sliceClosedMesh(faces: Vertex[][], cut: Cut): Vertex[][] {
  const result: Vertex[][] = [];
  const segments: [T.Vector3, T.Vector3][] = [];
  for (const face of faces) {
    const polygon = clip(face, cut);
    if (polygon.length < 3) continue;
    result.push(polygon);
    if (!face.some(vertex => (vertex.position[cut.axis] - cut.value) * cut.sign < -precision)) continue;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i].position;
      const b = polygon[(i + 1) % polygon.length].position;
      if (Math.abs(a[cut.axis] - cut.value) < precision && Math.abs(b[cut.axis] - cut.value) < precision) {
        segments.push([a, b]);
      }
    }
  }
  return result.concat(sectionCap(segments, cut));
}

export function divideModel(model: T.Group): T.Group[] {
  const sections = Array.from({ length: 9 }, () => new T.Group());
  model.updateMatrixWorld(true);
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone())
      .applyMatrix4(object.matrixWorld);
    const pos = geometry.getAttribute('position');
    const norm = geometry.getAttribute('normal');
    const triangles: Vertex[][] = [];
    for (let i = 0; i < pos.count; i += 3) {
      triangles.push([i, i + 1, i + 2].map(index => ({
        position: new T.Vector3().fromBufferAttribute(pos, index),
        normal: new T.Vector3().fromBufferAttribute(norm, index),
      })));
    }
    sections.forEach((section, index) => {
      const center = cellPosition(index);
      const cuts: Cut[] = [
        { axis: 'x', value: center.x - .5, sign: 1 },
        { axis: 'x', value: center.x + .5, sign: -1 },
        { axis: 'y', value: center.y - .5, sign: 1 },
        { axis: 'y', value: center.y + .5, sign: -1 },
      ];
      const positions: number[] = [];
      const normals: number[] = [];
      for (const polygon of cuts.reduce(sliceClosedMesh, triangles)) {
        for (let i = 1; i + 1 < polygon.length; i++) {
          for (const vertex of [polygon[0], polygon[i], polygon[i + 1]]) {
            positions.push(vertex.position.x - center.x, vertex.position.y - center.y, vertex.position.z);
            normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
          }
        }
      }
      if (positions.length === 0) return;
      const part = new T.BufferGeometry();
      part.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      part.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
      const mesh = new T.Mesh(part, object.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      section.add(mesh);
    });
    geometry.dispose();
    object.geometry.dispose();
  });
  return sections;
}

export function disposeTiles(tiles: readonly T.Group[]): void {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  for (const tile of tiles) {
    tile.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach(material => materials.add(material));
    });
    tile.removeFromParent();
  }
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
}
