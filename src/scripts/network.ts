/**
 * Renderer-agnostic "living network" used by the hero sphere.
 * Nodes sit on a unit sphere; connections draw themselves between
 * neighbouring nodes, send a pulse across, light up the target and fade.
 * The WebGL (desktop) and 2D canvas (mobile) renderers both read this state.
 */

export interface Connection {
  a: number;
  b: number;
  /** Seconds since this connection started (negative while waiting to start). */
  t: number;
  lit: boolean;
}

export interface NetworkOptions {
  count: number;
  neighbours?: number;
  maxConnections?: number;
  /** Average seconds between ambient connections. */
  spawnEvery?: number;
  glowingShare?: number;
  seed?: number;
}

/** Event fired by the hero problem carousel when it moves to a new problem. */
export const PROBLEM_EVENT = 'daybytes:problem';

export const CONNECTION_SECONDS = 1.7;
const DRAW_END = 0.3; // fraction of the lifetime spent drawing the line
const PULSE_END = 0.72; // ...then the pulse travels until here, then the line fades

/** Phase helpers for a connection at time t. */
export function connectionState(c: Connection) {
  const p = c.t / CONNECTION_SECONDS;
  return {
    /** 0..1 how far the line has been drawn from a to b. */
    head: Math.min(Math.max(p / DRAW_END, 0), 1),
    /** 0..1 position of the travelling pulse, or -1 when there is none. */
    pulse: p > DRAW_END && p < PULSE_END ? (p - DRAW_END) / (PULSE_END - DRAW_END) : -1,
    /** Overall line opacity. */
    alpha: p < 0 ? 0 : p < PULSE_END ? 1 : Math.max(1 - (p - PULSE_END) / (1 - PULSE_END), 0),
  };
}

function rng(seed: number) {
  let s = seed % 2147483647;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export class Network {
  readonly count: number;
  /** xyz per node, unit length. */
  readonly positions: Float32Array;
  readonly phase: Float32Array;
  readonly speed: Float32Array;
  /** 1 for the minority of nodes that glow orange at rest. */
  readonly glowing: Float32Array;
  /** 0..1 temporary highlight when a pulse arrives; decays over time. */
  readonly lit: Float32Array;
  readonly neighbours: number[][];
  /** Unique [a, b] pairs for the faint resting mesh. */
  readonly edges: [number, number][];
  connections: Connection[] = [];

  private readonly maxConnections: number;
  private readonly spawnEvery: number;
  private nextSpawn = 0.4;
  private readonly random: () => number;

  constructor({ count, neighbours = 4, maxConnections = 48, spawnEvery = 0.9, glowingShare = 0.13, seed = 11 }: NetworkOptions) {
    this.count = count;
    this.maxConnections = maxConnections;
    this.spawnEvery = spawnEvery;
    this.random = rng(seed);
    const r = this.random;

    // Fibonacci lattice with jitter: even coverage, but organic rather than a grid.
    this.positions = new Float32Array(count * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - ((i + 0.5) / count) * 2 + (r() - 0.5) * (1.4 / count);
      const radius = Math.sqrt(Math.max(1 - y * y, 0));
      const theta = golden * i + (r() - 0.5) * 0.9;
      const v = [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
      const len = Math.hypot(v[0], v[1], v[2]);
      this.positions.set([v[0] / len, v[1] / len, v[2] / len], i * 3);
    }

    this.phase = Float32Array.from({ length: count }, () => r() * Math.PI * 2);
    this.speed = Float32Array.from({ length: count }, () => 0.6 + r() * 0.9);
    this.glowing = Float32Array.from({ length: count }, () => (r() < glowingShare ? 1 : 0));
    this.lit = new Float32Array(count);

    // k nearest neighbours by dot product (fine for a few hundred nodes, runs once).
    this.neighbours = [];
    const seen = new Set<string>();
    this.edges = [];
    for (let i = 0; i < count; i++) {
      const dots: [number, number][] = [];
      for (let j = 0; j < count; j++) {
        if (i !== j) dots.push([j, this.dot(i, j)]);
      }
      dots.sort((x, y) => y[1] - x[1]);
      const near = dots.slice(0, neighbours).map(([j]) => j);
      this.neighbours.push(near);
      for (const j of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          this.edges.push([i, j]);
        }
      }
    }
  }

  dot(i: number, j: number) {
    const p = this.positions;
    return p[i * 3] * p[j * 3] + p[i * 3 + 1] * p[j * 3 + 1] + p[i * 3 + 2] * p[j * 3 + 2];
  }

  /** Point on the arc from node a to node b (s in 0..1), written into out. */
  arcPoint(a: number, b: number, s: number, out: Float32Array | number[], offset = 0, radius = 1.012) {
    const p = this.positions;
    const x = p[a * 3] + (p[b * 3] - p[a * 3]) * s;
    const y = p[a * 3 + 1] + (p[b * 3 + 1] - p[a * 3 + 1]) * s;
    const z = p[a * 3 + 2] + (p[b * 3 + 2] - p[a * 3 + 2]) * s;
    const k = radius / Math.hypot(x, y, z);
    out[offset] = x * k;
    out[offset + 1] = y * k;
    out[offset + 2] = z * k;
  }

  /** Resting brightness 0..1 for node i (slow, staggered breathing). */
  breathe(i: number, time: number) {
    return 0.5 + 0.5 * Math.sin(time * this.speed[i] + this.phase[i]);
  }

  private connect(a: number, b: number, delay = 0) {
    if (this.connections.length >= this.maxConnections) return false;
    this.connections.push({ a, b, t: -delay, lit: false });
    return true;
  }

  private pick(isFront: (i: number) => boolean) {
    for (let tries = 0; tries < 12; tries++) {
      const i = Math.floor(this.random() * this.count);
      if (isFront(i)) return i;
    }
    return Math.floor(this.random() * this.count);
  }

  /**
  * A burst of connections spreading out from one node, hop by hop,
   * Daybytes "connecting" to solve the problem on the card.
   */
  burst(isFront: (i: number) => boolean, hops = 3) {
    const origin = this.pick(isFront);
    this.lit[origin] = 1;
    let frontier = [origin];
    const visited = new Set(frontier);
    for (let hop = 0; hop < hops; hop++) {
      const next: number[] = [];
      for (const from of frontier) {
        const options = this.neighbours[from].filter((n) => !visited.has(n));
        const fan = hop === 0 ? options.length : Math.min(options.length, 2);
        for (const to of options.slice(0, fan)) {
          visited.add(to);
          next.push(to);
          this.connect(from, to, hop * CONNECTION_SECONDS * 0.55 + this.random() * 0.12);
        }
      }
      frontier = next;
    }
  }

  update(dt: number, isFront: (i: number) => boolean) {
    // Ambient connections, roughly one per `spawnEvery` seconds, often overlapping.
    this.nextSpawn -= dt;
    if (this.nextSpawn <= 0) {
      const a = this.pick(isFront);
      const nbrs = this.neighbours[a];
      this.connect(a, nbrs[Math.floor(this.random() * nbrs.length)]);
      this.nextSpawn = this.spawnEvery * (0.45 + this.random() * 1.1);
    }

    for (const c of this.connections) {
      c.t += dt;
      if (!c.lit && c.t / CONNECTION_SECONDS >= PULSE_END) {
        c.lit = true;
        this.lit[c.b] = 1;
      }
    }
    this.connections = this.connections.filter((c) => c.t < CONNECTION_SECONDS);

    const decay = Math.exp(-dt / 0.9);
    for (let i = 0; i < this.count; i++) this.lit[i] *= decay;
  }
}
