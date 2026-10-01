<template>
  <div class="ascii-collection px-4 pb-10">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-blue-600 dark:text-blue-400">ASCII Collection</h2>
      <p class="text-sm text-gray-600 dark:text-blue-300 mt-1">
        Monochrome wearable sprites. Each row is two SVG pixels:
        <span class="font-mono">▀ ▄</span> are half blocks, <span class="font-mono">█ ▓ ▒ ░</span> are full.
      </p>
    </div>

    <div v-if="loadError" class="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      {{ loadError }}
    </div>

    <div v-else-if="!library" class="py-12 text-center text-gray-500 dark:text-blue-400">
      Loading JSON library…
    </div>

    <template v-else>
      <div class="mb-6 flex flex-wrap gap-3 items-end">
        <label class="block text-sm flex-1 min-w-[12rem]">
          <span class="text-gray-600 dark:text-blue-400">Search</span>
          <input
            v-model="query"
            type="search"
            placeholder="Name or id"
            class="mt-1 w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-3 py-2"
          />
        </label>
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-blue-400">Slot</span>
          <select
            v-model="slotFilter"
            class="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-3 py-2"
          >
            <option value="">All</option>
            <option v-for="slot in slotOptions" :key="slot" :value="slot">{{ slot }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="text-gray-600 dark:text-blue-400">Rarity</span>
          <select
            v-model="rarityFilter"
            class="mt-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-blue-300 px-3 py-2"
          >
            <option value="">All</option>
            <option v-for="rarity in rarityOptions" :key="rarity" :value="rarity">{{ rarity }}</option>
          </select>
        </label>
        <p class="text-sm text-gray-600 dark:text-blue-300 pb-2">
          {{ filtered.length }} / {{ wearables.length }}
        </p>
      </div>

      <section
        v-if="selected"
        class="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h3 class="font-semibold text-gray-800 dark:text-blue-400">
              {{ selected.id }} — {{ selected.name }}
            </h3>
            <p class="text-sm text-gray-600 dark:text-blue-300 mt-1">
              {{ selected.slotNames.join(', ') || 'No slot' }}
              · {{ selected.rarity }}
              <span v-if="selected.sleeves"> · sleeves</span>
            </p>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="selectedId = null"
          >
            Close
          </button>
        </div>

        <div class="flex flex-wrap gap-2 mb-4">
          <button
            v-for="view in viewNames"
            :key="view"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="activeView === view
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="activeView = view"
          >
            {{ view }}
          </button>
          <button
            v-if="selected.sleeves"
            type="button"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="showSleeves
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'"
            @click="showSleeves = !showSleeves"
          >
            Sleeves
          </button>
        </div>

        <p v-if="activeSprite" class="text-xs text-gray-500 dark:text-blue-400 mb-2">
          canvas {{ activeSprite.x }}, {{ activeSprite.y }}
        </p>
        <pre class="ascii-sprite overflow-auto rounded bg-gray-950 text-gray-100 whitespace-pre leading-none text-[10px] sm:text-xs p-3">{{ spriteText(activeSprite?.rows) }}</pre>
      </section>

      <div
        v-if="!filtered.length"
        class="py-12 text-center text-gray-500 dark:text-blue-400"
      >
        No wearables match.
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="item in filtered"
          :key="item.id"
          type="button"
          class="text-left bg-white dark:bg-gray-800 rounded-lg shadow p-3 hover:ring-2 hover:ring-blue-500 transition"
          :class="selectedId === item.id ? 'ring-2 ring-blue-600' : ''"
          @click="openItem(item.id)"
        >
          <pre class="ascii-sprite overflow-auto rounded bg-gray-950 text-gray-100 whitespace-pre leading-none max-h-40 text-[7px] p-2">{{ spriteText(frontRows(item)) }}</pre>
          <p class="mt-2 text-sm font-semibold text-gray-800 dark:text-blue-300">
            {{ item.id }} — {{ item.name }}
          </p>
          <p class="text-xs text-gray-500 dark:text-blue-400">
            {{ item.slotNames.join(', ') || 'No slot' }} · {{ item.rarity }}
          </p>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const library = ref(null)
const loadError = ref('')
const query = ref('')
const slotFilter = ref('')
const rarityFilter = ref('')
const selectedId = ref(null)
const activeView = ref('front')
const showSleeves = ref(false)

const wearables = computed(() => library.value?.wearables || [])
const viewNames = computed(() => library.value?.meta?.views || ['front', 'left', 'right', 'back'])

const slotOptions = computed(() => {
  const names = new Set()
  for (const item of wearables.value) {
    for (const name of item.slotNames || []) names.add(name)
  }
  return [...names]
})

const rarityOptions = computed(() => {
  const names = new Set(wearables.value.map((item) => item.rarity).filter(Boolean))
  return [...names]
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return wearables.value.filter((item) => {
    if (slotFilter.value && !(item.slotNames || []).includes(slotFilter.value)) return false
    if (rarityFilter.value && item.rarity !== rarityFilter.value) return false
    if (!q) return true
    return String(item.id).includes(q) || item.name.toLowerCase().includes(q)
  })
})

const selected = computed(() => wearables.value.find((item) => item.id === selectedId.value) || null)

const activeSprite = computed(() => {
  const item = selected.value
  if (!item) return null
  const source = showSleeves.value && item.sleeves ? item.sleeves : item.views
  return (source || []).find((view) => view.name === activeView.value) || source?.[0] || null
})

function frontRows(item) {
  const front = (item.views || []).find((view) => view.name === 'front')
  return front?.rows || item.views?.[0]?.rows || []
}

function spriteText(rows) {
  return rows?.length ? rows.join('\n') : ' '
}

function openItem(id) {
  selectedId.value = id
  activeView.value = 'front'
  showSleeves.value = false
}

onMounted(async () => {
  try {
    const response = await fetch('/data/aavegotchi_db_wearables_ascii.json')
    if (!response.ok) throw new Error(`Library request failed (${response.status})`)
    library.value = await response.json()
  } catch (error) {
    loadError.value = error?.message || String(error)
  }
})
</script>
