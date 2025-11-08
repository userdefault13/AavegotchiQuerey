/**
 * IndexedDB cache for wearable SVGs and metadata
 * Provides persistent local storage for wearables across page reloads
 */

const DB_NAME = 'aavegotchi-wearables-cache'
const DB_VERSION = 1
const STORE_SVG = 'wearable-svgs'
const STORE_TYPE = 'wearable-types'

let db = null

/**
 * Check if IndexedDB is available
 */
function isIndexedDBAvailable() {
  return typeof window !== 'undefined' && 'indexedDB' in window
}

/**
 * Initialize IndexedDB database
 */
async function initDB() {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in this browser')
  }
  
  if (db) return db
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }
    
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result
      
      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains(STORE_SVG)) {
        const svgStore = database.createObjectStore(STORE_SVG, { keyPath: 'id' })
        svgStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
      
      if (!database.objectStoreNames.contains(STORE_TYPE)) {
        const typeStore = database.createObjectStore(STORE_TYPE, { keyPath: 'id' })
        typeStore.createIndex('timestamp', 'timestamp', { unique: false })
      }
    }
  })
}

/**
 * Get cached SVG for a wearable
 * @param {number} wearableId - The wearable ID
 * @returns {Promise<string|null>} - Cached SVG string or null if not found
 */
export async function getCachedSvg(wearableId) {
  if (!isIndexedDBAvailable()) {
    return null
  }
  
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_SVG], 'readonly')
      const store = transaction.objectStore(STORE_SVG)
      const request = store.get(wearableId)
      
      request.onsuccess = () => {
        const result = request.result
        if (result && result.svg) {
          // Check if cache is still valid (30 days)
          const cacheAge = Date.now() - result.timestamp
          const maxAge = 1000 * 60 * 60 * 24 * 30 // 30 days
          
          if (cacheAge < maxAge) {
            resolve(result.svg)
          } else {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }
      
      request.onerror = () => {
        console.warn(`Error reading cached SVG for ${wearableId}:`, request.error)
        resolve(null) // Don't reject, just return null
      }
    })
  } catch (error) {
    console.warn('Error accessing cache for SVG:', error)
    return null
  }
}

/**
 * Cache a wearable SVG
 * @param {number} wearableId - The wearable ID
 * @param {string} svg - The SVG string to cache
 */
export async function cacheSvg(wearableId, svg) {
  if (!svg || !isIndexedDBAvailable()) {
    return
  }
  
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_SVG], 'readwrite')
      const store = transaction.objectStore(STORE_SVG)
      const request = store.put({
        id: wearableId,
        svg: svg,
        timestamp: Date.now()
      })
      
      request.onsuccess = () => {
        resolve()
      }
      
      request.onerror = () => {
        console.warn(`Error caching SVG for ${wearableId}:`, request.error)
        resolve() // Don't reject, caching failures shouldn't break the app
      }
    })
  } catch (error) {
    console.warn('Error caching SVG:', error)
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Get cached type data for a wearable
 * @param {number} wearableId - The wearable ID
 * @returns {Promise<object|null>} - Cached type data or null if not found
 */
export async function getCachedType(wearableId) {
  if (!isIndexedDBAvailable()) {
    return null
  }
  
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_TYPE], 'readonly')
      const store = transaction.objectStore(STORE_TYPE)
      const request = store.get(wearableId)
      
      request.onsuccess = () => {
        const result = request.result
        if (result && result.data) {
          // Check if cache is still valid (30 days)
          const cacheAge = Date.now() - result.timestamp
          const maxAge = 1000 * 60 * 60 * 24 * 30 // 30 days
          
          if (cacheAge < maxAge) {
            resolve(result.data)
          } else {
            resolve(null)
          }
        } else {
          resolve(null)
        }
      }
      
      request.onerror = () => {
        console.warn(`Error reading cached type for ${wearableId}:`, request.error)
        resolve(null) // Don't reject, just return null
      }
    })
  } catch (error) {
    console.warn('Error accessing cache for type:', error)
    return null
  }
}

/**
 * Cache wearable type data
 * @param {number} wearableId - The wearable ID
 * @param {object} typeData - The type data to cache
 */
export async function cacheType(wearableId, typeData) {
  if (!typeData || !isIndexedDBAvailable()) {
    return
  }
  
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_TYPE], 'readwrite')
      const store = transaction.objectStore(STORE_TYPE)
      const request = store.put({
        id: wearableId,
        data: typeData,
        timestamp: Date.now()
      })
      
      request.onsuccess = () => {
        resolve()
      }
      
      request.onerror = () => {
        console.warn(`Error caching type for ${wearableId}:`, request.error)
        resolve() // Don't reject, caching failures shouldn't break the app
      }
    })
  } catch (error) {
    console.warn('Error caching type:', error)
    // Don't throw - caching failures shouldn't break the app
  }
}

/**
 * Clear all cached wearables
 */
export async function clearCache() {
  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available in this browser')
  }
  
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_SVG, STORE_TYPE], 'readwrite')
      
      const svgStore = transaction.objectStore(STORE_SVG)
      const typeStore = transaction.objectStore(STORE_TYPE)
      
      const svgRequest = svgStore.clear()
      const typeRequest = typeStore.clear()
      
      let completed = 0
      const checkComplete = () => {
        completed++
        if (completed === 2) {
          console.log('Cache cleared')
          resolve()
        }
      }
      
      svgRequest.onsuccess = checkComplete
      typeRequest.onsuccess = checkComplete
      
      svgRequest.onerror = () => {
        console.warn('Error clearing SVG cache:', svgRequest.error)
        checkComplete()
      }
      
      typeRequest.onerror = () => {
        console.warn('Error clearing type cache:', typeRequest.error)
        checkComplete()
      }
    })
  } catch (error) {
    console.warn('Error clearing cache:', error)
    throw error
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
  if (!isIndexedDBAvailable()) {
    return { svgCount: 0, typeCount: 0, total: 0 }
  }
  
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_SVG, STORE_TYPE], 'readonly')
      
      const svgStore = transaction.objectStore(STORE_SVG)
      const typeStore = transaction.objectStore(STORE_TYPE)
      
      const svgRequest = svgStore.count()
      const typeRequest = typeStore.count()
      
      let svgCount = 0
      let typeCount = 0
      let completed = 0
      
      const checkComplete = () => {
        completed++
        if (completed === 2) {
          resolve({
            svgCount,
            typeCount,
            total: svgCount + typeCount
          })
        }
      }
      
      svgRequest.onsuccess = () => {
        svgCount = svgRequest.result
        checkComplete()
      }
      
      typeRequest.onsuccess = () => {
        typeCount = typeRequest.result
        checkComplete()
      }
      
      svgRequest.onerror = () => {
        console.warn('Error counting SVG cache:', svgRequest.error)
        checkComplete()
      }
      
      typeRequest.onerror = () => {
        console.warn('Error counting type cache:', typeRequest.error)
        checkComplete()
      }
    })
  } catch (error) {
    console.warn('Error getting cache stats:', error)
    return { svgCount: 0, typeCount: 0, total: 0 }
  }
}

