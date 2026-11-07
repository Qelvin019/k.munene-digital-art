import { Environment, Lightformer, Stars } from '@react-three/drei'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { CameraRig } from './CameraRig'
import { CosmicBackground } from './CosmicBackground'
import { PixelGrid } from './PixelGrid'

interface SceneProps {
  backgroundColor?: string
  onHiddenClick?: (gridIndex: number) => void
}

export function Scene({
  backgroundColor = '#020208',
  onHiddenClick,
}: SceneProps) {
  return (
    <>
      <color attach="background" args={[backgroundColor]} />

      <CameraRig />

      <ambientLight intensity={0.34} color="#9aa6ff" />
      <directionalLight
        position={[5, 8, 7]}
        intensity={2.6}
        color="#ffe4c2"
      />
      <pointLight
        position={[0, 0, 7]}
        intensity={18}
        color="#d9e2ff"
        distance={18}
        decay={2}
      />
      <pointLight
        position={[-7, -4, 5]}
        intensity={35}
        color="#3f7dff"
        distance={22}
        decay={2}
      />
      <pointLight
        position={[7, 4, 3]}
        intensity={28}
        color="#ff4fa0"
        distance={20}
        decay={2}
      />

      <CosmicBackground />
      <Stars
        radius={80}
        depth={60}
        count={1800}
        factor={2.2}
        saturation={0.5}
        fade
        speed={0.2}
      />

      <PixelGrid onHiddenClick={onHiddenClick} />

      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={3.2}
          color="#7e9bff"
          scale={[8, 8, 1]}
          position={[-7, 2, -6]}
        />
        <Lightformer
          form="rect"
          intensity={2.2}
          color="#ff6c9e"
          scale={[7, 5, 1]}
          position={[7, -1, -4]}
        />
        <Lightformer
          form="ring"
          intensity={3}
          color="#ffe1b0"
          scale={[4, 4, 1]}
          position={[0, 7, 2]}
        />
        <Lightformer
          form="rect"
          intensity={1.2}
          color="#ffffff"
          scale={[14, 2, 1]}
          position={[0, -6, 4]}
        />
      </Environment>

      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.72}
          luminanceThreshold={0.55}
          luminanceSmoothing={0.35}
          mipmapBlur
        />
        <Vignette offset={0.2} darkness={0.78} />
      </EffectComposer>
    </>
  )
}
