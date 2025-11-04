<template>
  <div id="app" class="min-h-screen">
      <header class="bg-white dark:bg-gray-800 shadow-md transition-colors">
        <div class="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Aavegotchi Viewer</h1>
          <div class="flex items-center gap-4">
            <!-- Theme Toggle Button -->
            <button
              @click="toggleTheme"
              class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            >
              <svg v-if="!isDark" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            
            <div v-if="connected" class="flex items-center gap-3">
              <span class="text-sm text-gray-600 dark:text-gray-300">{{ shortAddress }}</span>
              <button 
                @click="disconnect" 
                class="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
              >
                Disconnect
              </button>
            </div>
            <appkit-button v-else />
          </div>
        </div>
      </header>

      <main class="container mx-auto py-6">
        <div v-if="!connected" class="text-center py-12">
          <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg p-8 shadow-md transition-colors">
            <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Connect Your Wallet</h2>
            <p class="text-gray-600 dark:text-gray-300 mb-6">Connect your wallet to view your Aavegotchis on Base chain.</p>
            <appkit-button />
          </div>
        </div>

        <div v-else class="app-content">
          <Gallery 
            v-if="!selectedGotchiId"
            :selected-gotchi-id="selectedGotchiId"
            @select="handleSelectGotchi"
          />
          <Stage 
            v-else
            :gotchi-id="selectedGotchiId"
            @close="selectedGotchiId = null"
          />
        </div>
      </main>
    </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useWallet } from './composables/useWallet.js'
import { useTheme } from './composables/useTheme.js'
import Gallery from './components/Gallery.vue'
import Stage from './components/Stage.vue'

const { isConnected, shortAddress, address, disconnect } = useWallet()
const { isDark, toggleTheme } = useTheme()
const selectedGotchiId = ref(null)

// Ensure isConnected is reactive - Vue templates auto-unwrap refs
const connected = computed(() => {
  // isConnected should already be a computed from useWallet
  const value = isConnected.value
  console.log('App computed connected state:', value, 'address:', address.value)
  return !!value
})

// Debug connection state
watch(isConnected, (connected) => {
  console.log('isConnected watch triggered:', connected, 'value:', typeof connected === 'object' && 'value' in connected ? connected.value : connected)
  if (address?.value) {
    console.log('Address:', address.value)
  }
}, { immediate: true })

// Watch address only if it's a valid ref
watch(() => address?.value, (addr) => {
  console.log('Address changed:', addr)
  if (addr) {
    console.log('Address is now:', addr, 'isConnected:', typeof isConnected === 'object' && 'value' in isConnected ? isConnected.value : isConnected)
  }
}, { immediate: true })

function handleSelectGotchi(tokenId) {
  selectedGotchiId.value = tokenId
}
</script>

<style scoped>
.app-content {
  @apply min-h-[60vh];
}
</style>
