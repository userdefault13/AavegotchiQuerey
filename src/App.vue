<template>
  <div id="app" class="min-h-screen">
      <header class="bg-white shadow-md">
        <div class="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 class="text-2xl font-bold text-gray-800">Aavegotchi Viewer</h1>
          <div class="flex items-center gap-4">
            <div v-if="connected" class="flex items-center gap-3">
              <span class="text-sm text-gray-600">{{ shortAddress }}</span>
              <button 
                @click="disconnect" 
                class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
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
          <div class="max-w-md mx-auto bg-white rounded-lg p-8 shadow-md">
            <h2 class="text-2xl font-bold mb-4 text-gray-800">Connect Your Wallet</h2>
            <p class="text-gray-600 mb-6">Connect your wallet to view your Aavegotchis on Base chain.</p>
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
import Gallery from './components/Gallery.vue'
import Stage from './components/Stage.vue'

const { isConnected, shortAddress, address, disconnect } = useWallet()
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
