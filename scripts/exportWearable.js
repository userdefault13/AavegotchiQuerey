import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Constants
const AAVEGOTCHI_DIAMOND = process.env.VITE_CONTRACT_ADDRESS || '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF'
const ALCHEMY_API_KEY = process.env.VITE_ALCHEMY_API_KEY || 'cePVnDpeOovd0mRN3jGWWuzrtkgIfcJr'
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

const HAUNT_ID = 1
const COLLATERAL = '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390'
const TRAITS = [50, 50, 50, 50, 50, 50]

// Aavegotchi contract ABI - minimal set for our needs
const AAVEGOTCHI_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: '_hauntId', type: 'uint256' },
      { internalType: 'address', name: '_collateralType', type: 'address' },
      { internalType: 'int16[6]', name: '_numericTraits', type: 'int16[6]' },
      { internalType: 'uint16[16]', name: '_equippedWearables', type: 'uint16[16]' }
    ],
    name: 'previewSideAavegotchi',
    outputs: [
      { internalType: 'string[]', name: 'ag_', type: 'string[]' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_itemId', type: 'uint256' }
    ],
    name: 'getItemSvg',
    outputs: [
      { internalType: 'string', name: 'ag_', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_itemId', type: 'uint256' }
    ],
    name: 'getItemType',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'string', name: 'author', type: 'string' },
          { internalType: 'int8[6]', name: 'traitModifiers', type: 'int8[6]' },
          { internalType: 'bool[16]', name: 'slotPositions', type: 'bool[16]' },
          { internalType: 'uint8[]', name: 'allowedCollaterals', type: 'uint8[]' },
          {
            components: [
              { internalType: 'uint8', name: 'x', type: 'uint8' },
              { internalType: 'uint8', name: 'y', type: 'uint8' },
              { internalType: 'uint8', name: 'width', type: 'uint8' },
              { internalType: 'uint8', name: 'height', type: 'uint8' }
            ],
            internalType: 'struct Dimensions',
            name: 'dimensions',
            type: 'tuple'
          },
          { internalType: 'uint256', name: 'ghstPrice', type: 'uint256' },
          { internalType: 'uint256', name: 'maxQuantity', type: 'uint256' },
          { internalType: 'uint256', name: 'totalQuantity', type: 'uint256' },
          { internalType: 'uint32', name: 'svgId', type: 'uint32' },
          { internalType: 'uint8', name: 'rarityScoreModifier', type: 'uint8' },
          { internalType: 'bool', name: 'canPurchaseWithGhst', type: 'bool' },
          { internalType: 'uint16', name: 'minLevel', type: 'uint16' },
          { internalType: 'bool', name: 'canBeTransferred', type: 'bool' },
          { internalType: 'uint8', name: 'category', type: 'uint8' },
          { internalType: 'int16', name: 'kinshipBonus', type: 'int16' },
          { internalType: 'uint32', name: 'experienceBonus', type: 'uint32' }
        ],
        internalType: 'struct ItemType',
        name: 'itemType_',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

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
    // Remove the outer <svg> tag and get the inner content
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
    // Use regex to find elements with sleeve classes
    const sleevePattern = /<[^>]*class="[^"]*sleeve[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi
    const matches = svgString.match(sleevePattern)
    
    if (!matches || matches.length === 0) return ''
    
    // Extract viewBox from original SVG
    const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 64 64'
    
    // Create a new SVG with just the sleeves
    const sleevesSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${matches.join('')}</svg>`
    return sleevesSvg
  } catch (error) {
    console.warn(`Error extracting sleeves for ${viewName}:`, error.message)
    return ''
  }
}

/**
 * Determine rarity from rarityScoreModifier
 * @param {number} rarityScoreModifier - Rarity score modifier
 * @param {number} category - Category ID
 * @returns {string} - Rarity string
 */
function getRarity(rarityScoreModifier, category) {
  if (rarityScoreModifier >= 51) return 'Mythical'
  if (rarityScoreModifier >= 41) return 'Legendary'
  if (rarityScoreModifier >= 31) return 'Epic'
  if (rarityScoreModifier >= 21) return 'Rare'
  if (rarityScoreModifier >= 11) return 'Uncommon'
  if (rarityScoreModifier >= 1) return 'Common'
  return 'Common'
}

/**
 * Get all 4 views for a wearable when equipped on a Gotchi
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} wearableId - Wearable ID
 * @param {number} slot - Slot position (0-15)
 * @returns {Promise<{front: string, left: string, right: string, back: string}>}
 */
async function getWearableViews(contract, wearableId, slot) {
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
      if (Array.isArray(response)) {
        sidesArray = response
      } else if (response.ag_ && Array.isArray(response.ag_)) {
        sidesArray = response.ag_
      } else if (typeof response.length === 'number' && response.length > 0) {
        // Array-like object (could be Proxy)
        sidesArray = []
        for (let i = 0; i < response.length; i++) {
          if (response[i] !== undefined) {
            sidesArray.push(response[i])
          }
        }
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
 * @param {ethers.Contract} contract - Contract instance
 * @param {number} wearableId - Wearable ID to export
 * @returns {Promise<Object>} - Complete wearable object
 */
async function exportSingleWearable(contract, wearableId) {
  console.log(`\n=== Starting export for wearable ${wearableId} ===`)
  
  // Fetch item type metadata
  console.log(`Fetching item type for wearable ${wearableId}...`)
  let itemType
  try {
    itemType = await contract.getItemType(wearableId)
  } catch (error) {
    console.error(`Error fetching item type for wearable ${wearableId}:`, error.message)
    throw new Error(`Failed to fetch item type: ${error.message}`)
  }
  
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
    ? slotPositions.map(b => Boolean(b))
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
  
  const slotToUse = slot !== null ? slot : 0
  console.log(`Wearable ${wearableId} slot: ${slotToUse}`)
  console.log(`Name: ${itemType?.name || `Wearable #${wearableId}`}`)
  
  // Get individual wearable SVG
  console.log(`Fetching individual SVG for wearable ${wearableId}...`)
  let svg = ''
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
    
    console.log(`✓ Got individual SVG (${svg.length} chars, wrapped in 64x64)`)
  } catch (error) {
    console.warn(`Error fetching SVG for wearable ${wearableId}:`, error.message)
  }
  
  // Get 4 views
  console.log(`Fetching 4 views for wearable ${wearableId}...`)
  const views = await getWearableViews(contract, wearableId, slotToUse)
  console.log(`✓ Got views: Front=${!!views.front}, Left=${!!views.left}, Right=${!!views.right}, Back=${!!views.back}`)
  
  // Extract sleeves if it's a body wearable (slot 0)
  let sleeves = { front: '', left: '', right: '', back: '' }
  if (slotToUse === 0) {
    console.log(`Extracting sleeves for body wearable ${wearableId}...`)
    sleeves = {
      front: extractSleeves(views.front, 'Front'),
      left: extractSleeves(views.left, 'Left'),
      right: extractSleeves(views.right, 'Right'),
      back: extractSleeves(views.back, 'Back')
    }
    console.log(`✓ Extracted sleeves: Front=${!!sleeves.front}, Left=${!!sleeves.left}, Right=${!!sleeves.right}, Back=${!!sleeves.back}`)
  }
  
  // Build complete wearable object
  const wearable = {
    id: wearableId,
    name: itemType?.name || `Wearable #${wearableId}`,
    slot: slot !== null ? slot : null,
    category: Number(itemType?.category || 0),
    description: itemType?.description || '',
    author: itemType?.author || '',
    traitModifiers: traitModifiersArray,
    slotPositions: slotPositionsArray,
    allowedCollaterals: itemType?.allowedCollaterals || [],
    dimensions: dimensions,
    svgId: Number(itemType?.svgId || 0),
    rarityScoreModifier: Number(itemType?.rarityScoreModifier || 0),
    minLevel: Number(itemType?.minLevel || 0),
    rarity: getRarity(Number(itemType?.rarityScoreModifier || 0), Number(itemType?.category || 0)),
    ghstPrice: itemType?.ghstPrice?.toString() || '0',
    svg: svg,
    svgs: [
      views.front || '',
      views.left || '',
      views.right || '',
      views.back || ''
    ],
    sleeves: slotToUse === 0 ? [
      sleeves.front || '',
      sleeves.left || '',
      sleeves.right || '',
      sleeves.back || ''
    ] : []
  }
  
  console.log(`✓ Export complete for wearable ${wearableId}`)
  return wearable
}

/**
 * Main function to export wearable 22
 */
async function main() {
  const wearableId = process.argv[2] ? parseInt(process.argv[2]) : 22
  
  console.log('=== Aavegotchi Wearable Exporter ===')
  console.log(`Exporting wearable ${wearableId}...`)
  console.log(`Contract: ${AAVEGOTCHI_DIAMOND}`)
  console.log(`RPC: ${ALCHEMY_RPC_URL.replace(ALCHEMY_API_KEY, '***')}`)
  
  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
    console.log('✓ Connected to provider')
    
    // Create contract instance
    const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
    console.log('✓ Contract instance created')
    
    // Export wearable
    const wearable = await exportSingleWearable(contract, wearableId)
    
    // Write to JSON file
    const outputDir = path.join(__dirname, 'exports')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const filename = `wearable-${wearableId}-${Date.now()}.json`
    const filepath = path.join(outputDir, filename)
    
    fs.writeFileSync(filepath, JSON.stringify(wearable, null, 2), 'utf8')
    
    console.log(`\n✓ Successfully exported wearable ${wearableId}`)
    console.log(`✓ File saved to: ${filepath}`)
    console.log(`\nWearable Summary:`)
    console.log(`  Name: ${wearable.name}`)
    console.log(`  Slot: ${wearable.slot}`)
    console.log(`  Category: ${wearable.category}`)
    console.log(`  Rarity: ${wearable.rarity}`)
    console.log(`  SVG Length: ${wearable.svg.length} chars`)
    console.log(`  Views: ${wearable.svgs.filter(v => v).length}/4`)
    console.log(`  Sleeves: ${wearable.sleeves.filter(s => s).length}/4`)
    
  } catch (error) {
    console.error('\n✗ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the script
main()

