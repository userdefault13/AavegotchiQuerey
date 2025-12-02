import { ethers } from 'ethers'

// Constants
const AAVEGOTCHI_DIAMOND = process.env.VITE_CONTRACT_ADDRESS || '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF'
const ALCHEMY_API_KEY = process.env.VITE_ALCHEMY_API_KEY || 'cePVnDpeOovd0mRN3jGWWuzrtkgIfcJr'
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

const HAUNT_ID = 1
const COLLATERAL = '0x28424507fefb6f7f8E9D3860F56504E4e5f5f390'
const TRAITS = [50, 50, 50, 50, 50, 50]

// Slot name mapping
const SLOT_NAMES = {
  0: 'Body',
  1: 'Face',
  2: 'Eyes',
  3: 'Head',
  4: 'Left Hand',
  5: 'Right Hand',
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
 * Extract offset from nested SVG element
 */
function extractOffset(svgString) {
  if (!svgString) return { x: 0, y: 0 }
  
  try {
    // Find the first <svg> tag that appears after a gotchi-wearable group
    // This handles nested SVGs like: <g class="gotchi-wearable"><svg x="7" y="31">
    const wearableStartIndex = svgString.indexOf('gotchi-wearable')
    if (wearableStartIndex === -1) return { x: 0, y: 0 }
    
    // Find the next <svg> tag after the wearable group starts
    const svgStartIndex = svgString.indexOf('<svg', wearableStartIndex)
    if (svgStartIndex === -1) return { x: 0, y: 0 }
    
    // Extract the SVG tag attributes
    const svgTagEnd = svgString.indexOf('>', svgStartIndex)
    if (svgTagEnd === -1) return { x: 0, y: 0 }
    
    const svgTag = svgString.substring(svgStartIndex, svgTagEnd)
    
    // Extract x and y attributes
    const xMatch = svgTag.match(/x\s*=\s*["']?(\d+(?:\.\d+)?)["']?/i)
    const yMatch = svgTag.match(/y\s*=\s*["']?(\d+(?:\.\d+)?)["']?/i)
    
    if (xMatch && yMatch) {
      return {
        x: parseFloat(xMatch[1] || '0'),
        y: parseFloat(yMatch[1] || '0')
      }
    }
    
    return { x: 0, y: 0 }
  } catch (error) {
    console.warn('Error extracting offset:', error.message)
    return { x: 0, y: 0 }
  }
}

/**
 * Extract sleeves from SVG
 */
function extractSleeves(svgString) {
  if (!svgString) return null
  
  try {
    // Extract viewBox from original SVG
    const viewBoxMatch = svgString.match(/viewBox\s*=\s*["']([^"']+)["']/i)
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 64 64'
    
    // Find sleeve groups (handle nested groups properly)
    const sleeveGroups = []
    let startIndex = 0
    
    while (true) {
      const groupStart = svgString.indexOf('<g', startIndex)
      if (groupStart === -1) break
      
      const groupTagEnd = svgString.indexOf('>', groupStart)
      if (groupTagEnd === -1) break
      
      const groupTag = svgString.substring(groupStart, groupTagEnd + 1)
      
      if (groupTag.includes('gotchi-sleeves')) {
        // Find matching closing tag (handle nesting)
        let depth = 1
        let pos = groupTagEnd + 1
        let endPos = -1
        
        while (pos < svgString.length && depth > 0) {
          const nextGOpen = svgString.indexOf('<g', pos)
          const nextGClose = svgString.indexOf('</g>', pos)
          
          if (nextGClose === -1) break
          
          // Make sure we're not matching </g> when looking for <g
          const isOpeningG = nextGOpen !== -1 && 
                             (nextGOpen === 0 || svgString[nextGOpen - 1] !== '/') &&
                             nextGOpen < nextGClose
          
          if (isOpeningG) {
            depth++
            pos = nextGOpen + 2
          } else {
            depth--
            if (depth === 0) {
              endPos = nextGClose + 4
              break
            }
            pos = nextGClose + 4
          }
        }
        
        if (endPos !== -1) {
          const groupContent = svgString.substring(groupStart, endPos)
          sleeveGroups.push(groupContent)
          startIndex = endPos
        } else {
          break
        }
      } else {
        startIndex = groupTagEnd + 1
      }
    }
    
    if (sleeveGroups.length === 0) return null
    
    // Combine all sleeve groups
    const sleevesSvg = sleeveGroups.join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${sleevesSvg}</svg>`
  } catch (error) {
    console.warn('Error extracting sleeves:', error.message)
    return null
  }
}

/**
 * Extract wearable SVG content from full gotchi SVG
 */
function extractWearableSvg(fullSvg) {
  if (!fullSvg) return ''
  
  try {
    // Extract viewBox from original SVG
    const viewBoxMatch = fullSvg.match(/viewBox\s*=\s*["']([^"']+)["']/i)
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 64 64'
    
    // Find gotchi-wearable groups (handle nested groups and SVG tags)
    const wearableGroups = []
    let startIndex = 0
    
    while (true) {
      const groupStart = fullSvg.indexOf('<g', startIndex)
      if (groupStart === -1) break
      
      const groupTagEnd = fullSvg.indexOf('>', groupStart)
      if (groupTagEnd === -1) break
      
      const groupTag = fullSvg.substring(groupStart, groupTagEnd + 1)
      
      if (groupTag.includes('gotchi-wearable')) {
        // Find matching closing </g> tag (handle nesting of both <g> and <svg> tags)
        // We need to track depth for both <g> and <svg> tags
        let gDepth = 1  // Depth of <g> tags
        let svgDepth = 0  // Depth of <svg> tags
        let pos = groupTagEnd + 1
        let endPos = -1
        
        while (pos < fullSvg.length && gDepth > 0) {
          // Find next tags
          let nextGOpen = fullSvg.indexOf('<g', pos)
          const nextGClose = fullSvg.indexOf('</g>', pos)
          let nextSvgOpen = fullSvg.indexOf('<svg', pos)
          const nextSvgClose = fullSvg.indexOf('</svg>', pos)
          
          // Filter out closing tags - if we found <g but it's actually </g>, skip it
          while (nextGOpen !== -1 && nextGOpen > 0 && fullSvg[nextGOpen - 1] === '/') {
            nextGOpen = fullSvg.indexOf('<g', nextGOpen + 1)
          }
          while (nextSvgOpen !== -1 && nextSvgOpen > 0 && fullSvg[nextSvgOpen - 1] === '/') {
            nextSvgOpen = fullSvg.indexOf('<svg', nextSvgOpen + 1)
          }
          
          const isOpeningG = nextGOpen !== -1
          const isOpeningSvg = nextSvgOpen !== -1
          
          // Find the earliest tag
          const candidates = []
          if (isOpeningG) candidates.push({ pos: nextGOpen, type: 'g', isOpen: true })
          if (isOpeningSvg) candidates.push({ pos: nextSvgOpen, type: 'svg', isOpen: true })
          if (nextGClose !== -1) candidates.push({ pos: nextGClose, type: 'g', isOpen: false })
          if (nextSvgClose !== -1) candidates.push({ pos: nextSvgClose, type: 'svg', isOpen: false })
          
          if (candidates.length === 0) break
          
          const next = candidates.reduce((min, curr) => curr.pos < min.pos ? curr : min)
          
          if (next.isOpen) {
            // Opening tag
            if (next.type === 'g') {
              gDepth++
            } else {
              svgDepth++
            }
            pos = next.pos + (next.type === 'g' ? 2 : 4)
          } else {
            // Closing tag
            if (next.type === 'g') {
              gDepth--
              if (gDepth === 0) {
                // Found the matching closing </g> tag for our wearable group
                // All nested content (including SVG tags) is included
                endPos = next.pos + 4
                break
              }
            } else {
              svgDepth--
            }
            pos = next.pos + (next.type === 'g' ? 4 : 6)
          }
        }
        
        if (endPos !== -1) {
          const groupContent = fullSvg.substring(groupStart, endPos)
          wearableGroups.push(groupContent)
          startIndex = endPos
        } else {
          break
        }
      } else {
        startIndex = groupTagEnd + 1
      }
    }
    
    if (wearableGroups.length === 0) return ''
    
    // Combine all wearable groups
    let wearableContent = wearableGroups.join('')
    
    // Ensure only root-level <g> tags (with gotchi-wearable class) have xmlns attribute
    // Nested <g> tags should NOT have xmlns (matching Stage.vue behavior)
    wearableContent = wearableContent.replace(
      /<g([^>]*)>/gi,
      (match, attributes) => {
        // Only add xmlns to <g> tags that have gotchi-wearable class
        // Skip nested <g> tags (they don't have gotchi-wearable class)
        if (!attributes.includes('gotchi-wearable')) {
          return match // Return as-is for nested <g> tags
        }
        // Check if xmlns already exists
        if (match.includes('xmlns=')) {
          return match
        }
        // Add xmlns attribute only to root-level gotchi-wearable groups
        if (attributes.trim() === '') {
          return '<g xmlns="http://www.w3.org/2000/svg">'
        }
        return `<g xmlns="http://www.w3.org/2000/svg" ${attributes.trim()}>`
      }
    )
    
    // Check if content already has an SVG wrapper (it shouldn't, but be safe)
    // If it does, return as-is. Otherwise wrap in outer SVG for storage
    if (wearableContent.trim().startsWith('<svg')) {
      return wearableContent
    }
    
    // Wrap in SVG with viewBox for standalone use
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${wearableContent}</svg>`
  } catch (error) {
    console.warn('Error extracting wearable SVG:', error.message)
    return ''
  }
}

/**
 * Check if SVG has color dependencies (uses .gotchi-primary or .gotchi-secondary)
 */
function hasColorDeps(svgString) {
  if (!svgString) return false
  return svgString.includes('gotchi-primary') || svgString.includes('gotchi-secondary')
}

/**
 * Get all 4 views for a wearable
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
    
    // Parse response
    let sidesArray = []
    if (response && typeof response === 'object') {
      if (Array.isArray(response)) {
        sidesArray = response
      } else if (response.ag_ && Array.isArray(response.ag_)) {
        sidesArray = response.ag_
      } else if (typeof response.length === 'number' && response.length > 0) {
        sidesArray = []
        for (let i = 0; i < response.length; i++) {
          if (response[i] !== undefined) {
            sidesArray.push(response[i])
          }
        }
      }
    }
    
    // Determine view order
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
 * Export a single wearable in the new format
 */
async function exportWearable(contract, wearableId) {
  console.log(`\n=== Exporting wearable ${wearableId} ===`)
  
  // Fetch item type
  let itemType
  try {
    itemType = await contract.getItemType(wearableId)
  } catch (error) {
    console.error(`Error fetching item type: ${error.message}`)
    throw error
  }
  
  // Extract slot
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
    console.warn(`No slot found for wearable ${wearableId}, defaulting to 0`)
    slot = 0
  }
  
  // Get views
  console.log(`  Fetching 4 views...`)
  const views = await getWearableViews(contract, wearableId, slot)
  
  // Extract wearable SVGs and offsets for each side
  const frontWearableSvg = extractWearableSvg(views.front)
  const leftWearableSvg = extractWearableSvg(views.left)
  const rightWearableSvg = extractWearableSvg(views.right)
  const backWearableSvg = extractWearableSvg(views.back)
  
  const sides = {
    Front: {
      svg: frontWearableSvg,
      offset: extractOffset(views.front),
      hasColorDeps: hasColorDeps(frontWearableSvg)
    },
    Left: {
      svg: leftWearableSvg,
      offset: extractOffset(views.left),
      hasColorDeps: hasColorDeps(leftWearableSvg)
    },
    Right: {
      svg: rightWearableSvg,
      offset: extractOffset(views.right),
      hasColorDeps: hasColorDeps(rightWearableSvg)
    },
    Back: {
      svg: backWearableSvg,
      offset: extractOffset(views.back),
      hasColorDeps: hasColorDeps(backWearableSvg)
    }
  }
  
  // Extract sleeves (only for body wearables)
  const sleeves = slot === 0
    ? [
        extractSleeves(views.front),
        extractSleeves(views.left),
        extractSleeves(views.right),
        extractSleeves(views.back)
      ]
    : [null, null, null, null]
  
  // Build wearable object
  const wearable = {
    itemId: wearableId,
    name: itemType?.name || `Wearable #${wearableId}`,
    description: itemType?.description || '',
    rarity: getRarity(Number(itemType?.rarityScoreModifier || 0)),
    slot: slot,
    slotName: SLOT_NAMES[slot] || `Slot ${slot}`,
    slotPositions: slotPositionsArray,
    allowedCollaterals: (itemType?.allowedCollaterals || []).map(c => Number(c)),
    dimensions: {
      x: Number(itemType?.dimensions?.x || 0),
      y: Number(itemType?.dimensions?.y || 0),
      width: Number(itemType?.dimensions?.width || 0),
      height: Number(itemType?.dimensions?.height || 0)
    },
    sides: sides,
    sleeves: sleeves,
    metadata: {
      totalQuantity: Number(itemType?.totalQuantity || 0),
      svgId: Number(itemType?.svgId || 0),
      rarityScoreModifier: Number(itemType?.rarityScoreModifier || 0),
      canPurchaseWithGhst: Boolean(itemType?.canPurchaseWithGhst || false),
      minLevel: Number(itemType?.minLevel || 0),
      kinshipBonus: Number(itemType?.kinshipBonus || 0),
      experienceBonus: Number(itemType?.experienceBonus || 0),
      traitModifiers: (itemType?.traitModifiers || []).map(t => Number(t))
    }
  }
  
  console.log(`  ✓ Complete`)
  return wearable
}

/**
 * Main function
 */
async function main() {
  // Generate array of item IDs from 1 to 420
  const itemIds = Array.from({ length: 420 }, (_, i) => i + 1)
  
  console.log('=== Aavegotchi Wearable Tester ===')
  console.log(`Testing items: ${itemIds[0]}-${itemIds[itemIds.length - 1]} (${itemIds.length} items)`)
  console.log(`Contract: ${AAVEGOTCHI_DIAMOND}`)
  console.log(`Note: Items without valid SVGs will be skipped\n`)
  
  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
    console.log('✓ Connected to provider')
    
    // Create contract instance
    const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
    console.log('✓ Contract instance created\n')
    
    // Export all wearables
    const wearables = {}
    let successCount = 0
    let failCount = 0
    const skippedItems = []
    
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i]
      try {
        // First, check if item exists by trying to get item type
        // This will throw if the item doesn't exist
        try {
          await contract.getItemType(itemId)
        } catch (checkError) {
          // Item doesn't exist, skip it
          skippedItems.push(itemId)
          if ((i + 1) % 50 === 0 || i < 10) {
            console.log(`[${i + 1}/${itemIds.length}] Item ${itemId}: SKIPPED (does not exist)`)
          }
          continue
        }
        
        console.log(`\n[${i + 1}/${itemIds.length}] Processing item ${itemId}...`)
        const wearable = await exportWearable(contract, itemId)
        
        // Validate that we got valid SVG data
        const hasValidSvg = wearable.sides.Front.svg || 
                           wearable.sides.Left.svg || 
                           wearable.sides.Right.svg || 
                           wearable.sides.Back.svg
        
        if (!hasValidSvg) {
          console.warn(`  ⚠ Item ${itemId} has no valid SVG data, skipping`)
          skippedItems.push(itemId)
          failCount++
          continue
        }
        
        wearables[itemId] = wearable
        successCount++
        console.log(`✓ Successfully exported item ${itemId}`)
        
        // Small delay to avoid rate limiting (every 10 items)
        if ((i + 1) % 10 === 0 && i < itemIds.length - 1) {
          console.log('  Waiting 500ms to avoid rate limiting...')
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (error) {
        failCount++
        skippedItems.push(itemId)
        console.error(`✗ Failed to export wearable ${itemId}:`, error.message)
        // Continue processing other items
      }
    }
    
    console.log(`\n=== Summary ===`)
    console.log(`Successfully exported: ${successCount}/${itemIds.length}`)
    console.log(`Failed/Skipped: ${failCount + skippedItems.length}/${itemIds.length}`)
    console.log(`Skipped items (no SVG): ${skippedItems.length}`)
    if (skippedItems.length > 0 && skippedItems.length <= 50) {
      console.log(`Skipped item IDs: ${skippedItems.join(', ')}`)
    } else if (skippedItems.length > 50) {
      console.log(`Skipped item IDs (first 50): ${skippedItems.slice(0, 50).join(', ')}...`)
    }
    
    // Write to file
    const fs = await import('fs')
    const outputFile = 'wearables-1-420.json'
    fs.writeFileSync(outputFile, JSON.stringify({ wearables }, null, 2), 'utf8')
    console.log(`\n✓ Written to ${outputFile}`)
    console.log(`Total wearables exported: ${Object.keys(wearables).length}`)
    
  } catch (error) {
    console.error('\n✗ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the script
main()

