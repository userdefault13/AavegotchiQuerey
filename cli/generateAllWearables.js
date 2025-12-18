import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Constants
const AAVEGOTCHI_DIAMOND = process.env.VITE_CONTRACT_ADDRESS || '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF'
const ALCHEMY_API_KEY = process.env.VITE_ALCHEMY_API_KEY || 'cePVnDpeOovd0mRN3jGWWuzrtkgIfcJr'
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// Default settings for previewSideAavegotchi
const HAUNT_ID = 1
const COLLATERAL = '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390' // maUNI (Haunt 1)
const TRAITS = [50, 50, 50, 50, 50, 50] // Neutral traits

// Slot name mapping
const SLOT_NAMES = {
  0: 'Body',
  1: 'Face',
  2: 'Eyes',
  3: 'Head',
  4: 'LeftHand',
  5: 'RightHand',
  6: 'Pet',
  7: 'Background'
}

// Aavegotchi contract ABI
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
 * Determine rarity from rarityScoreModifier
 */
function getRarity(rarityScoreModifier) {
  if (rarityScoreModifier >= 51) return 'Mythical'
  if (rarityScoreModifier >= 41) return 'Legendary'
  if (rarityScoreModifier >= 31) return 'Epic'
  if (rarityScoreModifier >= 21) return 'Rare'
  if (rarityScoreModifier >= 11) return 'Uncommon'
  if (rarityScoreModifier >= 1) return 'Common'
  return 'Common'
}

/**
 * Helper function to find elements by tag and class
 */
function findElements(doc, tagName, className) {
  const results = []
  let elements = []
  
  try {
    if (doc.getElementsByTagName) {
      elements = Array.from(doc.getElementsByTagName(tagName))
    }
  } catch (e) {
    // Fallback to manual walk
  }
  
  if (elements.length === 0) {
    const walk = (node) => {
      if (node && node.nodeType === 1) {
        if (node.nodeName === tagName || tagName === '*') {
          elements.push(node)
        }
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i])
          }
        }
      }
    }
    walk(doc)
  }
  
  if (className) {
    for (const element of elements) {
      const nodeClass = (element.getAttribute('class') || '').trim()
      const classes = nodeClass.split(/\s+/).filter(c => c.length > 0)
      if (classes.includes(className) || nodeClass.includes(className)) {
        results.push(element)
      }
    }
  } else {
    results.push(...elements)
  }
  
  return results
}

/**
 * Extract wearable SVG from full gotchi SVG
 * Handles nested <svg x="..." y="..."> tags for positioning
 */
function extractWearableSvg(fullSvg) {
  if (!fullSvg) return ''
  
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(fullSvg, 'image/svg+xml')
    const svgElement = doc.documentElement
    const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
    const serializer = new XMLSerializer()
    
    // Find all gotchi-wearable groups
    const wearableElements = findElements(doc, 'g', 'gotchi-wearable')
    
    if (wearableElements.length === 0) {
      return ''
    }
    
    // Create wrapper SVG
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    // Clone all wearable groups (including any nested SVG tags for positioning)
    for (const element of wearableElements) {
      const clone = element.cloneNode(true)
      wrapper.appendChild(clone)
    }
    
    return serializer.serializeToString(wrapper)
  } catch (error) {
    console.warn('Error extracting wearable SVG:', error.message)
    return ''
  }
}

/**
 * Extract sleeves from SVG (for body wearables)
 * Returns an object with sleevesUp and sleevesDown SVG strings for a single view
 * Handles positioning offsets from nested <svg x="..." y="..."> tags
 */
function extractSleeves(svgString) {
  if (!svgString) {
    return {
      sleevesUp: '',
      sleevesDown: ''
    }
  }
  
  try {
    // First, try to find the offset from the SVG string itself
    // Sleeves are typically inside: <svg x="7" y="31">...<g class="gotchi-sleeves">...</g></svg>
    let offsetX = 0
    let offsetY = 0
    
    // Search for positioned SVG tags that contain sleeves
    const positionedSvgRegex = /<svg\s+[^>]*x\s*=\s*["']([^"']+)["'][^>]*y\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?gotchi-sleeves/gi
    const match = positionedSvgRegex.exec(svgString)
    if (match) {
      offsetX = parseFloat(match[1]) || 0
      offsetY = parseFloat(match[2]) || 0
    } else {
      // Try alternative pattern: x="..." y="..." on separate lines
      const altRegex = /<svg\s+[^>]*x\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?y\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?gotchi-sleeves/gi
      const altMatch = altRegex.exec(svgString)
      if (altMatch) {
        offsetX = parseFloat(altMatch[1]) || 0
        offsetY = parseFloat(altMatch[2]) || 0
      }
    }
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(svgString, 'image/svg+xml')
    const svgElement = doc.documentElement
    const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
    const serializer = new XMLSerializer()
    
    // Find all sleeve elements (groups with gotchi-sleeves class)
    const sleeveElements = findElements(doc, 'g', 'gotchi-sleeves')
    
    // Separate sleeves-up and sleeves-down
    const sleevesUpElements = []
    const sleevesDownElements = []
    
    for (const element of sleeveElements) {
      const classes = (element.getAttribute('class') || '').toLowerCase()
      
      // Check if this is sleeves-up or sleeves-down
      const isSleevesUp = classes.includes('sleeves-up') || classes.includes('sleevesup')
      const isSleevesDown = classes.includes('sleeves-down') || classes.includes('sleevesdown')
      
      if (isSleevesUp) {
        sleevesUpElements.push(element)
      } else if (isSleevesDown) {
        sleevesDownElements.push(element)
      }
    }
    
    // For Back view: sleeves-down might be loose <path> elements after sleeves-up groups
    // Check if we found sleeves-up but no sleeves-down groups
    if (sleevesUpElements.length > 0 && sleevesDownElements.length === 0) {
      // Look for paths that come after sleeves-up groups
      // These might be sleeves-down elements that aren't wrapped in a group
      for (const sleevesUpElement of sleevesUpElements) {
        let nextSibling = sleevesUpElement.nextSibling
        const pathsAfterSleevesUp = []
        
        // Collect paths that come immediately after this sleeves-up group
        while (nextSibling) {
          if (nextSibling.nodeType === 1) { // Element node
            const nodeName = nextSibling.nodeName.toLowerCase()
            const classes = (nextSibling.getAttribute('class') || '').toLowerCase()
            
            // Stop if we hit another sleeves group or a different element type
            if (classes.includes('gotchi-sleeves')) {
              break
            }
            
            // Collect path elements that might be sleeves-down
            if (nodeName === 'path') {
              pathsAfterSleevesUp.push(nextSibling)
            } else if (nodeName === 'g' && !classes.includes('gotchi-sleeves')) {
              // Might be a group containing sleeves-down paths
              const pathsInGroup = nextSibling.querySelectorAll('path')
              if (pathsInGroup.length > 0) {
                pathsAfterSleevesUp.push(...Array.from(pathsInGroup))
              }
            }
          }
          nextSibling = nextSibling.nextSibling
        }
        
        // If we found paths after sleeves-up, wrap them in a group as sleeves-down
        if (pathsAfterSleevesUp.length > 0) {
          const sleevesDownGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
          sleevesDownGroup.setAttribute('class', 'gotchi-sleeves gotchi-sleeves-down')
          
          // Determine if this is left or right based on the sleeves-up element
          const sleevesUpClasses = sleevesUpElement.getAttribute('class') || ''
          if (sleevesUpClasses.includes('sleeves-left')) {
            sleevesDownGroup.setAttribute('class', 'gotchi-sleeves gotchi-sleeves-left gotchi-sleeves-down')
          } else if (sleevesUpClasses.includes('sleeves-right')) {
            sleevesDownGroup.setAttribute('class', 'gotchi-sleeves gotchi-sleeves-right gotchi-sleeves-down')
          }
          
          for (const path of pathsAfterSleevesUp) {
            const clone = path.cloneNode(true)
            sleevesDownGroup.appendChild(clone)
          }
          
          sleevesDownElements.push(sleevesDownGroup)
        }
      }
    }
    
    if (sleevesUpElements.length === 0 && sleevesDownElements.length === 0) {
      return {
        sleevesUp: '',
        sleevesDown: ''
      }
    }
    
    // Helper function to wrap sleeves with positioning
    const wrapSleevesWithPosition = (elements) => {
      if (elements.length === 0) return ''
      
      // Create wrapper SVG with 64x64 viewBox
      const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
      wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      wrapper.setAttribute('viewBox', '0 0 64 64')
      
      // Always wrap in a positioned group if there's an offset
      // This ensures sleeves are positioned correctly in the 64x64 canvas
      if (offsetX !== 0 || offsetY !== 0) {
        const positionedGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
        positionedGroup.setAttribute('transform', `translate(${offsetX}, ${offsetY})`)
        
        for (const element of elements) {
          const clone = element.cloneNode(true)
          positionedGroup.appendChild(clone)
        }
        
        wrapper.appendChild(positionedGroup)
      } else {
        // No offset, just clone elements directly
        for (const element of elements) {
          const clone = element.cloneNode(true)
          wrapper.appendChild(clone)
        }
      }
      
      return serializer.serializeToString(wrapper)
    }
    
    const sleevesUpSvg = wrapSleevesWithPosition(sleevesUpElements)
    const sleevesDownSvg = wrapSleevesWithPosition(sleevesDownElements)
    
    return {
      sleevesUp: sleevesUpSvg,
      sleevesDown: sleevesDownSvg
    }
  } catch (error) {
    console.warn('Error extracting sleeves:', error.message)
    return {
      sleevesUp: '',
      sleevesDown: ''
    }
  }
}

/**
 * Parse previewSideAavegotchi response
 */
function parsePreviewResponse(response) {
  let svgArray = []
  
  if (Array.isArray(response)) {
    svgArray = response
  } else if (response && response.ag_) {
    svgArray = Array.isArray(response.ag_) ? response.ag_ : [response.ag_]
  } else if (response && typeof response.length === 'number') {
    svgArray = []
    for (let i = 0; i < response.length; i++) {
      if (response[i] !== undefined) {
        svgArray.push(response[i])
      }
    }
  }
  
  return svgArray
}

/**
 * Determine view order from SVG array
 */
function determineViewOrder(svgArray) {
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  return {
    Front: svgArray[0],
    Left: svgArray[1],
    Right: svgArray[2],
    Back: svgArray[3]
  }
}

/**
 * Get all 4 views for a wearable when equipped
 */
async function getWearableViews(contract, wearableId, slot) {
  const equippedWearables = new Array(16).fill(0)
  equippedWearables[slot] = wearableId
  
  try {
    const response = await contract.previewSideAavegotchi(
      HAUNT_ID,
      COLLATERAL,
      TRAITS,
      equippedWearables
    )
    
    const svgArray = parsePreviewResponse(response)
    if (svgArray.length < 4) {
      throw new Error(`Expected 4 views, got ${svgArray.length}`)
    }
    
    return determineViewOrder(svgArray)
  } catch (error) {
    console.warn(`Error fetching views for wearable ${wearableId}:`, error.message)
    return { Front: '', Left: '', Right: '', Back: '' }
  }
}

/**
 * Generate wearable JSON for a single wearable
 */
async function generateWearable(contract, wearableId) {
  console.log(`\nProcessing wearable ${wearableId}...`)
  
  // Fetch item type metadata
  let itemType
  try {
    itemType = await contract.getItemType(wearableId)
  } catch (error) {
    console.error(`  ✗ Error fetching item type: ${error.message}`)
    return null
  }
  
  // Extract slot from slotPositions
  let slot = null
  const slotPositions = itemType?.slotPositions || []
  const slotPositionsArray = Array.isArray(slotPositions)
    ? slotPositions.map(b => Boolean(b))
    : new Array(16).fill(false)
  
  for (let i = 0; i < slotPositionsArray.length; i++) {
    if (slotPositionsArray[i] === true) {
      slot = i
      break
    }
  }
  
  if (slot === null) {
    console.warn(`  ⚠ No slot found for wearable ${wearableId}, skipping`)
    return null
  }
  
  const slotName = SLOT_NAMES[slot] || `Slot${slot}`
  
  // Get 4 views
  const views = await getWearableViews(contract, wearableId, slot)
  
  // Extract wearable SVGs from each view
  const frontWearable = extractWearableSvg(views.Front)
  const leftWearable = extractWearableSvg(views.Left)
  const rightWearable = extractWearableSvg(views.Right)
  const backWearable = extractWearableSvg(views.Back)
  
  // Extract sleeves if it's a body wearable
  let sleevesUp = { front: '', left: '', right: '', back: '' }
  let sleevesDown = { front: '', left: '', right: '', back: '' }
  if (slot === 0) {
    const frontSleeves = extractSleeves(views.Front)
    const leftSleeves = extractSleeves(views.Left)
    const rightSleeves = extractSleeves(views.Right)
    const backSleeves = extractSleeves(views.Back)
    
    sleevesUp = {
      front: frontSleeves.sleevesUp || '',
      left: leftSleeves.sleevesUp || '',
      right: rightSleeves.sleevesUp || '',
      back: backSleeves.sleevesUp || ''
    }
    
    sleevesDown = {
      front: frontSleeves.sleevesDown || '',
      left: leftSleeves.sleevesDown || '',
      right: rightSleeves.sleevesDown || '',
      back: backSleeves.sleevesDown || ''
    }
  }
  
  // Build wearable object (convert BigInt values to strings)
  const wearable = {
    id: wearableId,
    name: itemType?.name || `Wearable #${wearableId}`,
    slot: slot,
    slotName: slotName,
    category: Number(itemType?.category || 0),
    description: itemType?.description || '',
    author: itemType?.author || '',
    traitModifiers: (itemType?.traitModifiers || []).map(t => Number(t)),
    slotPositions: slotPositionsArray,
    allowedCollaterals: (itemType?.allowedCollaterals || []).map(c => Number(c)),
    dimensions: itemType?.dimensions ? {
      x: Number(itemType.dimensions.x || 0),
      y: Number(itemType.dimensions.y || 0),
      width: Number(itemType.dimensions.width || 64),
      height: Number(itemType.dimensions.height || 64)
    } : { x: 0, y: 0, width: 64, height: 64 },
    svgId: Number(itemType?.svgId || 0),
    rarityScoreModifier: Number(itemType?.rarityScoreModifier || 0),
    minLevel: Number(itemType?.minLevel || 0),
    rarity: getRarity(Number(itemType?.rarityScoreModifier || 0)),
    ghstPrice: itemType?.ghstPrice ? String(itemType.ghstPrice) : '0',
    maxQuantity: itemType?.maxQuantity ? String(itemType.maxQuantity) : '0',
    totalQuantity: itemType?.totalQuantity ? String(itemType.totalQuantity) : '0',
    canPurchaseWithGhst: Boolean(itemType?.canPurchaseWithGhst || false),
    canBeTransferred: Boolean(itemType?.canBeTransferred || false),
    kinshipBonus: Number(itemType?.kinshipBonus || 0),
    experienceBonus: Number(itemType?.experienceBonus || 0),
    svgs: [
      frontWearable || '',
      leftWearable || '',
      rightWearable || '',
      backWearable || ''
    ],
    sleevesUp: slot === 0 ? [
      sleevesUp.front || '',
      sleevesUp.left || '',
      sleevesUp.right || '',
      sleevesUp.back || ''
    ] : [],
    sleevesDown: slot === 0 ? [
      sleevesDown.front || '',
      sleevesDown.left || '',
      sleevesDown.right || '',
      sleevesDown.back || ''
    ] : []
  }
  
  console.log(`  ✓ ${wearable.name} (${slotName}, ${wearable.rarity})`)
  console.log(`    Views: Front=${!!frontWearable}, Left=${!!leftWearable}, Right=${!!rightWearable}, Back=${!!backWearable}`)
  if (slot === 0) {
    console.log(`    Sleeves Up: Front=${!!sleevesUp.front}, Left=${!!sleevesUp.left}, Right=${!!sleevesUp.right}, Back=${!!sleevesUp.back}`)
    console.log(`    Sleeves Down: Front=${!!sleevesDown.front}, Left=${!!sleevesDown.left}, Right=${!!sleevesDown.right}, Back=${!!sleevesDown.back}`)
  }
  
  return wearable
}

/**
 * Main function
 */
async function main() {
  console.log('=== Generate All Wearables ===\n')
  
  // Parse command line arguments
  const startId = process.argv[2] ? parseInt(process.argv[2]) : 1
  const endId = process.argv[3] ? parseInt(process.argv[3]) : 100
  
  console.log(`Wearable ID range: ${startId} to ${endId}\n`)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Create output directory
  const outputDir = path.join(__dirname, 'exports/Wearables')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // IDs to skip by default (can be overridden if explicitly requested)
  const defaultSkipIds = new Set([21, 22, 23])
  
  // Load existing wearables from main JSON file if it exists
  const mainJsonPath = path.join(outputDir, 'wearables_1-420.json')
  let existingWearables = []
  if (fs.existsSync(mainJsonPath)) {
    try {
      const existingData = fs.readFileSync(mainJsonPath, 'utf8')
      existingWearables = JSON.parse(existingData)
      if (!Array.isArray(existingWearables)) {
        existingWearables = []
      }
    } catch (error) {
      console.warn(`Warning: Could not read existing wearables file: ${error.message}`)
      existingWearables = []
    }
  }
  
  // Create a map of existing wearable IDs for quick lookup
  const existingIds = new Set(existingWearables.map(w => w.id))
  
  // Determine if this is a small range (likely intentional regeneration)
  const isSmallRange = (endId - startId + 1) <= 10
  const requestedIds = new Set()
  for (let i = startId; i <= endId; i++) {
    requestedIds.add(i)
  }
  
  // Process each wearable ID
  let successCount = 0
  let errorCount = 0
  let skippedCount = 0
  const errors = []
  const newWearables = []
  
  for (let wearableId = startId; wearableId <= endId; wearableId++) {
    // Skip default IDs only if they're NOT in the requested range
    // If explicitly requested, allow regeneration
    if (defaultSkipIds.has(wearableId) && !requestedIds.has(wearableId)) {
      console.log(`\nSkipping wearable ${wearableId} (already generated)`)
      skippedCount++
      continue
    }
    
    // Skip if already exists (unless it's a small range - likely intentional regeneration)
    if (existingIds.has(wearableId) && !isSmallRange) {
      console.log(`\nSkipping wearable ${wearableId} (already in JSON file)`)
      skippedCount++
      continue
    }
    
    // If regenerating (small range and exists), remove from existing array first
    if (existingIds.has(wearableId) && isSmallRange) {
      console.log(`\nRegenerating wearable ${wearableId}...`)
      existingWearables = existingWearables.filter(w => w.id !== wearableId)
      existingIds.delete(wearableId)
    }
    
    try {
      const wearable = await generateWearable(contract, wearableId)
      
      if (!wearable) {
        skippedCount++
        continue
      }
      
      // Save JSON file organized by slot
      const slotName = wearable.slotName
      const slotDir = path.join(outputDir, slotName)
      if (!fs.existsSync(slotDir)) {
        fs.mkdirSync(slotDir, { recursive: true })
      }
      
      const filename = `wearable-${wearableId}-${Date.now()}.json`
      const filepath = path.join(slotDir, filename)
      fs.writeFileSync(filepath, JSON.stringify(wearable, null, 2), 'utf8')
      
      // Add to new wearables array
      newWearables.push(wearable)
      
      successCount++
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`  ✗ Error processing wearable ${wearableId}:`, error.message)
      errors.push({ wearableId, error: error.message })
      errorCount++
    }
  }
  
  // Merge new wearables with existing ones and save to main JSON file
  if (newWearables.length > 0) {
    // Combine existing and new wearables, sort by ID
    const allWearables = [...existingWearables, ...newWearables]
    allWearables.sort((a, b) => a.id - b.id)
    
    // Save to main JSON file
    fs.writeFileSync(mainJsonPath, JSON.stringify(allWearables, null, 2), 'utf8')
    console.log(`\n✓ Saved ${newWearables.length} new wearables to ${mainJsonPath}`)
    console.log(`  Total wearables in file: ${allWearables.length}`)
  }
  
  // Summary
  console.log('\n=== Summary ===')
  console.log(`Total wearables processed: ${endId - startId + 1}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Skipped: ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
  
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log(`  - Wearable ${e.wearableId}: ${e.error}`))
  }
  
  console.log(`\nFiles saved to: ${outputDir}`)
}

// Run the script
main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

