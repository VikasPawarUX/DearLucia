import { reducedMotion } from './view';

const palette = ['#32bd54', '#f3424a', '#ffc91f', '#258ff1', '#a85be8'];
const random = (min: number, max: number) => min + Math.random() * (max - min);

export function celebrate(canvas: HTMLCanvasElement): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (reducedMotion.matches || !ctx) return Promise.resolve();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio, 1.5);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.scale(ratio, ratio);
  canvas.hidden = false;

  const pieces = Array.from({ length: width < 600 ? 24 : 38 }, () => {
    const vertices = Math.floor(random(5, 9));
    const outline = Array.from({ length: vertices }, (_, index) => {
      const angle = (index + random(-.2, .2)) * Math.PI * 2 / vertices;
      const radius = random(.3, .65);
      return [Math.cos(angle) * radius, Math.sin(angle) * radius * .72];
    });
    return {
      x: width * random(.035, .965),
      y: height * random(.035, .72),
      start: random(0, .72),
      life: random(1.45, 1.82),
      speed: random(.047, .092) * height,
      breeze: random(-15, 15),
      sway: random(4, 15),
      phase: random(0, Math.PI * 2),
      flutter: random(1.8, 3.4),
      turn: (Math.random() < .5 ? -1 : 1) * random(1.1, 2.8),
      size: random(12.6, 25.2),
      color: palette[Math.floor(Math.random() * palette.length)],
      opacity: random(.76, .98),
      outline,
    };
  });

  return new Promise(resolve => {
    const start = performance.now();
    const draw = (now: number) => {
      const elapsed = (now - start) / 1000;
      ctx.clearRect(0, 0, width, height);
      let active = false;

      for (const piece of pieces) {
        const age = elapsed - piece.start;
        if (age >= piece.life) continue;
        active = true;
        if (age < 0) continue;
        const flutter = piece.phase + age * piece.flutter;
        const x = piece.x + piece.breeze * age + piece.sway * (Math.sin(flutter) - Math.sin(piece.phase));
        const y = piece.y + piece.speed * age + height * .008 * age * age;
        if (y > height + piece.size) continue;

        ctx.save();
        ctx.globalAlpha = piece.opacity * Math.min(1, age / .24, (piece.life - age) / .44);
        ctx.translate(x, y);
        ctx.rotate(piece.phase + age * piece.turn + .25 * Math.sin(flutter));
        ctx.scale(piece.size, piece.size * (.28 + .72 * Math.abs(Math.cos(flutter))));
        ctx.fillStyle = piece.color;
        ctx.beginPath();
        const [firstX, firstY] = piece.outline[0];
        ctx.moveTo(firstX, firstY);
        for (let i = 1; i < piece.outline.length; i++) {
          const [x, y] = piece.outline[i];
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (active && !reducedMotion.matches) requestAnimationFrame(draw);
      else {
        canvas.hidden = true;
        resolve();
      }
    };
    requestAnimationFrame(draw);
  });
}
