<template>
  <div 
    class="aavegotchi-card"
    @click="$emit('select', gotchiData.tokenId)"
    :class="{ 'selected': isSelected }"
  >
    <div class="card-header">
      <h3 class="gotchi-id">#{{ gotchiData.tokenId }}</h3>
      <p class="gotchi-name">{{ gotchiData.name || 'Unnamed' }}</p>
    </div>
    <div class="card-image">
      <div 
        v-if="thumbnailSvg" 
        ref="svgContainer"
        v-html="thumbnailSvg" 
        class="svg-thumbnail"
      ></div>
      <div v-else class="svg-placeholder">
        <div class="loading-spinner-small"></div>
      </div>
    </div>
    <div class="card-footer">
      <span class="brs-badge">BRS: {{ gotchiData.brs }}</span>
    </div>
  </div>
</template>

<script setup>
import { watch, ref, nextTick, onUnmounted } from 'vue'

const props = defineProps({
  gotchiData: {
    type: Object,
    required: true
  },
  thumbnailSvg: {
    type: String,
    default: ''
  },
  isSelected: {
    type: Boolean,
    default: false
  }
})

defineEmits(['select'])

const svgContainer = ref(null)
const styleElement = ref(null)

// Extract and apply SVG styles
function applySvgStyles(svgString) {
  if (!svgString) return

  // Extract style content from SVG
  const styleMatch = svgString.match(/<style>(.*?)<\/style>/s)
  if (!styleMatch) {
    console.warn(`AavegotchiCard [${props.gotchiData.tokenId}] - No style tag found in SVG`)
    return
  }

  const styleContent = styleMatch[1]
  
  // Remove any existing style element for this component
  if (styleElement.value) {
    styleElement.value.remove()
    styleElement.value = null
  }

  // Create a scoped style element that applies only to this SVG
  const styleId = `gotchi-style-${props.gotchiData.tokenId}`
  
  // Check if style already exists (in case of re-render)
  const existingStyle = document.getElementById(styleId)
  if (existingStyle) {
    existingStyle.remove()
  }
  
  const newStyleElement = document.createElement('style')
  newStyleElement.id = styleId
  
  // Scope the styles to this specific SVG using the data attribute
  // Handle both simple classes (.gotchi-primary) and multi-part classes (.gotchi-primary-mouth)
  const scopedStyles = styleContent
    .replace(/\.gotchi-([\w-]+)\s*\{/g, `svg[data-gotchi-id="${props.gotchiData.tokenId}"] .gotchi-$1 {`)
  
  newStyleElement.textContent = scopedStyles
  document.head.appendChild(newStyleElement)
  styleElement.value = newStyleElement
  
  console.log(`AavegotchiCard [${props.gotchiData.tokenId}] - Applied extracted styles`)
}

// Watch for SVG changes and apply styles
watch(() => props.thumbnailSvg, async (newSvg) => {
  if (newSvg) {
    await nextTick()
    // Add data attribute to SVG for scoping
    if (svgContainer.value) {
      const svgElement = svgContainer.value.querySelector('svg')
      if (svgElement) {
        svgElement.setAttribute('data-gotchi-id', props.gotchiData.tokenId)
      }
    }
    applySvgStyles(newSvg)
  }
}, { immediate: true })

onUnmounted(() => {
  // Clean up style element when component is destroyed
  if (styleElement.value) {
    styleElement.value.remove()
  }
})
</script>

<style scoped>
.aavegotchi-card {
  @apply bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 cursor-pointer;
  @apply hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg transition-all;
  @apply flex flex-col gap-3;
}

.aavegotchi-card.selected {
  @apply border-blue-600 dark:border-blue-500 shadow-lg;
}

.card-header {
  @apply text-center;
}

.gotchi-id {
  @apply text-lg font-bold text-gray-800 dark:text-gray-100;
}

.gotchi-name {
  @apply text-sm text-gray-600 dark:text-gray-300 truncate;
}

.card-image {
  @apply bg-gray-100 dark:bg-gray-700 rounded-lg p-2 flex items-center justify-center;
  min-height: 150px;
}

.svg-thumbnail {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 150px;
}

.svg-thumbnail :deep(svg) {
  max-width: 100%;
  max-height: 150px;
  width: auto;
  height: auto;
}

/* Don't interfere with SVG's internal styles - let them work naturally */
.svg-thumbnail :deep(svg style) {
  /* Style tag should be processed automatically by browser */
}

.svg-placeholder {
  @apply flex items-center justify-center;
  min-height: 150px;
}

.loading-spinner-small {
  @apply w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin;
}

.card-footer {
  @apply flex justify-center;
}

.brs-badge {
  @apply bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-full text-sm font-medium;
}
</style>

