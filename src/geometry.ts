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
      for (const triangle of triangles) {
        const polygon = cuts.reduce(clip, triangle);
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
