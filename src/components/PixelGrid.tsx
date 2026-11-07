import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { EASTER_EGG_INDICES, gridData } from '../data/grid'
import { disposeAudio, playHoverBlip, playShockBass, resumeAudio } from '../audio'
import { GRID_DEPTH, GRID_WORLD_WIDTH } from './sceneConfig'

const scratch = new THREE.Object3D()
const scratchColor = new THREE.Color()
const SHOCK_DURATION = 2.0
const HOVER_STIFFNESS = 220
const HOVER_DAMPING = 12

interface SpringState {
  value: number
  velocity: number
}

function integrateSpring(state: SpringState, target: number, dt: number) {
  const substeps = Math.max(1, Math.ceil(dt / (1 / 120)))
  const step = dt / substeps

  for (let index = 0; index < substeps; index += 1) {
    const acceleration =
      HOVER_STIFFNESS * (target - state.value) - HOVER_DAMPING * state.velocity
    state.velocity += acceleration * step
    state.value += state.velocity * step
  }

  state.value = THREE.MathUtils.clamp(state.value, -0.3, 1.5)
  state.velocity = THREE.MathUtils.clamp(state.velocity, -6, 6)
}

interface PixelGridProps {
  onHiddenClick?: (gridIndex: number) => void
}

export function PixelGrid({ onHiddenClick }: PixelGridProps) {
  const { camera, gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const hoveredIndexRef = useRef(-1)
  const lastStarRef = useRef(-10)
  const currentHover = useRef<SpringState>({ value: 0, velocity: 0 })
  const previousHover = useRef<SpringState>({ value: 0, velocity: 0 })

  const { width, height, colors, depth } = gridData
  const worldHeight = GRID_WORLD_WIDTH * (height / width)
  const cubeSize = Math.min(GRID_WORLD_WIDTH / width, worldHeight / height) * 0.78
  const count = width * height

  const effectUniforms = useMemo(
    () => ({
      uHoveredIndex: { value: -1 },
      uPreviousIndex: { value: -1 },
      uHover: { value: 0 },
      uPreviousHover: { value: 0 },
      uShockAge: { value: -1 },
      uShockOrigin: { value: new THREE.Vector3() },
      uRippleAge: { value: -1 },
      uRippleOrigin: { value: new THREE.Vector3() },
      uStarAge: { value: -1 },
      uStarOrigin: { value: new THREE.Vector3() },
    }),
    [],
  )

  const geometry = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1)
    const indices = new Float32Array(count)

    for (let index = 0; index < count; index += 1) {
      indices[index] = index
    }

    box.setAttribute('aIndex', new THREE.InstancedBufferAttribute(indices, 1))
    return box
  }, [count])

  const material = useMemo(() => {
    const physical = new THREE.MeshPhysicalMaterial({
      metalness: 0.48,
      roughness: 0.32,
      clearcoat: 0.7,
      clearcoatRoughness: 0.24,
      envMapIntensity: 1.3,
      iridescence: 0.16,
      iridescenceIOR: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 400,
      toneMapped: true,
    })

    physical.onBeforeCompile = (shader) => {
      shader.uniforms.uHoveredIndex = effectUniforms.uHoveredIndex
      shader.uniforms.uPreviousIndex = effectUniforms.uPreviousIndex
      shader.uniforms.uHover = effectUniforms.uHover
      shader.uniforms.uPreviousHover = effectUniforms.uPreviousHover
      shader.uniforms.uShockAge = effectUniforms.uShockAge
      shader.uniforms.uShockOrigin = effectUniforms.uShockOrigin
      shader.uniforms.uRippleAge = effectUniforms.uRippleAge
      shader.uniforms.uRippleOrigin = effectUniforms.uRippleOrigin

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
            #include <common>
            attribute float aIndex;
            uniform float uHoveredIndex;
            uniform float uPreviousIndex;
            uniform float uHover;
            uniform float uPreviousHover;
            uniform float uShockAge;
            uniform vec3 uShockOrigin;
            uniform float uRippleAge;
            uniform vec3 uRippleOrigin;
            uniform float uStarAge;
            uniform vec3 uStarOrigin;
            varying float vHover;
            varying float vShock;

            float hash11(float p) {
              p = fract(p * 0.1031);
              p *= p + 33.33;
              p *= p + p;
              return fract(p);
            }
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
            #include <begin_vertex>

            float currentHover =
              abs(aIndex - uHoveredIndex) < 0.5 ? uHover : 0.0;
            float previousHover =
              abs(aIndex - uPreviousIndex) < 0.5 ? uPreviousHover : 0.0;
            vHover = clamp(currentHover + previousHover, -0.3, 1.45);
            transformed *= mix(1.0, 1.32, vHover);

            float randA = hash11(aIndex * 1.37 + 4.2);
            float randB = hash11(aIndex * 2.11 + 8.7);
            vec3 shockOffset = vec3(0.0);
            float shock = 0.0;

            #ifdef USE_INSTANCING
              vec3 instanceCenter = instanceMatrix[3].xyz;
              float shockAge = uShockAge;
              float shockEnvelope =
                smoothstep(0.0, 0.07, shockAge) *
                (1.0 - smoothstep(0.78, 1.36, shockAge));
              float shockRadius = shockAge * 3.5;
              float shockDistance =
                length(instanceCenter.xy - uShockOrigin.xy);

              float waveDelta = (shockDistance - shockRadius) / 0.58;
              float waveA = exp(-waveDelta * waveDelta);
              float waveDeltaB =
                (shockDistance - shockRadius * 0.62 - 0.22) / 0.36;
              float waveB = exp(-waveDeltaB * waveDeltaB);
              float waveAmp = (waveA + waveB * 0.55) * (0.65 + randB * 0.55);
              shock = waveAmp * shockEnvelope;
              float returnEnd = 1.36;
              float returnStagger = 0.12 + randA * 0.3;
              float returnT = smoothstep(
                returnEnd,
                returnEnd + returnStagger,
                shockAge
              );
              float dispMag = shockAge >= 0.0 ? waveAmp * (1.0 - returnT) : 0.0;

              vec2 radialDirection =
                shockDistance > 0.0001
                  ? (instanceCenter.xy - uShockOrigin.xy) / shockDistance
                  : vec2(cos(randA * 6.283), sin(randA * 6.283));
              float scatter = dispMag * (0.6 + randB * 0.55);
              vec2 scatterXY =
                radialDirection * scatter * 0.9 +
                vec2(randA - 0.5, randB - 0.5) * scatter * 0.35;

              float scatterZ =
                scatter * (0.22 + randB * 0.9);

              float rippleAge = uRippleAge;
              float rippleEnv = smoothstep(0.0, 0.07, rippleAge) * (1.0 - smoothstep(0.78, 1.36, rippleAge));
              float distToRipple = length(instanceCenter.xy - uRippleOrigin.xy);
              float rippleFalloff = 1.0 - smoothstep(0.6, 3.0, distToRipple);
              float rippleAmp = (waveA + waveB * 0.55) * (0.65 + randB * 0.55);
              float rippleDispMag = rippleAmp * rippleEnv * rippleFalloff;
              vec2 rippleDirection =
                distToRipple > 0.0001
                  ? (instanceCenter.xy - uRippleOrigin.xy) / distToRipple
                  : vec2(cos(randA * 6.283), sin(randA * 6.283));
              vec2 rippleScatterXY =
                rippleDirection * rippleDispMag * 0.9;
              float rippleScatterZ = rippleDispMag * 0.22;
              vec3 rippleOffset = vec3(rippleScatterXY, rippleScatterZ);

              shockOffset = vec3(scatterXY, scatterZ) + rippleOffset;

              float starAge = uStarAge;
              float starEnv = smoothstep(0.0, 0.07, starAge) * (1.0 - smoothstep(0.78, 1.36, starAge));
              float starDist = length(instanceCenter.xy - uStarOrigin.xy);
              float starFalloff = 1.0 - smoothstep(0.6, 3.0, starDist);
              float starMag = (0.35 + randB * 0.3) * starEnv * starFalloff;
              vec2 starDirection = (instanceCenter.xy - uStarOrigin.xy) / (starDist > 0.0001 ? starDist : 1.0);
              vec2 starScatterXY = starDirection * starMag * 0.6;
              float starScatterZ = starMag * 0.12;
              vec3 starOffset = vec3(starScatterXY, starScatterZ);
              shockOffset = shockOffset + starOffset;

              vec3 hoverOffset = vec3(0.0);
              if (currentHover > 0.0) {
                hoverOffset = vec3(0.0, -currentHover * 0.12, 0.0);
              }
              shockOffset = shockOffset + hoverOffset;

              float spin =
                dispMag * (randA - 0.5) * 11.0;
              float spinCos = cos(spin);
              float spinSin = sin(spin);
              transformed.xy =
                mat2(spinCos, -spinSin, spinSin, spinCos) *
                transformed.xy;
            #endif

            vShock = clamp(shock, 0.0, 2.0);
          `,
        )
        .replace(
          '#include <project_vertex>',
          /* glsl */ `
            vec4 mvPosition = vec4(transformed, 1.0);

            #ifdef USE_INSTANCING
              mvPosition = instanceMatrix * mvPosition;
            #endif

            mvPosition.xyz += shockOffset;
            mvPosition = modelViewMatrix * mvPosition;
            mvPosition.xyz *= mix(1.0, 0.95, vHover);
            gl_Position = projectionMatrix * mvPosition;
          `,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
            #include <common>
            uniform float uShockAge;
            varying float vHover;
            varying float vShock;
          `,
        )
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `
            #include <emissivemap_fragment>

            float heat = clamp(vShock, 0.0, 1.0);
            float flicker =
              0.72 + 0.28 * sin(uShockAge * 110.0 + vShock * 61.0);
            vec3 thermal = mix(
              vec3(1.0, 0.02, 0.0),
              vec3(1.0, 0.55, 0.01),
              smoothstep(0.0, 0.5, heat)
            );
            thermal = mix(
              thermal,
              vec3(0.55, 0.88, 1.0),
              smoothstep(0.55, 1.0, heat)
            );
            thermal *= flicker;

            diffuseColor.rgb = mix(diffuseColor.rgb, thermal, heat * 0.92);

            float hoverGlow = max(vHover, 0.0);

            #ifdef USE_COLOR
              totalEmissiveRadiance +=
                vColor.rgb * (0.28 + hoverGlow * 3.0) +
                hoverGlow * vec3(0.75, 0.85, 1.2) +
                thermal * heat * 2.0;
            #endif
          `,
        )
    }
    physical.customProgramCacheKey = () => 'cosmic-pixel-shock-v6'

    return physical
  }, [effectUniforms])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const stepX = GRID_WORLD_WIDTH / width
    const stepY = worldHeight / height

    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const index = row * width + column
        const x = (column + 0.5) * stepX - GRID_WORLD_WIDTH / 2
        const y = (height / 2 - row - 0.5) * stepY
        const z = (depth[index] - 0.45) * GRID_DEPTH

        scratch.position.set(x, y, z)
        scratch.scale.setScalar(cubeSize)
        scratch.updateMatrix()

        mesh.setMatrixAt(index, scratch.matrix)
        scratchColor.set(colors[index])
        mesh.setColorAt(index, scratchColor)
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    return () => {
      material.dispose()
      geometry.dispose()
    }
  }, [colors, cubeSize, depth, geometry, height, material, width, worldHeight])

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const localRay = new THREE.Ray()
    const inverseMatrix = new THREE.Matrix4()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const intersection = new THREE.Vector3()
    const stepX = GRID_WORLD_WIDTH / width
    const stepY = worldHeight / height
    const halfWidth = GRID_WORLD_WIDTH / 2
    const halfHeight = worldHeight / 2
    const margin = 1.8

    const castLocalRay = (clientX: number, clientY: number) => {
      const group = groupRef.current
      if (!group) return null

      const rect = canvas.getBoundingClientRect()
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(pointer, camera)
      inverseMatrix.copy(group.matrixWorld).invert()
      localRay.copy(raycaster.ray).applyMatrix4(inverseMatrix)
      return localRay
    }

    const setHovered = (nextIndex: number) => {
      if (nextIndex === hoveredIndexRef.current) return
      if (nextIndex !== -1) {
        playHoverBlip()
      }

      const current = currentHover.current
      const previous = previousHover.current

      previous.value = current.value
      previous.velocity = current.velocity
      current.value = 0
      current.velocity = 0

      effectUniforms.uPreviousIndex.value = hoveredIndexRef.current
      effectUniforms.uPreviousHover.value = previous.value
      effectUniforms.uHoveredIndex.value = nextIndex
      effectUniforms.uHover.value = 0
      hoveredIndexRef.current = nextIndex
    }

    const pickCell = (clientX: number, clientY: number) => {
      const ray = castLocalRay(clientX, clientY)
      if (!ray) return -1

      let cell = -1
      let z = 0

      for (let iteration = 0; iteration < 4; iteration += 1) {
        plane.constant = -z
        if (!ray.intersectPlane(plane, intersection)) return -1

        if (
          intersection.x < -halfWidth - margin ||
          intersection.x > halfWidth + margin ||
          intersection.y < -halfHeight - margin ||
          intersection.y > halfHeight + margin
        ) {
          return -1
        }

        const clampedX = THREE.MathUtils.clamp(
          intersection.x,
          -halfWidth + 0.0001,
          halfWidth - 0.0001,
        )
        const clampedY = THREE.MathUtils.clamp(
          intersection.y,
          -halfHeight + 0.0001,
          halfHeight - 0.0001,
        )
        const column = Math.floor((clampedX + halfWidth) / stepX)
        const row = Math.floor((halfHeight - clampedY) / stepY)

        cell = row * width + column
        z = (depth[cell] - 0.45) * GRID_DEPTH
      }

      return cell
    }

    const handlePointerMove = (event: PointerEvent) => {
      setHovered(pickCell(event.clientX, event.clientY))
    }

    const handlePointerLeave = () => {
      setHovered(-1)
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return

      resumeAudio()

      const group = groupRef.current
      const ray = castLocalRay(event.clientX, event.clientY)
      if (!group || !ray) return

      const cell = pickCell(event.clientX, event.clientY)
      setHovered(cell)

      if (cell !== -1 && EASTER_EGG_INDICES.includes(cell)) {
        onHiddenClick?.(cell)
      }

      plane.constant = 0
      if (!ray.intersectPlane(plane, intersection)) return

      effectUniforms.uShockOrigin.value.set(
        THREE.MathUtils.clamp(intersection.x, -halfWidth, halfWidth),
        THREE.MathUtils.clamp(intersection.y, -halfHeight, halfHeight),
        0,
      )
      if (effectUniforms.uShockAge.value < 0) {
        effectUniforms.uShockAge.value = 0
      }
      effectUniforms.uRippleAge.value = 0
      effectUniforms.uRippleOrigin.value.set(
        THREE.MathUtils.clamp(intersection.x, -halfWidth, halfWidth),
        THREE.MathUtils.clamp(intersection.y, -halfHeight, halfHeight),
        0,
      )
      playShockBass()
    }

    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerleave', handlePointerLeave)
    canvas.addEventListener('pointercancel', handlePointerLeave)
    canvas.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('blur', handlePointerLeave)

    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerleave', handlePointerLeave)
      canvas.removeEventListener('pointercancel', handlePointerLeave)
      canvas.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('blur', handlePointerLeave)
    }
  }, [
    camera,
    depth,
    effectUniforms,
    gl,
    height,
    onHiddenClick,
    width,
    worldHeight,
  ])

  useEffect(() => {
    return () => {
      disposeAudio()
    }
  }, [])

  useFrame((state, delta) => {
    const springStep = Math.min(delta, 0.2)

    integrateSpring(
      currentHover.current,
      hoveredIndexRef.current >= 0 ? 1 : 0,
      springStep,
    )
    integrateSpring(previousHover.current, 0, springStep)

    effectUniforms.uHover.value = currentHover.current.value
    effectUniforms.uPreviousHover.value = previousHover.current.value

    if (
      Math.abs(previousHover.current.value) < 0.002 &&
      Math.abs(previousHover.current.velocity) < 0.01
    ) {
      previousHover.current.value = 0
      previousHover.current.velocity = 0
      effectUniforms.uPreviousHover.value = 0
      effectUniforms.uPreviousIndex.value = -1
    }

    if (effectUniforms.uShockAge.value >= 0) {
      effectUniforms.uShockAge.value += delta
      if (effectUniforms.uShockAge.value > SHOCK_DURATION) {
        effectUniforms.uShockAge.value = -1
      }
    }

    if (effectUniforms.uRippleAge.value >= 0) {
      effectUniforms.uRippleAge.value += delta
      if (effectUniforms.uRippleAge.value > SHOCK_DURATION) {
        effectUniforms.uRippleAge.value = -1
      }
    }

    if (effectUniforms.uStarAge.value < 0 && state.clock.elapsedTime - lastStarRef.current > 5) {
      const eggIndex = EASTER_EGG_INDICES[Math.floor(Math.random() * EASTER_EGG_INDICES.length)]
      const starRow = Math.floor(eggIndex / width)
      const starColumn = eggIndex % width
      const starStepX = GRID_WORLD_WIDTH / width
      const starStepY = worldHeight / height
      const starX = (starColumn + 0.5) * starStepX - GRID_WORLD_WIDTH / 2
      const starY = (height / 2 - starRow - 0.5) * starStepY
      effectUniforms.uStarOrigin.value.set(starX, starY, 0)
      effectUniforms.uStarAge.value = 0
      lastStarRef.current = state.clock.elapsedTime
    }
    if (effectUniforms.uStarAge.value >= 0) {
      effectUniforms.uStarAge.value += delta
      if (effectUniforms.uStarAge.value > SHOCK_DURATION) {
        effectUniforms.uStarAge.value = -1
      }
    }

    const group = groupRef.current
    if (!group) return

    const time = state.clock.elapsedTime
    const targetY = state.pointer.x * 0.022 + Math.sin(time * 0.12) * 0.008
    const targetX = -state.pointer.y * 0.016 + Math.cos(time * 0.09) * 0.006
    const damping = 1 - Math.exp(-springStep * 2.2)

    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, targetY, damping)
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, targetX, damping)
  })

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, count]}
        frustumCulled={false}
      />
    </group>
  )
}
