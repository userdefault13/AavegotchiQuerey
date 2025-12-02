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
 * Extract collateral from SVG string
 */
function extractCollateral(svgString, collateralColors) {
  if (!svgString) return null
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  const serializer = new XMLSerializer()
  
  // Find collateral group
  const collateralElements = findElements(doc, 'g', 'gotchi-collateral')
  if (collateralElements.length === 0) {
    return null
  }
  
  const collateralGroup = collateralElements[0]
  
  // Wrap in full SVG with style
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  
  // Add style block with collateral colors
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  
  style.appendChild(doc.createTextNode(`
    .gotchi-primary{fill:${primaryColor};}
    .gotchi-secondary{fill:${secondaryColor};}
    .gotchi-cheek{fill:${cheekColor};}
    .gotchi-eyeColor{fill:${primaryColor};}
    .gotchi-primary-mouth{fill:${primaryColor};}
    .gotchi-sleeves-up{display:none;}
    .gotchi-handsUp{display:none;}
    .gotchi-handsDownOpen{display:block;}
    .gotchi-handsDownClosed{display:none;}
  `.trim()))
  wrapper.appendChild(style)
  
  // Clone collateral group
  const clone = collateralGroup.cloneNode(true)
  wrapper.appendChild(clone)
  
  return serializer.serializeToString(wrapper)
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
 * Generate collateral JSON for a single collateral
 */
async function generateCollateral(collateralData, contract) {
  const collateralAddress = collateralData.collateralType
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  console.log(`\nProcessing ${collateralData.name} (${collateralAddress})...`)
  
  // Call previewSideAavegotchi
  const hauntId = 1
  const neutralTraits = [50, 50, 50, 50, 50, 50]
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    hauntId,
    collateralAddress,
    neutralTraits,
    emptyWearables
  )
  
  // Parse response
  const svgArray = parsePreviewResponse(response)
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  const views = determineViewOrder(svgArray)
  
  // Extract collateral from each view
  const result = {
    collateral: []
  }
  
  const frontCollateral = extractCollateral(views.Front, collateralColors)
  if (frontCollateral) result.collateral.push(frontCollateral)
  
  const leftCollateral = extractCollateral(views.Left, collateralColors)
  if (leftCollateral) result.collateral.push(leftCollateral)
  
  const rightCollateral = extractCollateral(views.Right, collateralColors)
  if (rightCollateral) result.collateral.push(rightCollateral)
  
  const backCollateral = extractCollateral(views.Back, collateralColors)
  if (backCollateral) result.collateral.push(backCollateral)
  
  return result
}

/**
 * Main function
 */
async function main() {
  console.log('=== Generate All Collateral JSONs ===\n')
  
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
  const outputDir = path.join(__dirname, 'exports/Collaterals')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Process each collateral
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < allCollaterals.length; i++) {
    const collateral = allCollaterals[i]
    
    try {
      const result = await generateCollateral(collateral, contract)
      
      // Save individual file
      const filename = `collateral-${collateral.name.toLowerCase()}-${Date.now()}.json`
      const filepath = path.join(outputDir, filename)
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8')
      
      console.log(`✓ [${i + 1}/${allCollaterals.length}] Saved: ${filename}`)
      console.log(`  Collateral views: ${result.collateral.length}`)
      
      successCount++
      
      // Small delay to avoid rate limiting
      if (i < allCollaterals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`✗ [${i + 1}/${allCollaterals.length}] Error processing ${collateral.name}:`, error.message)
      errors.push({ collateral: collateral.name, error: error.message })
      errorCount++
    }
  }
  
  // Summary
  console.log('\n=== Summary ===')
  console.log(`Total collaterals: ${allCollaterals.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log(`  - ${e.collateral}: ${e.error}`))
  }
  
  console.log(`\nFiles saved to: ${outputDir}`)
}

// Run the script
main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

