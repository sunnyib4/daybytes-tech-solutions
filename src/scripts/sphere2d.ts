/**
 * Lightweight 2D-canvas version of the hero network for phones (and for
 * desktops without WebGL). Same engine as the WebGL sphere, fewer nodes,
 * no React or three.js. Never runs for prefers-reduced-motion.
 */
import { Network, PROBLEM_EVENT, connectionState } from './network';
import { onPageLoad, prefersReducedMotion } from './lifecycle';

const NODE_COUNT = 150;
const TURN_SECONDS = 50;
const TILT_X = 0.38;
const ARC_SEGMENTS = 6;

const supportsWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

/** Pre-rendered soft glow, drawn with drawImage (much cheaper than shadowBlur). */
function glowSprite(rgb: string) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.18, `rgba(${rgb},0.9)`);
  grad.addColorStop(0.45, `rgba(${rgb},0.25)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function start(canvas: HTMLCanvasElement, host: HTMLElement, signal: AbortSignal) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const net = new Network({ count: NODE_COUNT, neighbours: 3, maxConnections: 26, spawnEvery: 0.74, glowingShare: 0.2, seed: 5 });
  const nodeGlow = glowSprite('255,138,61');
  const pulseGlow = glowSprite('255,220,170');

  let size = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = canvas.clientWidth;
    canvas.width = canvas.height = Math.round(size * dpr);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Rotation: spin around Y, then a fixed tilt around X. Projected orthographically.
  let angle = 0;
  const cosT = Math.cos(TILT_X);
  const sinT = Math.sin(TILT_X);
  const proj = new Float32Array(NODE_COUNT * 3);
  const project = (x: number, y: number, z: number, out: number[] | Float32Array, o: number) => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const x1 = x * ca + z * sa;
    const z1 = -x * sa + z * ca;
    out[o] = x1;
    out[o + 1] = y * cosT - z1 * sinT;
    out[o + 2] = y * sinT + z1 * cosT;
  };
  const isFront = (i: number) => proj[i * 3 + 2] > 0.35;
  const facing = (z: number) => Math.min(Math.max(z / 0.45, 0), 1);

  const tmp = [0, 0, 0];
  const pt = [0, 0, 0];
  let time = 0;
  let last = performance.now();
  let raf = 0;
  let running = false;

  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    angle += (dt * Math.PI * 2) / TURN_SECONDS;
    for (let i = 0; i < NODE_COUNT; i++) {
      project(net.positions[i * 3], net.positions[i * 3 + 1], net.positions[i * 3 + 2], proj, i * 3);
    }
    net.update(dt, isFront);

    const R = (size / 2) * dpr;
    const sx = (x: number) => R + x * R * 0.985;
    const sy = (y: number) => R - y * R * 0.985;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Core: same gradient as the static artwork (centre 46% / 40%).
    ctx.save();
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();
    const core = ctx.createRadialGradient(R * 0.92, R * 0.8, 0, R * 0.92, R * 0.8, R * 1.613);
    [
      [0, '#0E0D0C'],
      [0.3, '#1F1B19'],
      [0.52, '#4A3529'],
      [0.7, '#B8693A'],
      [0.82, '#F5A06A'],
      [0.92, '#FFE6D6'],
      [1, '#FFFFFF'],
    ].forEach(([o, c]) => core.addColorStop(o as number, c as string));
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, R * 2, R * 2);

    ctx.globalCompositeOperation = 'lighter';

    // Faint resting mesh.
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'rgba(255,143,72,0.13)';
    ctx.beginPath();
    for (const [a, b] of net.edges) {
      if (proj[a * 3 + 2] < 0.15 || proj[b * 3 + 2] < 0.15) continue;
      ctx.moveTo(sx(proj[a * 3]), sy(proj[a * 3 + 1]));
      ctx.lineTo(sx(proj[b * 3]), sy(proj[b * 3 + 1]));
    }
    ctx.stroke();

    // Live connections and pulses.
    ctx.lineWidth = 1.4 * dpr;
    for (const c of net.connections) {
      const { head, pulse, alpha } = connectionState(c);
      if (alpha <= 0 || head <= 0) continue;
      const fz = Math.min(proj[c.a * 3 + 2], proj[c.b * 3 + 2]);
      const a = alpha * facing(fz);
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(255,150,80,${0.9 * a})`;
      ctx.beginPath();
      for (let s = 0; s <= ARC_SEGMENTS; s++) {
        net.arcPoint(c.a, c.b, (s / ARC_SEGMENTS) * head, tmp);
        project(tmp[0], tmp[1], tmp[2], pt, 0);
        s === 0 ? ctx.moveTo(sx(pt[0]), sy(pt[1])) : ctx.lineTo(sx(pt[0]), sy(pt[1]));
      }
      ctx.stroke();
      if (pulse >= 0) {
        net.arcPoint(c.a, c.b, pulse, tmp, 0, 1.016);
        project(tmp[0], tmp[1], tmp[2], pt, 0);
        const r = 13 * dpr;
        ctx.globalAlpha = a;
        ctx.drawImage(pulseGlow, sx(pt[0]) - r, sy(pt[1]) - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }

    // Nodes: dim breathing rings; glowing / just-lit nodes get a soft orange glow.
    for (let i = 0; i < NODE_COUNT; i++) {
      const z = proj[i * 3 + 2];
      if (z < 0.02) continue;
      const f = facing(z);
      const x = sx(proj[i * 3]);
      const y = sy(proj[i * 3 + 1]);
      const breathe = net.breathe(i, time);
      const hot = Math.max(net.glowing[i] * (0.45 + 0.55 * breathe), net.lit[i]);
      if (hot > 0.05) {
        const r = (7 + 9 * hot) * dpr;
        ctx.globalAlpha = f * Math.min(hot * 1.2, 1);
        ctx.drawImage(nodeGlow, x - r, y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = `rgba(255,128,64,${f * (0.3 + 0.35 * breathe)})`;
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.arc(x, y, 3.6 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  };

  const play = () => {
    if (running) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const pause = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // Pause when the hero is off-screen or the tab is hidden.
  let onScreen = true;
  const sync = () => (onScreen && !document.hidden ? play() : pause());
  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', sync, { signal });

  const onProblem = () => net.burst(isFront);
  window.addEventListener(PROBLEM_EVENT, onProblem, { signal });
  const first = window.setTimeout(onProblem, 700);

  host.setAttribute('data-sphere-live', '');
  sync();

  signal.addEventListener('abort', () => {
    pause();
    io.disconnect();
    ro.disconnect();
    window.clearTimeout(first);
    host.removeAttribute('data-sphere-live');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
}

onPageLoad((pageSignal) => {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-sphere-2d]');
  const host = canvas?.closest<HTMLElement>('[data-sphere]');
  if (!canvas || !host) return;

  const phone = window.matchMedia('(max-width: 767px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const webgl = supportsWebGL();
  let run: AbortController | undefined;

  // Re-evaluate when the viewport crosses the phone breakpoint or the motion setting changes.
  const evaluate = () => {
    const shouldRun = !prefersReducedMotion() && (phone.matches || !webgl);
    if (shouldRun && !run) {
      run = new AbortController();
      start(canvas, host, run.signal);
    } else if (!shouldRun && run) {
      run.abort();
      run = undefined;
    }
  };
  evaluate();
  phone.addEventListener('change', evaluate, { signal: pageSignal });
  reduced.addEventListener('change', evaluate, { signal: pageSignal });
  pageSignal.addEventListener('abort', () => run?.abort());
});
