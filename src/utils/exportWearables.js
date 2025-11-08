import { getContract } from './contract.js'
import { getCachedSvg, getCachedType } from './wearableCache.js'

// Constants for preview
const HAUNT_ID = 1
const COLLATERAL = '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390'
const TRAITS = [50, 50, 50, 50, 50, 50]

/**
 * Wrap SVG in a 64x64 canvas, centering the content
 * @param {string} svgString - Original SVG string
 * @returns {string} - SVG wrapped in 64x64 canvas
 */
function wrapSvgIn64x64Canvas(svgString) {
  if (!svgString) return ''
  
  try {
    // Extract viewBox from original SVG
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
    let viewBox = '0 0 64 64' // Default
    
    if (viewBoxMatch) {
      viewBox = viewBoxMatch[1]
    }
    
    // Parse viewBox values
    const viewBoxValues = viewBox.split(/\s+/).map(v => parseFloat(v))
    const [x, y, width, height] = viewBoxValues.length === 4 
      ? viewBoxValues 
      : [0, 0, 64, 64]
    
    // Calculate center position for 64x64 canvas
    const centerX = (64 - width) / 2
    const centerY = (64 - height) / 2
    
    // Extract the inner content (everything between <svg> tags)
    const innerContentMatch = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
    const innerContent = innerContentMatch ? innerContentMatch[1] : svgString
    
    // Create new SVG with 64x64 viewBox and centered content
    const wrappedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <g transform="translate(${centerX - x}, ${centerY - y})">
    ${innerContent}
  </g>
</svg>`
    
    return wrappedSvg
  } catch (error) {
    console.warn('Error wrapping SVG in 64x64 canvas:', error.message)
    // Fallback: return original SVG wrapped in 64x64
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <g transform="translate(7, 21)">
    ${svgString.replace(/<svg[^>]*>|<\/svg>/gi, '')}
  </g>
</svg>`
  }
}

/**
 * Extract sleeves from SVG for body wearables
 * @param {string} svgString - SVG string
 * @param {string} viewName - View name (Front, Left, Right, Back)
 * @returns {string} - Extracted sleeve SVG or empty string
 */
function extractSleeves(svgString, viewName) {
  if (!svgString) return ''
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgElement = doc.documentElement
    
    // Find all elements with sleeve classes
    const sleeveElements = []
    const allElements = svgElement.querySelectorAll('*')
    
    for (const element of allElements) {
      const classes = (element.getAttribute('class') || '').toLowerCase()
      if (classes.includes('sleeve') || classes.includes('sleeves')) {
        sleeveElements.push(element.cloneNode(true))
      }
    }
    
    if (sleeveElements.length === 0) return ''
    
    // Create a new SVG with just the sleeves
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
    wrapper.setAttribute('viewBox', viewBox)
    
    sleeveElements.forEach(el => wrapper.appendChild(el))
    
    const serializer = new XMLSerializer()
    return serializer.serializeToString(wrapper)
  } catch (error) {
    console.warn(`Error extracting sleeves for ${viewName}:`, error)
    return ''
  }
}

/**
 * Determine rarity from rarityScoreModifier and category
 * @param {number} rarityScoreModifier - Rarity score modifier
 * @param {number} category - Category ID
 * @returns {string} - Rarity string
 */
function getRarity(rarityScoreModifier, category) {
  // Rarity tiers based on rarityScoreModifier
  // Common: 0-10, Uncommon: 11-20, Rare: 21-30, Epic: 31-40, Legendary: 41-50, Mythical: 51+
  if (rarityScoreModifier >= 51) return 'Mythical'
  if (rarityScoreModifier >= 41) return 'Legendary'
  if (rarityScoreModifier >= 31) return 'Epic'
  if (rarityScoreModifier >= 21) return 'Rare'
  if (rarityScoreModifier >= 11) return 'Uncommon'
  if (rarityScoreModifier >= 1) return 'Common'
  return 'Common' // Default
}

/**
 * Get all 4 views for a wearable when equipped on a Gotchi
 * @param {number} wearableId - Wearable ID
 * @param {number} slot - Slot position (0-15)
 * @returns {Promise<{front: string, left: string, right: string, back: string}>}
 */
async function getWearableViews(wearableId, slot) {
  const contract = getContract()
  
  // Create equippedWearables array with the wearable in its slot
  const equippedWearables = new Array(16).fill(0)
  equippedWearables[slot] = wearableId
  
  try {
    const response = await contract.previewSideAavegotchi(
      HAUNT_ID,
      COLLATERAL,
      TRAITS,
      equippedWearables
    )
    
    // Parse response - handle different return formats
    let sidesArray = []
    if (response && typeof response === 'object') {
      if (typeof response.length === 'number' && response.length > 0) {
        // Array-like object (could be Proxy)
        sidesArray = []
        for (let i = 0; i < response.length; i++) {
          if (response[i] !== undefined) {
            sidesArray.push(response[i])
          }
        }
      } else if (response.ag_) {
        const agValue = response.ag_
        if (Array.isArray(agValue)) {
          sidesArray = agValue
        } else if (typeof agValue === 'string') {
          sidesArray = [agValue]
        } else if (agValue && typeof agValue.length === 'number') {
          sidesArray = []
          for (let i = 0; i < agValue.length; i++) {
            if (agValue[i] !== undefined) {
              sidesArray.push(agValue[i])
            }
          }
        }
      } else if (Array.isArray(response)) {
        sidesArray = response
      }
    }
    
    // Determine view order by checking SVG content
    let front = sidesArray[0] || ''
    let left = ''
    let right = ''
    let back = sidesArray[3] || ''
    
    if (sidesArray.length >= 4) {
      const view1 = (sidesArray[1] || '').toLowerCase()
      const view2 = (sidesArray[2] || '').toLowerCase()
      
      const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')
      const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft')
      
      if (view1IsLeft && !view2IsLeft) {
        left = sidesArray[1]
        right = sidesArray[2]
      } else if (view2IsLeft && !view1IsLeft) {
        left = sidesArray[2]
        right = sidesArray[1]
      } else {
        // Default assumption
        left = sidesArray[1]
        right = sidesArray[2]
      }
    }
    
    return { front, left, right, back }
  } catch (error) {
    console.warn(`Error fetching views for wearable ${wearableId}:`, error.message)
    return { front: '', left: '', right: '', back: '' }
  }
}

/**
 * Export a single wearable with full metadata, views, and sleeves
 * @param {number} wearableId - Wearable ID to export
 * @returns {Promise<Object>} - Complete wearable object
 */
export async function exportSingleWearable(wearableId) {
  const contract = getContract()
  
  console.log(`Starting export for wearable ${wearableId}...`)
  
  // Try to get cached type data first
  let typeData = await getCachedType(wearableId)
  
  // Fetch item type metadata if not cached
  if (!typeData) {
    console.log(`Fetching item type for wearable ${wearableId}...`)
    try {
      const itemType = await contract.getItemType(wearableId)
      
      // Extract slot from slotPositions
      let slot = null
      if (itemType && itemType.slotPositions && Array.isArray(itemType.slotPositions)) {
        for (let i = 0; i < itemType.slotPositions.length; i++) {
          if (itemType.slotPositions[i] === true) {
            slot = i
            break
          }
        }
      }
      
      // Convert slotPositions to array of booleans
      const slotPositions = itemType?.slotPositions || []
      const slotPositionsArray = Array.isArray(slotPositions) 
        ? slotPositions 
        : new Array(16).fill(false)
      
      // Convert traitModifiers to array
      const traitModifiers = itemType?.traitModifiers || []
      const traitModifiersArray = Array.isArray(traitModifiers)
        ? traitModifiers.map(t => Number(t))
        : [0, 0, 0, 0, 0, 0]
      
      // Convert dimensions to array format [x, y, width, height]
      let dimensions = [0, 0, 0, 0]
      if (itemType?.dimensions) {
        dimensions = [
          Number(itemType.dimensions.x || 0),
          Number(itemType.dimensions.y || 0),
          Number(itemType.dimensions.width || 0),
          Number(itemType.dimensions.height || 0)
        ]
      }
      
      typeData = {
        name: itemType?.name || `Wearable #${wearableId}`,
        slot: slot !== null ? slot : null,
        category: Number(itemType?.category || 0),
        slotPositions: slotPositionsArray,
        traitModifiers: traitModifiersArray,
        allowedCollaterals: itemType?.allowedCollaterals || [],
        description: itemType?.description || '',
        author: itemType?.author || '',
        dimensions: dimensions,
        svgId: Number(itemType?.svgId || 0),
        rarityScoreModifier: Number(itemType?.rarityScoreModifier || 0),
        minLevel: Number(itemType?.minLevel || 0),
        ghstPrice: itemType?.ghstPrice?.toString() || '0'
      }
    } catch (error) {
      console.error(`Error fetching item type for wearable ${wearableId}:`, error)
      throw new Error(`Failed to fetch item type: ${error.message}`)
    }
  }
  
  // Get slot position (default to 0 if not found)
  const slot = typeData?.slot !== null && typeData?.slot !== undefined ? typeData.slot : 0
  
  console.log(`Wearable ${wearableId} slot: ${slot}`)
  
  // Get individual wearable SVG
  console.log(`Fetching individual SVG for wearable ${wearableId}...`)
  let svg = await getCachedSvg(wearableId)
  if (!svg) {
    try {
      const response = await contract.getItemSvg(wearableId)
      if (typeof response === 'string') {
        svg = response
      } else if (response && typeof response === 'object' && response.ag_) {
        svg = response.ag_
      } else if (response && typeof response === 'object' && response.length === 1) {
        svg = response[0]
      }
      
      // Wrap SVG in 64x64 canvas
      if (svg) {
        svg = wrapSvgIn64x64Canvas(svg)
      }
    } catch (error) {
      console.warn(`Error fetching SVG for wearable ${wearableId}:`, error.message)
      svg = ''
    }
  } else {
    // If cached SVG exists, check if it's already wrapped (has 64x64 viewBox)
    // If not, wrap it
    if (svg && !svg.includes('viewBox="0 0 64 64"')) {
      svg = wrapSvgIn64x64Canvas(svg)
    }
  }
  
  // Get 4 views
  console.log(`Fetching 4 views for wearable ${wearableId}...`)
  const views = await getWearableViews(wearableId, slot)
  
  // Extract sleeves if it's a body wearable (slot 0)
  let sleeves = { front: '', left: '', right: '', back: '' }
  if (slot === 0) {
    console.log(`Extracting sleeves for body wearable ${wearableId}...`)
    sleeves = {
      front: extractSleeves(views.front, 'Front'),
      left: extractSleeves(views.left, 'Left'),
      right: extractSleeves(views.right, 'Right'),
      back: extractSleeves(views.back, 'Back')
    }
  }
  
  // Build complete wearable object
  const wearable = {
    id: wearableId,
    name: typeData?.name || `Wearable #${wearableId}`,
    slot: slot !== null ? slot : null,
    category: typeData?.category || 0,
    description: typeData?.description || '',
    author: typeData?.author || '',
    traitModifiers: typeData?.traitModifiers || [0, 0, 0, 0, 0, 0],
    slotPositions: typeData?.slotPositions || new Array(16).fill(false),
    allowedCollaterals: typeData?.allowedCollaterals || [],
    dimensions: typeData?.dimensions || [0, 0, 0, 0],
    svgId: typeData?.svgId || 0,
    rarityScoreModifier: typeData?.rarityScoreModifier || 0,
    minLevel: typeData?.minLevel || 0,
    rarity: getRarity(typeData?.rarityScoreModifier || 0, typeData?.category || 0),
    ghstPrice: typeData?.ghstPrice || '0',
    svg: svg || '',
    svgs: [
      views.front || '',
      views.left || '',
      views.right || '',
      views.back || ''
    ],
    sleeves: slot === 0 ? [
      sleeves.front || '',
      sleeves.left || '',
      sleeves.right || '',
      sleeves.back || ''
    ] : []
  }
  
  console.log(`Export complete for wearable ${wearableId}`)
  return wearable
}

/**
 * Export wearable 22 for testing
 * @returns {Promise<Object>} - Complete wearable object
 */
export async function exportWearable22() {
  console.log('=== Exporting Wearable 22 ===')
  try {
    const wearable = await exportSingleWearable(22)
    console.log('Wearable 22 exported successfully:', wearable)
    
    // Optionally download as JSON
    const jsonString = JSON.stringify(wearable, null, 2)
    console.log('JSON:', jsonString)
    
    // Create download link
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wearable-22-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    console.log('Downloaded wearable-22.json')
    return wearable
  } catch (error) {
    console.error('Error exporting wearable 22:', error)
    throw error
  }
}

