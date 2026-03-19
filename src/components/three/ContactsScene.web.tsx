import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { router } from 'expo-router';
import type { ContactWithProfile } from '@/hooks/useContacts';

// ─── Ripple Ring ─────────────────────────────────────────────────────────────
function RippleRing({ delay }: { delay: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = ((clock.getElapsedTime() + delay) % 3) / 3; // 0→1 over 3s
    if (ref.current) {
      ref.current.scale.setScalar(1 + t * 3.0);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.18 * (1 - t);
    }
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.6, 0.015, 8, 64]} />
      <meshBasicMaterial ref={matRef} color="#7c3aed" transparent opacity={0.18} />
    </mesh>
  );
}

// ─── Hub ─────────────────────────────────────────────────────────────────────
function Hub() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.30;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05);
    }
    if (glowRef.current) {
      glowRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.10);
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.08 + Math.sin(t * 0.8) * 0.02;
    }
  });

  return (
    <group>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.85, 32, 32]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.08} />
      </mesh>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#7c3aed"
          emissiveIntensity={1.5}
          roughness={0.15}
          metalness={0.3}
        />
      </mesh>
      <RippleRing delay={0} />
      <RippleRing delay={1} />
      <RippleRing delay={2} />
    </group>
  );
}

// ─── Contact Node ─────────────────────────────────────────────────────────────
interface ContactNodeProps {
  contact: ContactWithProfile;
  ringRadius: number;
  angleOffset: number;
  rotationSpeed: number;
  rotationDir: 1 | -1;
}

function ContactNode({ contact, ringRadius, angleOffset, rotationSpeed, rotationDir }: ContactNodeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const angle = (t * rotationSpeed * rotationDir) + angleOffset;
    const x = Math.cos(angle) * ringRadius;
    const z = Math.sin(angle) * ringRadius;
    if (groupRef.current) {
      groupRef.current.position.set(x, 0, z);
    }
    if (lineRef.current) {
      const positions = new Float32Array([0, 0, 0, x, 0, z]);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
      lineRef.current.geometry = geometry;
    }
  });

  const tierColors: Record<string, string> = {
    champion: '#fbbf24',
    explorer: '#60a5fa',
    wanderer: '#a78bfa',
  };
  const nodeColor = tierColors[contact.trust_tier] ?? '#a78bfa';

  return (
    <>
      <lineSegments ref={lineRef} geometry={geometry}>
        <lineBasicMaterial color="#7c3aed" transparent opacity={0.35} />
      </lineSegments>
      <group
        ref={groupRef}
        onClick={() => router.push(`/contacts-graph` as any)}
      >
        <mesh>
          <sphereGeometry args={[0.3, 20, 20]} />
          <meshStandardMaterial
            color={nodeColor}
            emissive={nodeColor}
            emissiveIntensity={0.8}
            roughness={0.2}
            metalness={0.2}
          />
        </mesh>
      </group>
    </>
  );
}

// ─── Particle Field ───────────────────────────────────────────────────────────
function ParticleField({ count = 80 }: { count?: number }) {
  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      spd[i] = Math.random() * 0.003 + 0.001;
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
    <points geometry={geometry}>
      <pointsMaterial color="#ffffff" size={0.022} transparent opacity={0.25} sizeAttenuation />
    </points>
  );
}

// ─── Scene Group ─────────────────────────────────────────────────────────────
function SceneGroup({ contacts }: { contacts: ContactWithProfile[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const { mouse } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += (mouse.x * 0.10 - groupRef.current.rotation.y) * 0.04;
    groupRef.current.rotation.x += (-mouse.y * 0.06 - groupRef.current.rotation.x) * 0.04;
  });

  const inner = contacts.slice(0, 6);
  const outer = contacts.slice(6, 12);

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.3} />
      <pointLight position={[3, 4, 3]} intensity={1.8} color="#7c3aed" />
      <pointLight position={[-3, -2, -2]} intensity={0.6} color="#ffffff" />

      <Hub />
      <ParticleField />

      {inner.map((c, i) => (
        <ContactNode
          key={c.contact_id}
          contact={c}
          ringRadius={2.2}
          angleOffset={(i / inner.length) * Math.PI * 2}
          rotationSpeed={0.18}
          rotationDir={1}
        />
      ))}
      {outer.map((c, i) => (
        <ContactNode
          key={c.contact_id}
          contact={c}
          ringRadius={3.6}
          angleOffset={(i / outer.length) * Math.PI * 2}
          rotationSpeed={0.12}
          rotationDir={-1}
        />
      ))}
    </group>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
export function ContactsScene({ contacts }: { contacts: ContactWithProfile[] }) {
  return (
    <Canvas
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as React.CSSProperties}
      camera={{ position: [0, 1.5, 7], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
    >
      <SceneGroup contacts={contacts} />
    </Canvas>
  );
}
