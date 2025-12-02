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
  }
]

// Eye color rarity mappings (trait value ranges)
// These map eye color trait values to rarity names
const EYE_COLOR_RARITY_MAP = {
  // Mythical Low: 0-1
  mythical_low: { min: 0, max: 1, color: '#FF00FF' },
  // Rare Low: 2-4
  rare_low: { min: 2, max: 4, color: '#0064FF' },
  // Uncommon Low: 5-9
  uncommon_low: { min: 5, max: 9, color: '#5D24BF' },
  // Common: 10-89 (uses collateral color)
  common: { min: 10, max: 89, color: null }, // null means use collateral primary color
  // Uncommon High: 90-94
  uncommon_high: { min: 90, max: 94, color: '#36818E' },
  // Rare High: 95-97
  rare_high: { min: 95, max: 97, color: '#EA8C27' },
  // Mythical High: 98-99
  mythical_high: { min: 98, max: 99, color: '#51FFA8' }
}

// Eye shape mappings based on https://wiki.aavegotchi.com/en/eye-shape
const EYE_SHAPE_MAP = [
  // Haunt 1-specific Mythical Low
  { name: 'Mythical-Low_1', rangeMin: 0, rangeMax: 0, rarity: 'MythicalLow', traitValue: 0, haunt: 1 },
  { name: 'Mythical-Low_2', rangeMin: 1, rangeMax: 1, rarity: 'MythicalLow', traitValue: 1, haunt: 1 },
  
  // Haunt 2-specific Mythical Low
  { name: 'Mythical-Low_1', rangeMin: 0, rangeMax: 0, rarity: 'MythicalLow', traitValue: 0, haunt: 2 },
  { name: 'Mythical-Low_2', rangeMin: 1, rangeMax: 1, rarity: 'MythicalLow', traitValue: 1, haunt: 2 },
  
  // Non-Haunt-specific
  { name: 'Rare-Low_1', rangeMin: 2, rangeMax: 4, rarity: 'RareLow', traitValue: 3, haunt: null },
  { name: 'Rare-Low_2', rangeMin: 5, rangeMax: 6, rarity: 'RareLow', traitValue: 5, haunt: null },
  { name: 'Rare-Low_3', rangeMin: 7, rangeMax: 9, rarity: 'RareLow', traitValue: 8, haunt: null },
  { name: 'Uncommon-Low_1', rangeMin: 10, rangeMax: 14, rarity: 'UncommonLow', traitValue: 12, haunt: null },
  { name: 'Uncommon-Low_2', rangeMin: 15, rangeMax: 19, rarity: 'UncommonLow', traitValue: 17, haunt: null },
  { name: 'Uncommon-Low_3', rangeMin: 20, rangeMax: 24, rarity: 'UncommonLow', traitValue: 22, haunt: null },
  { name: 'Common_1', rangeMin: 25, rangeMax: 41, rarity: 'Common', traitValue: 33, haunt: null },
  { name: 'Common_2', rangeMin: 42, rangeMax: 57, rarity: 'Common', traitValue: 50, haunt: null },
  { name: 'Common_3', rangeMin: 58, rangeMax: 74, rarity: 'Common', traitValue: 66, haunt: null },
  { name: 'Uncommon-High_1', rangeMin: 75, rangeMax: 79, rarity: 'UncommonHigh', traitValue: 77, haunt: null },
  { name: 'Uncommon-High_2', rangeMin: 80, rangeMax: 84, rarity: 'UncommonHigh', traitValue: 82, haunt: null },
  { name: 'Uncommon-High_3', rangeMin: 85, rangeMax: 89, rarity: 'UncommonHigh', traitValue: 87, haunt: null },
  { name: 'Rare-High_1', rangeMin: 90, rangeMax: 92, rarity: 'RareHigh', traitValue: 91, haunt: null },
  { name: 'Rare-High_2', rangeMin: 93, rangeMax: 94, rarity: 'RareHigh', traitValue: 93, haunt: null },
  { name: 'Rare-High_3', rangeMin: 95, rangeMax: 97, rarity: 'RareHigh', traitValue: 96, haunt: null },
  
  // Collateral-specific (98-99) - these vary by collateral, handled separately
  // For now, we'll use a generic name and handle per-collateral later
]

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
 * Extract eyes from SVG string
 */
function extractEyes(svgString, collateralColors, eyeColorHex) {
  if (!svgString) return null
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  const serializer = new XMLSerializer()
  
  // Find eye color group
  const eyeElements = findElements(doc, 'g', 'gotchi-eyeColor')
  if (eyeElements.length === 0) {
    return null
  }
  
  const eyeGroup = eyeElements[0]
  
  // Wrap in full SVG with style
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  
  // Add style block with collateral colors and eye color
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  const eyeColor = eyeColorHex || primaryColor // Use provided eye color or fallback to primary
  
  style.appendChild(doc.createTextNode(`
    .gotchi-primary{fill:${primaryColor};}
    .gotchi-secondary{fill:${secondaryColor};}
    .gotchi-cheek{fill:${cheekColor};}
    .gotchi-eyeColor{fill:${eyeColor};}
    .gotchi-primary-mouth{fill:${primaryColor};}
    .gotchi-sleeves-up{display:none;}
    .gotchi-handsUp{display:none;}
    .gotchi-handsDownOpen{display:block;}
    .gotchi-handsDownClosed{display:none;}
  `.trim()))
  wrapper.appendChild(style)
  
  // Clone eye group
  const clone = eyeGroup.cloneNode(true)
  wrapper.appendChild(clone)
  
  return serializer.serializeToString(wrapper)
}

/**
 * Get eye shape info from trait value
 */
function getEyeShapeInfo(traitValue) {
  for (const shape of EYE_SHAPE_MAP) {
    if (traitValue >= shape.rangeMin && traitValue <= shape.rangeMax) {
      return shape
    }
  }
  // Default to Common_2 (range 42-57)
  return EYE_SHAPE_MAP.find(s => s.name === 'Common_2') || EYE_SHAPE_MAP[7]
}

/**
 * Get folder name for eye shape
 * Format: Eyes/{collateral}/{Rarity}/{ShapeName}_Range_{min}-{max}/
 */
function getEyeShapeFolderName(shapeInfo) {
  return `${shapeInfo.name}_Range_${shapeInfo.rangeMin}-${shapeInfo.rangeMax}`
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
 * Generate eyes JSON for a single collateral and eye shape
 */
async function generateEyes(collateralData, eyeShapeTrait, eyeColorTrait, contract, hauntId = null) {
  const collateralAddress = collateralData.collateralType
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  // Use provided hauntId or default to collateral's haunt
  const finalHauntId = hauntId || collateralData.haunt || 1
  
  // Determine eye color based on trait value
  let eyeColorHex = null
  let rarityName = 'Common'
  
  for (const [rarity, config] of Object.entries(EYE_COLOR_RARITY_MAP)) {
    if (eyeColorTrait >= config.min && eyeColorTrait <= config.max) {
      eyeColorHex = config.color || collateralColors.primaryColor.replace('0x', '#')
      rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1).replace('_', '')
      break
    }
  }
  
  // Call previewSideAavegotchi with the eye shape trait
  // Traits: [NRG, AGG, SPK, BRN, EYS, EYC]
  // EYS = eye shape (index 4), EYC = eye color (index 5)
  const traits = [50, 50, 50, 50, eyeShapeTrait, eyeColorTrait]
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    finalHauntId,
    collateralAddress,
    traits,
    emptyWearables
  )
  
  // Parse response
  const svgArray = parsePreviewResponse(response)
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  const views = determineViewOrder(svgArray)
  
  // Extract eyes from each view
  const result = {
    eyes: []
  }
  
  const frontEyes = extractEyes(views.Front, collateralColors, eyeColorHex)
  if (frontEyes) result.eyes.push(frontEyes)
  
  const leftEyes = extractEyes(views.Left, collateralColors, eyeColorHex)
  if (leftEyes) result.eyes.push(leftEyes)
  
  const rightEyes = extractEyes(views.Right, collateralColors, eyeColorHex)
  if (rightEyes) result.eyes.push(rightEyes)
  
  const backEyes = extractEyes(views.Back, collateralColors, eyeColorHex)
  if (backEyes) result.eyes.push(backEyes)
  
  return {
    result,
    rarityName
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Generate All Eye JSONs ===\n')
  
  // Load collateral data
  const haunt1Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt2.json')
  
  let allCollaterals = []
  
  if (fs.existsSync(haunt1Path)) {
    const haunt1Data = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
    allCollaterals = allCollaterals.concat(haunt1Data.collaterals || [])
  }
  
  if (fs.existsSync(haunt2Path)) {
    const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
    allCollaterals = allCollaterals.concat(haunt2Data.collaterals || [])
  }
  
  console.log(`Found ${allCollaterals.length} collaterals\n`)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Create output directory
  const outputDir = path.join(__dirname, 'exports/Eyes')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Eye color rarity values to generate (one per rarity tier)
  const eyeColorTraits = [
    { trait: 1, rarity: 'MythicalLow' },    // 0-1
    { trait: 3, rarity: 'RareLow' },        // 2-4
    { trait: 7, rarity: 'UncommonLow' },    // 5-9
    { trait: 50, rarity: 'Common' },        // 10-89 (uses collateral color)
    { trait: 92, rarity: 'UncommonHigh' },  // 90-94
    { trait: 96, rarity: 'RareHigh' },     // 95-97
    { trait: 99, rarity: 'MythicalHigh' }  // 98-99
  ]
  
  // Eye shapes to generate - will be filtered per collateral based on haunt
  // Collateral-specific shapes (98-99) will be added dynamically
  
  // Process each collateral
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < allCollaterals.length; i++) {
    const collateral = allCollaterals[i]
    const collateralName = collateral.name.toLowerCase()
    
    console.log(`\n[${i + 1}/${allCollaterals.length}] Processing ${collateral.name}...`)
    
    // Determine haunt for this collateral
    const collateralHaunt = collateral.haunt || 1 // Default to haunt 1
    
    // Filter eye shapes based on haunt:
    // - Include non-haunt-specific shapes (haunt: null)
    // - Include shapes matching this collateral's haunt
    let eyeShapesToGenerate = EYE_SHAPE_MAP.filter(s => 
      s.haunt === null || s.haunt === collateralHaunt
    )
    
    // Add collateral-specific eye shape (98-99)
    // Format: {collateral}Collateral (e.g., "maDAICollateral", "amDAICollateral")
    const collateralShapeName = `${collateral.name}Collateral`
    eyeShapesToGenerate.push({
      name: collateralShapeName,
      rangeMin: 98,
      rangeMax: 99,
      rarity: 'Collateral',
      traitValue: 98,
      haunt: collateralHaunt
    })
    
    // Create collateral directory
    const collateralDir = path.join(outputDir, collateralName)
    if (!fs.existsSync(collateralDir)) {
      fs.mkdirSync(collateralDir, { recursive: true })
    }
    
    // Generate eyes for each eye shape
    for (const shapeConfig of eyeShapesToGenerate) {
      // Create rarity directory: Eyes/{collateral}/{Rarity}/
      const rarityDir = path.join(collateralDir, shapeConfig.rarity)
      if (!fs.existsSync(rarityDir)) {
        fs.mkdirSync(rarityDir, { recursive: true })
      }
      
      // Create shape folder: {ShapeName}_Range_{min}-{max}/
      const shapeFolderName = getEyeShapeFolderName(shapeConfig)
      const shapeDir = path.join(rarityDir, shapeFolderName)
      if (!fs.existsSync(shapeDir)) {
        fs.mkdirSync(shapeDir, { recursive: true })
      }
      
      console.log(`  Eye Shape ${shapeConfig.name} (${shapeConfig.rarity}, Range ${shapeConfig.rangeMin}-${shapeConfig.rangeMax})...`)
      
      // Generate eyes for each eye color rarity
      for (const eyeColorConfig of eyeColorTraits) {
        try {
          const { result, rarityName } = await generateEyes(
            collateral,
            shapeConfig.traitValue,
            eyeColorConfig.trait,
            contract,
            collateralHaunt
          )
          
          if (result.eyes.length > 0) {
            // Save JSON file with descriptive name
            const filename = `eyes-${eyeColorConfig.rarity.toLowerCase()}-${Date.now()}.json`
            const filepath = path.join(shapeDir, filename)
            fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8')
            
            console.log(`    ✓ ${rarityName}: ${result.eyes.length} views`)
            
            successCount++
          } else {
            console.log(`    ⚠ ${rarityName}: No eyes extracted`)
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`    ✗ Error processing ${eyeColorConfig.rarity}:`, error.message)
          errors.push({ 
            collateral: collateral.name, 
            shapeName: shapeConfig.name,
            rarity: eyeColorConfig.rarity,
            error: error.message 
          })
          errorCount++
        }
      }
    }
  }
  
  // Summary
  console.log('\n=== Summary ===')
  console.log(`Total collaterals: ${allCollaterals.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log(`  - ${e.collateral} (${e.rarity}): ${e.error}`))
  }
  
  console.log(`\nFiles saved to: ${outputDir}`)
}

// Run the script
main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

