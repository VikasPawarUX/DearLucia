import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import { createCar } from './car.ts';
import { cellPosition, divideModel, disposeTiles } from './geometry.ts';

function volume(group: T.Group): number {
  group.updateMatrixWorld(true);
  let total = 0;
  const a = new T.Vector3();
  const b = new T.Vector3();
  const c = new T.Vector3();
  group.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const geometry = object.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.index;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      a.fromBufferAttribute(position, index?.getX(i) ?? i).applyMatrix4(object.matrixWorld);
      b.fromBufferAttribute(position, index?.getX(i + 1) ?? i + 1).applyMatrix4(object.matrixWorld);
      c.fromBufferAttribute(position, index?.getX(i + 2) ?? i + 2).applyMatrix4(object.matrixWorld);
      total += a.dot(b.cross(c)) / 6;
    }
  });
  return total;
}

function capArea(tile: T.Group, axis: 'x' | 'y', side: number): number {
  let area = 0;
  const a = new T.Vector3();
  const b = new T.Vector3();
  const c = new T.Vector3();
  tile.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    const normal = object.geometry.getAttribute('normal');
    const getAxis = axis === 'x' ? 'getX' : 'getY';
    for (let i = 0; i < position.count; i += 3) {
      const isCap = [i, i + 1, i + 2].every(v =>
        Math.abs(position[getAxis](v) - side * .5) < 1e-6 && normal[getAxis](v) === side);
      if (!isCap) continue;
      a.fromBufferAttribute(position, i);
      b.fromBufferAttribute(position, i + 1);
      c.fromBufferAttribute(position, i + 2);
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
  });
  return area;
}

test('car sections preserve volume and carry matched outward-facing caps across the grid', () => {
  const car = createCar();
  const intactVolume = volume(car);
  const tiles = divideModel(car);
  let cappedSeams = 0;

  const assertSeam = (first: number, second: number, axis: 'x' | 'y', side: number) => {
    const firstArea = capArea(tiles[first], axis, side);
    const secondArea = capArea(tiles[second], axis, -side);
    assert.ok(Math.abs(firstArea - secondArea) < 1e-5, `Tiles ${first} and ${second}: ${firstArea}, ${secondArea}`);
    if (firstArea > 1e-5) cappedSeams++;
  };

  for (let i = 0; i < tiles.length; i++) {
    tiles[i].position.copy(cellPosition(i));
    if (i % 3 < 2) assertSeam(i, i + 1, 'x', 1);
    if (i < 6) assertSeam(i, i + 3, 'y', -1);
  }
  assert.ok(cappedSeams >= 6);
  const slicedVolume = tiles.reduce((sum, tile) => sum + volume(tile), 0);
  assert.ok(Math.abs(slicedVolume - intactVolume) < 1e-5, `Volumes: ${intactVolume}, ${slicedVolume}`);
  disposeTiles(tiles);
});
