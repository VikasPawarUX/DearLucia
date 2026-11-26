const pigments = ['#6b3217', '#8b4922', '#a45227', '#b17b39', '#92602b'];
const random = (min: number, max: number) => min + Math.random() * (max - min);

/** A string split into user-perceived characters, each with its marks (Intl.Segmenter when available). */
function graphemes(text: string, lang: string): { segment: string; index: number }[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(lang || undefined, { granularity: 'grapheme' }).segment(text));
  }
  const parts: { segment: string; index: number }[] = [];
  let index = 0;
  for (const segment of text) {
    // Without Segmenter, keep combining marks (accents, Thai vowels and tones, Arabic harakat) with their letter.
    if (parts.length && /\p{M}/u.test(segment)) parts[parts.length - 1].segment += segment;
    else parts.push({ segment, index });
    index += segment.length;
  }
  return parts;
}

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
  let picture: CanvasImageSource | undefined;
  try {
    const text = title.firstChild;
    // Safari can hand back a partly decoded image (only its top part painted), which would leave
    // the reveal showing half a logo. Wait for the full load, then copy it to a decoded bitmap.
    if (artwork) {
      if (!artwork.complete) {
        // An error also ends the wait (decode() then rejects), so the title screen can never hang.
        await new Promise(resolve => {
          artwork.addEventListener('load', resolve, { once: true });
          artwork.addEventListener('error', resolve, { once: true });
        });
      }
      await artwork.decode();
      picture = await createImageBitmap(artwork).catch(() => artwork);
    }
    else if (text instanceof Text) await document.fonts.load(font, text.data);
    else return;
    const style = getComputedStyle(title);
    const box = artwork
      ? { width: title.offsetWidth, height: title.offsetHeight, left: 0, top: 0 }
      : title.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const mask = document.createElement('canvas');
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // Room around the text for marks that reach past the line box: stacked Vietnamese accents,
    // Thai vowels and tone marks above and below, Arabic dots and swashes.
    const pad = artwork ? 4 : Math.max(4, Math.ceil(parseFloat(style.fontSize) * .35));
    const width = Math.ceil(box.width + pad * 2);
    const height = Math.ceil(box.height + pad * 2);
    mask.width = canvas.width = Math.ceil(width * ratio);
    mask.height = canvas.height = Math.ceil(height * ratio);
    const glyphs = mask.getContext('2d', { willReadFrequently: true });
    const ctx = canvas.getContext('2d');
    if (!glyphs || !ctx) return;

    glyphs.scale(ratio, ratio);
    const capHeight = artwork ? box.height * .48 : parseFloat(style.fontSize);
    if (artwork) {
      glyphs.drawImage(picture ?? artwork, pad, pad, box.width, box.height);
    } else if (text instanceof Text) {
      glyphs.font = font;
      const metrics = glyphs.measureText(text.data);
      const lineHeight = parseFloat(style.lineHeight);
      const ascent = metrics.fontBoundingBoxAscent ?? capHeight * .85;
      const descent = metrics.fontBoundingBoxDescent ?? capHeight * .25;
      const baseline = (lineHeight + ascent - descent) / 2;
      // Find where the browser wrapped the title, then draw each line whole, so the canvas shapes
      // it exactly as the page does: Arabic letters stay joined, Thai clusters and Vietnamese
      // accents stay together. Text is measured by grapheme (a letter with all its marks), never
      // split inside one.
      const rtl = style.direction === 'rtl';
      glyphs.direction = rtl ? 'rtl' : 'ltr';
      glyphs.textAlign = rtl ? 'right' : 'left';
      const range = document.createRange();
      const lines = new Map<number, { content: string; left: number; right: number }>();
      for (const { segment, index } of graphemes(text.data, title.lang || document.documentElement.lang)) {
        range.setStart(text, index);
        range.setEnd(text, index + segment.length);
        const rect = range.getBoundingClientRect();
        const line = Math.round((rect.top - box.top) / lineHeight);
        const previous = lines.get(line);
        const left = rect.left - box.left;
        const right = rect.right - box.left;
        if (!previous) lines.set(line, { content: segment, left, right });
        else {
          previous.content += segment;
          if (rect.width) {
            previous.left = Math.min(previous.left, left);
            previous.right = Math.max(previous.right, right);
          }
        }
      }
      for (const [line, { content, left, right }] of lines) {
        glyphs.fillText(content.trim(), (rtl ? right : left) + pad, pad + line * lineHeight + baseline);
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
        // Patches start in a left-to-right sweep with a little jitter, so the title paints in like a
        // brush stroke instead of random blotches that can leave one side missing for a moment.
        start: Math.min(.5, x / width * .42 + random(0, .08)),
        size: capHeight * random(.31, .78),
        color: pigments[Math.floor(random(0, pigments.length))],
      };
    });

    canvas.className = 'title-pigment';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.top = canvas.style.left = `${-pad}px`;
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
    if (typeof ImageBitmap !== 'undefined' && picture instanceof ImageBitmap) picture.close();
    canvas.remove();
    title.classList.remove('is-painting');
  }
}
