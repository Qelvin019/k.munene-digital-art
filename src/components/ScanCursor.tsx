import { useEffect, useRef } from 'react'

export function ScanCursor() {
  const reticleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reticle = reticleRef.current
    if (!reticle) return

    const handleMove = (event: PointerEvent) => {
      reticle.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`
    }

    window.addEventListener('pointermove', handleMove)
    return () => window.removeEventListener('pointermove', handleMove)
  }, [])

  return (
    <div ref={reticleRef} className="reticle" aria-hidden="true">
      <span className="reticle-pulse" />
    </div>
  )
}
