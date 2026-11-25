const size = 360;
const corner = size * .09;
const bevel = size * .030;
const edgeTint = [255, 249, 232];
const tileInset = .0018 * 3 / (1 - 2 * .088);

export function paintTile(image: HTMLImageElement, index: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const width = image.naturalWidth / 3;
  const height = image.naturalHeight / 3;
  ctx.drawImage(image, (index % 3 + tileInset) * width, (Math.floor(index / 3) + tileInset) * height,
    width * (1 - 2 * tileInset), height * (1 - 2 * tileInset), 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size);
  const texture = new Uint8ClampedArray(pixels.data);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + .5 - size / 2;
      const py = y + .5 - size / 2;
      const qx = Math.abs(px) - (size / 2 - corner);
      const qy = Math.abs(py) - (size / 2 - corner);
      const ax = Math.max(0, qx);
      const ay = Math.max(0, qy);
      const length = Math.hypot(ax, ay);
      const distance = corner - length - Math.min(Math.max(qx, qy), 0);
      if (distance >= bevel) continue;
      const offset = (y * size + x) * 4;
      pixels.data[offset + 3] = 255 * Math.max(0, Math.min(1, distance + .5));
      if (distance <= -.5) continue;

      const nx = Math.sign(px) * (length ? ax / length : Number(qx > qy));
      const ny = Math.sign(py) * (length ? ay / length : Number(qy >= qx));
      // A quarter-round gives the shoulder a changing normal all the way to the lip.
      const slope = Math.min(1, 1 - distance / bevel);
      const normalZ = Math.sqrt(1 - slope * slope);
      const light = -.72 * nx - .90 * ny;
      const lit = Math.max(0, Math.min(1, light));
      const dark = Math.max(0, Math.min(1, -light));
      const crest = Math.exp(-((slope - .62) ** 2) / .086);
      const highlight = lit * (.16 * slope + .86 * crest);
      const shade = 1 - dark * (.34 * slope + .27 * (1 - normalZ));
      const bend = bevel * .36 * slope * slope;
      const sx = Math.round(x - nx * bend);
      const sy = Math.round(y - ny * bend);
      const source = (sy * size + sx) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const warmth = edgeTint[channel];
        pixels.data[offset + channel] = texture[source + channel] * shade * (1 - highlight) + warmth * highlight;
      }
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}
