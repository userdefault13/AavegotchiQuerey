<template>
  <div class="composer px-4 pb-10">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-blue-600 dark:text-blue-400">Composer</h2>
      <p class="text-sm text-gray-600 dark:text-blue-300 mt-1">
        Build a gotchi from the JSON SVG library and compare it to on-chain
        <code class="text-xs dark:text-blue-400">previewSideAavegotchi</code>.
      </p>
    </div>

    <div v-if="loadError" class="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="!library" class="py-12 text-center text-gray-500 dark:text-blue-400">
      Loading JSON library…
    </div>

    <form v-else class="space-y-6" @submit.prevent="onSubmit">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Haunt + collateral -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
          <h3 class="font-semibold text-gray-800 dark:text-blue-400">Base</h3>

          <label class="block text-sm">
            <span class="text-gray-600 dark:text-blue-400">Haunt</span>
            <select
              v-model.number="hauntId"
              class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-3 py-2"
            >
              <option :value="1">Haunt 1 (ma*)</option>
              <option :value="2">Haunt 2 (am*)</option>
            </select>
          </label>

          <label class="block text-sm">
            <span class="text-gray-600 dark:text-blue-400">Collateral</span>
            <select
              v-model="collateralKey"
              class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-3 py-2"
            >
              <option v-for="c in collaterals" :key="c.collateralType" :value="c.collateralType">
                {{ c.name }}
              </option>
            </select>
          </label>
        </section>

        <!-- Traits -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
          <h3 class="font-semibold text-gray-800 dark:text-blue-400">Traits (0–99)</h3>
          <div
            v-for="(label, idx) in traitLabels"
            :key="label"
            class="grid grid-cols-[4rem_1fr_3rem] gap-2 items-center text-sm"
          >
            <span class="text-gray-600 dark:text-blue-400">{{ label }}</span>
            <input
              v-model.number="traits[idx]"
              type="range"
              min="0"
              max="99"
              class="w-full"
            />
            <input
              v-model.number="traits[idx]"
              type="number"
              min="0"
              max="99"
              class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-2 py-1"
            />
          </div>
        </section>
      </div>

      <!-- Wearables -->
      <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 class="font-semibold text-gray-800 dark:text-blue-400 mb-3">Wearables</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label v-for="(slotName, slot) in slotNames" :key="slot" class="block text-sm">
            <span class="text-gray-600 dark:text-blue-400">{{ slot }} — {{ slotName }}</span>
            <select
              v-model.number="equipped[slot]"
              class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-2 py-2 text-xs"
            >
              <option :value="0">None</option>
              <option
                v-for="w in wearablesBySlot[slot]"
                :key="w.id"
                :value="w.id"
              >
                {{ w.id }} — {{ w.name }}
              </option>
            </select>
          </label>
        </div>
      </section>

      <div class="flex flex-wrap gap-3 items-center">
        <button
          type="submit"
          class="px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          :disabled="submitting"
        >
          {{ submitting ? 'Composing…' : 'Compose & Compare' }}
        </button>
        <button
          type="button"
          class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-blue-400 dark:hover:bg-gray-700"
          @click="resetForm"
        >
          Reset
        </button>
        <span v-if="submitError" class="text-sm text-red-600 dark:text-red-400">{{ submitError }}</span>
      </div>
    </form>

    <!-- Results -->
    <div v-if="results" class="mt-10 space-y-6">
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="view in viewNames"
          :key="view"
          type="button"
          class="px-3 py-1.5 rounded text-sm"
          :class="activeView === view
            ? 'bg-blue-700 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-blue-300'"
          @click="activeView = view"
        >
          {{ view }}
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Library -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="font-semibold mb-3 text-gray-800 dark:text-blue-400">JSON library SVG</h3>
          <div v-if="results.libraryError" class="text-sm text-red-600">{{ results.libraryError }}</div>
          <template v-else>
            <div
              class="svg-preview mb-3 flex justify-center bg-gray-50 dark:bg-gray-900 rounded p-4"
              v-html="results.library[activeView]"
            />
            <details class="text-xs">
              <summary class="cursor-pointer text-blue-600 dark:text-blue-400 mb-2">Inline SVG source</summary>
              <div class="flex justify-end mb-1">
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-blue-300"
                  @click="copyText(results.library[activeView])"
                >
                  Copy
                </button>
              </div>
              <pre class="overflow-auto max-h-64 p-2 rounded bg-gray-100 dark:bg-gray-900 dark:text-blue-300 text-[10px] whitespace-pre-wrap break-all">{{ results.library[activeView] }}</pre>
            </details>
          </template>
        </section>

        <!-- On-chain -->
        <section class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="font-semibold mb-3 text-gray-800 dark:text-blue-400">On-chain SVG</h3>
          <div v-if="results.chainError" class="text-sm text-red-600">{{ results.chainError }}</div>
          <template v-else>
            <div
              class="svg-preview mb-3 flex justify-center bg-gray-50 dark:bg-gray-900 rounded p-4"
              v-html="results.chain[activeView]"
            />
            <details class="text-xs">
              <summary class="cursor-pointer text-blue-600 dark:text-blue-400 mb-2">Inline SVG source</summary>
              <div class="flex justify-end mb-1">
                <button
                  type="button"
                  class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 dark:text-blue-300"
                  @click="copyText(results.chain[activeView])"
                >
                  Copy
                </button>
              </div>
              <pre class="overflow-auto max-h-64 p-2 rounded bg-gray-100 dark:bg-gray-900 dark:text-blue-300 text-[10px] whitespace-pre-wrap break-all">{{ results.chain[activeView] }}</pre>
            </details>
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getContract } from '../utils/contract.js'
import {
  loadLibrary,
  composeAllViews,
  getCollateralsForHaunt,
  wearablesForSlot,
  parsePreviewSideResponse,
  previewSidesToNamed,
  VIEW_NAMES,
  SLOT_NAMES
} from '../utils/composeGotchi.js'

const traitLabels = ['NRG', 'AGG', 'SPK', 'BRN', 'EYS', 'EYC']
const viewNames = VIEW_NAMES
const slotNames = SLOT_NAMES

const library = ref(null)
const loadError = ref('')
const hauntId = ref(1)
const collateralKey = ref('')
const traits = ref([50, 50, 50, 50, 50, 50])
const equipped = ref(Array(8).fill(0))
const submitting = ref(false)
const submitError = ref('')
const results = ref(null)
const activeView = ref('Front')

const collaterals = computed(() => {
  if (!library.value) return []
  return getCollateralsForHaunt(library.value, hauntId.value)
})

const wearablesBySlot = computed(() => {
  if (!library.value) return Array.from({ length: 8 }, () => [])
  return Array.from({ length: 8 }, (_, slot) => wearablesForSlot(library.value, slot))
})

watch(hauntId, () => {
  const list = collaterals.value
  if (list.length) collateralKey.value = list[0].collateralType
})

watch(collaterals, (list) => {
  if (!collateralKey.value && list.length) {
    collateralKey.value = list[0].collateralType
  }
})

onMounted(async () => {
  try {
    library.value = await loadLibrary()
    const list = getCollateralsForHaunt(library.value, hauntId.value)
    if (list.length) collateralKey.value = list[0].collateralType
  } catch (e) {
    loadError.value = e.message || String(e)
  }
})

function resetForm() {
  hauntId.value = 1
  traits.value = [50, 50, 50, 50, 50, 50]
  equipped.value = Array(8).fill(0)
  results.value = null
  submitError.value = ''
  const list = getCollateralsForHaunt(library.value, 1)
  if (list.length) collateralKey.value = list[0].collateralType
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || '')
  } catch (_) {
    /* ignore */
  }
}

async function onSubmit() {
  submitError.value = ''
  submitting.value = true
  results.value = null

  const wearables16 = Array(16).fill(0)
  for (let i = 0; i < 8; i++) wearables16[i] = Number(equipped.value[i]) || 0

  const input = {
    hauntId: hauntId.value,
    collateralType: collateralKey.value,
    numericTraits: traits.value.map((t) => Math.max(0, Math.min(99, Number(t) || 0))),
    equippedWearables: wearables16
  }

  const out = {
    library: {},
    chain: {},
    libraryError: null,
    chainError: null
  }

  try {
    out.library = await composeAllViews(input, library.value)
  } catch (e) {
    out.libraryError = e.message || String(e)
  }

  try {
    const contract = getContract()
    const response = await contract.previewSideAavegotchi(
      input.hauntId,
      input.collateralType,
      input.numericTraits,
      wearables16
    )
    const arr = parsePreviewSideResponse(response)
    out.chain = previewSidesToNamed(arr)
  } catch (e) {
    out.chainError = e.message || String(e)
  }

  results.value = out
  activeView.value = 'Front'
  submitting.value = false

  if (out.libraryError && out.chainError) {
    submitError.value = 'Both library and on-chain compose failed.'
  }
}
</script>

<style scoped>
.svg-preview :deep(svg) {
  width: 256px;
  height: 256px;
  image-rendering: pixelated;
}

.composer :deep(select option) {
  @apply dark:text-blue-300 dark:bg-gray-900;
}
</style>
