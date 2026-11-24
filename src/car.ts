import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mountToPlane } from './mount.ts';

export function createCar(): T.Group {
  const car = new T.Group();
  const paint = new T.MeshStandardMaterial({ color: '#ed6a68', roughness: .9 });
  const glass = new T.MeshStandardMaterial({ color: '#9dd7ea', roughness: .87 });
  const rubber = new T.MeshStandardMaterial({ color: '#594567', roughness: .95 });
  const trim = new T.MeshStandardMaterial({ color: '#997fb6', roughness: .91 });
  const lamp = new T.MeshStandardMaterial({ color: '#ffe5b9', roughness: .91 });

  function add(geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    car.add(mesh);
    return mesh;
  }
  function box(w: number, h: number, d: number, r: number, material: T.Material,
    x: number, y: number, z: number) {
    return add(new RoundedBoxGeometry(w, h, d, 5, r), material, x, y, z);
  }

  const chassis = box(1.35, .58, 1.92, .19, paint, 0, .03, .01);
  box(1.30, .34, .75, .13, paint, 0, .27, .57);
  const cabin = new RoundedBoxGeometry(1.13, .86, 1.31, 6, .14);
  const positions = cabin.getAttribute('position');
  const normals = cabin.getAttribute('normal');
  const normal = new T.Vector3();
  // Taper the roof and rake the windshield while retaining smooth bevel normals.
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const taper = .93 - y * .18;
    const slope = -.18 * z - .18;
    positions.setZ(i, z * taper - y * .18);
    normal.fromBufferAttribute(normals, i);
    normal.set(normal.x, normal.y - slope * normal.z / taper, normal.z / taper).normalize();
    normals.setXYZ(i, normal.x, normal.y, normal.z);
  }
  const roof = add(cabin, paint, 0, .61, -.13);
  const windscreen = box(.90, .40, .077, .037, glass, 0, .68, .474);
  windscreen.rotation.x = -.342;
  const mountedParts = [chassis, roof];
  for (const side of [-1, 1]) {
    const sideWindow = box(.07, .39, .80, .034, glass, .552 * side, .69, -.17);
    sideWindow.rotation.x = -.12;
    for (const z of [.58, -.59]) {
      const tire = add(new T.CylinderGeometry(.282, .282, .217, 36, 1), rubber, .63 * side, -.21, z);
      tire.rotation.z = Math.PI / 2;
      mountedParts.push(tire);
      const hub = add(new T.SphereGeometry(1, 24, 14), lamp, .745 * side, -.21, z);
      hub.scale.set(.042, .143, .143);
    }
    const headlight = add(new T.SphereGeometry(1, 24, 16), lamp, side * .438, .095, .95);
    headlight.scale.set(.144, .145, .073);
  }
  box(1.34, .17, .235, .081, trim, 0, -.16, .935);
  box(.33, .049, .072, .024, rubber, 0, .11, .958);
  car.rotation.set(.23, -.53, -.055, 'YXZ');
  car.scale.setScalar(1.01);
  car.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(car);
  const center = bounds.getCenter(new T.Vector3());
  const depth = .51;
  car.position.set(-center.x, -center.y + .09, .093 / depth - bounds.min.z);
  const mountedCar = new T.Group();
  mountedCar.scale.z = depth;
  mountedCar.add(car);
  mountedCar.updateMatrixWorld(true);
  for (const part of mountedParts) {
    const original = part.geometry;
    const surface = (original.index ? original.toNonIndexed() : original.clone())
      .applyMatrix4(part.matrixWorld);
    const mounted = mountToPlane(surface, .061);
    mounted.applyMatrix4(part.matrixWorld.clone().invert());
    part.geometry = mounted;
    original.dispose();
    surface.dispose();
  }
  return mountedCar;
}
