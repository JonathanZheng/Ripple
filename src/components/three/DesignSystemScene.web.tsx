import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Each token's orbital config
const TOKEN_CONFIGS = [
  { type: 'color', color: '#7c3aed',  orbit: { rx: 2.5, ry: 1.0, speed: 0.18, phase: 0.0  } },
  { type: 'color', color: '#ec4899',  orbit: { rx: 2.2, ry: 0.8, speed: 0.14, phase: 1.2  } },
  { type: 'color', color: '#10b981',  orbit: { rx: 2.8, ry: 1.2, speed: 0.20, phase: 2.4  } },
  { type: 'color', color: '#f59e0b',  orbit: { rx: 2.0, ry: 0.9, speed: 0.16, phase: 3.6  } },
  { type: 'color', color: '#ffffff',  orbit: { rx: 2.6, ry: 1.1, speed: 0.12, phase: 4.8  } },
  { type: 'button', color: '#ffffff', orbit: { rx: 3.0, ry: 1.3, speed: 0.10, phase: 0.8  } },
  { type: 'button', color: '#7c3aed', orbit: { rx: 3.2, ry: 1.0, speed: 0.13, phase: 2.0  } },
  { type: 'card',  color: 'rgba(255,255,255,0.5)', orbit: { rx: 3.4, ry: 1.5, speed: 0.09, phase: 4.0  } },
  { type: 'card',  color: '#7c3aed',  orbit: { rx: 3.1, ry: 1.1, speed: 0.15, phase: 5.2  } },
  { type: 'color', color: '#a78bfa',  orbit: { rx: 2.3, ry: 0.7, speed: 0.19, phase: 1.8  } },
  { type: 'button', color: '#ffffff', orbit: { rx: 2.9, ry: 1.4, speed: 0.11, phase: 3.0  } },
] as const;

// Compute token position at a given time (same formula used by each token's useFrame)
function orbitPos(t: number, o: { rx: number; ry: number; speed: number; phase: number }) {
  const angle = t * o.speed + o.phase;
  return new THREE.Vector3(
    Math.cos(angle) * o.rx,
    Math.sin(angle * 0.7) * o.ry,
    Math.sin(angle) * 0.8,
  );
}

// ─── Hub ─────────────────────────────────────────────────────────────────────
function Hub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.x = t * 0.15;
      meshRef.current.rotation.y = t * 0.22;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.04);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.08);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.06 + Math.sin(t * 0.8) * 0.02;
    }
  });

  return (
    <group>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.07} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.28, 32, 32]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#7c3aed"
          emissiveIntensity={1.8}
          roughness={0.1}
          metalness={0.4}
        />
      </mesh>
    </group>
  );
}

// ─── Token components (each self-contained) ───────────────────────────────────
type OrbitCfg = { rx: number; ry: number; speed: number; phase: number };

function ColorToken({ color, orbit }: { color: string; orbit: OrbitCfg }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const p = orbitPos(clock.getElapsedTime(), orbit);
    ref.current.position.copy(p);
    const t = clock.getElapsedTime();
    ref.current.rotation.x = t * 0.30;
    ref.current.rotation.y = t * 0.40;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  );
}

function ButtonToken({ color, orbit }: { color: string; orbit: OrbitCfg }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const angle = t * orbit.speed + orbit.phase;
    ref.current.position.set(
      Math.cos(angle) * orbit.rx,
      Math.sin(angle * 0.6) * orbit.ry,
      Math.sin(angle * 1.3) * 0.7,
    );
    ref.current.rotation.y = t * 0.25;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.55, 0.16, 0.04]} />
        <meshStandardMaterial color={color} wireframe transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function CardToken({ color, orbit }: { color: string; orbit: OrbitCfg }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const angle = t * orbit.speed + orbit.phase;
    ref.current.position.set(
      Math.cos(angle) * orbit.rx,
      Math.sin(angle * 0.5) * orbit.ry,
      Math.sin(angle * 1.1) * 0.9,
    );
    ref.current.rotation.x = t * 0.12;
    ref.current.rotation.y = t * 0.20;
  });
  return (
    <group ref={ref}>
      <mesh>
        <boxGeometry args={[0.55, 0.36, 0.03]} />
        <meshStandardMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}

// ─── Connection Lines (computed via same orbit formula — no ref-passing needed) ──
function ConnectionLines() {
  const lineRef = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const positions: number[] = [];
    TOKEN_CONFIGS.forEach((cfg) => {
      const p = orbitPos(t, cfg.orbit);
      positions.push(0, 0, 0, p.x, p.y, p.z);
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    if (lineRef.current) lineRef.current.geometry = geometry;
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.05} />
    </lineSegments>
  );
}

// ─── Particle Field ───────────────────────────────────────────────────────────
function ParticleField({ count = 160 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      spd[i] = Math.random() * 0.004 + 0.001;
    }
    return { positions: pos, speeds: spd };
  }, [count]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame(() => {
    const pos = geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += speeds[i];
      if (pos[i * 3 + 1] > 5) pos[i * 3 + 1] = -5;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color="#ffffff" size={0.025} transparent opacity={0.30} sizeAttenuation />
    </points>
  );
}

// ─── Scene root (mouse parallax) ──────────────────────────────────────────────
function SceneGroup() {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += (mouse.x * 0.12 - groupRef.current.rotation.y) * 0.04;
    groupRef.current.rotation.x += (-mouse.y * 0.08 - groupRef.current.rotation.x) * 0.04;
  });

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 3, 3]} intensity={1.5} color="#7c3aed" />
      <pointLight position={[-3, -2, -2]} intensity={0.8} color="#ffffff" />

      <Hub />
      <ParticleField />
      <ConnectionLines />

      {TOKEN_CONFIGS.map((cfg, i) => {
        if (cfg.type === 'color')  return <ColorToken  key={i} color={cfg.color} orbit={cfg.orbit} />;
        if (cfg.type === 'button') return <ButtonToken key={i} color={cfg.color} orbit={cfg.orbit} />;
        if (cfg.type === 'card')   return <CardToken   key={i} color={cfg.color} orbit={cfg.orbit} />;
        return null;
      })}
    </group>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export function DesignSystemScene() {
  return (
    <Canvas
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as React.CSSProperties}
      camera={{ position: [0, 0, 5.5], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
    >
      <SceneGroup />
    </Canvas>
  );
}
 