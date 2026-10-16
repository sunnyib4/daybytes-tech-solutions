import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Network, PROBLEM_EVENT, connectionState } from '@/scripts/network';

/**
 * Desktop hero sphere: a slowly turning "living network" in WebGL.
 * Loaded with client:media="(min-width: 768px)". Phones get the 2D canvas
 * version (src/scripts/sphere2d.ts); prefers-reduced-motion gets the static SVG.
 */

const NODE_COUNT = 380;
const MAX_CONNECTIONS = 56;
const ARC_SEGMENTS = 10;
const TURN_SECONDS = 32; // one full rotation
const TILT = { x: 0.26, y: 0.42 }; // max extra tilt toward the pointer (radians)

export const supportsWebGL = () => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

// Dark core with an orange-to-white rim, matching the static artwork.
const coreMaterial = new THREE.ShaderMaterial({
  vertexShader: /* glsl */ `
    varying vec3 vViewNormal;
    void main() {
      vViewNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vViewNormal;
    vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
    void main() {
      float t = clamp(length(vViewNormal.xy - vec2(-0.08, 0.2)) / 1.16, 0.0, 1.0);
      vec3 c = hex(14., 13., 12.);
      c = mix(c, hex(31., 27., 25.), smoothstep(0.0, 0.42, t));
      c = mix(c, hex(74., 53., 41.), smoothstep(0.42, 0.62, t));
      c = mix(c, hex(184., 105., 58.), smoothstep(0.62, 0.78, t));
      c = mix(c, hex(245., 160., 106.), smoothstep(0.78, 0.88, t));
      c = mix(c, hex(255., 230., 214.), smoothstep(0.88, 0.95, t));
      c = mix(c, vec3(1.0), smoothstep(0.95, 1.0, t));
      gl_FragColor = vec4(c, 1.0);
    }`,
});

const additive = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending } as const;

// Shared by the resting mesh and the live connections: fades toward the rim and hides the back.
const lineMaterial = (opacity: number) =>
  new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      varying float vAlpha;
      varying float vFacing;
      void main() {
        vFacing = normalize(normalMatrix * normalize(position)).z;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vAlpha;
      varying float vFacing;
      void main() {
        float a = vAlpha * uOpacity * smoothstep(0.0, 0.45, vFacing);
        if (a < 0.004) discard;
        gl_FragColor = vec4(1.0, 0.56, 0.28, a);
      }`,
  });

const nodeMaterial = (pixelRatio: number) =>
  new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uTime: { value: 0 }, uSize: { value: 10 }, uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uSize;
      uniform float uPixelRatio;
      attribute float aPhase;
      attribute float aSpeed;
      attribute float aGlowing;
      attribute float aLit;
      varying float vFacing;
      varying float vHot;
      varying float vBreathe;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = normalize(normalMatrix * position).z;
        vBreathe = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);
        vHot = max(aGlowing * (0.45 + 0.55 * vBreathe), aLit);
        gl_PointSize = uSize * uPixelRatio * (1.0 + 1.1 * vHot) * (3.5 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vFacing;
      varying float vHot;
      varying float vBreathe;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float ring = smoothstep(0.5, 0.41, d) * smoothstep(0.24, 0.32, d);
        float glow = exp(-d * d * 16.0);
        float core = smoothstep(0.2, 0.1, d);
        float a = mix(ring * (0.35 + 0.35 * vBreathe), glow * 0.75 + core, vHot);
        a *= smoothstep(0.05, 0.5, vFacing);
        if (a < 0.01) discard;
        vec3 col = mix(vec3(1.0, 0.5, 0.25), vec3(1.0, 0.8, 0.55), core * vHot);
        gl_FragColor = vec4(col, a);
      }`,
  });

const pulseMaterial = (pixelRatio: number) =>
  new THREE.ShaderMaterial({
    ...additive,
    uniforms: { uPixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      uniform float uPixelRatio;
      attribute float aAlpha;
      varying float vAlpha;
      varying float vFacing;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = normalize(normalMatrix * normalize(position)).z;
        vAlpha = aAlpha;
        gl_PointSize = 26.0 * uPixelRatio * (3.5 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vFacing;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = (exp(-d * d * 30.0) + smoothstep(0.12, 0.05, d)) * vAlpha * smoothstep(0.0, 0.4, vFacing);
        if (a < 0.01) discard;
        gl_FragColor = vec4(1.0, 0.86, 0.66, a);
      }`,
  });

function dynamicAttribute(size: number, itemSize: number) {
  return new THREE.BufferAttribute(new Float32Array(size * itemSize), itemSize).setUsage(THREE.DynamicDrawUsage);
}

function NetworkSphere({ pointer }: { pointer: React.RefObject<{ x: number; y: number }> }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const outer = useRef<THREE.Group>(null);
  const spinner = useRef<THREE.Group>(null);
  const time = useRef(0);
  const tilt = useRef({ x: 0, y: 0 });

  const net = useMemo(() => new Network({ count: NODE_COUNT, maxConnections: MAX_CONNECTIONS, spawnEvery: 0.68, glowingShare: 0.2 }), []);

  const { nodeGeo, meshGeo, liveGeo, pulseGeo, materials } = useMemo(() => {
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(net.positions.map((v) => v * 1.004), 3));
    nodeGeo.setAttribute('aPhase', new THREE.BufferAttribute(net.phase, 1));
    nodeGeo.setAttribute('aSpeed', new THREE.BufferAttribute(net.speed, 1));
    nodeGeo.setAttribute('aGlowing', new THREE.BufferAttribute(net.glowing, 1));
    nodeGeo.setAttribute('aLit', new THREE.BufferAttribute(net.lit, 1).setUsage(THREE.DynamicDrawUsage));

    // Faint resting mesh between neighbours, drawn as short surface arcs.
    const meshPos = new Float32Array(net.edges.length * 4 * 2 * 3);
    let o = 0;
    for (const [a, b] of net.edges) {
      for (let s = 0; s < 4; s++) {
        net.arcPoint(a, b, s / 4, meshPos, o, 1.006);
        net.arcPoint(a, b, (s + 1) / 4, meshPos, o + 3, 1.006);
        o += 6;
      }
    }
    const meshGeo = new THREE.BufferGeometry();
    meshGeo.setAttribute('position', new THREE.BufferAttribute(meshPos, 3));
    meshGeo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(meshPos.length / 3).fill(1), 1));

    const liveGeo = new THREE.BufferGeometry();
    const liveVerts = MAX_CONNECTIONS * ARC_SEGMENTS * 2;
    liveGeo.setAttribute('position', dynamicAttribute(liveVerts, 3));
    liveGeo.setAttribute('aAlpha', dynamicAttribute(liveVerts, 1));
    liveGeo.setDrawRange(0, 0);

    const pulseGeo = new THREE.BufferGeometry();
    pulseGeo.setAttribute('position', dynamicAttribute(MAX_CONNECTIONS, 3));
    pulseGeo.setAttribute('aAlpha', dynamicAttribute(MAX_CONNECTIONS, 1));
    pulseGeo.setDrawRange(0, 0);

    return {
      nodeGeo,
      meshGeo,
      liveGeo,
      pulseGeo,
      materials: { mesh: lineMaterial(0.11), live: lineMaterial(0.95), nodes: nodeMaterial(dpr), pulses: pulseMaterial(dpr) },
    };
  }, [net, dpr]);

  // Is node i on the visible hemisphere right now? Uses the spinner's world matrix.
  const isFront = useMemo(() => {
    const v = new THREE.Vector3();
    return (i: number) => {
      if (!spinner.current) return true;
      v.fromArray(net.positions, i * 3).applyMatrix4(spinner.current.matrixWorld);
      return v.z > 0.35;
    };
  }, [net]);

  // Burst of connections whenever the problem card moves on, plus one on start.
  useEffect(() => {
    const onProblem = () => net.burst(isFront);
    window.addEventListener(PROBLEM_EVENT, onProblem);
    const first = window.setTimeout(onProblem, 700);
    return () => {
      window.removeEventListener(PROBLEM_EVENT, onProblem);
      window.clearTimeout(first);
    };
  }, [net, isFront]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1); // no jumps after a pause
    time.current += dt;
    if (spinner.current) spinner.current.rotation.y += (dt * Math.PI * 2) / TURN_SECONDS;
    if (outer.current && pointer.current) {
      const k = 1 - Math.exp(-dt * 3);
      tilt.current.x += (pointer.current.y * TILT.x - tilt.current.x) * k;
      tilt.current.y += (pointer.current.x * TILT.y - tilt.current.y) * k;
      outer.current.rotation.set(0.46 + tilt.current.x, tilt.current.y, 0.12);
    }

    net.update(dt, isFront);
    materials.nodes.uniforms.uTime.value = time.current;
    (nodeGeo.attributes.aLit as THREE.BufferAttribute).needsUpdate = true;

    // Rebuild the live connection and pulse buffers.
    const lp = liveGeo.attributes.position as THREE.BufferAttribute;
    const la = liveGeo.attributes.aAlpha as THREE.BufferAttribute;
    const pp = pulseGeo.attributes.position as THREE.BufferAttribute;
    const pa = pulseGeo.attributes.aAlpha as THREE.BufferAttribute;
    let v = 0;
    let p = 0;
    for (const c of net.connections) {
      const { head, pulse, alpha } = connectionState(c);
      if (alpha <= 0 || head <= 0) continue;
      const segs = Math.max(1, Math.ceil(head * ARC_SEGMENTS));
      for (let s = 0; s < segs; s++) {
        net.arcPoint(c.a, c.b, (s / segs) * head, lp.array as Float32Array, v * 3);
        net.arcPoint(c.a, c.b, ((s + 1) / segs) * head, lp.array as Float32Array, v * 3 + 3);
        la.array[v] = alpha;
        la.array[v + 1] = alpha;
        v += 2;
      }
      if (pulse >= 0) {
        net.arcPoint(c.a, c.b, pulse, pp.array as Float32Array, p * 3, 1.016);
        pa.array[p] = Math.sin(pulse * Math.PI) * 0.6 + 0.4;
        p++;
      }
    }
    liveGeo.setDrawRange(0, v);
    pulseGeo.setDrawRange(0, p);
    lp.needsUpdate = la.needsUpdate = pp.needsUpdate = pa.needsUpdate = true;
  });

  return (
    <group ref={outer} rotation={[0.38, 0, 0.12]}>
      <mesh material={coreMaterial} renderOrder={0}>
        <sphereGeometry args={[1, 96, 96]} />
      </mesh>
      <group ref={spinner}>
        <lineSegments geometry={meshGeo} material={materials.mesh} renderOrder={1} />
        <lineSegments geometry={liveGeo} material={materials.live} renderOrder={2} frustumCulled={false} />
        <points geometry={nodeGeo} material={materials.nodes} renderOrder={3} />
        <points geometry={pulseGeo} material={materials.pulses} renderOrder={4} frustumCulled={false} />
      </group>
    </group>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    const legacyMq = mq as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };

    update();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }

    legacyMq.addListener?.(update);
    return () => legacyMq.removeListener?.(update);
  }, []);

  return reduced;
}

export default function HeroSphere() {
  const reduced = usePrefersReducedMotion();
  const [webgl] = useState(() => {
    if (typeof window === 'undefined') return false;
    return supportsWebGL();
  });
  const wrapper = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  // Pause rendering while the hero is scrolled away or the tab is hidden.
  useEffect(() => {
    if (!wrapper.current) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(wrapper.current);
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    // Tilt toward the pointer on desktop; this island never loads on phones.
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onMove);
    };
  }, [reduced, webgl]);

  // Hand over from the static image once WebGL is drawing; hand back on unmount.
  const host = () => wrapper.current?.closest('[data-sphere]');
  useEffect(() => {
    if (!reduced && webgl && host()) {
      host()?.setAttribute('data-sphere-live', '');
    }
    return () => host()?.removeAttribute('data-sphere-live');
  }, [reduced, webgl]);

  if (reduced || !webgl) return null;

  return (
    <div ref={wrapper} className="absolute inset-0" aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={onScreen && tabVisible ? 'always' : 'never'}
        camera={{ position: [0, 0, 3.5], fov: 35 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={() => {
          host()?.setAttribute('data-sphere-live', '');
        }}
      >
        <NetworkSphere pointer={pointer} />
      </Canvas>
    </div>
  );
}
