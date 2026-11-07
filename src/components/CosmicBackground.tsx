import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotation = mat2(1.6, 1.2, -1.2, 1.6);

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = rotation * p;
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    float time = uTime * 0.011;

    float cloudA = fbm(p * 1.35 + vec2(time * 0.55, -time * 0.3));
    float cloudB = fbm(p * 2.15 + cloudA * 1.8 + vec2(-time * 0.4, time * 0.35));
    float halo = smoothstep(1.15, 0.08, length(p));
    float filaments = smoothstep(0.42, 0.8, cloudA) * halo;
    float clouds = smoothstep(0.38, 0.88, cloudB) * halo;

    vec3 color = vec3(0.004, 0.006, 0.018);
    color += vec3(0.11, 0.035, 0.3) * pow(filaments, 1.4) * 0.52;
    color += vec3(0.015, 0.16, 0.25) * pow(clouds, 1.35) * 0.45;
    color += vec3(0.32, 0.1, 0.16) * pow(max(0.0, cloudB - cloudA), 2.0) * 0.18;

    vec2 dustUv = vUv * vec2(aspect, 1.0) * 480.0;
    vec2 dustCell = floor(dustUv);
    float dust = step(0.9985, hash21(dustCell)) * smoothstep(0.35, 0.95, hash21(dustCell + 13.7));
    color += vec3(0.55, 0.62, 0.9) * dust * 0.22;

    color *= 1.0 - 0.45 * smoothstep(0.25, 0.78, length(vUv - 0.5));
    color += (hash21(gl_FragCoord.xy + uTime) - 0.5) * 0.006;

    gl_FragColor = vec4(color, 1.0);
  }
`

export function CosmicBackground() {
  const material = useRef<THREE.ShaderMaterial>(null)

  useFrame((state) => {
    if (!material.current) return
    material.current.uniforms.uTime.value = state.clock.elapsedTime
    material.current.uniforms.uResolution.value.set(
      state.size.width,
      state.size.height,
    )
  })

  return (
    <mesh position={[0, 0, -30]} renderOrder={-100}>
      <planeGeometry args={[120, 90]} />
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uResolution: { value: new THREE.Vector2(1, 1) },
        }}
        depthWrite
        toneMapped={false}
      />
    </mesh>
  )
}
