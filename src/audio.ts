let audioContext: AudioContext | null = null
let masterGain: GainNode | null = null
let humOscillator: OscillatorNode | null = null

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext()
    masterGain = audioContext.createGain()
    masterGain.gain.value = 0.4
    masterGain.connect(audioContext.destination)
  }
  return audioContext
}

export const resumeAudio = (): void => {
  const context = getAudioContext()
  if (context.state === 'suspended') {
    void context.resume()
  }

  if (humOscillator) return

  const hum = context.createOscillator()
  hum.type = 'sine'
  hum.frequency.value = 45
  const humGain = context.createGain()
  humGain.gain.value = 0.15
  hum.connect(humGain)
  humGain.connect(masterGain!)
  hum.start()
  humOscillator = hum
}

const playTone = (
  oscillatorType: OscillatorType,
  startFrequency: number,
  endFrequency: number,
  duration: number,
  gainPeak: number,
) => {
  const context = getAudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = oscillatorType
  oscillator.frequency.setValueAtTime(startFrequency, context.currentTime)
  oscillator.frequency.exponentialRampToValueAtTime(
    Math.max(endFrequency, 0.1),
    context.currentTime + duration,
  )

  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(gainPeak, context.currentTime + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)

  oscillator.connect(gain)
  gain.connect(masterGain!)
  oscillator.start()
  oscillator.stop(context.currentTime + duration + 0.05)
}

export const playHoverBlip = (): void => {
  resumeAudio()
  playTone('sine', 1900, 1500, 0.05, 0.05)
}

export const playShockBass = (): void => {
  resumeAudio()
  playTone('sine', 60, 26, 1.35, 0.8)
}

export const disposeAudio = (): void => {
  if (audioContext) {
    void audioContext.close()
  }
  audioContext = null
  masterGain = null
  humOscillator = null
}
