import gridJson from './supreme-grid.json'

export interface PixelGridData {
  width: number
  height: number
  image: string
  colors: string[]
  depth: number[]
}

export const gridData = gridJson as PixelGridData
export const gridAspect = gridData.width / gridData.height

export const EASTER_EGG_INDICES = [12, 47, 88, 121, 159]
export const SECRET_SEQUENCE = [88, 159, 12, 47, 121]
export const RIDDLE_TEXT =
  'The relic remembers the dark. Five echoes sleep behind the pixels. Their voices were swallowed by the void. Recite the sleeping order to unseal the lock: the first was crimson, the second azure, the third gold, the fourth violet, the fifth bone-white.'
export const SECRET_CODE = 'CRIM-4X7-K2M9'
export const HIDDEN_MESSAGE =
  'THE RELIC IS AWAKE — THE VOID REMEMBERS YOU.'
