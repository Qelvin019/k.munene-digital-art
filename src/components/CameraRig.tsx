import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { gridAspect } from '../data/grid'
import {
  CAMERA_FOV,
  GRID_WORLD_WIDTH,
} from './sceneConfig'

export function CameraRig() {
  const { camera } = useThree()
  const desiredPosition = useMemo(() => new THREE.Vector3(), [])
  const lookTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame((state, delta) => {
    const aspect = state.size.width / Math.max(state.size.height, 1)
    const halfFov = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2)
    const fitWidth =
      (GRID_WORLD_WIDTH * 1.14) / (2 * halfFov * Math.max(aspect, 0.01))
    const fitHeight =
      (GRID_WORLD_WIDTH / gridAspect) * 1.24 / (2 * halfFov)
    const baseZ = Math.max(fitWidth, fitHeight, 8)

    const time = state.clock.elapsedTime
    const pointerX = state.pointer.x
    const pointerY = state.pointer.y
    const driftX =
      Math.sin(time * 0.17) * 0.012 + Math.sin(time * 0.31 + 1.7) * 0.005
    const driftY =
      Math.cos(time * 0.13) * 0.009 + Math.sin(time * 0.27 + 0.4) * 0.004

    desiredPosition.set(
      pointerX * GRID_WORLD_WIDTH * 0.07 + driftX * GRID_WORLD_WIDTH,
      pointerY * GRID_WORLD_WIDTH * 0.05 + driftY * GRID_WORLD_WIDTH,
      baseZ + Math.sin(time * 0.11) * baseZ * 0.008,
    )

    const damping = 1 - Math.exp(-Math.min(delta, 0.1) * 2.4)
    camera.position.lerp(desiredPosition, damping)

    lookTarget.set(
      pointerX * GRID_WORLD_WIDTH * 0.008,
      pointerY * GRID_WORLD_WIDTH * 0.006,
      0,
    )
    camera.lookAt(lookTarget)
  })

  return null
}
