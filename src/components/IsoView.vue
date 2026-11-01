<template>
  <div class="p-4 space-y-6">
    <div v-if="loadError" class="p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      {{ loadError }}
    </div>
    <template v-else-if="library">
      <div class="flex flex-wrap gap-4 items-end">
        <label class="text-sm text-gray-700 dark:text-blue-300">
          Collection
          <select v-model="collection" :class="selectClass" data-testid="iso-collection">
            <option v-for="item in COLLECTIONS" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-blue-300">
          Collateral
          <select v-model.number="collateral" :class="selectClass" data-testid="iso-collateral">
            <option v-for="(item, index) in collaterals" :key="item.collateralType + index" :value="index">
              {{ item.name }}
            </option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-blue-300">
          Eye shape
          <select v-model.number="eyeShape" :class="selectClass" data-testid="iso-eye-shape">
            <option v-for="option in eyeShapeOptions" :key="option.trait" :value="option.trait">{{ option.label }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-blue-300">
          Eye colour
          <select v-model.number="eyeColor" :class="selectClass" data-testid="iso-eye-color">
            <option v-for="option in EYE_COLORS" :key="option.trait" :value="option.trait">{{ option.label }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-blue-300">
          Hands
          <select v-model="pose" :class="selectClass" data-testid="iso-pose">
            <option v-for="option in POSES" :key="option.id" :value="option.id">{{ option.label }}</option>
          </select>
        </label>
        <label class="text-sm text-gray-700 dark:text-blue-300">
          Frame
          <select v-model="frameMode" :class="selectClass" data-testid="iso-frame">
            <option value="float">Floating (animated)</option>
            <option value="0">Rest</option>
            <option value="1">Up</option>
          </select>
        </label>
      </div>

      <div class="flex flex-wrap gap-4" data-testid="iso-views">
        <figure v-for="(view, index) in VIEWS" :key="view" class="iso-tile rounded-lg p-2" :style="theme(current)">
          <div v-html="sprite({ ...current, view: index, scale: 4 })" />
          <figcaption class="text-xs text-center text-white">{{ view }}</figcaption>
        </figure>
      </div>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-blue-300">
          Every {{ collectionLabel }} collateral, with these eyes
        </h2>
        <div class="flex flex-wrap gap-2" data-testid="iso-all-collaterals">
          <button
            v-for="(item, index) in collaterals"
            :key="item.collateralType + index"
            type="button"
            class="iso-tile rounded-lg p-1"
            :class="{ 'iso-picked': index === collateral }"
            :style="theme({ ...current, collateral: item })"
            @click="collateral = index"
          >
            <div v-html="sprite({ ...current, collateral: item, view: 0, scale: 2 })" />
            <span class="block text-xs text-center text-white">{{ item.name }}</span>
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-semibold text-gray-700 dark:text-blue-300">
          Every eye shape, on {{ current.collateral.name }}
        </h2>
        <div class="flex flex-wrap gap-2" data-testid="iso-all-eyes">
          <button
            v-for="option in eyeShapeOptions"
            :key="option.trait"
            type="button"
            class="iso-tile rounded-lg p-1"
            :class="{ 'iso-picked': option.trait === eyeShape }"
            :style="theme({ ...current, eyeShape: option.trait })"
            @click="eyeShape = option.trait"
          >
            <div v-html="sprite({ ...current, eyeShape: option.trait, view: 0, scale: 2 })" />
            <span class="block text-xs text-center text-white">{{ option.short }}</span>
          </button>
        </div>
      </section>
    </template>
    <p v-else class="text-gray-500 dark:text-blue-300">Loading…</p>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getEyeColorHex } from '../utils/composeGotchi'

// The iso library is built from the NEAR 3/4-view sprite sheet by AarcadeGh$t's
// scripts/build-iso-gotchi-json.py: one 80x80 body drawn in NEAR, recoloured by class, with every
// collateral logo and eye shape mapped onto its face.
const SIZE = 80
const FLOAT_DY = -2
const VIEWS = ['Front left', 'Front right', 'Back left', 'Back right']
const POSES = [
  { id: 'handsWalk', label: 'Walk' },
  { id: 'handsOut', label: 'Out' },
  { id: 'handsDown', label: 'Down' }
]
const COLLECTIONS = [
  { id: 'near', label: 'NEAR', collaterals: 'aavegotchi_db_collaterals_iso_near.json', eyes: 1 },
  { id: 'avax', label: 'AVAX', collaterals: 'aavegotchi_db_collaterals_iso_avax.json', eyes: 1 },
  { id: 'haunt1', label: 'Haunt 1', collaterals: 'aavegotchi_db_collaterals_iso_haunt1.json', eyes: 1 },
  { id: 'haunt2', label: 'Haunt 2', collaterals: 'aavegotchi_db_collaterals_iso_haunt2.json', eyes: 2 },
  { id: 'haunt3', label: 'Haunt 3', collaterals: 'aavegotchi_db_collaterals_iso_haunt3.json', eyes: 3 }
]
/** One trait value per eye colour band (getEyeColorHex). */
const EYE_COLORS = [
  { trait: 50, label: 'Common (collateral)' },
  { trait: 15, label: 'Uncommon low' },
  { trait: 80, label: 'Uncommon high' },
  { trait: 5, label: 'Rare low' },
  { trait: 95, label: 'Rare high' },
  { trait: 0, label: 'Mythical low' },
  { trait: 98, label: 'Mythical high' }
]
const COLLATERAL_EYES = 98
const selectClass = 'block mt-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'

const library = ref(null)
const loadError = ref('')
const collection = ref('near')
const collateral = ref(0)
const eyeShape = ref(COLLATERAL_EYES)
const eyeColor = ref(50)
const pose = ref('handsWalk')
const frameMode = ref('float')
const tick = ref(0)
let timer = null

const collectionInfo = computed(() => COLLECTIONS.find((item) => item.id === collection.value))
const collectionLabel = computed(() => collectionInfo.value.label)
const collaterals = computed(() => library.value.collaterals[collection.value])
const eyeShapes = computed(() => library.value.eyeShapes[collectionInfo.value.eyes])
const eyeShapeOptions = computed(() => [
  ...eyeShapes.value
    .filter((shape) => shape.rangeMin < COLLATERAL_EYES && shape.svgs[0])
    .map((shape) => ({
      trait: shape.rangeMin,
      label: `#${shape.id} (${shape.rangeMin}–${shape.rangeMax})`,
      short: `${shape.rangeMin}–${shape.rangeMax}`
    })),
  { trait: COLLATERAL_EYES, label: 'Collateral eyes (98–99)', short: 'collateral' }
])
const frame = computed(() => (frameMode.value === 'float' ? tick.value % 2 : Number(frameMode.value)))
const current = computed(() => ({
  collateral: collaterals.value[collateral.value] || collaterals.value[0],
  eyeShape: eyeShape.value,
  eyeColor: eyeColor.value,
  pose: pose.value,
  frame: frame.value
}))

watch(collection, () => {
  collateral.value = 0
})

const chainColor = (value) => `#${String(value).replace(/^0x|^#/, '')}`

function theme({ collateral: item, eyeColor: trait }) {
  return {
    '--iso-primary': chainColor(item.primaryColor),
    '--iso-secondary': chainColor(item.secondaryColor),
    '--iso-cheek': chainColor(item.cheekColor),
    '--iso-eye': getEyeColorHex(trait, item.primaryColor)
  }
}

/** Eye shape for a trait value (rangeMax is exclusive in the JSON). */
function findEyeShape(trait) {
  return eyeShapes.value.find((shape) => trait >= shape.rangeMin && trait < shape.rangeMax) ||
    eyeShapes.value.find((shape) => trait >= shape.rangeMin && trait <= shape.rangeMax)
}

function hands(view, id) {
  return String(library.value.main.hands[view]).match(new RegExp(`<g class="gotchi-${id}">.*?</g>`))?.[0] || ''
}

function sprite({ collateral: item, eyeShape: trait, pose: id, frame: up, view, scale }) {
  const main = library.value.main
  const layers = [main.body[view]]
  if (view < 2) {
    const eyes = trait >= COLLATERAL_EYES ? item.eyeShapeSvgs?.[view] : findEyeShape(trait)?.svgs?.[view]
    layers.push(eyes || '', item.svgs?.[view] || '')
  }
  layers.push(hands(view, id))
  const body = layers.join('')
  const shadow = (up ? main.shadow_float : main.shadow)[view]
  const inner = shadow + (up ? `<g transform="translate(0 ${FLOAT_DY})">${body}</g>` : body)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE * scale}" height="${SIZE * scale}" shape-rendering="crispEdges">${inner}</svg>`
}

async function loadJson(name) {
  const response = await fetch(`/data/${name}`)
  if (!response.ok) throw new Error(`Could not load ${name} (${response.status})`)
  return response.json()
}

onMounted(async () => {
  try {
    const [main, eyes1, eyes2, eyes3, ...packs] = await Promise.all([
      loadJson('aavegotchi_db_main_iso.json'),
      loadJson('aavegotchi_db_eye_shapes_iso_haunt1.json'),
      loadJson('aavegotchi_db_eye_shapes_iso_haunt2.json'),
      loadJson('aavegotchi_db_eye_shapes_iso_haunt3.json'),
      ...COLLECTIONS.map((item) => loadJson(item.collaterals))
    ])
    library.value = {
      main,
      eyeShapes: { 1: eyes1.eyeShapes, 2: eyes2.eyeShapes, 3: eyes3.eyeShapes },
      collaterals: Object.fromEntries(COLLECTIONS.map((item, index) => [item.id, packs[index].collaterals]))
    }
  } catch (error) {
    loadError.value = error.message
  }
  timer = setInterval(() => tick.value++, 400)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.iso-tile {
  background: #8f9b98;
}
.iso-picked {
  outline: 2px solid #2563eb;
}
.iso-tile :deep(.gotchi-primary),
.iso-tile :deep(.gotchi-primary-mouth) {
  fill: var(--iso-primary);
}
.iso-tile :deep(.gotchi-secondary) {
  fill: var(--iso-secondary);
}
.iso-tile :deep(.gotchi-cheek) {
  fill: var(--iso-cheek);
}
.iso-tile :deep(.gotchi-eyeColor) {
  fill: var(--iso-eye);
}
</style>
