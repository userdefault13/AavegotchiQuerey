import { ref, computed } from 'vue'
import { useQueries } from '@tanstack/vue-query'
import { getContract } from '../utils/contract.js'

export function useWearables() {
  const isLoadingWearables = ref(false)
  const wearablesError = ref(null)
  const loadedCount = ref(100) // Start with first 100, load more as needed
  
  // Generate a list of wearable IDs (0-1000 as a reasonable range)
  // In production, this should come from contract or API
  const wearableIds = computed(() => {
    const ids = []
    // Common wearable IDs range (adjust based on actual contract)
    for (let i = 1; i <= 1000; i++) {
      ids.push(i)
    }
    return ids
  })
  
  // Get IDs to load based on loadedCount
  const idsToLoad = computed(() => {
    return wearableIds.value.slice(0, loadedCount.value)
  })
  
  // Function to load more wearables
  const loadMoreWearables = () => {
    const nextCount = Math.min(loadedCount.value + 100, wearableIds.value.length)
    if (nextCount > loadedCount.value) {
      loadedCount.value = nextCount
    }
  }
  
  // Check if more wearables can be loaded
  const hasMoreWearables = computed(() => {
    return loadedCount.value < wearableIds.value.length
  })
  
  // Fetch individual wearable SVGs using getItemSvg
  // This gets the standalone wearable SVG with proper dimensions (e.g., item8.svg)
  const wearableSvgQueries = useQueries({
    queries: computed(() => {
      const ids = idsToLoad.value
      
      return ids.map(wearableId => {
        return {
          queryKey: ['wearable-svg', wearableId],
          queryFn: async () => {
            try {
              const contract = getContract()
              
              // Use getItemSvg which is specifically designed for wearable items
              // This function returns the SVG with proper dimensions included
              const response = await contract.getItemSvg(wearableId)
              
              // Parse response - getItemSvg returns a string directly or object with ag_ property
              let svgString = null
              if (typeof response === 'string') {
                svgString = response
              } else if (response && typeof response === 'object' && response.ag_) {
                svgString = response.ag_
              } else if (response && typeof response === 'object' && response.length === 1) {
                svgString = response[0]
              }
              
              if (svgString && typeof svgString === 'string' && svgString.trim().length > 0) {
                console.log(`Fetched SVG for wearable ${wearableId}, length: ${svgString.length}`)
                return svgString
              }
              
              return null
            } catch (error) {
              // If getItemSvg fails, the wearable might not exist
              // Only log errors that aren't "ItemsFacet: _id not found for item" to reduce noise
              if (!error.message?.includes('ItemsFacet: _id not found for item') && !error.message?.includes('_id not found for item')) {
                console.warn(`Failed to fetch SVG for wearable ${wearableId}:`, error.message)
              }
              return null
            }
          },
          enabled: true, // No need for gotchi data - we can fetch wearable SVGs directly
          staleTime: 1000 * 60 * 5, // Cache for 5 minutes
          retry: 1, // Only retry once to avoid too many failed requests
        }
      })
    })
  })

  // Fetch item type information to get slot positions
  const wearableTypeQueries = useQueries({
    queries: computed(() => {
      const ids = idsToLoad.value
      
      return ids.map(wearableId => {
        return {
          queryKey: ['wearable-type', wearableId],
          queryFn: async () => {
            try {
              const contract = getContract()
              
              // Get item type information including slotPositions
              const itemType = await contract.getItemType(wearableId)
              
              // Extract slot from slotPositions array
              // Find the first slot index where slotPositions[slot] === true
              // Slots: 0=Body, 1=Face, 2=Eyes, 3=Head, 4=Left Hand, 5=Right Hand, 6=Pet, 7=Background
              let slot = null
              if (itemType && itemType.slotPositions && Array.isArray(itemType.slotPositions)) {
                for (let i = 0; i < itemType.slotPositions.length; i++) {
                  if (itemType.slotPositions[i] === true) {
                    slot = i
                    break
                  }
                }
              }
              
              return {
                name: itemType?.name || `Wearable #${wearableId}`,
                slot: slot !== null ? slot : null,
                category: itemType?.category || 0,
                slotPositions: itemType?.slotPositions || []
              }
            } catch (error) {
              // If getItemType fails, the wearable might not exist
              // Only log errors that aren't "ItemsFacet: Item type doesn't exist" to reduce noise
              if (!error.message?.includes("ItemsFacet: Item type doesn't exist") && !error.message?.includes("Item type doesn't exist")) {
                console.warn(`Failed to fetch item type for wearable ${wearableId}:`, error.message)
              }
              return null
            }
          },
          enabled: true,
          staleTime: 1000 * 60 * 10, // Cache for 10 minutes (slot data doesn't change often)
          retry: 1,
        }
      })
    })
  })
  
  // Create a map of wearable ID to SVG
  const wearableSvgsMap = computed(() => {
    const map = {}
    const ids = idsToLoad.value
    wearableSvgQueries.value.forEach((query, index) => {
      const wearableId = ids[index]
      if (query.data && wearableId) {
        map[wearableId] = query.data
      }
    })
    return map
  })

  // Create a map of wearable ID to slot
  const wearableSlotMap = computed(() => {
    const map = {}
    const ids = idsToLoad.value
    wearableTypeQueries.value.forEach((query, index) => {
      const wearableId = ids[index]
      if (query.data && query.data.slot !== null && wearableId) {
        map[wearableId] = query.data.slot
      }
    })
    return map
  })

  // Create a map of wearable ID to name
  const wearableNameMap = computed(() => {
    const map = {}
    const ids = idsToLoad.value
    wearableTypeQueries.value.forEach((query, index) => {
      const wearableId = ids[index]
      if (query.data && query.data.name && wearableId) {
        map[wearableId] = query.data.name
      }
    })
    return map
  })
  
  // Generate fallback thumbnail if SVG fetch fails
  const generateWearableThumbnail = (id) => {
    const size = 64
    const fontSize = 20
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2" rx="4"/>
      <text x="${size/2}" y="${size/2}" font-family="monospace" font-size="${fontSize}" fill="#374151" text-anchor="middle" dominant-baseline="middle" font-weight="bold">#${id}</text>
    </svg>`
  }
  
  // Return wearable data with fetched SVGs and real slot data
  // Only include wearables that have been loaded
  const wearables = computed(() => {
    return idsToLoad.value.map(id => {
      const svg = wearableSvgsMap.value[id]
      const slot = wearableSlotMap.value[id] ?? null // Use real slot from contract, or null if not found
      const name = wearableNameMap.value[id] || `Wearable #${id}`
      
      return {
        id,
        name,
        slot: slot !== null ? slot : null, // Use real slot from contract
        rarity: null,
        thumbnail: svg || generateWearableThumbnail(id) // Use fetched SVG or fallback
      }
    })
  })
  
  // Filter wearables by slot (if we have slot data)
  const getWearablesBySlot = (slot) => {
    if (slot === undefined || slot === null) {
      // If no slot specified, return all wearables
      return wearables.value
    }
    // Otherwise, only return wearables that match the slot (filter out null slots)
    return wearables.value.filter(w => w.slot === slot)
  }
  
  // Update loading state - check both SVG and type queries
  const isLoading = computed(() => {
    return wearableSvgQueries.value.some(q => q.isLoading) || 
           wearableTypeQueries.value.some(q => q.isLoading)
  })
  
  return {
    isLoadingWearables: isLoading,
    wearablesError,
    wearables,
    getWearablesBySlot,
    wearableSvgsMap, // Export the SVG map for validation
    loadMoreWearables, // Function to load more wearables
    hasMoreWearables // Computed to check if more can be loaded
  }
}

