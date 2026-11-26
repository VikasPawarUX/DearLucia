const pigments = ['#6b3217', '#8b4922', '#a45227', '#b17b39', '#92602b'];
const random = (min: number, max: number) => min + Math.random() * (max - min);

function smooth(from: number, to: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export async function paintReveal(title: HTMLElement, delay: number, duration: number, artwork?: HTMLImageElement): Promise<void> {
  const original = getComputedStyle(title);
  const ink = original.color;
  const font = `${original.fontWeight} ${original.fontSize} ${original.fontFamily}`;
  title.classList.add('is-painting');

  const canvas = document.createElement('canvas');
  try {
    const text = title.firstChild;
    if (artwork) await artwork.decode();
    else if (text instanceof Text) await document.fonts.load(font, text.data);
    else return;
    const style = getComputedStyle(title);
    const box = artwork
      ? { width: title.offsetWidth, height: title.offsetHeight, left: 0, top: 0 }
      : title.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const mask = document.createElement('canvas');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.ceil(box.width + 8);
    const height = Math.ceil(box.height + 8);
    mask.width = canvas.width = Math.ceil(width * ratio);
    mask.height = canvas.height = Math.ceil(height * ratio);
    const glyphs = mask.getContext('2d', { willReadFrequently: true });
    const ctx = canvas.getContext('2d');
    if (!glyphs || !ctx) return;

    glyphs.scale(ratio, ratio);
    const capHeight = artwork ? box.height * .48 : parseFloat(style.fontSize);
    if (artwork) {
      glyphs.drawImage(artwork, 4, 4, box.width, box.height);
    } else if (text instanceof Text) {
      glyphs.font = font;
      const metrics = glyphs.measureText(text.data);
      const lineHeight = parseFloat(style.lineHeight);
      const ascent = metrics.fontBoundingBoxAscent ?? capHeight * .85;
      const descent = metrics.fontBoundingBoxDescent ?? capHeight * .25;
      const baseline = (lineHeight + ascent - descent) / 2;
      const range = document.createRange();
      const lines = new Map<number, { content: string; left: number }>();
      let offset = 0;
      for (const character of text.data) {
        range.setStart(text, offset);
        offset += character.length;
        range.setEnd(text, offset);
        const rect = range.getBoundingClientRect();
        const line = Math.round((rect.top - box.top) / lineHeight);
        const previous = lines.get(line);
        if (previous) previous.content += character;
        else lines.set(line, { content: character, left: rect.left - box.left });
      }
      for (const [line, { content, left }] of lines) {
        glyphs.fillText(content.trimEnd(), left + 4, 4 + line * lineHeight + baseline);
      }

    }

    const alpha = glyphs.getImageData(0, 0, mask.width, mask.height).data;
    const points: [number, number][] = [];
    const step = Math.max(2, Math.round(capHeight * ratio / 11));
    for (let y = step; y < mask.height; y += step) {
      for (let x = step; x < mask.width; x += step) {
        if (alpha[(y * mask.width + x) * 4 + 3] > 160) points.push([x / ratio, y / ratio]);
      }
    }
    if (!points.length) return;

    const count = Math.min(75, Math.max(18, Math.round(box.width / capHeight * 5)));
    const patches = Array.from({ length: count }, (_, index) => {
      const [x, y] = points[Math.floor((index + Math.random()) * points.length / count)];
      const outline = new Path2D();
      const edges = 13;
      for (let i = 0; i < edges; i++) {
        const angle = (i + random(-.24, .24)) / edges * 2 * Math.PI;
        const r = random(.58, 1.16);
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r * .56;
        if (i === 0) outline.moveTo(px, py);
        else outline.lineTo(px, py);
      }
      outline.closePath();
      return {
        x, y, outline,
        angle: random(-1.35, 1.35),
        start: random(0, .5),
        size: capHeight * random(.31, .78),
        color: pigments[Math.floor(random(0, pigments.length))],
      };
    });

    canvas.className = 'title-pigment';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    title.append(canvas);
    ctx.scale(ratio, ratio);
    await new Promise<void>(resolve => {
      const start = performance.now() + delay;
      const motion = matchMedia('(prefers-reduced-motion: reduce)');
      const draw = (now: number) => {
        const progress = (now - start) / duration;
        if (progress >= 1 || motion.matches) {
          resolve();
          return;
        }
        if (progress >= 0) {
          ctx.clearRect(0, 0, width, height);
          const finish = smooth(.64, 1, progress);
          for (const patch of patches) {
            const growth = smooth(patch.start, patch.start + .49, progress);
            if (!growth) continue;
            ctx.save();
            ctx.translate(patch.x, patch.y);
            ctx.rotate(patch.angle);
            ctx.scale(patch.size * growth, patch.size * growth);
            ctx.fillStyle = patch.color;
            ctx.globalAlpha = Math.min(1, growth * 4);
            ctx.fill(patch.outline);
            ctx.restore();
          }
          ctx.save();
          ctx.fillStyle = ink;
          ctx.globalAlpha = finish;
          if (artwork) ctx.drawImage(mask, 0, 0, width, height);
          else ctx.fillRect(0, 0, width, height);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(mask, 0, 0, width, height);
          ctx.restore();
        }
        requestAnimationFrame(draw);
      };
      requestAnimationFrame(draw);
    });
  } finally {
    canvas.remove();
    title.classList.remove('is-painting');
  }
}
