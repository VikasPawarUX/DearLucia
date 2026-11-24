import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createCar(): T.Group {
  const car = new T.Group();
  const paint = new T.MeshStandardMaterial({ color: '#f63846', roughness: .72 });
  const glass = new T.MeshStandardMaterial({ color: '#63c6ef', roughness: .58 });
  const rubber = new T.MeshStandardMaterial({ color: '#47376b', roughness: .88 });
  const trim = new T.MeshStandardMaterial({ color: '#8c77c5', roughness: .77 });
  const lamp = new T.MeshStandardMaterial({ color: '#ffdda1', roughness: .57 });
  const tail = new T.MeshStandardMaterial({ color: '#a82845', roughness: .68 });

  function add(geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    car.add(mesh);
    return mesh;
  }
  function box(w: number, h: number, d: number, r: number, material: T.Material,
    x: number, y: number, z: number) {
    return add(new RoundedBoxGeometry(w, h, d, 3, r), material, x, y, z);
  }

  box(1.35, .58, 1.92, .19, paint, 0, .03, .01);
  box(1.30, .34, .75, .13, paint, 0, .27, .57);
  const profile = new T.Shape();
  profile.moveTo(-.63, -.08);
  profile.lineTo(.54, -.08);
  profile.lineTo(.28, .65);
  profile.quadraticCurveTo(.24, .75, .11, .75);
  profile.lineTo(-.52, .75);
  profile.quadraticCurveTo(-.65, .74, -.68, .62);
  profile.lineTo(-.78, .02);
  profile.closePath();
  const cabin = new T.ExtrudeGeometry(profile, {
    depth: 1.02, bevelEnabled: true, bevelSize: .075, bevelThickness: .075, bevelSegments: 4, curveSegments: 7,
  });
  cabin.rotateY(-Math.PI / 2);
  add(cabin, paint, .51, .26, 0);
  const windscreen = box(.93, .43, .075, .036, glass, 0, .67, .424);
  windscreen.rotation.x = -.342;
  for (const side of [-1, 1]) {
    const sideWindow = new T.Shape();
    sideWindow.moveTo(-.61, .14);
    sideWindow.lineTo(.405, .14);
    sideWindow.lineTo(.228, .59);
    sideWindow.quadraticCurveTo(.206, .66, .128, .66);
    sideWindow.lineTo(-.456, .66);
    sideWindow.quadraticCurveTo(-.531, .66, -.547, .586);
    sideWindow.closePath();
    const windowGeometry = new T.ExtrudeGeometry(sideWindow, {
      depth: .012, bevelEnabled: true, bevelSize: .022, bevelThickness: .018, bevelSegments: 3, curveSegments: 6,
    });
    windowGeometry.rotateY(-Math.PI / 2);
    add(windowGeometry, glass, .586 * side, .26, 0);
    for (const z of [.58, -.59]) {
      const tire = add(new T.CylinderGeometry(.282, .282, .217, 36, 1), rubber, .63 * side, -.21, z);
      tire.rotation.z = Math.PI / 2;
      const hub = add(new T.SphereGeometry(1, 24, 14), lamp, .745 * side, -.21, z);
      hub.scale.set(.042, .143, .143);
    }
    const headlight = add(new T.SphereGeometry(1, 24, 16), lamp, side * .438, .095, .95);
    headlight.scale.set(.144, .145, .073);
    box(.15, .13, .065, .032, tail, side * .43, .11, -.95);
  }
  box(1.34, .17, .235, .081, trim, 0, -.16, .935);
  box(.33, .049, .072, .024, rubber, 0, .11, .958);
  box(.33, .049, .072, .024, rubber, 0, .022, .958);
  car.rotation.set(.23, -.53, -.055, 'YXZ');
  car.scale.setScalar(1.16);
  car.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(car);
  const center = bounds.getCenter(new T.Vector3());
  car.position.set(-center.x, -center.y + .015, .145 - bounds.min.z);
  return car;
}
