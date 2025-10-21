'use client';

import { useState, useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial, Preload } from '@react-three/drei';
// A biblioteca 'maath' é ótima para matemática 3D, vamos instalá-la
import { inSphere } from 'maath/random';

// Componente interno para a lógica das estrelas
function Stars(props: any) {
  const ref = useRef<any>(null); // CORREÇÃO: Adicionado valor inicial 'null'

  // Cria 5000 pontos posicionados aleatoriamente dentro de uma esfera
  const sphere = inSphere(new Float32Array(5000), { radius: 1.5 });

  // useFrame é um hook que executa em cada frame da animação
  useFrame((_state, delta) => {
    if (ref.current) {
        ref.current.rotation.x -= delta / 10;
        ref.current.rotation.y -= delta / 15;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]}>
      <Points ref={ref} positions={sphere} stride={3} frustumCulled {...props}>
        <PointMaterial
          transparent
          color="#0ea5e9" // Cor sky-500 do Tailwind
          size={0.005}
          sizeAttenuation={true}
          depthWrite={false}
        />
      </Points>
    </group>
  );
}

// Componente principal da cena
export default function ThreeScene() {
  return (
    <div className="absolute top-0 left-0 w-full h-full z-0">
      <Canvas camera={{ position: [0, 0, 1] }}>
        <Suspense fallback={null}>
            <Stars />
        </Suspense>
        <Preload all />
      </Canvas>
    </div>
  );
}
