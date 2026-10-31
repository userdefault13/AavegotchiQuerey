#!/usr/bin/env node
/**
 * Works out which palette colours each baked voxel wearable needs so it matches its on-chain
 * 2D art, and writes them to public/data/voxel_art_palettes.json. Each model is projected
 * front-on over its rasterised art, and every palette cell takes the art colour it mostly covers.
 *
 * Needs baked models (npm run import-voxels) and a browser to rasterise the art:
 *   npm i --no-save playwright && npx playwright install chromium
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const VOXELS = path.join(ROOT, 'public', 'voxels')
const OUTPUT = path.join(ROOT, 'public', 'data', 'voxel_art_palettes.json')

const ART_SIZE = 64
const SAMPLES_PER_PIXEL = 2
const DYNAMIC = '#fe01fd' // Stands in for collateral-coloured art, which has no fixed colour.
const MIN_VOTES = 6
const MIN_SHARE = 0.5
const MATCH_LIMIT = 160
const POSITION_WEIGHT = 0.3
const MIN_ART_AREA = 0.005
const GLOW_WHITE_SHARE = 0.5
const STRONG_GLOW = 0.5
// Art colours the 3D model has no matching palette colour for, such as the shield's ring.
const MANUAL_CELLS = { 23: { '245,0': '#e6cce1', '36,0': '#ffffff' }, 45: { '246,0': '#ffffff' } }
const NEAREST_LIMIT = 60 // Colours unseen from the front only snap to art colours this close.
const SAME_COLOR = 12
const SLOT_HOLDERS = { 0: 'body', 1: 'face', 2: 'eyes', 3: 'head', 4: 'handLeft', 5: 'handRight', 6: 'pet' }

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
const multiply = (a, b) => {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[r + c * 4] += a[r + k * 4] * b[k + c * 4]
  return out
}
const apply = (m, [x, y, z]) => [0, 1, 2].map((i) => m[i] * x + m[4 + i] * y + m[8 + i] * z + m[12 + i])
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function nodeMatrix(node) {
  if (node.matrix) return node.matrix
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  return [
    (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
    2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
    2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ]
}

function readGlb(file) {
  const bytes = fs.readFileSync(path.join(VOXELS, file))
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength))
  const bin = bytes.subarray(20 + jsonLength + 8)
  const view = (index) => {
    const v = json.bufferViews[index]
    return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)
  }
  const accessor = (index) => {
    const a = json.accessors[index]
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType]
    const raw = view(a.bufferView).subarray(a.byteOffset ?? 0)
    const copy = raw.buffer.slice(raw.byteOffset, raw.byteOffset + a.count * size * Type.BYTES_PER_ELEMENT)
    return { data: new Type(copy), size }
  }
  const meshes = []
  const visit = (index, parent) => {
    const node = json.nodes[index]
    const matrix = multiply(parent, nodeMatrix(node))
    for (const primitive of node.mesh === undefined ? [] : json.meshes[node.mesh].primitives) {
      const material = json.materials[primitive.material]
      const textureIndex = material.pbrMetallicRoughness.baseColorTexture?.index
      const image = textureIndex === undefined ? null : view(json.images[json.textures[textureIndex].source].bufferView)
      meshes.push({
        matrix,
        positions: accessor(primitive.attributes.POSITION).data,
        uvs: accessor(primitive.attributes.TEXCOORD_0).data,
        indices: primitive.indices === undefined ? null : accessor(primitive.indices).data,
        image,
        imageKey: image ? crypto.createHash('md5').update(image).digest('hex') : null,
        factor: material.pbrMetallicRoughness.baseColorFactor.slice(0, 3),
        glows: (material.emissiveFactor ?? []).some((v) => v >= STRONG_GLOW)
      })
    }
    ;(node.children ?? []).forEach((child) => visit(child, matrix))
  }
  json.scenes[0].nodes.forEach((node) => visit(node, IDENTITY))
  return meshes
}

const triangleCount = (mesh) => (mesh.indices ? mesh.indices.length : mesh.positions.length / 3) / 3
const vertexOf = (mesh, t, corner) => (mesh.indices ? mesh.indices[t * 3 + corner] : t * 3 + corner)

/** The palette cell a triangle samples: `x,y` in the image, or null when untextured. */
function cellOf(mesh, t, size) {
  if (!size) return null
  let [u, v] = [0, 0]
  for (let corner = 0; corner < 3; corner++) {
    const vertex = vertexOf(mesh, t, corner)
    u += mesh.uvs[vertex * 2] / 3
    v += mesh.uvs[vertex * 2 + 1] / 3
  }
  const wrap = (value, limit) => Math.min(limit - 1, Math.max(0, Math.floor((value - Math.floor(value)) * limit)))
  return `${wrap(u, size[0])},${wrap(v, size[1])}`
}

/** Z-buffers a model from the front into the art's opaque bounds, recording the cell seen per sample. */
function projectFront(meshes, holder, art, mirrored, sizes) {
  const world = meshes.map((mesh) => {
    const matrix = multiply(holder, mesh.matrix)
    const points = []
    for (let i = 0; i < mesh.positions.length; i += 3) points.push(apply(matrix, [mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]]))
    return points
  })
  const all = world.flat()
  if (!all.length) return []
  const [minX, maxX] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))]
  const [minY, maxY] = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))]
  const width = art.maxX - art.minX + 1
  const height = art.maxY - art.minY + 1
  const depth = new Float64Array(width * height).fill(Infinity)
  const seen = new Array(width * height).fill(null)
  const toArt = ([x, y, z]) => {
    const across = (x - minX) / (maxX - minX || 1)
    // The gotchi faces -Z, so its +X is on the viewer's left... unless the art disagrees.
    return [(mirrored ? across : 1 - across) * width, (1 - (y - minY) / (maxY - minY || 1)) * height, z]
  }
  meshes.forEach((mesh, m) => {
    for (let t = 0; t < triangleCount(mesh); t++) {
      const [a, b, c] = [0, 1, 2].map((corner) => toArt(world[m][vertexOf(mesh, t, corner)]))
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      if (Math.abs(area) < 1e-6) continue
      const cell = cellOf(mesh, t, sizes[m])
      for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))); y < Math.min(height, Math.ceil(Math.max(a[1], b[1], c[1]))); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))); x < Math.min(width, Math.ceil(Math.max(a[0], b[0], c[0]))); x++) {
          const [px, py] = [x + 0.5, y + 0.5]
          const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area
          const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area
          const w2 = 1 - w0 - w1
          if (w0 < 0 || w1 < 0 || w2 < 0) continue
          const z = w0 * a[2] + w1 * b[2] + w2 * c[2]
          if (z >= depth[x + y * width]) continue
          depth[x + y * width] = z
          seen[x + y * width] = { mesh: m, cell }
        }
      }
    }
  })
  const samples = []
  seen.forEach((hit, i) => {
    if (!hit) return
    const color = art.pixels[(art.minX + i % width) + (art.minY + Math.floor(i / width)) * art.size]
    if (color) samples.push({ ...hit, color })
  })
  return samples
}

const entryKey = (mesh, cell) => `${mesh.imageKey ?? 'plain'}|${cell}`

/**
 * Models and art differ in proportion, so position alone misleads. A cell takes the art colour
 * closest to its current one, with position only breaking near ties.
 */
function matchCell(votes, current, colors, glows, plain) {
  const total = [...votes.values()].reduce((sum, n) => sum + n, 0)
  if (total < MIN_VOTES || (votes.get(DYNAMIC) ?? 0) / total >= MIN_SHARE) return null
  // A strong glow renders white whatever its palette says, so white art there is already right.
  if (glows && (votes.get('#ffffff') ?? 0) / total >= GLOW_WHITE_SHARE) return '#ffffff'
  // Untextured parts are plain white placeholders, so their colour says nothing: use the art's.
  if (plain) {
    const [color] = [...votes].filter(([c]) => c !== DYNAMIC).sort((a, b) => b[1] - a[1])[0] ?? []
    return color ?? null
  }
  let best = null
  for (const color of colors) {
    // Art outlines are black and the models have none, so only dark cells may turn black.
    if (color === '#000000' && distance(current, [0, 0, 0]) > 80) continue
    const d = distance(rgb(color), current)
    const cost = d * (1 - POSITION_WEIGHT * ((votes.get(color) ?? 0) / total))
    if (d <= MATCH_LIMIT && (!best || cost < best.cost)) best = { color, cost }
  }
  return best?.color ?? null
}

/** Art colours big enough to count, so stray pixels never win. */
function mainColors(art) {
  const counts = new Map()
  for (const color of art.pixels) if (color && color !== DYNAMIC) counts.set(color, (counts.get(color) ?? 0) + 1)
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
  return [...counts].filter(([, n]) => n / total >= MIN_ART_AREA).map(([color]) => color)
}

async function rasteriseAll(wearables) {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ executablePath: process.env.CHROME })
  const page = await browser.newPage()
  const size = ART_SIZE * SAMPLES_PER_PIXEL
  const result = new Map()
  for (const w of wearables) {
    const front = w.svgs[0]
    const sleeves = (w.sleeves ?? []).join?.('') ?? ''
    const [main, sleeve] = await page.evaluate(async ({ parts, size, dynamic }) => {
      const render = async (body) => {
        if (!body) return null
        const style = `<style>[class*="gotchi-primary"],[class*="gotchi-secondary"],[class*="gotchi-eyeColor"],[class*="gotchi-cheek"]{fill:${dynamic}!important}</style>`
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="${size}" height="${size}" shape-rendering="crispEdges">${style}${body}</svg>`
        const image = new Image()
        image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0)
        return Array.from(context.getImageData(0, 0, size, size).data)
      }
      return [await render(parts[0]), await render(parts[1])]
    }, { parts: [front, sleeves], size, dynamic: DYNAMIC })
    result.set(w.id, { main: toArt(main, size), sleeve: toArt(sleeve, size) })
  }
  const palettes = new Map()
  const imagePage = await browser.newPage()
  return { art: result, browser, imagePage, palettes }
}

function toArt(data, size) {
  if (!data) return null
  const pixels = new Array(size * size).fill(null)
  let [minX, minY, maxX, maxY] = [size, size, -1, -1]
  for (let i = 0; i < size * size; i++) {
    if (data[i * 4 + 3] < 128) continue
    pixels[i] = hex([data[i * 4], data[i * 4 + 1], data[i * 4 + 2]])
    minX = Math.min(minX, i % size)
    maxX = Math.max(maxX, i % size)
    minY = Math.min(minY, Math.floor(i / size))
    maxY = Math.max(maxY, Math.floor(i / size))
  }
  return maxX < 0 ? null : { pixels, minX, minY, maxX, maxY, size }
}

/** Decodes a palette PNG in the browser: its size and a colour per pixel. */
async function readPalette(page, cache, mesh) {
  if (!mesh.image) return null
  if (!cache.has(mesh.imageKey)) {
    cache.set(mesh.imageKey, await page.evaluate(async (base64) => {
      // Raw values: a colour-managed read shifts them enough to flip close matches.
      const blob = await fetch(`data:image/png;base64,${base64}`).then((response) => response.blob())
      const image = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0)
      if (image.width * image.height > 4096) return { size: [image.width, image.height], data: null }
      return { size: [image.width, image.height], data: Array.from(context.getImageData(0, 0, image.width, image.height).data) }
    }, mesh.image.toString('base64')))
  }
  return cache.get(mesh.imageKey)
}

const currentColor = (mesh, palette, cell) => {
  if (!palette?.data) return mesh.factor.map((v) => Math.round(Math.min(1, v) * 255))
  const [x, y] = cell.split(',').map(Number)
  const at = (x + y * palette.size[0]) * 4
  return [palette.data[at], palette.data[at + 1], palette.data[at + 2]]
}

const artColors = (art) => new Set((art?.pixels ?? []).filter((c) => c && c !== DYNAMIC && c !== '#000000'))

function nearest(colors, current) {
  let best = null
  for (const color of colors) {
    const d = distance(rgb(color), current)
    if (d <= NEAREST_LIMIT && (!best || d < best.d)) best = { color, d }
  }
  return best?.color ?? null
}

const manifest = JSON.parse(fs.readFileSync(path.join(VOXELS, 'manifest.json')))
const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'aavegotchi_db_wearables.json'))).wearables
const items = db.filter((w) => manifest.wearables[w.id]?.main)
const { art, browser, imagePage, palettes } = await rasteriseAll(items)

const output = {}
const report = []
for (const w of items) {
  const files = manifest.wearables[w.id]
  const { main, sleeve } = art.get(w.id)
  const slot = w.slotPositions.findIndex(Boolean)
  const movable = slot === 6 && manifest.movablePets.includes(w.id)
  const holder = manifest.holders[movable ? 'movablePet' : SLOT_HOLDERS[slot]] ?? IDENTITY
  const meshes = readGlb(files.main)
  const paletteOf = await Promise.all(meshes.map((mesh) => readPalette(imagePage, palettes, mesh)))
  // Photographic textures have no palette cells to recolour.
  const sizes = paletteOf.map((palette) => (palette?.data ? palette.size : null))
  if (!main) { report.push({ id: w.id, name: w.name, status: 'no art' }); continue }

  const [plain, flipped] = [false, true].map((mirrored) => projectFront(meshes, holder, main, mirrored, sizes))
  const agreement = (samples) => {
    const tally = new Map()
    for (const { mesh, cell, color } of samples) {
      const key = `${mesh}|${cell}`
      if (!tally.has(key)) tally.set(key, new Map())
      tally.get(key).set(color, (tally.get(key).get(color) ?? 0) + 1)
    }
    return [...tally.values()].reduce((sum, votes) => sum + Math.max(...votes.values()), 0)
  }
  const samples = agreement(flipped) > agreement(plain) ? flipped : plain

  const votes = new Map()
  const owner = new Map()
  for (const { mesh, cell, color } of samples) {
    const key = entryKey(meshes[mesh], cell)
    if (!votes.has(key)) votes.set(key, new Map())
    votes.get(key).set(color, (votes.get(key).get(color) ?? 0) + 1)
    owner.set(key, { mesh, cell })
  }
  const colors = mainColors(main)
  const matched = new Map()
  for (const [key, tally] of votes) {
    const { mesh, cell } = owner.get(key)
    const color = matchCell(tally, currentColor(meshes[mesh], paletteOf[mesh], cell), colors, meshes[mesh].glows, !meshes[mesh].image)
    if (color) matched.set(key, color)
  }
  for (const [cell, color] of Object.entries(MANUAL_CELLS[w.id] ?? {})) {
    for (const mesh of meshes) if (mesh.imageKey) matched.set(entryKey(mesh, cell), color)
  }

  const fallback = new Set([...artColors(main), ...artColors(sleeve)])
  const buildFile = async (file) => {
    const parts = readGlb(file)
    const partPalettes = await Promise.all(parts.map((mesh) => readPalette(imagePage, palettes, mesh)))
    let changes = 0
    const entries = parts.map((mesh, m) => {
      const palette = partPalettes[m]
      if (mesh.image && !palette?.data) return null
      const cells = {}
      const used = new Set()
      for (let t = 0; t < triangleCount(mesh); t++) used.add(cellOf(mesh, t, palette?.size))
      const assigned = []
      for (const cell of used) {
        const current = currentColor(mesh, palette, cell)
        const color = matched.get(entryKey(mesh, cell)) ?? nearest(fallback, current)
        if (!color) continue
        assigned.push(color)
        if (distance(rgb(color), current) <= SAME_COLOR && !mesh.glows) continue
        if (cell === null) cells.plain = color
        else cells[cell] = color
      }
      // A glowing material ignores its palette under the renderer's lights, so colours only
      // show once it stops glowing. Solid white parts keep their glow.
      const unlit = mesh.glows && assigned.some((color) => color !== '#ffffff')
      if (!Object.keys(cells).length && !unlit) return null
      changes += Object.keys(cells).length
      return { cells, ...(unlit ? { unlit: true } : {}) }
    })
    return { entries, changes }
  }

  const changed = {}
  let total = 0
  for (const file of [files.main, files.sleeveLeft, files.sleeveRight, files.rightHandWeapon].filter(Boolean)) {
    const { entries, changes } = await buildFile(file)
    if (entries.some(Boolean)) changed[file] = entries
    total += changes
  }
  if (Object.keys(changed).length) output[w.id] = changed
  report.push({ id: w.id, name: w.name, status: total ? 'recoloured' : 'kept', cells: total, confident: matched.size, seen: votes.size })
}
await browser.close()

fs.writeFileSync(OUTPUT, JSON.stringify(output))
const uncertain = report.filter((r) => r.seen && r.confident / r.seen < 0.5)
console.log(`${report.length} items, ${report.filter((r) => r.status === 'recoloured').length} recoloured, ${report.filter((r) => r.status === 'kept').length} unchanged`)
console.log(`low confidence: ${uncertain.map((r) => `${r.id} ${r.name}`).join(', ') || 'none'}`)
