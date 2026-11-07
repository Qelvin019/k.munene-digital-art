export type SecretPhase =
  | 'idle'
  | 'riddle'
  | 'decrypt'
  | 'breaking'
  | 'revealed'

interface SecretOverlayProps {
  phase: SecretPhase
  riddle: string
  code: string
  hiddenMessage: string
  breakingText: string
}

export function SecretOverlay({
  phase,
  riddle,
  code,
  hiddenMessage,
  breakingText,
}: SecretOverlayProps) {
  if (phase === 'idle' || phase === 'decrypt') {
    return null
  }

  let kicker = ''
  let title = ''
  let body = ''

  if (phase === 'riddle') {
    kicker = 'SIGNAL LOST'
    title = 'THE RELIC REMEMBERS'
    body = riddle
  }

  if (phase === 'breaking') {
    kicker = 'WARNING'
    title = 'THE GRID BREAKS'
    body = breakingText
  }

  if (phase === 'revealed') {
    kicker = 'THE RELIC AWAKES'
    title = 'THE VOID REMEMBERS YOU'
    body = hiddenMessage
  }

  return (
    <div className={`secret-overlay secret-overlay-${phase}`} aria-hidden="true">
      <div className="secret-panel">
        <div className="secret-kicker">{kicker}</div>
        <h2 className="secret-title">{title}</h2>
        <p className="secret-riddle">{body}</p>
        {phase === 'riddle' && <div className="secret-code">{code}</div>}
        {phase === 'riddle' && (
          <p className="secret-hint">Follow the echoes in the recited order</p>
        )}
      </div>
    </div>
  )
}
