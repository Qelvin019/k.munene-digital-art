import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import jpeg from 'jpeg-js'

const root = resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const sourceArg = args.find((arg) => !arg.startsWith('--'))
const widthArg = args.find((arg) => arg.startsWith('--width='))
const gridWidth = Math.max(
  24,
  Math.min(320, Number(widthArg?.split('=')[1] ?? process.env.GRID_WIDTH ?? 168)),
)

function normalizeSource(input) {
  const normalized = input.replace(/\\/g, '/')
  const windowsPath = normalized.match(/^([A-Za-z]):\/(.*)$/)
  if (windowsPath && process.platform !== 'win32') {
    return `/mnt/${windowsPath[1].toLowerCase()}/${windowsPath[2]}`
  }
  return resolve(normalized)
}

const candidates = [
  sourceArg,
  process.env.SUPREME_IMAGE,
  'C:/Users/Admin/Pictures/supreme.jpg',
  '/mnt/c/Users/Admin/Pictures/supreme.jpg',
].filter(Boolean)

let source
for (const candidate of candidates) {
  const normalized = normalizeSource(candidate)
  try {
    await access(normalized)
    source = normalized
    break
  } catch {
    continue
  }
}

if (!source) {
  throw new Error(
    'Could not find the source image. Pass a path: npm run sample -- /path/to/image.jpg',
  )
}

const extension = extname(source).toLowerCase()
if (extension !== '.jpg' && extension !== '.jpeg') {
  throw new Error('The sampler currently accepts JPEG images. Pass a .jpg or .jpeg file.')
}

const encoded = await readFile(source)
const decoded = jpeg.decode(encoded, { useTArray: true, formatAsRGBA: true })
const gridHeight = Math.max(1, Math.round((decoded.height / decoded.width) * gridWidth))

const colors = new Array(gridWidth * gridHeight)
const depth = new Float32Array(gridWidth * gridHeight)
const clamp01 = (value) => Math.max(0, Math.min(1, value))

for (let y = 0; y < gridHeight; y += 1) {
  const sourceY0 = Math.floor((y * decoded.height) / gridHeight)
  const sourceY1 = Math.max(
    sourceY0 + 1,
    Math.floor(((y + 1) * decoded.height) / gridHeight),
  )

  for (let x = 0; x < gridWidth; x += 1) {
    const sourceX0 = Math.floor((x * decoded.width) / gridWidth)
    const sourceX1 = Math.max(
      sourceX0 + 1,
      Math.floor(((x + 1) * decoded.width) / gridWidth),
    )

    let red = 0
    let green = 0
    let blue = 0
    let samples = 0

    for (let sy = sourceY0; sy < sourceY1; sy += 1) {
      for (let sx = sourceX0; sx < sourceX1; sx += 1) {
        const offset = (sy * decoded.width + sx) * 4
        red += decoded.data[offset]
        green += decoded.data[offset + 1]
        blue += decoded.data[offset + 2]
        samples += 1
      }
    }

    const r = red / samples
    const g = green / samples
    const b = blue / samples
    const index = y * gridWidth + x

    colors[index] =
      '#' +
      [r, g, b]
        .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
        .join('')

    const normalizedRed = r / 255
    const normalizedGreen = g / 255
    const normalizedBlue = b / 255
    const luminance =
      0.2126 * normalizedRed + 0.7152 * normalizedGreen + 0.0722 * normalizedBlue
    const high = Math.max(normalizedRed, normalizedGreen, normalizedBlue)
    const low = Math.min(normalizedRed, normalizedGreen, normalizedBlue)
    const saturation = high === 0 ? 0 : (high - low) / high

    const relief = clamp01(
      (1 - Math.pow(luminance, 0.8)) * 0.9 + saturation * 0.42,
    )

    const grain = (Math.sin(index * 12.9898) * 43758.5453) % 1
    depth[index] =
      Math.round(clamp01(relief + (grain - 0.5) * 0.045) * 1000) / 1000
  }
}

const outputDir = resolve(root, 'src/data')
const publicDir = resolve(root, 'public')
await mkdir(outputDir, { recursive: true })
await mkdir(publicDir, { recursive: true })

const imageName = 'supreme.jpg'
await copyFile(source, resolve(publicDir, imageName))

const payload = {
  width: gridWidth,
  height: gridHeight,
  image: `/${imageName}`,
  colors,
  depth: Array.from(depth),
}

await writeFile(
  resolve(outputDir, 'supreme-grid.json'),
  JSON.stringify(payload) + '\n',
)

const minDepth = Math.min(...depth)
const maxDepth = Math.max(...depth)
const avgDepth = depth.reduce((sum, value) => sum + value, 0) / depth.length

console.log(`Sampled ${source}`)
console.log(`Grid: ${gridWidth} x ${gridHeight} (${colors.length} instances)`)
console.log(
  `Depth range: ${minDepth.toFixed(3)} – ${maxDepth.toFixed(3)} (avg ${avgDepth.toFixed(3)})`,
)
console.log(`Wrote src/data/supreme-grid.json and public/${imageName}`)
