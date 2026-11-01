#!/usr/bin/env node
/**
 * Builds the isometric base library from the on-chain 2D art: each 64x64 part is sheared onto
 * a 2:1 plane, and the body gets a thin side band for depth. Theme classes are kept, so the
 * output colours the same way as the 2D library. Writes public/data/aavegotchi_db_iso_base.json.
 *
 * Views are the way the gotchi faces on screen: sw and se show the face, ne and nw the back.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name)))

const SIZE = 64
const DEPTH = 4
const HAND_DEPTH = 1
const PAD_X = 6
const PAD_TOP = DEPTH / 2 + 4
const WIDTH = SIZE + DEPTH + PAD_X * 2
const HEIGHT = PAD_TOP + SIZE + SIZE / 2 + 4
const FRONT = 0
const BACK = 3
const VIEWS = { sw: { art: FRONT, mirror: false }, se: { art: FRONT, mirror: true }, ne: { art: BACK, mirror: false }, nw: { art: BACK, mirror: true } }
const THEME_CLASSES = ['gotchi-primary-mouth', 'gotchi-primary', 'gotchi-secondary', 'gotchi-cheek', 'gotchi-eyeColor', 'gotchi-collateral', 'gotchi-shadow']

/** Sub-paths of a path's `d`, as closed polygons. Handles the straight commands the art uses. */
function polygons(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? []
  const result = []
  let polygon = null
  let [x, y, i, command] = [0, 0, 0, '']
  const number = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++]
    const relative = command === command.toLowerCase()
    const upper = command.toUpperCase()
    if (upper === 'Z') {
      if (polygon) [x, y] = polygon[0]
      polygon = null
      continue
    }
    if (upper === 'M' || upper === 'L') {
      const [a, b] = [number(), number()]
      x = relative ? x + a : a
      y = relative ? y + b : b
      if (upper === 'M' || !polygon) {
        polygon = [[x, y]]
        result.push(polygon)
        command = relative ? 'l' : 'L'
        continue
      }
    } else if (upper === 'H') {
      const a = number()
      x = relative ? x + a : a
    } else if (upper === 'V') {
      const a = number()
      y = relative ? y + a : a
    } else {
      throw new Error(`Unsupported path command ${command}`)
    }
    if (!polygon) {
      polygon = [[x, y]]
      result.push(polygon)
    } else {
      polygon.push([x, y])
    }
  }
  return result
}

function fillPath(grid, d, key) {
  const shapes = polygons(d)
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const [px, py] = [col + 0.5, row + 0.5]
      let winding = 0
      for (const shape of shapes) {
        for (let k = 0; k < shape.length; k++) {
          const [x1, y1] = shape[k]
          const [x2, y2] = shape[(k + 1) % shape.length]
          if ((y1 <= py) === (y2 <= py)) continue
          if (x1 + ((py - y1) / (y2 - y1)) * (x2 - x1) > px) winding += y2 > y1 ? 1 : -1
        }
      }
      if (winding !== 0) grid.set(`${col},${row}`, key)
    }
  }
}

/** Rasterises art into `x,y` -> paint, one pixel per art unit. `skip` drops whole groups by class. */
function rasterise(svg, { only = null, skip = [] } = {}) {
  const grid = new Map()
  const stack = []
  for (const [, closing, name, attributes = '', selfClosing] of svg.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    if (closing) {
      stack.pop()
      continue
    }
    const attribute = (key) => attributes.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`))?.[1]
    const parent = stack[stack.length - 1] ?? { paint: null, classes: [], opacity: null }
    const classes = [...parent.classes, ...(attribute('class')?.split(/\s+/) ?? [])]
    const theme = attribute('class')?.split(/\s+/).find((c) => THEME_CLASSES.includes(c))
    const fill = attribute('fill')
    const paint = theme ? (fill ? `fill:${fill}|${theme}` : `class:${theme}`) : fill ? `fill:${fill}` : parent.paint
    const node = { paint, classes, opacity: attribute('opacity') ?? parent.opacity }
    if (name === 'path') {
      const wanted = (!only || classes.includes(only)) && !skip.some((c) => classes.includes(c))
      if (wanted) fillPath(grid, attribute('d'), `${node.paint ?? 'class:gotchi-primary'}`)
    }
    if (!selfClosing && name !== 'path') stack.push(node)
    if (!selfClosing && name === 'path') stack.push(node)
  }
  return grid
}

/** Maps one art pixel to its place on the sheared plane, `depth` steps back from the front. */
function place(col, row, mirror, depth = 0) {
  const x = mirror ? SIZE - 1 - col : col
  const sheared = mirror ? Math.floor((SIZE - 1 - x) / 2) : Math.floor(x / 2)
  const step = mirror ? -depth : depth
  return [x + step + PAD_X + (mirror ? DEPTH : 0), row + sheared - Math.floor(depth / 2) + PAD_TOP]
}

function project(grid, mirror) {
  const out = new Map()
  for (const [key, paint] of grid) {
    const [col, row] = key.split(',').map(Number)
    const [x, y] = place(col, row, mirror)
    out.set(`${x},${y}`, paint)
  }
  return out
}

/** Pushes the silhouette back: side pixels are the band, and one outline wraps the whole shape. */
function extrude(grid, mirror, depth) {
  const out = new Map()
  for (const key of grid.keys()) {
    const [col, row] = key.split(',').map(Number)
    for (let d = depth; d >= 1; d--) {
      const [x, y] = place(col, row, mirror, d)
      out.set(`${x},${y}`, 'class:gotchi-secondary')
    }
  }
  const front = project(grid, mirror)
  const solid = new Set([...out.keys(), ...front.keys()])
  for (const key of out.keys()) {
    const [x, y] = key.split(',').map(Number)
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !solid.has(`${x + a},${y + b}`))) out.set(key, 'class:gotchi-primary')
  }
  // The front's edge against the band would draw a hard inner line, so it joins the band.
  for (const [key, paint] of front) {
    const [x, y] = key.split(',').map(Number)
    const toBand = mirror ? -1 : 1
    // The art's outline is more than a pixel thick, so walk across all of it to see what's beyond.
    let beside = x + toBand
    while (front.get(`${beside},${y}`) === 'class:gotchi-primary') beside += toBand
    const inner = paint === 'class:gotchi-primary' && !front.has(`${beside},${y}`) && out.get(`${beside},${y}`) === 'class:gotchi-secondary'
    out.set(key, inner ? 'class:gotchi-secondary' : paint)
  }
  return out
}

/** Pixels back to SVG: one run per row, grouped by paint and keeping the theme classes. */
function toSvg(grid, rootClass) {
  const byPaint = new Map()
  const rows = new Map()
  for (const [key, paint] of grid) {
    const [x, y] = key.split(',').map(Number)
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push([x, paint])
  }
  for (const [y, cells] of [...rows].sort((a, b) => a[0] - b[0])) {
    cells.sort((a, b) => a[0] - b[0])
    let i = 0
    while (i < cells.length) {
      let j = i
      while (j + 1 < cells.length && cells[j + 1][1] === cells[i][1] && cells[j + 1][0] === cells[j][0] + 1) j++
      const run = `M${cells[i][0]} ${y}h${j - i + 1}v1h-${j - i + 1}z`
      byPaint.set(cells[i][1], (byPaint.get(cells[i][1]) ?? '') + run)
      i = j + 1
    }
  }
  const groups = [...byPaint].map(([paint, d]) => {
    const [fill, theme] = paint.startsWith('class:') ? [null, paint.slice(6)] : paint.slice(5).split('|')
    const fillAttribute = fill ? ` fill="${fill}"` : ''
    const classAttribute = theme ? ` class="${theme}"` : ''
    return `<path${classAttribute}${fillAttribute} d="${d}"/>`
  })
  return `<g class="${rootClass}">${groups.join('')}</g>`
}

function perView(build) {
  return Object.fromEntries(Object.entries(VIEWS).map(([view, config]) => [view, build(config)]))
}

const flat = (svgs, rootClass, options) => perView(({ art, mirror }) => {
  const svg = svgs[art] ?? ''
  return toSvg(project(rasterise(svg, options), mirror), rootClass)
})

// Faces and collateral symbols belong on the front, so the back views stay plain.
const frontOnly = (svgs, rootClass) => flat([svgs[FRONT]], rootClass)

/** The floor shadow: the body's footprint, offset along the ground. */
function shadow(body, mirror) {
  const grid = new Map()
  const rows = [...body.keys()].map((key) => Number(key.split(',')[1]))
  const bottom = Math.max(...rows)
  const columns = [...body.keys()].filter((key) => Number(key.split(',')[1]) >= bottom - 2).map((key) => Number(key.split(',')[0]))
  const [left, right] = [Math.min(...columns), Math.max(...columns)]
  for (let col = left; col <= right; col++) {
    for (let d = 0; d <= DEPTH + 2; d++) {
      for (let thick = 0; thick < 3; thick++) {
        const [x, y] = place(col, bottom + 2 + thick, mirror, d)
        grid.set(`${x},${y}`, 'fill:#000')
      }
    }
  }
  return grid
}

const main = read('aavegotchi_db_main.json')
const bodyGrids = perView(({ art }) => rasterise(main.body[art], { skip: ['gotchi-shadow', 'gotchi-cheek', 'gotchi-primary-mouth'] }))
const views = Object.keys(VIEWS)

const library = {
  meta: { width: WIDTH, height: HEIGHT, views, source: 'aavegotchi_db_main.json, sheared 2:1' },
  shadow: Object.fromEntries(views.map((view) => [view, toSvg(shadow(bodyGrids[view], VIEWS[view].mirror), 'gotchi-shadow').replace('<path', '<path opacity=".25"')])),
  body: Object.fromEntries(views.map((view) => [view, toSvg(extrude(bodyGrids[view], VIEWS[view].mirror, DEPTH), 'gotchi-body')])),
  cheeks: flat(main.body, 'gotchi-cheeks', { only: 'gotchi-cheek' }),
  mouth_neutral: flat(main.mouth_neutral, 'gotchi-mouth'),
  mouth_happy: flat(main.mouth_happy, 'gotchi-mouth'),
  eyes_mad: flat(main.eyes_mad, 'gotchi-eyes'),
  eyes_happy: flat(main.eyes_happy, 'gotchi-eyes'),
  eyes_sleepy: flat(main.eyes_sleepy, 'gotchi-eyes')
}
for (const pose of ['handsDownClosed', 'handsDownOpen', 'handsUp']) {
  library[pose] = perView(({ art, mirror }) => {
    const grid = rasterise(main.hands[art], { only: `gotchi-${pose}` })
    return toSvg(extrude(grid, mirror, HAND_DEPTH), `gotchi-${pose}`)
  })
}

const collateralFiles = ['aavegotchi_db_collaterals_haunt1.json', 'aavegotchi_db_collaterals_haunt2.json']
const seen = new Set()
library.collaterals = collateralFiles.flatMap((file) => read(file).collaterals).filter((c) => {
  const fresh = !seen.has(c.collateralType)
  seen.add(c.collateralType)
  return fresh
}).map((c) => ({
  collateralType: c.collateralType,
  primaryColor: c.primaryColor,
  secondaryColor: c.secondaryColor,
  cheekColor: c.cheekColor,
  svgs: frontOnly(c.svgs, 'gotchi-collateral')
}))
library.eyeShapes = read('aavegotchi_db_eye_shapes_haunt1.json').eyeShapes.map((e) => ({
  id: e.id,
  svgs: frontOnly(e.svgs, 'gotchi-eyes')
}))

const output = path.join(DATA, 'aavegotchi_db_iso_base.json')
fs.writeFileSync(output, JSON.stringify(library))
console.log(`${path.relative(process.cwd(), output)}: ${WIDTH}x${HEIGHT}, ${library.collaterals.length} collaterals, ${library.eyeShapes.length} eye shapes, ${(fs.statSync(output).size / 1024).toFixed(0)} KB`)
