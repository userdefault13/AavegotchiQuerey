/**
 * Minimal MagicaVoxel .vox reader: models, palette, and the scene graph flattened into
 * `instances`, each placing one model with a 3x3 rotation (row-major) and a translation.
 */
export function parseVox(arrayBuffer) {
  const view = new DataView(arrayBuffer)
  const tag = (offset) => String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3)
  )
  if (arrayBuffer.byteLength < 20 || tag(0) !== 'VOX ') throw new Error('Not a .vox file')

  const models = []
  const sceneNodes = new Map()
  const hiddenLayers = new Set()
  let size = null
  let palette = null
  let offset = 8
  while (offset + 12 <= arrayBuffer.byteLength) {
    const id = tag(offset)
    const contentSize = view.getUint32(offset + 4, true)
    const content = offset + 12
    if (id === 'SIZE') {
      size = [view.getUint32(content, true), view.getUint32(content + 4, true), view.getUint32(content + 8, true)]
    } else if (id === 'XYZI') {
      const count = view.getUint32(content, true)
      const voxels = new Uint8Array(arrayBuffer, content + 4, count * 4)
      models.push({ size, voxels })
    } else if (id === 'RGBA') {
      // Palette entry i describes colour index i + 1.
      palette = new Uint8Array(arrayBuffer, content, 256 * 4)
    } else if (id === 'nTRN' || id === 'nGRP' || id === 'nSHP' || id === 'LAYR') {
      readSceneChunk(view, id, content, sceneNodes, hiddenLayers)
    }
    // MAIN holds its children inline, so step into it rather than over it.
    offset = id === 'MAIN' ? content + contentSize : content + contentSize + view.getUint32(offset + 8, true)
  }
  return { models, palette, instances: flattenScene(sceneNodes, hiddenLayers, models.length) }
}

function readSceneChunk(view, id, start, sceneNodes, hiddenLayers) {
  let o = start
  const int = () => {
    const value = view.getInt32(o, true)
    o += 4
    return value
  }
  const string = () => {
    const length = int()
    const bytes = new Uint8Array(view.buffer, o, length)
    o += length
    return String.fromCharCode(...bytes)
  }
  const dict = () => {
    const entries = {}
    for (let n = int(); n > 0; n--) {
      const key = string()
      entries[key] = string()
    }
    return entries
  }

  const nodeId = int()
  const attributes = dict()
  if (id === 'LAYR') {
    if (attributes._hidden === '1') hiddenLayers.add(nodeId)
  } else if (id === 'nTRN') {
    const child = int()
    int() // reserved
    const layer = int()
    int() // frame count
    const frame = dict()
    sceneNodes.set(nodeId, {
      children: [child],
      layer,
      hidden: attributes._hidden === '1',
      rotation: frame._r === undefined ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : decodeRotation(Number(frame._r)),
      translation: frame._t ? frame._t.split(' ').map(Number) : [0, 0, 0]
    })
  } else if (id === 'nGRP') {
    const children = []
    for (let n = int(); n > 0; n--) children.push(int())
    sceneNodes.set(nodeId, { children })
  } else {
    int() // always one model
    sceneNodes.set(nodeId, { children: [], model: int() })
  }
}

function decodeRotation(bits) {
  const first = bits & 3
  const second = (bits >> 2) & 3
  const third = 3 - first - second
  const signs = [(bits >> 4) & 1, (bits >> 5) & 1, (bits >> 6) & 1].map((b) => (b ? -1 : 1))
  const rotation = new Array(9).fill(0)
  rotation[first] = signs[0]
  rotation[3 + second] = signs[1]
  rotation[6 + third] = signs[2]
  return rotation
}

function flattenScene(sceneNodes, hiddenLayers, modelCount) {
  const instances = []
  const visit = (id, rotation, translation) => {
    const node = sceneNodes.get(id)
    if (!node || node.hidden || hiddenLayers.has(node.layer)) return
    let [r, t] = [rotation, translation]
    if (node.rotation) {
      const a = rotation
      const b = node.rotation
      r = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) =>
        a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]))
      t = [0, 1, 2].map((row) => translation[row] +
        a[row * 3] * node.translation[0] + a[row * 3 + 1] * node.translation[1] + a[row * 3 + 2] * node.translation[2])
    }
    if (node.model !== undefined) instances.push({ model: node.model, rotation: r, translation: t })
    node.children.forEach((child) => visit(child, r, t))
  }
  visit(0, [1, 0, 0, 0, 1, 0, 0, 0, 1], [0, 0, 0])
  if (instances.length) return instances
  // Older files have no scene graph: show every model at the origin.
  return Array.from({ length: modelCount }, (_, model) => ({
    model, rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0]
  }))
}
