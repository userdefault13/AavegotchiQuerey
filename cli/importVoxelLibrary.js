#!/usr/bin/env node
/**
 * Bake a checkout of the Voxel-Library Unity project into web assets:
 *   public/voxels/manifest.json     slots, colours, wearable and eye index
 *   public/voxels/base.glb          the naked gotchi, in player space
 *   public/voxels/wearables/*.glb   one model per wearable part, in holder space
 *   public/voxels/eyes/*.glb        one model per eye shape, in player space
 *   public/voxels/vox/*.vox         de-duplicated MagicaVoxel sources
 *
 * Usage: node cli/importVoxelLibrary.js <path-to-Voxel-Library-checkout>
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const SOURCE = process.argv[2]
if (!SOURCE) {
  console.error('Usage: node cli/importVoxelLibrary.js <path-to-Voxel-Library-checkout>')
  process.exit(1)
}

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'voxels')
const PREFABS = 'Assets/_Game Asset/Prefabs/_Phase2-Prefs'
const WEARABLES = `${PREFABS}/_3d Models/Wearables`
const PLAYER = `${PREFABS}/_Player/PlayerForDressingRoom.prefab`
const BUILTIN_GUID = '0000000000000000e000000000000000'
const CUBE_FILE_ID = '10202'

const stats = { missingMesh: new Set(), multiMeshGuess: new Set(), missingMaterial: 0 }

// ---------- matrices (column-major, Unity space) ----------
const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function multiply(a, b) {
  const out = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
    }
  }
  return out
}

function compose({ p, q, s }) {
  const [x, y, z, w] = q
  return [
    (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
    2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    p[0], p[1], p[2], 1
  ]
}

function transformPoint(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14]
  ]
}

function determinant3(m) {
  return m[0] * (m[5] * m[10] - m[9] * m[6]) -
    m[4] * (m[1] * m[10] - m[9] * m[2]) +
    m[8] * (m[1] * m[6] - m[5] * m[2])
}

function invertAffine(m) {
  const det = determinant3(m)
  const inv = [
    (m[5] * m[10] - m[9] * m[6]) / det, (m[9] * m[2] - m[1] * m[10]) / det, (m[1] * m[6] - m[5] * m[2]) / det, 0,
    (m[8] * m[6] - m[4] * m[10]) / det, (m[0] * m[10] - m[8] * m[2]) / det, (m[4] * m[2] - m[0] * m[6]) / det, 0,
    (m[4] * m[9] - m[8] * m[5]) / det, (m[8] * m[1] - m[0] * m[9]) / det, (m[0] * m[5] - m[4] * m[1]) / det, 0,
    0, 0, 0, 1
  ]
  const t = transformPoint(inv, [m[12], m[13], m[14]])
  inv[12] = -t[0]
  inv[13] = -t[1]
  inv[14] = -t[2]
  return inv
}

// Unity is left-handed and glTF right-handed: mirror across Z.
const MIRROR_Z = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1]
const toGltfMatrix = (m) => multiply(multiply(MIRROR_Z, m), MIRROR_Z)

// ---------- Unity assets ----------
function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__MACOSX' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, visit)
    else visit(full)
  }
}

const guidToPath = new Map()
walk(path.join(SOURCE, 'Assets'), (file) => {
  if (!file.endsWith('.meta')) return
  const match = fs.readFileSync(file, 'utf8').slice(0, 4000).match(/^guid: (\w+)/m)
  if (match) guidToPath.set(match[1], file.slice(0, -5))
})

function parseUnityDocs(file) {
  const parts = fs.readFileSync(file, 'utf8').split(/^--- !u!(\d+) &(-?\d+).*$/m)
  const docs = new Map()
  for (let i = 1; i < parts.length; i += 3) {
    docs.set(parts[i + 1], { type: parts[i], text: parts[i + 2] })
  }
  return docs
}

const vector = (text, key, fields) => {
  const match = text.match(new RegExp(`${key}: \\{([^}]*)\\}`))
  if (!match) return null
  const values = Object.fromEntries(match[1].split(',').map((pair) => {
    const [k, v] = pair.split(':')
    return [k.trim(), Number(v)]
  }))
  return fields.map((f) => values[f])
}

const fileRef = (text, key) => {
  const match = text.match(new RegExp(`${key}: \\{fileID: (-?\\d+)(?:, guid: (\\w+))?`))
  return match ? { fileID: match[1], guid: match[2] } : null
}

const materialRefs = (text) => {
  const block = text.match(/m_Materials:\n((?:\s+- \{[^\n]*\n)+)/)
  if (!block) return []
  return [...block[1].matchAll(/guid: (\w+)/g)].map((m) => m[1])
}

function readTransform(text) {
  return {
    p: vector(text, 'm_LocalPosition', ['x', 'y', 'z']) ?? [0, 0, 0],
    q: vector(text, 'm_LocalRotation', ['x', 'y', 'z', 'w']) ?? [0, 0, 0, 1],
    s: vector(text, 'm_LocalScale', ['x', 'y', 'z']) ?? [1, 1, 1]
  }
}

function readOverrides(text) {
  const overrides = new Map()
  const pattern = /- target: \{fileID: (-?\d+)(?:, guid: \w+)?[^}]*\}\n\s+propertyPath: (.+)\n\s+value: ?(.*)\n\s+objectReference: \{fileID: -?\d+(?:, guid: (\w+))?/g
  for (const m of text.matchAll(pattern)) {
    if (!overrides.has(m[1])) overrides.set(m[1], [])
    overrides.get(m[1]).push({ path: m[2], value: m[3], guid: m[4] })
  }
  return overrides
}

function applyOverride(node, { path: prop, value, guid }) {
  const axis = { x: 0, y: 1, z: 2, w: 3 }
  const local = prop.match(/^m_Local(Position|Rotation|Scale)\.([xyzw])$/)
  if (local) {
    const key = { Position: 'p', Rotation: 'q', Scale: 's' }[local[1]]
    node.local[key][axis[local[2]]] = Number(value)
  } else if (prop === 'm_IsActive') {
    node.active = value !== '0'
  } else if (prop === 'm_Name') {
    node.name = value
  } else {
    const material = prop.match(/^m_Materials\.Array\.data\[(\d+)\]$/)
    if (material && guid) node.materials[Number(material[1])] = guid
  }
}

const cloneNode = (node) => ({
  ...node,
  local: { p: [...node.local.p], q: [...node.local.q], s: [...node.local.s] },
  materials: [...node.materials],
  children: node.children.map(cloneNode),
  ids: new Set(node.ids)
})

function findById(node, id) {
  if (node.ids.has(id)) return node
  for (const child of node.children) {
    const hit = findById(child, id)
    if (hit) return hit
  }
  return null
}

function fbxAsNode(file, name) {
  const fbx = loadFbx(file)
  const node = {
    name, active: true, ids: new Set(), mesh: null, materials: [], children: [],
    local: { p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1] }
  }
  const models = fbx.meshModels
  if (models.length === 1) {
    node.mesh = { file, model: models[0].name }
  } else {
    node.children = models.map((model) => ({
      name: model.name, active: true, ids: new Set(), materials: [], children: [],
      mesh: { file, model: model.name },
      local: model.local
    }))
  }
  return node
}

const prefabCache = new Map()

/** Build a tree of {name, local, active, mesh, materials, children} from a prefab. */
function loadPrefab(file) {
  if (prefabCache.has(file)) return prefabCache.get(file)
  const docs = parseUnityDocs(file)
  const gameObjects = new Map()
  const nodes = new Map()
  const fatherOf = new Map()

  for (const [id, doc] of docs) {
    if (doc.type === '1' && !/m_PrefabInstance: \{fileID: [1-9-]/.test(doc.text)) {
      gameObjects.set(id, {
        name: (doc.text.match(/m_Name: (.*)/)?.[1] ?? '').trim(),
        active: !/m_IsActive: 0/.test(doc.text)
      })
    }
  }
  for (const [id, doc] of docs) {
    if ((doc.type === '4' || doc.type === '224') && !/m_PrefabInstance: \{fileID: [1-9-]/.test(doc.text)) {
      const go = fileRef(doc.text, 'm_GameObject')?.fileID
      const info = gameObjects.get(go) ?? { name: '', active: true }
      nodes.set(id, {
        name: info.name, active: info.active, local: readTransform(doc.text),
        mesh: null, materials: [], children: [], ids: new Set([id, go])
      })
      fatherOf.set(id, fileRef(doc.text, 'm_Father')?.fileID)
    }
  }

  const byGameObject = new Map()
  for (const node of nodes.values()) {
    for (const id of node.ids) byGameObject.set(id, node)
  }
  for (const doc of docs.values()) {
    const owner = byGameObject.get(fileRef(doc.text, 'm_GameObject')?.fileID)
    if (!owner) continue
    if (doc.type === '33' || doc.type === '137') {
      const mesh = fileRef(doc.text, 'm_Mesh')
      if (mesh?.guid) owner.mesh = { guid: mesh.guid, fileID: mesh.fileID, name: owner.name }
      if (doc.type === '137') owner.skinned = true
    }
    if (doc.type === '23' || doc.type === '137') {
      owner.materials = materialRefs(doc.text)
      if (/m_Enabled: 0/.test(doc.text)) owner.rendererDisabled = true
    }
  }

  const instanceRoots = new Map()
  for (const [id, doc] of docs) {
    if (doc.type !== '1001') continue
    const source = fileRef(doc.text, 'm_SourcePrefab')
    const sourcePath = guidToPath.get(source?.guid)
    if (!sourcePath) continue
    let instance
    if (sourcePath.toLowerCase().endsWith('.fbx')) {
      instance = fbxAsNode(sourcePath, path.basename(sourcePath, path.extname(sourcePath)))
    } else if (sourcePath.endsWith('.prefab')) {
      instance = cloneNode(loadPrefab(sourcePath))
    } else {
      continue
    }
    for (const [target, list] of readOverrides(doc.text)) {
      const node = findById(instance, target) ?? instance
      for (const override of list) applyOverride(node, override)
    }
    instanceRoots.set(id, instance)
    fatherOf.set(`i${id}`, fileRef(doc.text, 'm_TransformParent')?.fileID)
    nodes.set(`i${id}`, instance)
  }

  // A stripped transform stands in for an object inside a nested instance.
  for (const [id, doc] of docs) {
    if (doc.type !== '4' && doc.type !== '1') continue
    const instance = fileRef(doc.text, 'm_PrefabInstance')?.fileID
    if (!instance || instance === '0' || !instanceRoots.has(instance)) continue
    const source = fileRef(doc.text, 'm_CorrespondingSourceObject')?.fileID
    const target = findById(instanceRoots.get(instance), source) ?? instanceRoots.get(instance)
    target.ids.add(id)
    nodes.set(id, target)
  }

  let root = null
  for (const [id, node] of nodes) {
    if (!fatherOf.has(id)) continue
    const father = nodes.get(fatherOf.get(id))
    if (father && father !== node) father.children.push(node)
    else if (!root) root = node
  }
  prefabCache.set(file, root)
  return root
}

/** Flatten a node tree into parts with matrices relative to the tree's root. */
function collectParts(node, parent = identity(), respectActive = true) {
  if (respectActive && !node.active) return []
  const matrix = multiply(parent, compose(node.local))
  const parts = node.mesh && !node.rendererDisabled
    ? [{ mesh: node.mesh, materials: node.materials, matrix, name: node.name }]
    : []
  for (const child of node.children) parts.push(...collectParts(child, matrix, respectActive))
  return parts
}

function worldMatrix(root, target, parent = identity()) {
  const matrix = multiply(parent, compose(root.local))
  if (root === target) return matrix
  for (const child of root.children) {
    const hit = worldMatrix(child, target, matrix)
    if (hit) return hit
  }
  return null
}

// ---------- FBX ----------
function parseFbxBinary(buffer) {
  const version = buffer.readUInt32LE(23)
  const wide = version >= 7500

  function readValue(state) {
    const type = String.fromCharCode(buffer[state.o++])
    const scalars = {
      Y: [2, (o) => buffer.readInt16LE(o)], C: [1, (o) => buffer[o]],
      I: [4, (o) => buffer.readInt32LE(o)], F: [4, (o) => buffer.readFloatLE(o)],
      D: [8, (o) => buffer.readDoubleLE(o)], L: [8, (o) => Number(buffer.readBigInt64LE(o))]
    }
    if (scalars[type]) {
      const [size, read] = scalars[type]
      const value = read(state.o)
      state.o += size
      return value
    }
    if (type === 'S' || type === 'R') {
      const length = buffer.readUInt32LE(state.o)
      state.o += 4
      const value = buffer.subarray(state.o, state.o + length)
      state.o += length
      return type === 'S' ? value.toString('latin1') : value
    }
    const arrays = {
      f: [4, 'readFloatLE'], d: [8, 'readDoubleLE'], l: [8, 'readBigInt64LE'], i: [4, 'readInt32LE'], b: [1, 'readUInt8']
    }
    if (!arrays[type]) throw new Error(`Unknown FBX property type ${type}`)
    const count = buffer.readUInt32LE(state.o)
    const encoding = buffer.readUInt32LE(state.o + 4)
    const byteLength = buffer.readUInt32LE(state.o + 8)
    state.o += 12
    const raw = buffer.subarray(state.o, state.o + byteLength)
    state.o += byteLength
    const data = encoding === 1 ? zlib.inflateSync(raw) : raw
    const [size, reader] = arrays[type]
    const out = new Array(count)
    for (let i = 0; i < count; i++) out[i] = Number(data[reader](i * size))
    return out
  }

  function readNode(state) {
    const read = () => {
      const value = wide ? Number(buffer.readBigUInt64LE(state.o)) : buffer.readUInt32LE(state.o)
      state.o += wide ? 8 : 4
      return value
    }
    const end = read()
    const propCount = read()
    read()
    const nameLength = buffer[state.o++]
    if (end === 0) return null
    const name = buffer.toString('latin1', state.o, state.o + nameLength)
    state.o += nameLength
    const props = []
    for (let i = 0; i < propCount; i++) props.push(readValue(state))
    const children = []
    while (state.o < end) {
      const child = readNode(state)
      if (!child) break
      children.push(child)
    }
    state.o = end
    return { name, props, children }
  }

  const state = { o: 27 }
  const children = []
  while (state.o < buffer.length - 13 * (wide ? 2 : 1)) {
    const node = readNode(state)
    if (!node) break
    children.push(node)
  }
  return { name: 'root', props: [], children }
}

function parseFbxAscii(text) {
  const root = { name: 'root', props: [], children: [] }
  const stack = [root]
  let open = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';')) continue
    if (line === '}') {
      if (stack.length > 1) stack.pop()
      open = null
      continue
    }
    const match = line.match(/^([\w|]+):\s*(.*)$/)
    if (!match) {
      // Continuation of a wrapped numeric array.
      if (open) open.props.push(...parseAsciiValues(line))
      continue
    }
    const hasBlock = match[2].endsWith('{')
    const node = {
      name: match[1],
      props: parseAsciiValues(hasBlock ? match[2].slice(0, -1) : match[2]),
      children: []
    }
    stack[stack.length - 1].children.push(node)
    open = node
    if (hasBlock) {
      stack.push(node)
      open = null
    }
  }
  return root
}

function parseAsciiValues(text) {
  const values = []
  for (const m of text.matchAll(/"((?:[^"\\]|\\.)*)"|\*(\d+)|([^,\s]+)/g)) {
    if (m[1] !== undefined) values.push(m[1])
    else if (m[2] !== undefined) continue
    else {
      const n = Number(m[3])
      values.push(Number.isNaN(n) ? m[3] : n)
    }
  }
  return values
}

const fbxChild = (node, name) => node?.children.find((c) => c.name === name)

/** Arrays live directly on a node (binary) or under an `a:` child (ASCII). */
const fbxArray = (node) => {
  if (!node) return []
  const a = fbxChild(node, 'a')
  if (a) return a.props
  return Array.isArray(node.props[0]) ? node.props[0] : node.props
}

function fbxProperty(model, name) {
  const holder = fbxChild(model, 'Properties70')
  const prop = holder?.children.find((c) => c.props[0] === name)
  return prop ? prop.props.slice(4).map(Number) : null
}

const asId = (value) => String(value)
const fbxObjectName = (value) => String(value).split('\u0000')[0].replace(/^(Model|Material|Geometry)::/, '').trim()

function eulerToQuaternion([x, y, z]) {
  const r = Math.PI / 360
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x * r), Math.sin(x * r), Math.cos(y * r), Math.sin(y * r), Math.cos(z * r), Math.sin(z * r)]
  // FBX default rotation order is XYZ (X applied first).
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz
  ]
}

const fbxCache = new Map()

function loadFbx(file) {
  if (fbxCache.has(file)) return fbxCache.get(file)
  const buffer = fs.readFileSync(file)
  const tree = buffer.subarray(0, 18).toString('latin1').startsWith('Kaydara FBX Binary')
    ? parseFbxBinary(buffer)
    : parseFbxAscii(buffer.toString('utf8'))

  const objects = fbxChild(tree, 'Objects')
  const connections = fbxChild(tree, 'Connections')?.children ?? []
  const geometries = new Map()
  const models = new Map()
  const materials = new Map()
  for (const node of objects?.children ?? []) {
    const id = asId(node.props[0])
    if (node.name === 'Geometry') geometries.set(id, node)
    if (node.name === 'Model') models.set(id, node)
    if (node.name === 'Material') materials.set(id, fbxObjectName(node.props[1]))
  }

  const geometryOf = new Map()
  const materialsOf = new Map()
  for (const c of connections) {
    if (c.props[0] !== 'OO') continue
    const [child, parent] = [asId(c.props[1]), asId(c.props[2])]
    if (geometries.has(child) && models.has(parent)) geometryOf.set(parent, child)
    if (materials.has(child) && models.has(parent)) {
      if (!materialsOf.has(parent)) materialsOf.set(parent, [])
      materialsOf.get(parent).push(materials.get(child))
    }
  }

  // Unity imports centimetres at 0.01, times the importer's Scale Factor (the rig uses 38),
  // and mirrors X into its left-handed space.
  const meta = fs.readFileSync(`${file}.meta`, 'utf8')
  const globalScale = Number(meta.match(/globalScale: ([\d.e+-]+)/)?.[1] ?? 1)
  const fileUnits = fbxProperty(fbxChild(tree, 'GlobalSettings'), 'UnitScaleFactor')?.[0] ?? 1
  const unitScale = fileUnits / 100 * globalScale
  const meshModels = []
  for (const [id, model] of models) {
    const geometryId = geometryOf.get(id)
    if (!geometryId) continue
    const translation = fbxProperty(model, 'Lcl Translation') ?? [0, 0, 0]
    const rotation = fbxProperty(model, 'Lcl Rotation') ?? [0, 0, 0]
    const scale = fbxProperty(model, 'Lcl Scaling') ?? [1, 1, 1]
    const q = eulerToQuaternion(rotation)
    meshModels.push({
      name: fbxObjectName(model.props[1]),
      geometry: geometries.get(geometryId),
      geometryId,
      geometricOffset: fbxProperty(model, 'GeometricTranslation') ?? [0, 0, 0],
      materialNames: materialsOf.get(id) ?? [],
      unitScale,
      local: {
        p: [-translation[0] * unitScale, translation[1] * unitScale, translation[2] * unitScale],
        q: [q[0], -q[1], -q[2], q[3]],
        s: scale
      }
    })
  }
  const result = { meshModels, objects, connections, models, unitScale, meta, tree }
  for (const model of meshModels) model.fbx = result
  fbxCache.set(file, result)
  return result
}

function fbxTriangles(model) {
  const g = model.geometry
  const vertices = fbxArray(fbxChild(g, 'Vertices'))
  const polygon = fbxArray(fbxChild(g, 'PolygonVertexIndex'))
  const uvLayer = fbxChild(g, 'LayerElementUV')
  const uvs = fbxArray(fbxChild(uvLayer, 'UV'))
  const uvIndex = fbxArray(fbxChild(uvLayer, 'UVIndex'))
  const uvMapping = fbxChild(uvLayer, 'MappingInformationType')?.props[0]
  const materialLayer = fbxChild(g, 'LayerElementMaterial')
  const materialIndex = fbxArray(fbxChild(materialLayer, 'Materials'))
  const materialMapping = fbxChild(materialLayer, 'MappingInformationType')?.props[0]
  const [gx, gy, gz] = model.geometricOffset

  const corner = (polyVertex) => {
    const raw = polygon[polyVertex]
    const v = raw < 0 ? -raw - 1 : raw
    const position = [
      -(vertices[v * 3] + gx) * model.unitScale,
      (vertices[v * 3 + 1] + gy) * model.unitScale,
      (vertices[v * 3 + 2] + gz) * model.unitScale
    ]
    let uv = [0, 0]
    if (uvs.length) {
      const direct = uvMapping === 'ByPolygonVertex' ? polyVertex : v
      const u = uvIndex.length ? uvIndex[direct] : direct
      uv = [uvs[u * 2], uvs[u * 2 + 1]]
    }
    return { position, uv, index: v }
  }

  const bySlot = new Map()
  let start = 0
  let polygonNumber = 0
  for (let i = 0; i < polygon.length; i++) {
    if (polygon[i] >= 0) continue
    const slot = materialMapping === 'ByPolygon' ? (materialIndex[polygonNumber] ?? 0) : (materialIndex[0] ?? 0)
    if (!bySlot.has(slot)) bySlot.set(slot, [])
    const triangles = bySlot.get(slot)
    for (let k = start + 1; k < i; k++) triangles.push([corner(start), corner(k), corner(k + 1)])
    start = i + 1
    polygonNumber++
  }
  return bySlot
}

// Unity derives an FBX mesh's fileID as xxHash64("Type:Mesh->" + name + occurrence).
function xxHash64(input) {
  const [P1, P2, P3, P4, P5] = [11400714785074694791n, 14029467366897019727n, 1609587929392839161n, 9650029242287828579n, 2870177450012600261n]
  const M = (1n << 64n) - 1n
  const rotl = (x, r) => ((x << BigInt(r)) | (x >> BigInt(64 - r))) & M
  const round = (acc, value) => (rotl((acc + value * P2) & M, 31) * P1) & M
  const b = Buffer.from(input)
  let i = 0
  let h
  if (b.length >= 32) {
    const v = [(P1 + P2) & M, P2, 0n, (M + 1n - P1) & M]
    while (i <= b.length - 32) {
      for (let k = 0; k < 4; k++) v[k] = round(v[k], b.readBigUInt64LE(i + k * 8))
      i += 32
    }
    h = (rotl(v[0], 1) + rotl(v[1], 7) + rotl(v[2], 12) + rotl(v[3], 18)) & M
    for (const value of v) h = ((h ^ round(0n, value)) * P1 + P4) & M
  } else {
    h = P5
  }
  h = (h + BigInt(b.length)) & M
  while (i + 8 <= b.length) {
    h = (rotl(h ^ round(0n, b.readBigUInt64LE(i)), 27) * P1 + P4) & M
    i += 8
  }
  if (i + 4 <= b.length) {
    h = (rotl(h ^ ((BigInt(b.readUInt32LE(i)) * P1) & M), 23) * P2 + P3) & M
    i += 4
  }
  while (i < b.length) {
    h = (rotl(h ^ ((BigInt(b[i]) * P5) & M), 11) * P1) & M
    i++
  }
  h ^= h >> 33n
  h = (h * P2) & M
  h ^= h >> 29n
  h = (h * P3) & M
  h ^= h >> 32n
  return String(BigInt.asIntN(64, h))
}

function resolveMeshModel(ref) {
  const file = ref.file ?? guidToPath.get(ref.guid)
  if (!file || !file.toLowerCase().endsWith('.fbx') || !fs.existsSync(file)) return null
  const { meshModels } = loadFbx(file)
  if (ref.model) return meshModels.find((m) => m.name === ref.model) ?? null
  const occurrences = new Map()
  for (const model of meshModels) {
    const n = occurrences.get(model.name) ?? 0
    occurrences.set(model.name, n + 1)
    if (xxHash64(`Type:Mesh->${model.name}${n}`) === ref.fileID) return model
  }
  if (meshModels.length === 1) return meshModels[0]
  stats.multiMeshGuess.add(`${path.basename(file)}:${ref.name}`)
  return null
}

// ---------- materials ----------
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

const hexColor = ([r, g, b]) => '#' + [r, g, b]
  .map((c) => Math.round(Math.max(0, Math.min(1, c)) * 255).toString(16).padStart(2, '0'))
  .join('')

function readColor(text, key) {
  return vector(text, key, ['r', 'g', 'b', 'a'])
}

const materialCache = new Map()

function loadMaterial(guid) {
  if (materialCache.has(guid)) return materialCache.get(guid)
  const file = guidToPath.get(guid)
  let material = { name: 'default', color: [1, 1, 1, 1], emissive: [0, 0, 0], texture: null, transparent: false }
  if (file?.endsWith('.mat')) {
    const text = fs.readFileSync(file, 'utf8')
    const textureGuid = text.match(/- _BaseMap:\n\s+m_Texture: \{fileID: \d+, guid: (\w+)/)?.[1] ??
      text.match(/- _MainTex:\n\s+m_Texture: \{fileID: \d+, guid: (\w+)/)?.[1]
    const texture = guidToPath.get(textureGuid)
    const emissionOn = /_EMISSION/.test(text)
    const emissive = readColor(text, '- _EmissionColor') ?? [0, 0, 0, 1]
    material = {
      name: text.match(/m_Name: (.*)/g)?.at(-1)?.replace('m_Name: ', '') ?? path.basename(file, '.mat'),
      color: readColor(text, '- _BaseColor') ?? readColor(text, '- _Color') ?? [1, 1, 1, 1],
      emissive: emissionOn ? emissive.slice(0, 3) : [0, 0, 0],
      texture: texture && /\.(png|jpe?g)$/i.test(texture) ? texture : null,
      transparent: /_Surface: 1/.test(text)
    }
  } else {
    stats.missingMaterial++
  }
  materialCache.set(guid, material)
  return material
}

// ---------- GLB ----------
const CUBE_FACES = [
  [[0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [0.5, -0.5, 0.5]],
  [[-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, -0.5]],
  [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]],
  [[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5]],
  [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
  [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]]
]

function cubeTriangles() {
  const triangles = []
  for (const [a, b, c, d] of CUBE_FACES) {
    const corner = (position) => ({ position, uv: [0, 0] })
    triangles.push([corner(a), corner(b), corner(c)], [corner(a), corner(c), corner(d)])
  }
  return new Map([[0, triangles]])
}

function partTriangles(part) {
  if (part.mesh.guid === BUILTIN_GUID && part.mesh.fileID === CUBE_FILE_ID) return cubeTriangles()
  const model = resolveMeshModel(part.mesh)
  if (!model) {
    stats.missingMesh.add(`${part.name} (${guidToPath.get(part.mesh.guid) ?? part.mesh.guid ?? part.mesh.file})`)
    return null
  }
  return fbxTriangles(model)
}

/** Bake parts into one GLB. `transform` maps Unity part space into the target space. */
function buildGlb(parts, transform, roleOf = () => undefined, rig = null) {
  const primitives = new Map()
  for (const part of parts) {
    const bySlot = partTriangles(part)
    if (!bySlot) continue
    const matrix = multiply(transform, part.matrix)
    const flip = determinant3(matrix) < 0
    for (const [slot, triangles] of bySlot) {
      const guid = part.materials[slot] ?? part.materials[0] ?? null
      const role = roleOf(part)
      const key = `${guid}|${role ?? ''}`
      if (!primitives.has(key)) primitives.set(key, { guid, role, positions: [], normals: [], uvs: [], influences: [] })
      const primitive = primitives.get(key)
      for (const triangle of triangles) {
        // The FBX→Unity X mirror reverses winding, and so does Unity→glTF Z mirror.
        const corners = flip ? [triangle[0], triangle[2], triangle[1]] : triangle
        // A rigged part is posed from its bones; everything else from its own matrix.
        const influences = rig ? corners.map((c) => rig.influencesOf(part, c)) : null
        const points = corners.map((c, i) => {
          const [x, y, z] = influences ? rig.pose(influences[i]) : transformPoint(matrix, c.position)
          return [x, y, -z]
        })
        if (influences) primitive.influences.push(...influences)
        const u = points[1].map((v, i) => v - points[0][i])
        const v = points[2].map((w, i) => w - points[0][i])
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        const length = Math.hypot(...n) || 1
        corners.forEach((c, i) => {
          primitive.positions.push(...points[i])
          primitive.normals.push(n[0] / length, n[1] / length, n[2] / length)
          primitive.uvs.push(c.uv[0], 1 - c.uv[1])
        })
      }
    }
  }
  if (!primitives.size) return null
  if (rig) rig.primitives = [...primitives.values()].map((p) => p.influences)
  return encodeGlb([...primitives.values()])
}

function encodeGlb(primitives) {
  const chunks = []
  let offset = 0
  const bufferViews = []
  const accessors = []
  const images = []
  const textures = []
  const materials = []
  const meshPrimitives = []

  const addView = (buffer, target) => {
    const pad = (4 - (buffer.length % 4)) % 4
    chunks.push(buffer, Buffer.alloc(pad))
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, ...(target ? { target } : {}) })
    offset += buffer.length + pad
    return bufferViews.length - 1
  }
  const addFloats = (values, type, withBounds) => {
    const buffer = Buffer.from(new Float32Array(values).buffer)
    const size = type === 'VEC3' ? 3 : 2
    const accessor = {
      bufferView: addView(buffer, 34962), componentType: 5126, count: values.length / size, type
    }
    if (withBounds) {
      accessor.min = [0, 1, 2].map((i) => Math.min(...values.filter((_, k) => k % 3 === i)))
      accessor.max = [0, 1, 2].map((i) => Math.max(...values.filter((_, k) => k % 3 === i)))
    }
    accessors.push(accessor)
    return accessors.length - 1
  }

  for (const primitive of primitives) {
    const source = primitive.guid ? loadMaterial(primitive.guid) : null
    const pbr = {
      baseColorFactor: source
        ? [...source.color.slice(0, 3).map(srgbToLinear), source.color[3]]
        : [1, 1, 1, 1],
      metallicFactor: 0,
      roughnessFactor: 0.85
    }
    if (source?.texture) {
      const image = addView(fs.readFileSync(source.texture))
      images.push({ bufferView: image, mimeType: source.texture.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg' })
      textures.push({ source: images.length - 1, sampler: 0 })
      pbr.baseColorTexture = { index: textures.length - 1 }
    }
    const material = { name: source?.name ?? 'default', pbrMetallicRoughness: pbr }
    if (source?.transparent) material.alphaMode = 'BLEND'
    if (source?.emissive.some((c) => c > 0)) {
      material.emissiveFactor = source.emissive.map((c) => Math.min(1, srgbToLinear(c)))
    }
    if (primitive.role) material.extras = { role: primitive.role }
    materials.push(material)
    meshPrimitives.push({
      attributes: {
        POSITION: addFloats(primitive.positions, 'VEC3', true),
        NORMAL: addFloats(primitive.normals, 'VEC3'),
        TEXCOORD_0: addFloats(primitive.uvs, 'VEC2')
      },
      material: materials.length - 1
    })
  }

  const gltf = {
    asset: { version: '2.0', generator: 'AavegotchiQuerey importVoxelLibrary' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: meshPrimitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
    // Palette textures must stay crisp: NEAREST filtering.
    samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }],
    ...(images.length ? { images, textures } : {})
  }

  const json = Buffer.from(JSON.stringify(gltf))
  const jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)
  const binary = Buffer.concat(chunks)
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + json.length + jsonPad.length + 8 + binary.length, 8)
  const chunkHeader = (length, type) => {
    const b = Buffer.alloc(8)
    b.writeUInt32LE(length, 0)
    b.writeUInt32LE(type, 4)
    return b
  }
  return Buffer.concat([
    header,
    chunkHeader(json.length + jsonPad.length, 0x4e4f534a), json, jsonPad,
    chunkHeader(binary.length, 0x004e4942), binary
  ])
}

function writeGlb(relative, glb) {
  const file = path.join(OUT, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, glb)
}

// ---------- bake ----------
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const playerPath = path.join(SOURCE, PLAYER)
const player = loadPrefab(playerPath)
const playerDocs = parseUnityDocs(playerPath)
const script = [...playerDocs.values()].find((d) => d.type === '114' && d.text.includes('_headPH')).text

const scriptRef = (key) => fileRef(script, key)?.fileID
const scriptList = (key) => {
  const block = script.match(new RegExp(`\\n  ${key}:\\n((?:  - \\{[^\\n]*\\n)+)`))
  return block ? [...block[1].matchAll(/\{fileID: (-?\d+)(?:, guid: (\w+))?/g)].map((m) => ({ fileID: m[1], guid: m[2] })) : []
}
const scriptColors = (key) => {
  const block = script.match(new RegExp(`\\n  ${key}:\\n((?:  - \\{[^\\n]*\\n)+)`))
  return block ? [...block[1].matchAll(/r: ([\d.e-]+), g: ([\d.e-]+), b: ([\d.e-]+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]) : []
}

// Slot holders are swapped on purpose in the source: `_leftHandPh` sits on the
// Right_Arm bone. DrssingRoomPlayer maps HAND_LEFT to `_leftHandPh`, so we keep it.
const holderKeys = {
  body: '_bodyPH', head: '_headPH', face: '_facePH', eyes: '_eyePH',
  handLeft: '_leftHandPh', handRight: '_rightHandPH', pet: '_petPH', movablePet: '_moveablePetPH',
  sleeveLeft: '_leftHandSleevesPh', sleeveRight: '_rightHandSleevesPH'
}
const findNode = (id) => findById(player, id)
const holders = {}
for (const [slot, key] of Object.entries(holderKeys)) {
  const node = findNode(scriptRef(key))
  if (!node) throw new Error(`Holder ${key} not found in player prefab`)
  holders[slot] = worldMatrix(player, node)
}

const eyeNodeIds = new Set()
const eyeShapes = scriptList('EyeShapes').map((ref) => findNode(ref.fileID))
for (const node of eyeShapes) {
  if (node) eyeNodeIds.add(node)
}

// Parts recoloured live in the dressing room.
const eyeColorNodes = new Set(scriptList('EyeColorPart').map((ref) => findNode(ref.fileID)).filter(Boolean))
const collateralRoles = new Map(scriptList('collateralParts').map((ref, i) => [
  findNode(ref.fileID),
  // Source order: mouth, two glowing collateral cubes, then eye parts.
  i === 1 || i === 2 ? 'collateralGlow' : 'collateral'
]))

function isBasePart(node) {
  return !eyeNodeIds.has(node) && node !== findNode(scriptRef('eyeParent'))
}

function collectBase(node, parent = identity()) {
  if (!node.active) return []
  const matrix = multiply(parent, compose(node.local))
  const parts = []
  if (node.mesh && !node.rendererDisabled) {
    parts.push({
      mesh: node.mesh, materials: node.materials, matrix, name: node.name, node,
      role: collateralRoles.get(node) ?? (node.name.startsWith('Cube') ? 'cheek' : undefined)
    })
  }
  for (const child of node.children) {
    if (isBasePart(child)) parts.push(...collectBase(child, matrix))
  }
  return parts
}

// ---------- rig and animation ----------
const parentOf = new Map()
const linkParents = (node) => node.children.forEach((child) => {
  parentOf.set(child, node)
  linkParents(child)
})
linkParents(player)

function findByName(node, name) {
  if (node.name === name) return node
  for (const child of node.children) {
    const hit = findByName(child, name)
    if (hit) return hit
  }
  return null
}

const rigRoot = findByName(player, 'Prnt')
if (!rigRoot) throw new Error('Rig root Prnt not found in player prefab')
const rigAncestors = []
for (let node = parentOf.get(rigRoot); node; node = parentOf.get(node)) rigAncestors.unshift(node)
const rigOrigin = rigAncestors.reduce((m, node) => multiply(m, compose(node.local)), identity())

// Depth first, so a parent always comes before its children.
const bones = []
const boneIndex = new Map()
const addBone = (node, parent) => {
  boneIndex.set(node, bones.length)
  bones.push({ node, parent })
  const index = bones.length - 1
  node.children.forEach((child) => addBone(child, index))
}
addBone(rigRoot, -1)
const boneByName = new Map()
for (const bone of bones) {
  if (!boneByName.has(bone.node.name)) boneByName.set(bone.node.name, boneIndex.get(bone.node))
}

function worldPose(localOf) {
  const world = []
  bones.forEach((bone, i) => {
    world[i] = multiply(bone.parent < 0 ? rigOrigin : world[bone.parent], localOf(i))
  })
  return world
}
const restLocals = bones.map((bone) => compose(bone.node.local))
const restWorld = worldPose((i) => restLocals[i])
const restInverse = restWorld.map(invertAffine)

function boneOf(node) {
  for (let current = node; current; current = parentOf.get(current)) {
    if (boneIndex.has(current)) return boneIndex.get(current)
  }
  return -1
}

/** Per-vertex {bone, weight} from an FBX skin. */
function fbxSkin(model) {
  const { objects, connections } = model.fbx
  const children = new Map()
  for (const c of connections) {
    if (c.props[0] !== 'OO') continue
    const parent = asId(c.props[2])
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent).push(asId(c.props[1]))
  }
  const deformers = new Map(objects.children.filter((n) => n.name === 'Deformer').map((n) => [asId(n.props[0]), n]))
  const byVertex = new Map()
  for (const skinId of children.get(model.geometryId) ?? []) {
    if (!deformers.has(skinId)) continue
    for (const clusterId of children.get(skinId) ?? []) {
      const cluster = deformers.get(clusterId)
      const boneModel = (children.get(clusterId) ?? []).map((id) => model.fbx.models.get(id)).find(Boolean)
      const bone = boneModel ? boneByName.get(fbxObjectName(boneModel.props[1])) : undefined
      if (!cluster || bone === undefined) continue
      const indexes = fbxArray(fbxChild(cluster, 'Indexes'))
      const weights = fbxArray(fbxChild(cluster, 'Weights'))
      for (let i = 0; i < indexes.length; i++) {
        if (!byVertex.has(indexes[i])) byVertex.set(indexes[i], [])
        byVertex.get(indexes[i]).push({ bone, weight: weights[i] })
      }
    }
  }
  return byVertex
}

function partBounds(part) {
  const [min, max] = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]]
  for (const triangles of partTriangles(part).values()) {
    for (const triangle of triangles) {
      for (const corner of triangle) {
        transformPoint(part.matrix, corner.position).forEach((v, i) => {
          min[i] = Math.min(min[i], v)
          max[i] = Math.max(max[i], v)
        })
      }
    }
  }
  return { min, max }
}

// The arm renderers' own transforms are ignored by Unity's skinning and leave the hands
// uneven and detached, so seat each hand against the side of the body, level with its bone.
const HAND_BONES = { Left_Arm: ['Left_Arm_1', -1], Right_Arm: ['Right_Arm_1', 1] }
const seatedMatrices = new Map()
const bodyHalfWidth = partBounds(collectBase(player).find((part) => part.name === 'Body')).max[0]

function seatedMatrix(part) {
  const hand = HAND_BONES[part.name]
  if (!hand) return part.matrix
  if (seatedMatrices.has(part)) return seatedMatrices.get(part)
  const { min, max } = partBounds(part)
  const bone = restWorld[boneByName.get(hand[0])]
  const target = [hand[1] * (bodyHalfWidth + (max[0] - min[0]) / 2), bone[13], bone[14]]
  const matrix = [...part.matrix]
  ;[12, 13, 14].forEach((k, i) => { matrix[k] += target[i] - (min[i] + max[i]) / 2 })
  seatedMatrices.set(part, matrix)
  return matrix
}

// Held items follow the hands inwards. Sleeves stay put: they already reach from the body
// to the seated hand, which pokes out of the cuff.
const HAND_INSET = 0.113
for (const slot of ['handLeft', 'handRight']) {
  holders[slot][12] -= Math.sign(holders[slot][12]) * HAND_INSET
}

// The body carries stray weights on the arm and eye bones, which tear it when those move.
const BODY_ONLY_BONES = new Set(['Prnt', 'joint1', 'joint2', 'Spine', 'Head'])

const skinCache = new Map()
const usedBones = new Set()
const rig = {
  primitives: [],
  influencesOf(part, corner) {
    const world = transformPoint(seatedMatrix(part), corner.position)
    if (part.node?.skinned) {
      const model = resolveMeshModel(part.mesh)
      if (!skinCache.has(model)) skinCache.set(model, fbxSkin(model))
      const all = skinCache.get(model).get(corner.index)
      const list = part.name === 'Body'
        ? all?.filter(({ bone }) => BODY_ONLY_BONES.has(bones[bone].node.name))
        : all
      if (list?.length) {
        const total = list.reduce((sum, item) => sum + item.weight, 0)
        return list.map(({ bone, weight }) => {
          usedBones.add(bone)
          return { bone, weight: weight / total, local: transformPoint(restInverse[bone], world) }
        })
      }
    }
    const bone = boneOf(part.node)
    if (bone >= 0) usedBones.add(bone)
    return [{ bone, weight: 1, local: bone < 0 ? world : transformPoint(restInverse[bone], world) }]
  },
  pose(influences) {
    const out = [0, 0, 0]
    for (const { bone, weight, local } of influences) {
      const p = bone < 0 ? local : transformPoint(restWorld[bone], local)
      out[0] += p[0] * weight
      out[1] += p[1] * weight
      out[2] += p[2] * weight
    }
    return out
  }
}

const baseGlb = buildGlb(collectBase(player), identity(), (part) => part.role, rig)
if (baseGlb) writeGlb('base.glb', baseGlb)

const rotationMatrix = (degrees) => {
  const [x, y, z] = degrees.map((d) => d * Math.PI / 180)
  const axis = (i, a) => {
    const [c, s] = [Math.cos(a), Math.sin(a)]
    if (i === 0) return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]
    if (i === 1) return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  }
  // FBX default rotation order XYZ applies X first.
  return multiply(axis(2, z), multiply(axis(1, y), axis(0, x)))
}
const translationMatrix = ([x, y, z]) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]
const FBX_FPS = { 1: 120, 2: 100, 3: 60, 4: 50, 5: 48, 6: 30, 7: 30, 8: 30, 9: 30, 10: 25, 11: 24 }
const FBX_TICKS = 46186158000

const sampleLinear = (times, values, t) => {
  if (t <= times[0]) return values[0]
  for (let i = 1; i < times.length; i++) {
    if (t <= times[i]) {
      const f = (t - times[i - 1]) / (times[i] - times[i - 1] || 1)
      return values[i - 1] + (values[i] - values[i - 1]) * f
    }
  }
  return values.at(-1)
}

/** A clip inside an FBX, trimmed to the range in its .meta, as a local-matrix sampler. */
function fbxClip(file) {
  const fbx = loadFbx(file)
  const first = Number(fbx.meta.match(/firstFrame: ([\d.]+)/)[1])
  const last = Number(fbx.meta.match(/lastFrame: ([\d.]+)/)[1])
  const settings = fbxChild(fbx.tree, 'GlobalSettings')
  const fps = FBX_FPS[fbxProperty(settings, 'TimeMode')?.[0]] ?? fbxProperty(settings, 'CustomFrameRate')?.[0] ?? 30
  const objects = new Map(fbx.objects.children.map((n) => [asId(n.props[0]), n]))
  const channels = new Map()
  const nodeInfo = new Map()
  for (const c of fbx.connections) {
    if (c.props[0] !== 'OP') continue
    const [child, parent, property] = [asId(c.props[1]), asId(c.props[2]), String(c.props[3])]
    if (objects.get(child)?.name === 'AnimationCurveNode' && fbx.models.has(parent)) nodeInfo.set(child, { model: parent, property })
  }
  for (const c of fbx.connections) {
    if (c.props[0] !== 'OP') continue
    const [child, parent, property] = [asId(c.props[1]), asId(c.props[2]), String(c.props[3])]
    const info = nodeInfo.get(parent)
    if (!info || objects.get(child)?.name !== 'AnimationCurve') continue
    const curve = objects.get(child)
    const times = Array.from(fbxArray(fbxChild(curve, 'KeyTime')), (v) => Number(v) / FBX_TICKS)
    const values = Array.from(fbxArray(fbxChild(curve, 'KeyValueFloat')), Number)
    const key = `${info.model}|${info.property}`
    if (!channels.has(key)) channels.set(key, {})
    channels.get(key)[{ 'd|X': 0, 'd|Y': 1, 'd|Z': 2 }[property]] = { times, values }
  }

  const scale = fbx.unitScale
  const toUnity = [-scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1]
  const fromUnity = invertAffine(toUnity)
  const tracks = new Map()
  for (const [id, model] of fbx.models) {
    const bone = boneByName.get(fbxObjectName(model.props[1]))
    if (bone === undefined) continue
    const curves = (name) => channels.get(`${id}|${name}`)
    if (curves('Lcl Translation') || curves('Lcl Rotation') || curves('Lcl Scaling')) tracks.set(bone, { model, id, curves })
  }
  const duration = (last - first) / fps
  const read = (model, curves, name, fallback, t) => {
    const base = fbxProperty(model, name) ?? fallback
    const set = curves(name)
    return base.map((v, axis) => (set?.[axis] ? sampleLinear(set[axis].times, set[axis].values, t) : v))
  }
  return {
    duration,
    localAt(bone, seconds) {
      const track = tracks.get(bone)
      if (!track) return restLocals[bone]
      const { model, curves } = track
      const t = first / fps + seconds
      const pre = rotationMatrix(fbxProperty(model, 'PreRotation') ?? [0, 0, 0])
      const post = invertAffine(rotationMatrix(fbxProperty(model, 'PostRotation') ?? [0, 0, 0]))
      const pivot = fbxProperty(model, 'RotationPivot') ?? [0, 0, 0]
      const local = [
        translationMatrix(read(model, curves, 'Lcl Translation', [0, 0, 0], t)),
        translationMatrix(fbxProperty(model, 'RotationOffset') ?? [0, 0, 0]),
        translationMatrix(pivot),
        pre,
        rotationMatrix(read(model, curves, 'Lcl Rotation', [0, 0, 0], t)),
        post,
        translationMatrix(pivot.map((v) => -v)),
        (() => {
          const [x, y, z] = read(model, curves, 'Lcl Scaling', [1, 1, 1], t)
          return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]
        })()
      ].reduce(multiply)
      const unity = multiply(multiply(toUnity, local), fromUnity)
      // A channel the file does not key keeps the prefab's value, as Unity's Animator does.
      const out = [...unity]
      const rest = restLocals[bone]
      if (!curves('Lcl Translation')) [12, 13, 14].forEach((i) => { out[i] = rest[i] })
      if (!curves('Lcl Rotation') && !curves('Lcl Scaling')) [0, 1, 2, 4, 5, 6, 8, 9, 10].forEach((i) => { out[i] = rest[i] })
      return out
    }
  }
}

/** A Unity .anim holding position curves, as a local-matrix sampler. */
function unityPositionClip(file) {
  const text = fs.readFileSync(file, 'utf8')
  const section = text.match(/m_PositionCurves:\n([\s\S]*?)\n  m_ScaleCurves:/)[1]
  const tracks = new Map()
  for (const block of section.split(/\n  - curve:/)) {
    const name = block.match(/\n\s+path: (.*)/)?.[1]?.split('/').at(-1)
    if (!name || !boneByName.has(name)) continue
    const keys = [...block.matchAll(/time: ([\d.e-]+)\n\s+value: \{x: ([\d.e-]+), y: ([\d.e-]+), z: ([\d.e-]+)\}\n\s+inSlope: \{x: ([\d.e-]+), y: ([\d.e-]+), z: ([\d.e-]+)\}\n\s+outSlope: \{x: ([\d.e-]+), y: ([\d.e-]+), z: ([\d.e-]+)\}/g)]
      .map((m) => ({ time: Number(m[1]), value: [m[2], m[3], m[4]].map(Number), in: [m[5], m[6], m[7]].map(Number), out: [m[8], m[9], m[10]].map(Number) }))
    tracks.set(boneByName.get(name), keys)
  }
  const hermite = (keys, t) => {
    if (t <= keys[0].time) return keys[0].value
    for (let i = 1; i < keys.length; i++) {
      if (t > keys[i].time) continue
      const [a, b] = [keys[i - 1], keys[i]]
      const span = b.time - a.time
      const f = (t - a.time) / span
      const [f2, f3] = [f * f, f * f * f]
      return a.value.map((v, k) => (2 * f3 - 3 * f2 + 1) * v + (f3 - 2 * f2 + f) * span * a.out[k] +
        (-2 * f3 + 3 * f2) * b.value[k] + (f3 - f2) * span * b.in[k])
    }
    return keys.at(-1).value
  }
  return {
    duration: Number(text.match(/m_StopTime: ([\d.]+)/)[1]),
    localAt(bone, seconds) {
      const keys = tracks.get(bone)
      if (!keys) return restLocals[bone]
      const [x, y, z] = hermite(keys, seconds)
      const out = [...restLocals[bone]]
      out[12] = x
      out[13] = y
      out[14] = z
      return out
    }
  }
}

const holderBones = Object.fromEntries(Object.keys(holderKeys).map((slot) => {
  const bone = boneOf(findNode(scriptRef(holderKeys[slot])))
  if (bone >= 0) usedBones.add(bone)
  return [slot, bone]
}))
const eyeBone = boneOf(findNode(scriptRef('eyeParent')))
if (eyeBone >= 0) usedBones.add(eyeBone)

// Animator states from PlayerAnimatorDressing Room.controller. Attacks return to Idle
// for `rest` seconds (its Delay states) before repeating.
const RIG_DIR = 'Assets/_Game Asset/3d assets/_VDA Animaiton work/_Latest Work 8-24-24/rig_and_animations_fix/rig_and_animations_fix'
const CLIPS = [
  { id: 'Idle', label: 'Idle', file: 'Assets/_Game Asset/Animaiton/Idle.anim' },
  { id: 'Death', label: 'Death', file: `${RIG_DIR}/death_animation.fbx`, hidesHands: true },
  { id: 'IdleDrunk', label: 'Idle (drunk)', file: `${RIG_DIR}/idle_boss_drunk.fbx` },
  { id: 'MeleeAttack', label: 'Melee attack', file: `${RIG_DIR}/attack_axe.fbx`, rest: 1.5 },
  { id: 'RangeAttack', label: 'Range attack', file: `${RIG_DIR}/attack_wand.fbx`, rest: 1.5 },
  { id: 'LobAttack', label: 'Lob attack', file: `${RIG_DIR}/attack_ball.fbx`, rest: 1.5 },
  { id: 'flurryAttack', label: 'Flurry attack', file: `${RIG_DIR}/sushi_knife.fbx`, rest: 1.5 }
]
const CLIP_FPS = 30
const rigBones = [...usedBones].sort((a, b) => a - b)
const rigSlot = new Map(rigBones.map((bone, i) => [bone, i]))
const rounded = (values) => values.map((v) => Math.round(v * 1e5) / 1e5)
const clips = CLIPS.map(({ file, ...clip }) => {
  const source = path.join(SOURCE, file)
  const sampler = file.endsWith('.anim') ? unityPositionClip(source) : fbxClip(source)
  const count = Math.max(2, Math.ceil(sampler.duration * CLIP_FPS) + 1)
  const frames = []
  for (let f = 0; f < count; f++) {
    const seconds = Math.min(f / CLIP_FPS, sampler.duration)
    const world = worldPose((bone) => sampler.localAt(bone, seconds))
    for (const bone of rigBones) frames.push(...rounded(toGltfMatrix(world[bone])))
  }
  return { ...clip, duration: sampler.duration, fps: CLIP_FPS, frames }
})

const influenceData = (list) => {
  const counts = []
  const data = []
  for (const influences of list) {
    counts.push(influences.length)
    for (const { bone, weight, local } of influences) {
      data.push(bone < 0 ? -1 : rigSlot.get(bone), Math.round(weight * 1e4) / 1e4, ...rounded([local[0], local[1], -local[2]]))
    }
  }
  return { counts, data }
}
fs.writeFileSync(path.join(OUT, 'rig.json'), JSON.stringify({
  bones: rigBones.map((bone) => bones[bone].node.name),
  rest: rigBones.flatMap((bone) => rounded(toGltfMatrix(restWorld[bone]))),
  primitives: rig.primitives.map(influenceData),
  holders: Object.fromEntries(Object.entries(holderBones).map(([slot, bone]) => [slot, bone < 0 ? -1 : rigSlot.get(bone)])),
  eyeBone: eyeBone < 0 ? -1 : rigSlot.get(eyeBone),
  clips
}))

/** Eye shapes are stored inactive; only their own sub-tree toggling matters. */
function collectEye(node, parent) {
  const matrix = multiply(parent, compose(node.local))
  const parts = []
  if (node.mesh) {
    const role = eyeColorNodes.has(node) ? 'eyeColor' : collateralRoles.get(node)
    parts.push({ mesh: node.mesh, materials: node.materials, matrix, name: node.name, role })
  }
  for (const child of node.children) {
    if (child.active) parts.push(...collectEye(child, matrix))
  }
  return parts
}

const EYE_SHAPE_NAMES = [
  'USDT Collateral', 'BTC Collateral', 'YFI Collateral', 'WETH Collateral', 'USDC Collateral', 'UNI Collateral',
  'Uncommon Low 3', 'Uncommon Low 2', 'Uncommon Low 1', 'Uncommon High 3', 'Uncommon High 2', 'Uncommon High 1',
  'TUSD Collateral', 'Rare Low 3', 'Rare Low 2', 'Rare Low 1', 'Rare High 3', 'Rare High 2', 'Rare High 1',
  'Mythical Low 2', 'Mythical Low 1', 'Mythical Low 2 (H2)', 'Mythical Low 1 (H2)', 'Polygon Collateral',
  'LINK Collateral', 'ETH Collateral', 'DAI Collateral', 'Common Low 3', 'Common Low 2', 'Common Low 1', 'AAVE Collateral'
]

const eyes = []
eyeShapes.forEach((node, index) => {
  if (!node) return
  const parentWorld = (() => {
    const world = worldMatrix(player, node)
    return world ? multiply(world, invertAffine(compose(node.local))) : identity()
  })()
  const glb = buildGlb(collectEye(node, parentWorld), identity(), (part) => part.role)
  if (!glb) return
  writeGlb(`eyes/${index}.glb`, glb)
  eyes.push({ index, name: EYE_SHAPE_NAMES[index] ?? `Eye ${index}`, file: `eyes/${index}.glb` })
})

// Colour tables, in the order used by the source enums.
const materialColor = (ref) => {
  const material = ref.guid ? loadMaterial(ref.guid) : null
  return material ? hexColor(material.color) : '#ffffff'
}
const COLLATERALS = ['aave', 'dai', 'eth', 'link', 'matic', 'tusd', 'uni', 'usdc', 'usdt', 'weth', 'wbtc', 'yfi']
const EYE_COLORS = ['Mythical High', 'Mythical Low', 'Rare High', 'Rare Low', 'Uncommon High', 'Uncommon Low']
const GROUNDS = ['White', 'Purple', 'Blue', 'Green', 'Pink', 'Wheat']

const glowRefs = scriptList('collateralGlow')
const collaterals = scriptList('collateralBasic').map((ref, i) => ({
  name: COLLATERALS[i] ?? `collateral ${i}`,
  color: materialColor(ref),
  glow: glowRefs[i] ? materialColor(glowRefs[i]) : materialColor(ref)
}))
const eyeColors = scriptList('eyeMat').map((ref, i) => ({ name: EYE_COLORS[i] ?? `Eye colour ${i}`, color: materialColor(ref) }))
const grounds = scriptColors('groundColours').map((c, i) => ({ name: GROUNDS[i] ?? `Ground ${i}`, color: hexColor(c) }))

// Wearables: <id>.prefab, <id>_sleeve_L/R.prefab, <id>_RWeapon.prefab.
const wearables = {}
const skipped = []
const wearablesDir = path.join(SOURCE, WEARABLES)
for (const entry of fs.readdirSync(wearablesDir).sort()) {
  if (!entry.endsWith('.prefab')) continue
  const stem = entry.slice(0, -'.prefab'.length)
  const match = stem.match(/^(\d+)(?:(_sleeve_L|_sleeve_R|_RWeapon))?$/)
  if (!match) {
    skipped.push(stem)
    continue
  }
  const root = loadPrefab(path.join(wearablesDir, entry))
  if (!root) {
    skipped.push(stem)
    continue
  }
  const glb = buildGlb(collectParts(root), identity())
  if (!glb) {
    skipped.push(stem)
    continue
  }
  writeGlb(`wearables/${stem}.glb`, glb)
  const id = match[1]
  wearables[id] ??= {}
  const kind = { _sleeve_L: 'sleeveLeft', _sleeve_R: 'sleeveRight', _RWeapon: 'rightHandWeapon' }[match[2]] ?? 'main'
  wearables[id][kind] = `wearables/${stem}.glb`
}

// The source has sleeve meshes it never made prefabs for. They share the wired-up sleeves'
// space, so they take the transform of a template sleeve and the suit's own palette.
const SETS = 'Assets/_Game Asset/3d assets/_mohsinWork/NewWork/All sets'
const UNWIRED_SLEEVES = { 22: '9- captain aave/Saleev', 34: '13- godlike stani/Saleevs' }
const TEMPLATE_SLEEVE = 19

function bakeSleeve(id, side, file, materials) {
  const [template] = collectParts(loadPrefab(path.join(wearablesDir, `${TEMPLATE_SLEEVE}_sleeve_${side}.prefab`)))
  const model = loadFbx(file).meshModels[0]
  const glb = buildGlb([{ ...template, mesh: { file, model: model.name }, materials }], identity())
  writeGlb(`wearables/${id}_sleeve_${side}.glb`, glb)
  wearables[id][side === 'L' ? 'sleeveLeft' : 'sleeveRight'] = `wearables/${id}_sleeve_${side}.glb`
}

for (const [id, stem] of Object.entries(UNWIRED_SLEEVES)) {
  const [suit] = collectParts(loadPrefab(path.join(wearablesDir, `${id}.prefab`)))
  for (const side of ['L', 'R']) bakeSleeve(id, side, path.join(SOURCE, SETS, `${stem}_${side}.fbx`), suit.materials)
}

// These have sleeves in the on-chain art but no 3D sleeve anywhere in the source, so they
// get the template's plain sleeve, tinted at runtime with the art's main sleeve colour.
const DB_WEARABLES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'aavegotchi_db_wearables.json')
const sleeveColors = {}
for (const wearable of JSON.parse(fs.readFileSync(DB_WEARABLES, 'utf8')).wearables) {
  const art = JSON.stringify(wearable.sleeves ?? '')
  if (!wearable.slotPositions?.[0] || !wearables[wearable.id]?.main || wearables[wearable.id].sleeveLeft) continue
  // Pure magenta and cyan don't match the 3D suit they belong to, so don't tint with them.
  const fills = [...art.matchAll(/fill=\\"(#\w+)\\"/g)].map((m) => m[1].toLowerCase()).filter((c) => !['#f0f', '#ff00ff', '#0ff', '#00ffff'].includes(c))
  if (!fills.length) continue
  const counts = new Map()
  for (const fill of fills) counts.set(fill, (counts.get(fill) ?? 0) + 1)
  sleeveColors[wearable.id] = [...counts].sort((a, b) => b[1] - a[1])[0][0]
  for (const side of ['L', 'R']) {
    bakeSleeve(wearable.id, side, path.join(SOURCE, SETS, `8- aave hero/Saleev_${side}.fbx`), [])
  }
}

// .vox sources, de-duplicated by content.
const seen = new Map()
const vox = []
walk(path.join(SOURCE, 'Assets'), (file) => {
  if (!file.endsWith('.vox') || path.basename(file).startsWith('._')) return
  const data = fs.readFileSync(file)
  const hash = crypto.createHash('sha1').update(data).digest('hex')
  if (seen.has(hash)) return
  let name = path.basename(file)
  const taken = vox.filter((v) => v.name === name).length
  const fileName = taken ? `${path.basename(name, '.vox')}-${hash.slice(0, 6)}.vox` : name
  seen.set(hash, fileName)
  fs.mkdirSync(path.join(OUT, 'vox'), { recursive: true })
  fs.writeFileSync(path.join(OUT, 'vox', fileName), data)
  vox.push({
    name,
    file: `vox/${fileName}`,
    group: path.relative(path.join(SOURCE, 'Assets/_Game Asset/3d assets'), path.dirname(file))
  })
})
vox.sort((a, b) => a.file.localeCompare(b.file))

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
  holders: Object.fromEntries(Object.entries(holders).map(([slot, m]) => [slot, toGltfMatrix(m)])),
  collaterals, eyeColors, grounds, eyes, wearables, vox, sleeveColors,
  // Source rule: wearable 40 follows the body; 301 and 381 replace the gotchi's own eyes.
  movablePets: [40],
  eyeReplacingWearables: [301, 381]
}, null, 1))

console.log(`rig: ${rigBones.length} bones, clips ${clips.map((c) => `${c.id} ${c.duration.toFixed(2)}s`).join(', ')}`)
console.log(`generated sleeves: ${Object.entries(sleeveColors).map(([id, c]) => `${id} ${c}`).join(', ')}`)
console.log(`wearable ids: ${Object.keys(wearables).length}`)
console.log(`eye shapes: ${eyes.length}/${eyeShapes.length}`)
console.log(`vox files: ${vox.length} unique`)
console.log(`colours: ${collaterals.length} collaterals, ${eyeColors.length} eye, ${grounds.length} ground`)
console.log(`skipped prefabs (${skipped.length}): ${skipped.join(', ')}`)
console.log(`missing meshes (${stats.missingMesh.size}): ${[...stats.missingMesh].slice(0, 12).join(' | ')}`)
console.log(`unmatched multi-mesh parts (${stats.multiMeshGuess.size}): ${[...stats.multiMeshGuess].slice(0, 12).join(' | ')}`)
console.log(`materials without a .mat file: ${stats.missingMaterial}`)
