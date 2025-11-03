<template>
  <div class="svg-viewer-container">
    <div 
      ref="svgDisplay"
      class="svg-display" 
      v-html="svgString" 
      v-if="svgString && svgString.length > 0"
      :key="`svg-${props.gotchiId}-${props.viewName}-${svgString.length}`"
    ></div>
    <div v-else class="svg-placeholder">
      <div class="loading-spinner"></div>
      <p>Loading SVG...</p>
    </div>
    <button 
      @click="copySVG" 
      class="copy-btn"
      :class="{ 'copied': isCopied }"
    >
      {{ isCopied ? '✓ Copied!' : 'Copy SVG' }}
    </button>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  svgString: {
    type: String,
    default: ''
  },
  viewName: {
    type: String,
    default: 'SVG'
  },
  gotchiId: {
    type: Number,
    default: null
  },
  dataAttribute: {
    type: String,
    default: 'data-gotchi-stage-id'
  }
})

const isCopied = ref(false)
const svgDisplay = ref(null)

// Add data attribute to SVG for style scoping
watch(() => [props.svgString, props.gotchiId], async () => {
  if (props.svgString && props.svgString.length > 0 && props.gotchiId !== null) {
    console.log(`SVGViewer - Watching for SVG changes, gotchiId: ${props.gotchiId}, viewName: ${props.viewName}, svgLength: ${props.svgString.length}`)
    
    // Wait for v-html to render the SVG
    await nextTick()
    
    if (!svgDisplay.value) {
      console.warn('SVGViewer - svgDisplay ref is null')
      return
    }
    
    // Retry finding the SVG element (sometimes v-html needs a moment)
    let svgElement = svgDisplay.value.querySelector('svg')
    let attempts = 0
    while (!svgElement && attempts < 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      svgElement = svgDisplay.value.querySelector('svg')
      attempts++
    }
    
    if (svgElement) {
      svgElement.setAttribute(props.dataAttribute, props.gotchiId)
      
      // Ensure SVG has proper sizing
      const viewBox = svgElement.getAttribute('viewBox')
      if (viewBox && !svgElement.hasAttribute('width') && !svgElement.hasAttribute('height')) {
        // Set width to scale properly, height will auto from viewBox aspect ratio
        svgElement.setAttribute('width', '100%')
        svgElement.style.width = '100%'
        svgElement.style.maxWidth = '500px'
        svgElement.style.height = 'auto'
        svgElement.style.display = 'block'
      }
      
      console.log(`SVGViewer - Added ${props.dataAttribute}="${props.gotchiId}" to SVG`, {
        viewBox: svgElement.getAttribute('viewBox'),
        width: svgElement.getAttribute('width'),
        height: svgElement.getAttribute('height'),
        computedWidth: window.getComputedStyle(svgElement).width,
        computedHeight: window.getComputedStyle(svgElement).height,
        svgDisplayHeight: window.getComputedStyle(svgDisplay.value).height
      })
    } else {
      console.error(`SVGViewer - Could not find SVG element for gotchi ${props.gotchiId} after ${attempts} attempts`)
      console.error('SVGViewer - svgDisplay contents:', svgDisplay.value.innerHTML.substring(0, 200))
    }
  }
}, { immediate: true })

async function copySVG() {
  if (!props.svgString) return
  
  try {
    await navigator.clipboard.writeText(props.svgString)
    isCopied.value = true
    setTimeout(() => {
      isCopied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}
</script>

<style scoped>
.svg-viewer-container {
  @apply flex flex-col items-center gap-4;
}

.svg-display {
  @apply bg-white rounded-lg p-4 border-2 border-gray-200;
  max-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  width: 100%;
}

.svg-display :deep(svg) {
  width: 100%;
  max-width: 500px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.svg-display :deep(svg[viewBox]) {
  /* Ensure SVGs with viewBox scale properly */
  width: 100%;
  max-width: 500px;
  height: auto;
}

.svg-placeholder {
  @apply bg-gray-100 rounded-lg p-8 border-2 border-gray-200;
  @apply flex flex-col items-center justify-center gap-2;
  min-height: 200px;
  min-width: 200px;
}

.loading-spinner {
  @apply w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin;
}

.copy-btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
  @apply font-medium min-w-[120px];
}

.copy-btn.copied {
  @apply bg-green-600 hover:bg-green-700;
}
</style>

