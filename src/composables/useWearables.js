import { ref, computed, watch } from 'vue'
import { useQueries } from '@tanstack/vue-query'
import { getContract } from '../utils/contract.js'
import { getCachedSvg, cacheSvg, getCachedType, cacheType } from '../utils/wearableCache.js'

export function useWearables() {
  const isLoadingWearables = ref(false)
  const wearablesError = ref(null)
  const loadedCount = ref(0) // Track how many wearables we've loaded
  const batchSize = 25 // Load 25 wearables at a time (reduced for slower loading)
  const batchDelay = 1500 // Wait 1.5 seconds between batches (increased delay to avoid rate limits)
  const bodyWearableIds = ref(new Set()) // Track which IDs are Body (slot 0) wearables
  
  // Generate a list of wearable IDs (1-420 as there are only 420 total items)
  // In production, this should come from contract or API
  const MAX_WEARABLE_ID = 420
  const wearableIds = computed(() => {
    const ids = []
    // Common wearable IDs range (adjust based on actual contract)
    for (let i = 1; i <= MAX_WEARABLE_ID; i++) {
      ids.push(i)
    }
    return ids
  })
  
  // Get IDs to load - prioritize Body wearables once we know them
  const idsToLoad = computed(() => {
    const allIds = wearableIds.value
    const loaded = allIds.slice(0, loadedCount.value)
    
    // If we have Body wearable IDs discovered, prioritize them
    if (bodyWearableIds.value.size > 0 && loadedCount.value < allIds.length) {
      const bodyIds = Array.from(bodyWearableIds.value).filter(id => id <= loadedCount.value)
      const otherIds = loaded.filter(id => !bodyWearableIds.value.has(id))
      // Put Body wearables first
      return [...bodyIds, ...otherIds]
    }
    
    return loaded
  })
  
  // Progress tracking
  const loadingProgress = computed(() => {
    const total = wearableIds.value.length
    const loaded = loadedCount.value
    const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0
    return {
      loaded,
      total,
      percentage
    }
  })
  
  // Fetch item type information to get slot positions
  const wearableTypeQueries = useQueries({
    queries: computed(() => {
      const ids = idsToLoad.value
      
      return ids.map(wearableId => {
        return {
          queryKey: ['wearable-type', wearableId],
          queryFn: async () => {
            // Skip invalid wearable IDs (only 420 items exist)
            if (wearableId > MAX_WEARABLE_ID || wearableId < 1) {
              return null
            }
            
            try {
              // Check cache first
              const cached = await getCachedType(wearableId)
              if (cached) {
                return cached
              }
              
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
              
              const result = {
                name: itemType?.name || `Wearable #${wearableId}`,
                slot: slot !== null ? slot : null,
                category: itemType?.category || 0,
                slotPositions: itemType?.slotPositions || []
              }
              
              // Cache the result (don't await to avoid blocking)
              cacheType(wearableId, result).catch(() => {
                // Silently fail - caching failures shouldn't break the app
              })
              
              return result
            } catch (error) {
              // If getItemType fails, the wearable might not exist
              // Only log errors that aren't "ItemsFacet: Item type doesn't exist" or "missing revert data" to reduce noise
              const isKnownError = error.message?.includes("ItemsFacet: Item type doesn't exist") || 
                                   error.message?.includes("Item type doesn't exist") ||
                                   error.message?.includes("missing revert data") ||
                                   error.code === 'CALL_EXCEPTION'
              if (!isKnownError) {
                console.warn(`Failed to fetch item type for wearable ${wearableId}:`, error.message)
              }
              return null
            }
          },
          enabled: true,
          staleTime: 1000 * 60 * 10, // Cache for 10 minutes (slot data doesn't change often)
          retry: (failureCount, error) => {
            // Don't retry on rate limit errors (429) - they'll resolve when rate limit resets
            if (error?.message?.includes('429') || error?.message?.includes('compute units per second') || error?.code === 429) {
              return false
            }
            // Only retry once for other errors to avoid too many failed requests
            return failureCount < 1
          },
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
        }
      })
    })
  })
  
  // Watch for Body (slot 0) wearables and track them
  watch(wearableTypeQueries, (queries) => {
    queries.forEach((query, index) => {
      if (query.data && query.data.slot === 0) {
        const wearableId = idsToLoad.value[index]
        if (wearableId) {
          bodyWearableIds.value.add(wearableId)
        }
      }
    })
  }, { deep: true })
  
  // Fetch individual wearable SVGs using getItemSvg
  // This gets the standalone wearable SVG with proper dimensions (e.g., item8.svg)
  const wearableSvgQueries = useQueries({
    queries: computed(() => {
      const ids = idsToLoad.value
      
      return ids.map(wearableId => {
        return {
          queryKey: ['wearable-svg', wearableId],
          queryFn: async () => {
            // Skip invalid wearable IDs (only 420 items exist)
            if (wearableId > MAX_WEARABLE_ID || wearableId < 1) {
              return null
            }
            
            try {
              // Check cache first
              const cached = await getCachedSvg(wearableId)
              if (cached) {
                return cached
              }
              
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
                
                // Cache the result (don't await to avoid blocking)
                cacheSvg(wearableId, svgString).catch(() => {
                  // Silently fail - caching failures shouldn't break the app
                })
                
                return svgString
              }
              
              return null
            } catch (error) {
              // If getItemSvg fails, the wearable might not exist
              // Only log errors that aren't known "not found" or "missing revert data" errors to reduce noise
              const isKnownError = error.message?.includes('ItemsFacet: _id not found for item') || 
                                   error.message?.includes('_id not found for item') ||
                                   error.message?.includes("missing revert data") ||
                                   error.code === 'CALL_EXCEPTION'
              if (!isKnownError) {
                console.warn(`Failed to fetch SVG for wearable ${wearableId}:`, error.message)
              }
              return null
            }
          },
          enabled: true, // No need for gotchi data - we can fetch wearable SVGs directly
          staleTime: 1000 * 60 * 5, // Cache for 5 minutes
          retry: (failureCount, error) => {
            // Don't retry on rate limit errors (429) - they'll resolve when rate limit resets
            if (error?.message?.includes('429') || error?.message?.includes('compute units per second') || error?.code === 429) {
              return false
            }
            // Only retry once for other errors to avoid too many failed requests
            return failureCount < 1
          },
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
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
  
  // Function to load wearables in batches
  const loadWearablesInBatches = async () => {
    if (isLoadingWearables.value) return // Already loading
    
    isLoadingWearables.value = true
    wearablesError.value = null
    
    try {
      const total = wearableIds.value.length
      let currentBatch = 0
      
      while (loadedCount.value < total) {
        // Calculate next batch size
        const nextCount = Math.min(loadedCount.value + batchSize, total)
        loadedCount.value = nextCount
        
        // Wait longer for queries to process and avoid rate limits
        await new Promise(resolve => setTimeout(resolve, batchDelay))
        
        currentBatch++
        console.log(`Loading batch ${currentBatch}: ${loadedCount.value}/${total} wearables`)
      }
      
      console.log('Finished loading all wearable batches')
      // Don't set isLoadingWearables to false here - let the computed property handle it
      // when queries actually finish
    } catch (error) {
      console.error('Error loading wearables in batches:', error)
      wearablesError.value = error.message || 'Failed to load wearables'
      isLoadingWearables.value = false
    }
  }
  
  // Start loading when composable is created
  loadWearablesInBatches()
  
  // Watch for when loading actually completes
  watch([wearableSvgQueries, wearableTypeQueries, () => loadedCount.value], () => {
    const batchesLoading = loadedCount.value < wearableIds.value.length
    const queriesLoading = wearableSvgQueries.value.some(q => q.isLoading || q.isFetching) || 
           wearableTypeQueries.value.some(q => q.isLoading || q.isFetching)
    
    // Update flag when everything is done
    if (!batchesLoading && !queriesLoading) {
      isLoadingWearables.value = false
    }
  }, { deep: true })
  
  // Update loading state - check both SVG and type queries
  const isLoading = computed(() => {
    // Check if batches are still loading
    const batchesLoading = loadedCount.value < wearableIds.value.length
    
    // Check if queries are still loading or fetching
    const queriesLoading = wearableSvgQueries.value.some(q => q.isLoading || q.isFetching) || 
           wearableTypeQueries.value.some(q => q.isLoading || q.isFetching)
    
    return batchesLoading || queriesLoading
  })
  
  return {
    isLoadingWearables: isLoading,
    wearablesError,
    wearables,
    getWearablesBySlot,
    wearableSvgsMap, // Export the SVG map for validation
    loadingProgress // Export progress tracking
  }
}
