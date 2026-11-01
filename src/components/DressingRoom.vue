<template>
  <div class="dressing-room px-4 pb-10">
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-blue-600 dark:text-blue-400">Dressing Room</h2>
        <p class="text-sm text-gray-600 dark:text-blue-300 mt-1">
          Try voxel wearables on a 3D gotchi. Drag to orbit, scroll to zoom.
        </p>
      </div>
      <div class="flex gap-1">
        <button
          v-for="option in modes"
          :key="option.id"
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="mode === option.id
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'"
          @click="mode = option.id"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div v-if="loadError" class="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] gap-6">
      <section class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden relative lg:min-h-[32rem]">
        <!-- Out of flow on large screens so the canvas fills the column without resizing it. -->
        <div ref="viewport" class="h-[32rem] w-full lg:absolute lg:inset-0 lg:h-full" data-testid="voxel-viewport"></div>
        <div
          v-if="busy"
          class="absolute top-3 left-3 px-2 py-1 rounded text-xs bg-black/60 text-white"
        >
          Loading…
        </div>
        <label class="absolute top-3 right-3 text-xs text-white">
          <span class="sr-only">View</span>
          <select v-model="view" class="px-2 py-1 rounded bg-black/60 text-white" data-testid="voxel-view">
            <option v-for="option in VIEWS" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <button
          v-if="mode === 'dress'"
          type="button"
          class="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
          @click="turn"
        >
          Turn
        </button>
      </section>

      <!-- Dressing room -->
      <section v-if="mode === 'dress' && manifest" class="space-y-4 min-w-0">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 grid grid-cols-2 gap-3 text-sm">
          <label v-if="rig" class="block col-span-2">
            <span class="text-gray-600 dark:text-blue-400">Animation</span>
            <select v-model="animation" :class="selectClass">
              <option v-for="clip in rig.clips" :key="clip.id" :value="clip.id">{{ clip.label }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-gray-600 dark:text-blue-400">Collateral</span>
            <select v-model.number="collateral" :class="selectClass">
              <option v-for="(c, i) in collaterals" :key="c.collateralType" :value="i">{{ c.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-gray-600 dark:text-blue-400">Eye shape</span>
            <select v-model.number="eyeShape" :class="selectClass">
              <option v-for="eye in manifest.eyes" :key="eye.index" :value="eye.index">{{ eye.name }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-gray-600 dark:text-blue-400">Eye colour</span>
            <select v-model.number="eyeColor" :class="selectClass">
              <option v-for="(c, i) in manifest.eyeColors" :key="c.name" :value="i">{{ c.name }}</option>
              <option :value="manifest.eyeColors.length">Collateral</option>
            </select>
          </label>
          <label class="block">
            <span class="text-gray-600 dark:text-blue-400">Ground</span>
            <select v-model.number="ground" :class="selectClass">
              <option v-for="(g, i) in manifest.grounds" :key="g.name" :value="i">{{ g.name }}</option>
            </select>
          </label>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div class="flex flex-wrap gap-1 mb-3">
            <button
              v-for="slot in SLOTS"
              :key="slot.id"
              type="button"
              class="px-2 py-1 rounded text-xs font-medium transition-colors"
              :class="currentSlot === slot.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'"
              @click="currentSlot = slot.id"
            >
              {{ slot.label }}
            </button>
          </div>
          <input
            v-model="search"
            type="search"
            placeholder="Search wearables"
            class="w-full mb-3 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-2 py-1 text-sm"
          />
          <ul class="grid grid-cols-3 gap-2 max-h-80 overflow-y-auto">
            <li>
              <button type="button" :class="itemClass(null)" @click="equip(null)">
                <span class="h-14 flex items-center justify-center text-gray-400">None</span>
              </button>
            </li>
            <li v-for="item in visibleWearables" :key="item.id">
              <button type="button" :class="itemClass(item.id)" :title="`#${item.id} ${item.name}`" @click="equip(item.id)">
                <svg viewBox="0 0 64 64" class="h-14 w-full" v-html="item.icon"></svg>
                <span class="block truncate text-[11px] text-gray-700 dark:text-blue-300">{{ item.name }}</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 text-sm">
          <h3 class="font-semibold text-gray-800 dark:text-blue-400 mb-2">Equipped</h3>
          <p v-if="!equippedList.length" class="text-gray-500 dark:text-blue-300">Nothing yet.</p>
          <ul v-else class="space-y-1">
            <li v-for="entry in equippedList" :key="entry.slot" class="flex justify-between gap-2 text-gray-700 dark:text-blue-300">
              <span class="truncate">{{ entry.slotLabel }}: {{ entry.name }}</span>
              <button type="button" class="text-red-500 shrink-0" @click="equip(null, entry.slot)">Remove</button>
            </li>
          </ul>
        </div>
      </section>

      <!-- Raw .vox files -->
      <section v-else-if="mode === 'vox' && manifest" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3 text-sm min-w-0">
        <input
          v-model="voxSearch"
          type="search"
          placeholder="Search .vox files"
          class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-2 py-1"
        />
        <label v-if="voxModelCount > 1" class="block">
          <span class="text-gray-600 dark:text-blue-400">
            {{ voxModel === 0 ? `Whole scene (${voxModelCount} models)` : `Model ${voxModel} of ${voxModelCount}` }}
          </span>
          <input v-model.number="voxModel" type="range" min="0" :max="voxModelCount" class="w-full" />
        </label>
        <ul class="max-h-[26rem] overflow-y-auto space-y-1">
          <li v-for="file in visibleVox" :key="file.file">
            <button
              type="button"
              class="w-full text-left px-2 py-1 rounded transition-colors"
              :class="voxFile === file.file
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-700'"
              @click="voxFile = file.file; voxModel = 0"
            >
              {{ file.name }}
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { parseVox } from '../utils/voxParser.js'

// Production loads the models from separate hosting so they stay out of this public repo.
const BASE_URL = import.meta.env.VITE_VOXEL_BASE_URL ?? '/voxels/'

// slotIndex follows the on-chain slotPositions order. Holder names follow DrssingRoomPlayer.
const SLOTS = [
  { id: 'body', label: 'Body', slotIndex: 0, holder: 'body' },
  { id: 'face', label: 'Face', slotIndex: 1, holder: 'face' },
  { id: 'eyes', label: 'Eyes', slotIndex: 2, holder: 'eyes' },
  { id: 'head', label: 'Head', slotIndex: 3, holder: 'head' },
  { id: 'handLeft', label: 'Left hand', slotIndex: 4, holder: 'handLeft' },
  { id: 'handRight', label: 'Right hand', slotIndex: 5, holder: 'handRight' },
  { id: 'pet', label: 'Pet', slotIndex: 6, holder: 'pet' }
]

const modes = [
  { id: 'dress', label: 'Wearables' },
  { id: 'vox', label: '.vox files' }
]
const selectClass = 'mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-2 py-1'

const viewport = ref(null)
const mode = ref('dress')
// Angles are in degrees. Fixed views are orthographic, so sizes stay true across the model.
const VIEWS = [
  { id: 'perspective', label: 'Perspective' },
  { id: 'dimetric', label: 'Isometric 2:1 (pixel art)', elevation: 30, azimuth: 45 },
  { id: 'isometric', label: 'True isometric', elevation: 35.264, azimuth: 45 },
  { id: 'front', label: 'Front', elevation: 0, azimuth: 0 },
  { id: 'side', label: 'Side', elevation: 0, azimuth: 90 },
  { id: 'top', label: 'Top down', elevation: 89.9, azimuth: 0 }
]
const ORTHO_HALF_HEIGHT = 1.15
const ORTHO_DISTANCE = 10
const FLOOR_POLAR_LIMIT = Math.PI / 2 - 0.03
const view = ref('perspective')
const manifest = shallowRef(null)
const wearableDb = shallowRef([])
const loadError = ref('')
const busy = ref(false)

const collaterals = shallowRef([])
const collateral = ref(0)
const eyeShape = ref(29)
const eyeColor = ref(2)
const ground = ref(1)
const rig = shallowRef(null)
const animation = ref('Idle')
const currentSlot = ref('body')
const search = ref('')
const equipped = ref({})

const voxSearch = ref('')
const voxFile = ref('')
const voxModel = ref(0)
const voxModelCount = ref(0)

const wearablesById = computed(() => new Map(wearableDb.value.map((w) => [Number(w.id), w])))

const visibleWearables = computed(() => {
  const models = manifest.value?.wearables
  if (!models) return []
  const slot = SLOTS.find((s) => s.id === currentSlot.value)
  const query = search.value.trim().toLowerCase()
  return wearableDb.value
    .filter((w) => w.slotPositions?.[slot.slotIndex] && models[w.id]?.main)
    .filter((w) => !query || w.name.toLowerCase().includes(query) || String(w.id) === query)
    .map((w) => ({ id: Number(w.id), name: w.name, icon: w.svgs?.[0] ?? '' }))
})

const visibleVox = computed(() => {
  const query = voxSearch.value.trim().toLowerCase()
  return (manifest.value?.vox ?? []).filter((v) => !query || v.name.toLowerCase().includes(query))
})

const equippedList = computed(() => SLOTS
  .filter((slot) => equipped.value[slot.id] != null)
  .map((slot) => ({
    slot: slot.id,
    slotLabel: slot.label,
    name: wearablesById.value.get(equipped.value[slot.id])?.name ?? `#${equipped.value[slot.id]}`
  })))

const itemClass = (id) => [
  'w-full rounded border p-1 transition-colors',
  (equipped.value[currentSlot.value] ?? null) === id
    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/40'
    : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
]

// ---------- scene ----------
let renderer, scene, camera, perspectiveCamera, orthoCamera, controls, frame, resizeObserver
let groundMesh, gotchiRoot, gotchiModel, voxRoot, baseModel, eyeModel
const loader = new GLTFLoader()
const glbCache = new Map()
const holders = {}
const loadedSlots = {}
let loadToken = 0
let restInverses = []
let collateralSymbol = null

function loadGlb(file) {
  if (!glbCache.has(file)) {
    glbCache.set(file, loader.loadAsync(BASE_URL + file).then((gltf) => gltf.scene))
  }
  return glbCache.get(file).then((model) => {
    const copy = model.clone(true)
    // Materials are per instance because recolouring is per gotchi part.
    copy.traverse((node) => {
      if (node.isMesh) {
        node.material = node.material.clone()
        node.castShadow = true
      }
    })
    return copy
  })
}

function initScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#1f2937')
  perspectiveCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 200)
  perspectiveCamera.position.set(0, 1.2, 4.4)
  orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200)
  camera = perspectiveCamera

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  viewport.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0.6, 0)
  controls.enableDamping = true
  // The floor is one-sided, so keep the camera above it.
  controls.maxPolarAngle = FLOOR_POLAR_LIMIT

  scene.add(new THREE.HemisphereLight('#ffffff', '#8888aa', 1.8))
  const sun = new THREE.DirectionalLight('#ffffff', 2.2)
  sun.position.set(2.5, 5, 4)
  sun.castShadow = true
  scene.add(sun)

  groundMesh = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 48),
    new THREE.MeshStandardMaterial({ roughness: 1 })
  )
  groundMesh.rotation.x = -Math.PI / 2
  groundMesh.receiveShadow = true
  scene.add(groundMesh)

  // gotchiRoot turns about the floor centre; gotchiModel holds the rig, centred inside it.
  gotchiRoot = new THREE.Group()
  // The rig faces -Z, so start turned towards the camera.
  gotchiRoot.rotation.y = Math.PI
  gotchiModel = new THREE.Group()
  gotchiRoot.add(gotchiModel)
  voxRoot = new THREE.Group()
  scene.add(gotchiRoot, voxRoot)

  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(viewport.value)
  resize()

  const animate = () => {
    frame = requestAnimationFrame(animate)
    controls.update()
    if (rig.value && gotchiRoot.visible) updateAnimation(clock.getDelta())
    renderer.render(scene, camera)
  }
  animate()
}

// ---------- animation ----------
const FADE_SECONDS = 0.2
const HAND_BONES = ['Left_Arm_1', 'Right_Arm_1']
const SLEEVE_SEAT_TOLERANCE = 0.01
const clock = new THREE.Clock()
const skinned = []
let currentClip = null
let clipTime = 0
let fadeLeft = 0
let fadeFrom = null
let lastPose = null

const boneMatrix = (pose, slot) => new THREE.Matrix4().fromArray(pose, slot * 16)

function samplePose(clip, seconds) {
  const size = rig.value.bones.length * 16
  const position = Math.min(seconds, clip.duration) * clip.fps
  const a = Math.min(Math.floor(position), clip.frames.length / size - 1)
  const b = Math.min(a + 1, clip.frames.length / size - 1)
  const f = position - a
  const pose = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    pose[i] = clip.frames[a * size + i] * (1 - f) + clip.frames[b * size + i] * f
  }
  return pose
}

function updateAnimation(delta) {
  const clip = currentClip
  if (!clip) return
  clipTime += delta
  const total = clip.duration + (clip.rest ?? 0)
  if (clipTime >= total) clipTime %= total
  // During an attack's rest the gotchi idles, as the Delay states do.
  const idle = rig.value.clips[0]
  let pose = clipTime <= clip.duration
    ? samplePose(clip, clipTime)
    : samplePose(idle, (clipTime - clip.duration) % idle.duration)
  if (fadeLeft > 0 && fadeFrom) {
    fadeLeft = Math.max(0, fadeLeft - delta)
    const f = fadeLeft / FADE_SECONDS
    pose = pose.map((v, i) => v * (1 - f) + fadeFrom[i] * f)
  }
  applyPose(pose)
}

// A hand always ends where the naked hand ends. Sleeves cover it from the body out to their
// cuff, and the hand shrinks to the part still showing. Keyed by side of the body, as the sign of X.
const cuffs = { [-1]: 0, 1: 0 }
let nakedHand = null

function measureNakedHand() {
  const data = rig.value
  const handBones = HAND_BONES.map((name) => data.bones.indexOf(name))
  let [inner, tip] = [Infinity, 0]
  for (const { counts, data: influences } of data.primitives) {
    let read = 0
    for (const count of counts) {
      const entries = Array.from({ length: count }, (_, n) => read + n * 5)
      read += count * 5
      if (!entries.every((at) => handBones.includes(influences[at]))) continue
      const point = new THREE.Vector3(influences[entries[0] + 2], influences[entries[0] + 3], influences[entries[0] + 4])
      const x = Math.abs(point.applyMatrix4(boneMatrix(data.rest, influences[entries[0]])).x)
      inner = Math.min(inner, x)
      tip = Math.max(tip, x)
    }
  }
  return { inner, tip }
}

function measureSleeves() {
  nakedHand ??= measureNakedHand()
  cuffs[-1] = nakedHand.inner
  cuffs[1] = nakedHand.inner
  for (const model of loadedSlots.body?.models ?? []) {
    const holder = model.parent
    if (holder !== holders.sleeveLeft && holder !== holders.sleeveRight) continue
    const box = new THREE.Box3()
    model.traverse((node) => {
      if (!node.isMesh) return
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox()
      box.union(node.geometry.boundingBox.clone().applyMatrix4(holder.userData.rest))
    })
    const side = Math.sign(box.min.x + box.max.x)
    const [start, end] = side > 0 ? [box.min.x, box.max.x] : [-box.max.x, -box.min.x]
    // A few sleeves were modelled off-centre, so seat those against the body like the rest.
    const shift = Math.abs(start - nakedHand.inner) > SLEEVE_SEAT_TOLERANCE ? nakedHand.inner - start : 0
    model.position.set(side * shift, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(holder.userData.rest).invert())
    cuffs[side] = Math.min(end + shift, nakedHand.tip)
  }
}

/** Squeezes a hand towards its fingertip so it only spans cuff to tip. */
function handTrim(side) {
  if (!nakedHand) return new THREE.Matrix4()
  const { inner, tip } = nakedHand
  const showing = (tip - cuffs[side]) / (tip - inner)
  const across = showing > SLEEVE_SEAT_TOLERANCE ? 1 : 0
  return new THREE.Matrix4().makeTranslation(side * tip, 0, 0)
    .multiply(new THREE.Matrix4().makeScale(across * showing, across, across))
    .multiply(new THREE.Matrix4().makeTranslation(-side * tip, 0, 0))
}

function applyPose(pose) {
  lastPose = pose
  const data = rig.value
  const deltas = data.bones.map((_, slot) => boneMatrix(pose, slot).multiply(restInverses[slot]))
  for (const [slot, holder] of Object.entries(holders)) {
    const bone = data.holders[slot]
    if (bone < 0) continue
    holder.matrix.multiplyMatrices(deltas[bone], holder.userData.rest)
    holder.matrixWorldNeedsUpdate = true
  }
  const symbolBone = data.bones.indexOf('Collateral')
  if (collateralSymbol && symbolBone >= 0) {
    collateralSymbol.matrix.copy(deltas[symbolBone])
    collateralSymbol.matrixWorldNeedsUpdate = true
  }
  if (eyeModel && data.eyeBone >= 0) {
    eyeModel.matrixAutoUpdate = false
    eyeModel.matrix.copy(deltas[data.eyeBone])
    eyeModel.matrixWorldNeedsUpdate = true
  }
  const matrices = data.bones.map((name, slot) => {
    if (!HAND_BONES.includes(name)) return boneMatrix(pose, slot).elements
    const rest = boneMatrix(data.rest, slot)
    const side = Math.sign(rest.elements[12])
    return deltas[slot].clone().multiply(handTrim(side)).multiply(rest).elements
  })
  skinned.forEach((entry) => skinPrimitive(entry, matrices))
}

function skinPrimitive({ mesh, counts, data }, matrices) {
  const positions = mesh.geometry.attributes.position
  let read = 0
  for (let v = 0; v < counts.length; v++) {
    let [x, y, z] = [0, 0, 0]
    for (let n = 0; n < counts[v]; n++, read += 5) {
      const [bone, weight, lx, ly, lz] = [data[read], data[read + 1], data[read + 2], data[read + 3], data[read + 4]]
      if (bone < 0) {
        x += lx * weight
        y += ly * weight
        z += lz * weight
      } else {
        const m = matrices[bone]
        x += (m[0] * lx + m[4] * ly + m[8] * lz + m[12]) * weight
        y += (m[1] * lx + m[5] * ly + m[9] * lz + m[13]) * weight
        z += (m[2] * lx + m[6] * ly + m[10] * lz + m[14]) * weight
      }
    }
    positions.setXYZ(v, x, y, z)
  }
  positions.needsUpdate = true
  mesh.geometry.computeVertexNormals()
  mesh.geometry.computeBoundingSphere()
}

function playClip(id) {
  const clip = rig.value?.clips.find((c) => c.id === id)
  if (!clip) return
  fadeFrom = lastPose
  fadeLeft = lastPose ? FADE_SECONDS : 0
  currentClip = clip
  clipTime = 0
  // DrssingRoomPlayer hides the hand holders while the Death clip plays.
  if (holders.handLeft) holders.handLeft.visible = !clip.hidesHands
  if (holders.handRight) holders.handRight.visible = !clip.hidesHands
}

// ---------- collateral symbol ----------
const chainColor = (value) => `#${String(value).replace(/^0x/, '')}`

// The collateral art is drawn on a 64 unit gotchi; these place it on the voxel forehead.
const SVG_UNIT = 0.0212
const SVG_CENTER = [32, 16.5]
const FOREHEAD = [0, 0.481, -0.291]
const SYMBOL_DEPTH = 0.006
const SVG_SAMPLES = 4

/** Flattens the on-chain collateral SVG into runs of solid colour. */
function collateralRuns(c) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${c.svgs[0]}</svg>`, 'image/svg+xml')
  const size = 64 * SVG_SAMPLES
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.scale(SVG_SAMPLES, SVG_SAMPLES)
  const fillOf = (node) => {
    for (let current = node; current?.getAttribute; current = current.parentNode) {
      if (current.getAttribute('fill')) return current.getAttribute('fill')
      if (current.getAttribute('class')?.includes('secondary')) return chainColor(c.secondaryColor)
    }
    return chainColor(c.primaryColor)
  }
  for (const path of doc.querySelectorAll('path')) {
    context.fillStyle = fillOf(path)
    context.fill(new Path2D(path.getAttribute('d')))
  }
  const { data } = context.getImageData(0, 0, size, size)
  const runs = []
  for (let y = 0; y < size; y++) {
    let start = -1
    let color = 0
    for (let x = 0; x <= size; x++) {
      const i = (y * size + x) * 4
      const solid = x < size && data[i + 3] >= 128
      const value = solid ? (data[i] << 16) | (data[i + 1] << 8) | data[i + 2] : -1
      if (start >= 0 && value !== color) {
        runs.push({ x: start, y, length: x - start, color })
        start = -1
      }
      if (solid && start < 0) {
        start = x
        color = value
      }
    }
  }
  return runs
}

function showCollateralSymbol() {
  if (!collateralSymbol) return
  collateralSymbol.clear()
  const c = collaterals.value[collateral.value]
  if (!c) return
  const runs = collateralRuns(c)
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    runs.length
  )
  const unit = SVG_UNIT / SVG_SAMPLES
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  runs.forEach((run, i) => {
    // The rig faces -Z and is turned to the camera, so the art's +X is the model's -X.
    matrix.makeScale(run.length * unit, unit, SYMBOL_DEPTH)
    matrix.setPosition(
      FOREHEAD[0] - ((run.x + run.length / 2) / SVG_SAMPLES - SVG_CENTER[0]) * SVG_UNIT,
      FOREHEAD[1] - ((run.y + 0.5) / SVG_SAMPLES - SVG_CENTER[1]) * SVG_UNIT,
      FOREHEAD[2]
    )
    mesh.setMatrixAt(i, matrix)
    mesh.setColorAt(i, color.setHex(run.color))
  })
  collateralSymbol.add(mesh)
}

function resize() {
  const { clientWidth: width, clientHeight: height } = viewport.value
  if (!width || !height) return
  renderer.setSize(width, height)
  perspectiveCamera.aspect = width / height
  perspectiveCamera.updateProjectionMatrix()
  orthoCamera.top = ORTHO_HALF_HEIGHT
  orthoCamera.bottom = -ORTHO_HALF_HEIGHT
  orthoCamera.right = ORTHO_HALF_HEIGHT * (width / height)
  orthoCamera.left = -orthoCamera.right
  orthoCamera.updateProjectionMatrix()
}

/** Fixed views lock the angle so renders line up; zoom and pan still work. Turn sets the facing. */
function applyView() {
  const selected = VIEWS.find((option) => option.id === view.value)
  const fixed = selected.elevation !== undefined
  camera = fixed ? orthoCamera : perspectiveCamera
  controls.object = camera
  controls.enableRotate = !fixed
  controls.maxPolarAngle = fixed ? Math.PI / 2 : FLOOR_POLAR_LIMIT
  if (fixed) {
    const elevation = THREE.MathUtils.degToRad(selected.elevation)
    const azimuth = THREE.MathUtils.degToRad(selected.azimuth)
    camera.zoom = 1
    camera.updateProjectionMatrix()
    camera.position.setFromSphericalCoords(ORTHO_DISTANCE, Math.PI / 2 - elevation, azimuth).add(controls.target)
  }
  controls.update()
}

function turn() {
  gotchiRoot.rotation.y += Math.PI / 2
}

function eachMaterial(model, visit) {
  model?.traverse((node) => {
    if (node.isMesh) visit(node.material)
  })
}

/** Recolour parts the importer tagged; mirrors SetCollateral and SetEyeColor. */
function applyColors() {
  const data = manifest.value
  if (!data) return
  const c = collaterals.value[collateral.value]
  const primary = chainColor(c.primaryColor)
  const eye = data.eyeColors[eyeColor.value]?.color ?? primary
  const paint = (material) => {
    const role = material.userData.role
    // The source swaps in untextured materials here, so the palette must not tint them.
    if ((role === 'collateral' || role === 'eyeColor') && material.map) {
      material.map = null
      material.needsUpdate = true
    }
    if (role === 'collateral') material.color.set(primary)
    else if (role === 'cheek') material.color.set(chainColor(c.cheekColor))
    else if (role === 'eyeColor') material.color.set(eye)
  }
  eachMaterial(baseModel, paint)
  eachMaterial(eyeModel, paint)
  groundMesh.material.color.set(data.grounds[ground.value]?.color ?? '#ffffff')
}

const hidesOwnEyes = () => manifest.value?.eyeReplacingWearables.includes(equipped.value.eyes)

async function loadEye() {
  const token = ++loadToken
  const entry = manifest.value.eyes.find((e) => e.index === eyeShape.value)
  const model = entry ? await loadGlb(entry.file) : null
  if (token !== loadToken) return
  if (eyeModel) gotchiModel.remove(eyeModel)
  eyeModel = model
  if (eyeModel) {
    eyeModel.visible = !hidesOwnEyes()
    gotchiModel.add(eyeModel)
    if (lastPose) applyPose(lastPose)
  }
  applyColors()
}

// Palette corrections that match each model to its on-chain art; see cli/matchVoxelColors.js.
// Per file and mesh, in traversal order: cells are `x,y` in the palette image, or `plain`.
let artPalettes = {}
const artTextures = new Map()

function artTexture(file, index, map, cells) {
  const key = `${file}/${index}`
  if (!artTextures.has(key)) {
    const canvas = document.createElement('canvas')
    canvas.width = map.image.width
    canvas.height = map.image.height
    const context = canvas.getContext('2d')
    context.drawImage(map.image, 0, 0)
    for (const [cell, color] of Object.entries(cells)) {
      const [x, y] = cell.split(',').map(Number)
      context.fillStyle = color
      context.fillRect(x, y, 1, 1)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = map.colorSpace
    texture.flipY = map.flipY
    texture.magFilter = texture.minFilter = THREE.NearestFilter
    artTextures.set(key, texture)
  }
  return artTextures.get(key)
}

function applyArtPalette(id, file, model) {
  const entries = artPalettes[id]?.[file]
  if (!entries) return
  let index = 0
  eachMaterial(model, (material) => {
    const entry = entries[index]
    if (entry) {
      if (material.map && Object.keys(entry.cells).length) material.map = artTexture(file, index, material.map, entry.cells)
      if (entry.cells.plain) material.color.set(entry.cells.plain)
      if (entry.unlit) material.emissive.set(0x000000)
      material.needsUpdate = true
    }
    index++
  })
}

/** Files and holders for one wearable, per DrssingRoomPlayer.LoadModelProcess. */
function partsFor(slot, id) {
  const files = manifest.value.wearables[id] ?? {}
  const parts = []
  if (files.main) {
    const movable = slot.id === 'pet' && manifest.value.movablePets.includes(id)
    parts.push({ file: files.main, holder: movable ? 'movablePet' : slot.holder })
  }
  if (slot.id === 'body') {
    if (files.sleeveLeft) parts.push({ file: files.sleeveLeft, holder: 'sleeveLeft' })
    if (files.sleeveRight) parts.push({ file: files.sleeveRight, holder: 'sleeveRight' })
  }
  if (slot.id === 'handRight' && files.rightHandWeapon) {
    parts.push({ file: files.rightHandWeapon, holder: 'handRight' })
  }
  return parts
}

async function equip(id, slotId = currentSlot.value) {
  const slot = SLOTS.find((s) => s.id === slotId)
  equipped.value = { ...equipped.value, [slot.id]: id }
  const token = (loadedSlots[slot.id]?.token ?? 0) + 1
  const previous = loadedSlots[slot.id]?.models ?? []
  loadedSlots[slot.id] = { token, models: previous }
  busy.value = true
  try {
    const parts = id == null ? [] : partsFor(slot, id)
    const models = await Promise.all(parts.map(async (part) => {
      const model = await loadGlb(part.file)
      return { model, holder: part.holder, file: part.file }
    }))
    if (loadedSlots[slot.id].token !== token) return
    previous.forEach((model) => model.parent?.remove(model))
    const sleeveColor = manifest.value.sleeveColors?.[id]
    if (sleeveColor) {
      models.filter(({ holder }) => holder.startsWith('sleeve')).forEach(({ model }) => {
        eachMaterial(model, (material) => material.color.set(sleeveColor))
      })
    }
    models.forEach(({ model, holder, file }) => {
      applyArtPalette(id, file, model)
      holders[holder].add(model)
    })
    loadedSlots[slot.id].models = models.map((m) => m.model)
    if (slot.id === 'body') measureSleeves()
    if (slot.id === 'eyes' && eyeModel) eyeModel.visible = !hidesOwnEyes()
  } catch (error) {
    loadError.value = `Could not load wearable ${id}: ${error.message}`
  } finally {
    busy.value = false
  }
}

// ---------- .vox ----------
let voxParsed = null

function showVoxModel() {
  voxRoot.clear()
  if (!voxParsed) return
  // 0 shows the assembled scene; n shows the nth model on its own.
  const instances = voxModel.value === 0
    ? voxParsed.instances
    : [{ model: voxModel.value - 1, rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1], translation: [0, 0, 0] }]
  const points = []
  for (const { model: index, rotation: r, translation: t } of instances) {
    const { size, voxels } = voxParsed.models[index]
    const half = size.map((v) => Math.floor(v / 2))
    for (let i = 0; i < voxels.length; i += 4) {
      const [x, y, z] = [voxels[i] - half[0], voxels[i + 1] - half[1], voxels[i + 2] - half[2]]
      points.push({
        x: r[0] * x + r[1] * y + r[2] * z + t[0],
        y: r[3] * x + r[4] * y + r[5] * z + t[1],
        z: r[6] * x + r[7] * y + r[8] * z + t[2],
        colorIndex: voxels[i + 3]
      })
    }
  }
  if (!points.length) return

  const range = (axis) => {
    const values = points.map((p) => p[axis])
    return [Math.min(...values), Math.max(...values)]
  }
  const [[minX, maxX], [minY, maxY], [minZ, maxZ]] = [range('x'), range('y'), range('z')]
  const scale = 1.6 / (Math.max(maxX - minX, maxY - minY, maxZ - minZ) + 1)
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(scale, scale, scale),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    points.length
  )
  const matrix = new THREE.Matrix4()
  const color = new THREE.Color()
  const palette = voxParsed.palette
  points.forEach((point, i) => {
    // MagicaVoxel is Z-up.
    matrix.setPosition(
      (point.x - (minX + maxX) / 2) * scale,
      (point.z - minZ + 0.5) * scale,
      ((minY + maxY) / 2 - point.y) * scale
    )
    mesh.setMatrixAt(i, matrix)
    if (palette) {
      const k = (point.colorIndex - 1) * 4
      color.setRGB(palette[k] / 255, palette[k + 1] / 255, palette[k + 2] / 255, THREE.SRGBColorSpace)
    } else {
      color.set('#b0b0b0')
    }
    mesh.setColorAt(i, color)
  })
  mesh.castShadow = true
  voxRoot.add(mesh)
}

async function loadVox(file) {
  if (!file) return
  busy.value = true
  try {
    const response = await fetch(BASE_URL + encodeURI(file))
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    voxParsed = parseVox(await response.arrayBuffer())
    voxModelCount.value = voxParsed.models.length
    showVoxModel()
  } catch (error) {
    loadError.value = `Could not read ${file}: ${error.message}`
  } finally {
    busy.value = false
  }
}

// ---------- lifecycle ----------
watch([collateral, eyeColor, ground], applyColors)
watch(collateral, showCollateralSymbol)
watch(animation, playClip)
watch(eyeShape, () => manifest.value && loadEye())
watch(voxFile, loadVox)
watch(voxModel, showVoxModel)
watch(view, applyView)

watch(mode, (value) => {
  gotchiRoot.visible = value === 'dress'
  voxRoot.visible = value === 'vox'
  if (value === 'vox' && !voxFile.value) voxFile.value = manifest.value?.vox[0]?.file ?? ''
})

onMounted(async () => {
  try {
    const [manifestResponse, wearablesResponse, rigResponse, haunt1Response, haunt2Response] = await Promise.all([
      fetch(`${BASE_URL}manifest.json`),
      fetch('/data/aavegotchi_db_wearables.json'),
      fetch(`${BASE_URL}rig.json`),
      fetch('/data/aavegotchi_db_collaterals_haunt1.json'),
      fetch('/data/aavegotchi_db_collaterals_haunt2.json')
    ])
    artPalettes = await fetch('/data/voxel_art_palettes.json').then((response) => response.json())
    const isJson = manifestResponse.headers.get('content-type')?.includes('json')
    if (!manifestResponse.ok || !isJson) {
      throw new Error('Voxel assets are missing. Run: npm run import-voxels -- <path-to-Voxel-Library-checkout>')
    }
    const data = await manifestResponse.json()
    wearableDb.value = (await wearablesResponse.json()).wearables
    collaterals.value = [
      ...(await haunt1Response.json()).collaterals,
      ...(await haunt2Response.json()).collaterals
    ]
    collateral.value = Math.max(0, collaterals.value.findIndex((c) => c.name === 'maAAVE'))
    initScene()
    for (const [slot, elements] of Object.entries(data.holders)) {
      const holder = new THREE.Group()
      holder.matrixAutoUpdate = false
      holder.matrix.fromArray(elements)
      holder.userData.rest = holder.matrix.clone()
      holders[slot] = holder
      gotchiModel.add(holder)
    }
    manifest.value = data
    baseModel = await loadGlb('base.glb')
    gotchiModel.add(baseModel)
    const rigData = await rigResponse.json()
    restInverses = rigData.bones.map((_, slot) => boneMatrix(rigData.rest, slot).invert())
    const meshes = []
    baseModel.traverse((node) => {
      if (node.isMesh) meshes.push(node)
    })
    meshes.forEach((mesh, i) => {
      // Each frame rewrites the vertices, so this copy must not share the cached geometry.
      mesh.geometry = mesh.geometry.clone()
      mesh.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      skinned.push({ mesh, ...rigData.primitives[i] })
      // The source's plus-shaped marker gives way to the real collateral symbol.
      if (mesh.material.userData.role === 'collateralGlow') mesh.visible = false
    })
    collateralSymbol = new THREE.Group()
    collateralSymbol.matrixAutoUpdate = false
    gotchiModel.add(collateralSymbol)
    showCollateralSymbol()
    rig.value = rigData
    playClip(animation.value)
    updateAnimation(0)
    // The source rig is not grounded at the origin, so stand it on the floor and frame it.
    const bounds = new THREE.Box3().setFromObject(baseModel)
    const center = bounds.getCenter(new THREE.Vector3())
    gotchiModel.position.set(-center.x, -bounds.min.y, -center.z)
    controls.target.set(0, center.y - bounds.min.y, 0)
    await loadEye()
  } catch (error) {
    loadError.value = error.message
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  controls?.dispose()
  renderer?.dispose()
})
</script>
