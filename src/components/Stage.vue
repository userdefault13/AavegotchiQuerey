<template>
  <div class="stage-container">
    <button @click="$emit('close')" class="close-btn">← Back to Gallery</button>

    <div v-if="isLoading" class="loading-container">
      <div class="loading-spinner"></div>
      <p>Loading Aavegotchi data...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <p class="error-text">Error: {{ error.message }}</p>
    </div>

    <div v-else-if="gotchiData" class="stage-content">
      <!-- Gotchi Info Section -->
      <div class="info-section">
        <h1 class="gotchi-title">
          <span class="gotchi-id">#{{ gotchiData.tokenId }}</span>
          <span class="gotchi-name">{{ gotchiData.name || 'Unnamed Aavegotchi' }}</span>
        </h1>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Kinship</div>
            <div class="stat-value">{{ gotchiData.kinship }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">BRS</div>
            <div class="stat-value">{{ gotchiData.brs }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">XP</div>
            <div class="stat-value">{{ gotchiData.xp }}</div>
          </div>
        </div>

        <div class="traits-grid">
          <div class="trait-item">
            <span class="trait-label">NRG:</span>
            <span class="trait-value">{{ gotchiData.nrg }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">AGG:</span>
            <span class="trait-value">{{ gotchiData.agg }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">SPK:</span>
            <span class="trait-value">{{ gotchiData.spk }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">BRN:</span>
            <span class="trait-value">{{ gotchiData.brn }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">EYS:</span>
            <span class="trait-value">{{ gotchiData.eys }}</span>
          </div>
          <div class="trait-item">
            <span class="trait-label">EYC:</span>
            <span class="trait-value">{{ gotchiData.eyc }}</span>
          </div>
        </div>
      </div>

      <!-- SVG Section -->
      <div class="svg-section" v-if="svgViews">
        <div class="svg-header">
          <h2 class="section-title">Aavegotchi SVG</h2>
          <div class="view-controls">
            <button 
              @click="previousView" 
              class="nav-btn"
              :disabled="isLoadingSideViews || currentViewIndex === 0"
              title="Previous View"
            >
              ←
            </button>
            <span class="view-indicator">{{ currentViewName }}</span>
            <button 
              @click="nextView" 
              class="nav-btn"
              :disabled="isLoadingSideViews || currentViewIndex >= availableViews.length - 1"
              title="Next View"
            >
              →
            </button>
          </div>
        </div>
        <div class="svg-view-container">
          <div v-if="isLoadingSideViews && currentViewIndex > 0" class="loading-overlay">
            <div class="loading-spinner-small"></div>
            <p>Loading view...</p>
          </div>
          <SVGViewer 
            v-if="currentSvgView && currentSvgView.length > 0"
            :svg-string="currentSvgView" 
            :view-name="currentViewName"
            :gotchi-id="props.gotchiId"
            :data-attribute="'data-gotchi-stage-id'"
          />
          <div v-else class="svg-loading-fallback">
            <div class="loading-spinner-small"></div>
            <p>Loading SVG view...</p>
            <p class="debug-info" v-if="!currentSvgView">No SVG view available</p>
            <p class="debug-info" v-else-if="currentSvgView.length === 0">SVG view is empty</p>
          </div>
          <div class="svg-code-wrapper">
            <button 
              @click="copyToClipboard(currentSvgView, `svg-${currentViewName}`)" 
              class="copy-code-btn"
              :class="{ 'copied': copiedId === `svg-${currentViewName}` }"
            >
              {{ copiedId === `svg-${currentViewName}` ? '✓ Copied!' : 'Copy SVG Code' }}
            </button>
            <details class="svg-code-details">
              <summary class="code-summary">Show SVG Code</summary>
              <pre class="svg-code-block"><code>{{ currentSvgView }}</code></pre>
            </details>
          </div>
        </div>
      </div>

      <!-- SVG Metadata Section -->
      <div class="metadata-section" v-if="svgMetadata">
        <h2 class="section-title">SVG Metadata</h2>
        
        <div class="metadata-content">
          <div class="canvas-info">
            <h3 class="metadata-subtitle">Canvas Size</h3>
            <div class="info-row">
              <span>Width:</span>
              <span class="info-value">{{ svgMetadata.canvasSize.width }}px</span>
            </div>
            <div class="info-row">
              <span>Height:</span>
              <span class="info-value">{{ svgMetadata.canvasSize.height }}px</span>
            </div>
          </div>

          <div class="parts-info" v-if="svgMetadata.parts && svgMetadata.parts.length > 0">
            <h3 class="metadata-subtitle">Parts ({{ svgMetadata.parts.length }})</h3>
            <div class="parts-list">
              <div 
                v-for="(part, index) in svgMetadata.parts.slice(0, 20)" 
                :key="index"
                class="part-item"
              >
                <div class="part-header">
                  <span class="part-tag">{{ part.tag }}</span>
                  <span class="part-id" v-if="part.id">{{ part.id }}</span>
                </div>
                <div class="part-details">
                  <div class="detail-row">
                    <span>Position:</span>
                    <span>({{ part.x }}, {{ part.y }})</span>
                  </div>
                  <div class="detail-row" v-if="part.width > 0 || part.height > 0">
                    <span>Size:</span>
                    <span>{{ part.width }} × {{ part.height }}</span>
                  </div>
                  <div class="detail-row" v-if="part.transform">
                    <span>Transform:</span>
                    <span class="transform-text">{{ part.transform }}</span>
                  </div>
                </div>
              </div>
              <div v-if="svgMetadata.parts.length > 20" class="parts-truncated">
                ... and {{ svgMetadata.parts.length - 20 }} more parts
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import SVGViewer from './SVGViewer.vue'
import { useAavegotchi } from '../composables/useAavegotchi.js'
import { parseSVG } from '../utils/svgParser.js'
import { getContract } from '../utils/contract.js'

const props = defineProps({
  gotchiId: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['close'])

const { gotchiDataMap, svgDataMap } = useAavegotchi()

const gotchiData = ref(null)
const svgViews = ref(null)
const svgMetadata = ref(null)
const isLoading = ref(true)
const error = ref(null)
const copiedId = ref(null)
const styleElement = ref(null)

// Side views state
const sideViews = ref({})
const isLoadingSideViews = ref(false)
const currentViewIndex = ref(0)
const availableViews = ref(['Front'])

const currentSvgView = computed(() => {
  const viewName = availableViews.value[currentViewIndex.value] || 'Front'
  console.log('currentSvgView computed:', {
    viewName,
    currentViewIndex: currentViewIndex.value,
    hasSvgViews: !!svgViews.value,
    svgViewsLength: svgViews.value?.length,
    sideViews: Object.keys(sideViews.value),
    requestedSideView: sideViews.value[viewName] ? 'found' : 'not found'
  })
  
  if (viewName === 'Front') {
    const frontView = svgViews.value
    console.log('Returning front view:', frontView ? `${frontView.substring(0, 50)}...` : 'null')
    return frontView
  }
  const sideView = sideViews.value[viewName]
  if (sideView) {
    console.log(`Returning ${viewName} view:`, sideView ? `${sideView.substring(0, 50)}...` : 'null')
    return sideView
  }
  // Fallback to front view if side view not available
  console.log('Falling back to front view')
  return svgViews.value
})

const currentViewName = computed(() => {
  return availableViews.value[currentViewIndex.value] || 'Front'
})

// Watch for gotchi data from the map
watch(() => gotchiDataMap.value[props.gotchiId], async (newData) => {
  if (newData) {
    gotchiData.value = newData
    isLoading.value = false
    
    // Fetch side views when gotchi data is available
    await fetchSideViews()
  }
}, { immediate: true })

// Fetch side views for the gotchi
async function fetchSideViews() {
  if (!gotchiData.value) return
  
  isLoadingSideViews.value = true
  try {
    const contract = getContract()
    const tokenId = gotchiData.value.tokenId
    
    const newViews = ['Front']
    const newSideViews = {}
    
    // Try to fetch side views using getAavegotchiSideSvgs (returns [front, left, right, back])
    try {
      console.log('Attempting to fetch side views using getAavegotchiSideSvgs for token:', tokenId)
      const sidesResponse = await contract.getAavegotchiSideSvgs(tokenId)
      
      let sidesArray = []
      // Ethers might return a Proxy object that looks like an array
      // Check if it has numeric indices and length property
      if (sidesResponse && typeof sidesResponse === 'object') {
        if (typeof sidesResponse.length === 'number' && sidesResponse.length > 0) {
          // It's an array-like object (could be a real array or Proxy)
          // Convert to real array by accessing all indices
          sidesArray = []
          for (let i = 0; i < sidesResponse.length; i++) {
            if (sidesResponse[i] !== undefined) {
              sidesArray.push(sidesResponse[i])
            }
          }
        } else if (sidesResponse.ag_) {
          // Try to extract from ag_ property
          const agValue = sidesResponse.ag_
          if (Array.isArray(agValue)) {
            sidesArray = agValue
          } else if (typeof agValue === 'string') {
            sidesArray = [agValue]
          } else if (agValue && typeof agValue.length === 'number') {
            // Proxy array in ag_
            sidesArray = []
            for (let i = 0; i < agValue.length; i++) {
              if (agValue[i] !== undefined) {
                sidesArray.push(agValue[i])
              }
            }
          }
        } else if (Array.isArray(sidesResponse)) {
          // Real array
          sidesArray = sidesResponse
        }
      }
      
      console.log('Side views from getAavegotchiSideSvgs:', sidesArray)
      
      // Parse side views array - format: [front, left, right, back]
      if (sidesArray && sidesArray.length >= 4) {
        // [0] = front (already have this from svgViews), [1] = left, [2] = right, [3] = back
        newSideViews['Left'] = sidesArray[1]
        newSideViews['Right'] = sidesArray[2]
        newSideViews['Back'] = sidesArray[3]
        newViews.push('Left', 'Right', 'Back')
      } else if (sidesArray && sidesArray.length > 0) {
        // Handle partial arrays
        if (sidesArray.length >= 2) {
          newSideViews['Left'] = sidesArray[1]
          newViews.push('Left')
        }
        if (sidesArray.length >= 3) {
          newSideViews['Right'] = sidesArray[2]
          newViews.push('Right')
        }
        if (sidesArray.length >= 4) {
          newSideViews['Back'] = sidesArray[3]
          newViews.push('Back')
        }
      }
    } catch (getSidesError) {
      console.warn('getAavegotchiSideSvgs not available, trying previewSideAavegotchi:', getSidesError.message)
    }
    
    // Use previewSideAavegotchi as primary or fallback method
    if (gotchiData.value.hauntId !== undefined && gotchiData.value.collateral && gotchiData.value.numericTraits && gotchiData.value.equippedWearables) {
      try {
        console.log('Fetching preview side views using previewSideAavegotchi...')
        const previewResponse = await contract.previewSideAavegotchi(
          gotchiData.value.hauntId,
          gotchiData.value.collateral,
          gotchiData.value.numericTraits,
          gotchiData.value.equippedWearables
        )
        
        let previewArray = []
        if (Array.isArray(previewResponse)) {
          previewArray = previewResponse
        } else if (previewResponse && previewResponse.ag_) {
          previewArray = Array.isArray(previewResponse.ag_) ? previewResponse.ag_ : [previewResponse.ag_]
        }
        
        console.log('Preview side views:', previewArray)
        
        if (previewArray && previewArray.length > 0) {
          // previewSideAavegotchi returns [front, left, right, back] - same format as getAavegotchiSideSvgs
          // Merge with existing side views or use preview if getAavegotchiSideSvgs failed
          if (previewArray.length >= 4) {
            // [0] = front, [1] = left, [2] = right, [3] = back
            if (!newSideViews['Left']) {
              newSideViews['Left'] = previewArray[1]
              if (!newViews.includes('Left')) newViews.push('Left')
            }
            if (!newSideViews['Right']) {
              newSideViews['Right'] = previewArray[2]
              if (!newViews.includes('Right')) newViews.push('Right')
            }
            if (!newSideViews['Back']) {
              newSideViews['Back'] = previewArray[3]
              if (!newViews.includes('Back')) newViews.push('Back')
            }
          } else {
            // Handle partial arrays (shouldn't happen, but be safe)
            if (previewArray.length >= 2 && !newSideViews['Left']) {
              newSideViews['Left'] = previewArray[1]
              if (!newViews.includes('Left')) newViews.push('Left')
            }
            if (previewArray.length >= 3 && !newSideViews['Right']) {
              newSideViews['Right'] = previewArray[2]
              if (!newViews.includes('Right')) newViews.push('Right')
            }
            if (previewArray.length >= 4 && !newSideViews['Back']) {
              newSideViews['Back'] = previewArray[3]
              if (!newViews.includes('Back')) newViews.push('Back')
            }
          }
        }
      } catch (previewError) {
        console.warn('Failed to fetch preview side views:', previewError)
      }
    }
    
    sideViews.value = newSideViews
    availableViews.value = newViews
    currentViewIndex.value = 0 // Reset to front view
    
    console.log('Side views loaded:', {
      views: newViews,
      sideViews: Object.keys(newSideViews)
    })
    
  } catch (err) {
    console.error('Error fetching side views:', err)
    // Don't set error - just log it, we can still show front view
  } finally {
    isLoadingSideViews.value = false
  }
}

// Navigation functions
function nextView() {
  if (currentViewIndex.value < availableViews.value.length - 1) {
    currentViewIndex.value++
    // Apply styles for new view
    if (currentSvgView.value) {
      nextTick(() => {
        applySvgStyles(currentSvgView.value)
      })
    }
  }
}

function previousView() {
  if (currentViewIndex.value > 0) {
    currentViewIndex.value--
    // Apply styles for new view
    if (currentSvgView.value) {
      nextTick(() => {
        applySvgStyles(currentSvgView.value)
      })
    }
  }
}

// Extract and apply SVG styles (same logic as AavegotchiCard)
function applySvgStyles(svgString) {
  if (!svgString) return

  // Extract style content from SVG
  const styleMatch = svgString.match(/<style>(.*?)<\/style>/s)
  if (!styleMatch) {
    console.warn(`Stage [${props.gotchiId}] - No style tag found in SVG`)
    return
  }

  const styleContent = styleMatch[1]
  
  // Remove any existing style element for this component
  if (styleElement.value) {
    styleElement.value.remove()
    styleElement.value = null
  }

  // Create a scoped style element that applies only to this SVG
  const styleId = `gotchi-stage-style-${props.gotchiId}`
  
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
    .replace(/\.gotchi-([\w-]+)\s*\{/g, `svg[data-gotchi-stage-id="${props.gotchiId}"] .gotchi-$1 {`)
  
  newStyleElement.textContent = scopedStyles
  document.head.appendChild(newStyleElement)
  styleElement.value = newStyleElement
  
  console.log(`Stage [${props.gotchiId}] - Applied extracted styles`)
}

// Watch for SVG data from the map when gotchi data is available
watch(() => {
  const data = gotchiData.value
  if (!data) return null
  const svgs = svgDataMap.value[props.gotchiId]
  console.log('Stage watching SVG data for token', props.gotchiId, ':', {
    hasSvgs: !!svgs,
    isString: typeof svgs === 'string',
    svgsLength: svgs?.length,
    svgsValue: svgs ? svgs.substring(0, 100) + '...' : null
  })
  return svgs
}, async (svgs) => {
  console.log('SVG data changed in Stage for token', props.gotchiId, ':', {
    hasSvgs: !!svgs,
    type: typeof svgs,
    length: svgs?.length,
    preview: svgs ? svgs.substring(0, 100) + '...' : null
  })
  if (svgs && typeof svgs === 'string' && svgs.length > 0) {
    // svgs is now a single string, not an object
    svgViews.value = svgs
    console.log('Set svgViews.value to:', svgViews.value ? `${svgViews.value.substring(0, 50)}...` : 'null')
    
    // Apply extracted styles
    await nextTick()
    applySvgStyles(svgs)
    
    // Parse metadata from the SVG string
    try {
      console.log('Parsing SVG metadata, length:', svgs.length)
      svgMetadata.value = parseSVG(svgs)
      console.log('SVG metadata parsed:', {
        canvasSize: svgMetadata.value?.canvasSize,
        partsCount: svgMetadata.value?.parts?.length
      })
    } catch (err) {
      console.error('Error parsing SVG:', err)
    }
  } else {
    console.warn('No valid SVG data available for token', props.gotchiId, ':', {
      svgs,
      type: typeof svgs,
      length: svgs?.length
    })
    svgViews.value = null
  }
}, { immediate: true })

// Watch for current SVG view changes to apply styles
watch(currentSvgView, async (newSvg) => {
  if (newSvg) {
    await nextTick()
    applySvgStyles(newSvg)
  }
})

onUnmounted(() => {
  // Clean up style element when component is destroyed
  if (styleElement.value) {
    styleElement.value.remove()
  }
})

async function copyToClipboard(text, id) {
  if (!text) return
  
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => {
      copiedId.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.stage-container {
  @apply w-full p-6 max-w-7xl mx-auto;
}

.close-btn {
  @apply mb-6 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors font-medium;
}

.loading-container,
.error-container {
  @apply flex flex-col items-center justify-center py-12 gap-4;
}

.loading-spinner {
  @apply w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin;
}

.error-text {
  @apply text-red-600 font-medium;
}

.stage-content {
  @apply space-y-8;
}

.info-section {
  @apply bg-white rounded-lg p-6 shadow-md;
}

.gotchi-title {
  @apply text-3xl font-bold mb-6 flex flex-col sm:flex-row gap-2 items-baseline;
}

.gotchi-id {
  @apply text-blue-600;
}

.gotchi-name {
  @apply text-gray-800;
}

.stats-grid {
  @apply grid grid-cols-3 gap-4 mb-6;
}

.stat-card {
  @apply bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg p-4 text-center;
}

.stat-label {
  @apply text-sm text-purple-700 font-medium mb-1;
}

.stat-value {
  @apply text-2xl font-bold text-purple-900;
}

.traits-grid {
  @apply grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3;
}

.trait-item {
  @apply bg-gray-100 rounded-lg p-3 text-center;
}

.trait-label {
  @apply text-xs text-gray-600 block mb-1;
}

.trait-value {
  @apply text-lg font-bold text-gray-800;
}

.svg-section {
  @apply bg-white rounded-lg p-6 shadow-md;
}

.svg-header {
  @apply flex items-center justify-between mb-6;
}

.section-title {
  @apply text-2xl font-bold text-gray-800;
}

.view-controls {
  @apply flex items-center gap-3;
}

.nav-btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  @apply disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300;
  @apply font-bold text-lg min-w-[50px];
}

.view-indicator {
  @apply px-4 py-2 bg-gray-100 rounded-lg font-semibold text-gray-700 min-w-[80px] text-center;
}

.loading-overlay {
  @apply absolute inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center gap-2 z-10 rounded-lg;
}

.loading-spinner-small {
  @apply w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin;
}

.svg-loading-fallback {
  @apply flex flex-col items-center justify-center gap-4 p-8 bg-gray-50 rounded-lg border-2 border-gray-200;
  min-height: 300px;
}

.debug-info {
  @apply text-sm text-gray-500 italic;
}

.svg-view-container {
  @apply flex flex-col gap-6 relative;
}

.svg-view-item {
  @apply flex flex-col gap-4;
}

.view-title {
  @apply text-lg font-semibold text-gray-700;
}

.metadata-section {
  @apply bg-white rounded-lg p-6 shadow-md;
}

.metadata-content {
  @apply space-y-6;
}

.canvas-info {
  @apply bg-blue-50 rounded-lg p-4;
}

.metadata-subtitle {
  @apply text-lg font-semibold mb-4 text-gray-800;
}

.info-row {
  @apply flex justify-between items-center py-2 border-b border-gray-200 last:border-0;
}

.info-value {
  @apply font-mono font-semibold text-blue-600;
}

.parts-info {
  @apply mt-6;
}

.parts-list {
  @apply space-y-3 max-h-96 overflow-y-auto;
}

.part-item {
  @apply bg-gray-50 rounded-lg p-3 border border-gray-200;
}

.part-header {
  @apply flex items-center gap-2 mb-2;
}

.part-tag {
  @apply bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-mono font-semibold;
}

.part-id {
  @apply text-xs text-gray-600 font-mono;
}

.part-details {
  @apply space-y-1 text-sm;
}

.detail-row {
  @apply flex justify-between text-gray-700;
}

.transform-text {
  @apply font-mono text-xs break-all max-w-xs;
}

.parts-truncated {
  @apply text-center text-gray-500 italic py-2;
}

.svg-code-section {
  @apply bg-white rounded-lg p-6 shadow-md;
}

.svg-code-container {
  @apply space-y-4;
}

.svg-code-block {
  @apply bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono;
  @apply border border-gray-700;
  max-height: 400px;
  overflow-y: auto;
}

.svg-code-block.small {
  @apply text-xs;
  max-height: 200px;
}

.svg-code-block code {
  @apply text-green-400;
  white-space: pre;
}

.copy-code-btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  @apply font-medium;
}

.copy-code-btn.small {
  @apply px-3 py-1.5 text-sm;
}

.copy-code-btn.copied {
  @apply bg-green-600 hover:bg-green-700;
}

.svg-code-wrapper {
  @apply mt-4 space-y-2;
}

.svg-code-details {
  @apply bg-gray-50 rounded-lg border border-gray-200;
}

.code-summary {
  @apply px-4 py-2 cursor-pointer hover:bg-gray-100 font-medium text-sm text-gray-700;
}
</style>

