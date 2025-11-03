<template>
  <div class="gallery-container">
    <div v-if="isLoadingTokens" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading your Aavegotchis...</p>
    </div>

    <div v-else-if="tokensError" class="error-container">
      <p class="error-text">Error loading Aavegotchis: {{ tokensError.message }}</p>
    </div>

    <div v-else-if="!tokenIds || tokenIds.length === 0" class="empty-container">
      <p class="empty-text">No Aavegotchis found in this wallet.</p>
    </div>

    <div v-else class="gallery-grid">
      <AavegotchiCard
        v-for="tokenId in tokenIds"
        :key="`${tokenId}-${!!thumbnailSvgs[tokenId]}`"
        :gotchi-data="getGotchiCardData(tokenId)"
        :thumbnail-svg="thumbnailSvgs[tokenId] || ''"
        :is-selected="selectedGotchiId === tokenId"
        @select="handleSelect"
      />
    </div>
  </div>
</template>

<script setup>
import { watch, computed } from 'vue'
import AavegotchiCard from './AavegotchiCard.vue'
import { useAavegotchi } from '../composables/useAavegotchi.js'

const props = defineProps({
  selectedGotchiId: {
    type: Number,
    default: null
  }
})

const emit = defineEmits(['select'])

const { tokenIds, isLoadingTokens, tokensError, gotchiDataMap, svgDataMap } = useAavegotchi()

// Create a computed map of tokenId -> SVG for reactive access
const thumbnailSvgs = computed(() => {
  const map = {}
  const ids = tokenIds.value || []
  ids.forEach(tokenId => {
    const svg = svgDataMap.value[tokenId]
    map[tokenId] = svg || ''
    if (svg) {
      console.log(`Gallery - thumbnailSvgs computed for token ${tokenId}:`, {
        hasSvg: true,
        length: svg.length,
        firstChars: svg.substring(0, 50)
      })
    }
  })
  return map
})

// Debug logging with watchers to track changes
watch(tokenIds, (ids) => {
  console.log('Gallery - tokenIds changed:', ids)
}, { immediate: true })

watch(isLoadingTokens, (loading) => {
  console.log('Gallery - isLoadingTokens:', loading)
}, { immediate: true })

watch(tokensError, (error) => {
  console.log('Gallery - tokensError:', error)
}, { immediate: true })

watch(gotchiDataMap, (map) => {
  console.log('Gallery - gotchiDataMap updated:', map)
}, { immediate: true, deep: true })

watch(svgDataMap, (map) => {
  console.log('Gallery - svgDataMap updated:', Object.keys(map).length, 'entries')
}, { immediate: true, deep: true })

watch(thumbnailSvgs, (map) => {
  console.log('Gallery - thumbnailSvgs computed updated:', Object.keys(map).length, 'entries')
  // Log a sample to verify SVGs are there
  const sampleId = Object.keys(map)[0]
  if (sampleId) {
    console.log('Gallery - sample thumbnail SVG for token', sampleId, ':', {
      hasSvg: !!map[sampleId],
      length: map[sampleId]?.length,
      firstChars: map[sampleId]?.substring(0, 50)
    })
  }
}, { immediate: true, deep: true })

function getGotchiCardData(tokenId) {
  const gotchiData = gotchiDataMap.value[tokenId]
  if (gotchiData) {
    return {
      tokenId: gotchiData.tokenId,
      name: gotchiData.name || '',
      brs: gotchiData.brs || 0
    }
  }
  return {
    tokenId,
    name: '',
    brs: 0
  }
}


function handleSelect(tokenId) {
  emit('select', tokenId)
}
</script>

<style scoped>
.gallery-container {
  @apply w-full p-6;
}

.loading-container,
.error-container,
.empty-container {
  @apply flex flex-col items-center justify-center py-12 gap-4;
}

.loading-spinner {
  @apply w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin;
}

.error-text {
  @apply text-red-600 font-medium;
}

.empty-text {
  @apply text-gray-500 text-lg;
}

.gallery-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6;
}
</style>

