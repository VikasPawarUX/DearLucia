import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cellPosition, divideModel, disposeTiles } from './geometry';
import { createFrame } from './frame';
import { EMPTY } from './puzzle';

const ease = (t: number) => 1 - (1 - t) ** 3;
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export class PuzzleView {
  private renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  private scene = new T.Scene();
  private camera = new T.OrthographicCamera(-2.18, 2.18, 2.18, -2.18, .1, 30);
  private tiles: T.Group[] = [];

  constructor(host: HTMLElement) {
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFShadowMap;
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    host.append(renderer.domElement);
    const tilt = T.MathUtils.degToRad(10);
    this.camera.position.set(.39, Math.sin(tilt) * 8, Math.cos(tilt) * 8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(createFrame());
    this.scene.add(new T.HemisphereLight(0xfffbf4, 0xcabcb1, 2.02));
    const light = new T.DirectionalLight(0xfff4e6, 1.65);
    light.position.set(-2.8, 3.8, 9);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 17 });
    light.shadow.normalBias = .007;
    light.shadow.bias = -.0001;
    light.shadow.radius = 5;
    light.shadow.intensity = .52;
    this.scene.add(light);
    const fill = new T.DirectionalLight(0xe3e8ff, .43);
    fill.position.set(4, -2, 5);
    this.scene.add(fill);
    const resize = () => {
      const size = host.clientWidth;
      if (size > 0) renderer.setSize(size, size, false);
      this.draw();
    };
    new ResizeObserver(resize).observe(host);
    resize();
  }

  load(model: T.Group, layout: readonly number[], showFinal = false): void {
    disposeTiles(this.tiles);
    this.tiles = divideModel(model);
    const ivory = new T.MeshStandardMaterial({ color: '#fff2dc', roughness: .91, metalness: 0 });
    const geometry = new RoundedBoxGeometry(.976, .976, .14, 4, .026);
    for (const tile of this.tiles) {
      const base = new T.Mesh(geometry, ivory);
      base.receiveShadow = true;
      tile.add(base);
      this.scene.add(tile);
    }
    this.reset(layout, showFinal);
  }

  reset(layout: readonly number[], showFinal = false): void {
    layout.forEach((tile, index) => {
      const mesh = this.tiles[tile];
      mesh.position.copy(cellPosition(index));
      mesh.scale.setScalar(1);
      mesh.visible = tile !== EMPTY || showFinal;
    });
    this.draw();
  }

  async move(tile: number, index: number): Promise<void> {
    const mesh = this.tiles[tile];
    const from = mesh.position.clone();
    const to = cellPosition(index);
    await this.animate(190, t => {
      mesh.position.lerpVectors(from, to, ease(t));
      mesh.position.z = Math.sin(Math.PI * t) * .045;
    });
    mesh.position.copy(to);
    this.draw();
  }

  async stamp(): Promise<void> {
    const mesh = this.tiles[EMPTY];
    const to = cellPosition(EMPTY);
    mesh.visible = true;
    await this.animate(510, t => {
      const progress = t ** 2.5;
      mesh.position.set(to.x + .12 * (1 - progress), to.y + .82 * (1 - progress), 1.2 * (1 - progress));
      mesh.scale.setScalar(1 + .32 * (1 - progress));
    });
    mesh.position.copy(to);
    mesh.scale.setScalar(1);
    this.draw();
  }

  private draw(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private animate(duration: number, update: (t: number) => void): Promise<void> {
    if (reducedMotion.matches) {
      update(1);
      this.draw();
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const start = performance.now();
      const frame = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        update(t);
        this.draw();
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }
}
