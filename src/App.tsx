import { useCallback, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import * as THREE from 'three'
import { Scene } from './components/Scene'
import { ScanCursor } from './components/ScanCursor'
import { SecretOverlay, type SecretPhase } from './components/SecretOverlay'
import {
  HIDDEN_MESSAGE,
  RIDDLE_TEXT,
  SECRET_CODE,
  SECRET_SEQUENCE,
} from './data/grid'
import {
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
} from './components/sceneConfig'
import { gridData } from './data/grid'

const instanceCount = gridData.colors.length.toLocaleString('en-US')
const BREAKING_DURATION = 3200

export default function App() {
  const [phase, setPhase] = useState<SecretPhase>('idle')
  const [completed, setCompleted] = useState(0)
  const [backgroundColor, setBackgroundColor] = useState('#020208')

  useEffect(() => {
    if (phase !== 'breaking') return
    const timer = window.setTimeout(() => setPhase('revealed'), BREAKING_DURATION)
    return () => window.clearTimeout(timer)
  }, [phase])

  useEffect(() => {
    if (phase === 'breaking') {
      setBackgroundColor('#0a0320')
    }
    if (phase === 'revealed') {
      setBackgroundColor('#020208')
    }
  }, [phase])

  const progress = completed / SECRET_SEQUENCE.length

  const handleHiddenClick = useCallback(
    (gridIndex: number) => {
      if (phase === 'breaking' || phase === 'revealed') return

      if (phase === 'idle') {
        setPhase('riddle')
        return
      }

      const isNext = gridIndex === SECRET_SEQUENCE[completed]
      if (!(phase === 'riddle' || phase === 'decrypt')) return
      if (!isNext) return

      const nextCompleted = completed + 1
      if (nextCompleted >= SECRET_SEQUENCE.length) {
        setCompleted(nextCompleted)
        setPhase('breaking')
        return
      }
      setCompleted(nextCompleted)
      setPhase('decrypt')
    },
    [completed, phase],
  )

  const showProgress =
    phase === 'riddle' || phase === 'decrypt' || phase === 'breaking'

  return (
    <main className="app">
      <div className="canvas-shell">
        <Canvas
          dpr={[1, 1.5]}
          camera={{
            position: [0, 0, 13],
            fov: CAMERA_FOV,
            near: CAMERA_NEAR,
            far: CAMERA_FAR,
          }}
          gl={{
            antialias: true,
            alpha: false,
            depth: true,
            stencil: false,
            powerPreference: 'high-performance',
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping
            gl.toneMappingExposure = 1.12
          }}
        >
          <Suspense fallback={null}>
            <Scene backgroundColor={backgroundColor} onHiddenClick={handleHiddenClick} />
          </Suspense>
        </Canvas>
        <ScanCursor />
      </div>

      <div className="hud" aria-hidden="true">
        <header className="hud-top">
          <div className="hud-mark">
            K.MUNENE <span>/ COSMIC RELIQUARY</span>
          </div>
          <div className="hud-meta">WEBGL · 001</div>
        </header>

        <footer className="hud-bottom">
          <div className="hud-caption">
            <span className="hud-rule" />
            <p>HOVER TO IGNITE · CLICK TO SHOCK</p>
          </div>
          <div className="hud-meta">
            {instanceCount} FRAGMENTS · 1 DRAW CALL
          </div>
        </footer>
      </div>

      {phase !== 'idle' && phase !== 'decrypt' && (
        <SecretOverlay
          phase={phase}
          riddle={RIDDLE_TEXT}
          code={SECRET_CODE}
          hiddenMessage={HIDDEN_MESSAGE}
          breakingText="The grid fractures around you..."
        />
      )}

      <div
        className={`secret-progress ${showProgress ? 'active' : ''}`}
        aria-hidden="true"
      >
        <div
          className="secret-progress-fill"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <div className="vignette" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
    </main>
  )
}
