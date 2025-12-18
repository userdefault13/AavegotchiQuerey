import { ethers } from 'ethers'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
 * Load collateral data from JSON files
 */
function loadCollateralData(collateralAddress) {
  const haunt1Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt2.json')
  
  let collaterals = []
  
  if (fs.existsSync(haunt1Path)) {
    const haunt1Data = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
    collaterals = collaterals.concat(haunt1Data.collaterals || [])
  }
  
  if (fs.existsSync(haunt2Path)) {
    const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
    collaterals = collaterals.concat(haunt2Data.collaterals || [])
  }
  
  const collateral = collaterals.find(c => 
    c.collateralType.toLowerCase() === collateralAddress.toLowerCase()
  )
  
  return collateral
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
 * Find elements by class name
 */
function findElementsByClass(doc, className) {
  const results = []
  const allGroups = doc.getElementsByTagName('g')
  
  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i]
    const nodeClass = (group.getAttribute('class') || '').trim()
    const classes = nodeClass.split(/\s+/).filter(c => c.length > 0)
    
    if (classes.includes(className) || nodeClass.toLowerCase().includes(className.toLowerCase())) {
      results.push(group)
    }
  }
  
  return results
}

/**
 * Extract all three hand states from a hands SVG
 */
function extractAllHandStates(handsSVG, collateralColors, viewBox = '0 0 64 64') {
  const parser = new DOMParser()
  const doc = parser.parseFromString(handsSVG, 'image/svg+xml')
  const serializer = new XMLSerializer()
  
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  
  const states = {
    up: null,
    downOpen: null,
    downClosed: null
  }
  
  // Extract each state
  const handsUpGroups = findElementsByClass(doc, 'gotchi-handsUp')
  const handsDownOpenGroups = findElementsByClass(doc, 'gotchi-handsDownOpen')
  const handsDownClosedGroups = findElementsByClass(doc, 'gotchi-handsDownClosed')
  
  // Helper to wrap in SVG with appropriate CSS
  const wrapInSvg = (element, visibleState) => {
    if (!element) return null
    
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    // Add style block
    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
    const cssRules = [
      `.gotchi-primary{fill:${primaryColor};}`,
      `.gotchi-secondary{fill:${secondaryColor};}`,
      `.gotchi-cheek{fill:${cheekColor};}`,
      `.gotchi-eyeColor{fill:${primaryColor};}`,
      `.gotchi-primary-mouth{fill:${primaryColor};}`,
      `.gotchi-sleeves-up{display:none;}`,
      `.gotchi-handsUp{display:${visibleState === 'up' ? 'block' : 'none'};}`,
      `.gotchi-handsDownOpen{display:${visibleState === 'downOpen' ? 'block' : 'none'};}`,
      `.gotchi-handsDownClosed{display:${visibleState === 'downClosed' ? 'block' : 'none'};}`
    ].join('\n        ')
    
    style.appendChild(doc.createTextNode(cssRules))
    wrapper.appendChild(style)
    
    // Clone and append the hand group
    const clone = element.cloneNode(true)
    wrapper.appendChild(clone)
    
    return serializer.serializeToString(wrapper)
  }
  
  // Extract each state
  if (handsUpGroups.length > 0) {
    states.up = wrapInSvg(handsUpGroups[0], 'up')
  }
  
  if (handsDownOpenGroups.length > 0) {
    states.downOpen = wrapInSvg(handsDownOpenGroups[0], 'downOpen')
  }
  
  if (handsDownClosedGroups.length > 0) {
    states.downClosed = wrapInSvg(handsDownClosedGroups[0], 'downClosed')
  }
  
  return states
}

/**
 * Update collateral base JSON with all three hand states
 */
async function updateCollateralBaseWithAllHandStates(jsonPath) {
  console.log('=== Extract All Hand States ===')
  console.log(`JSON file: ${jsonPath}\n`)
  
  // Read existing JSON
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  
  // Extract collateral name from filename
  const filename = path.basename(jsonPath)
  const collateralNameMatch = filename.match(/collateral-base-(\w+)-/)
  const collateralName = collateralNameMatch ? collateralNameMatch[1] : null
  
  if (!collateralName) {
    throw new Error('Could not determine collateral name from filename')
  }
  
  // Find collateral address by name (case-insensitive search)
  let collateralAddress = null
  const haunt1Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt2.json')
  
  const searchCollaterals = (collaterals) => {
    return collaterals.find(c => 
      c.name.toLowerCase() === collateralName.toLowerCase() ||
      c.name.toLowerCase().replace(/^ma|^am/, '').toLowerCase() === collateralName.toLowerCase()
    )
  }
  
  if (fs.existsSync(haunt1Path)) {
    const haunt1Data = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
    const found = searchCollaterals(haunt1Data.collaterals || [])
    if (found) collateralAddress = found.collateralType
  }
  
  if (!collateralAddress && fs.existsSync(haunt2Path)) {
    const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
    const found = searchCollaterals(haunt2Data.collaterals || [])
    if (found) collateralAddress = found.collateralType
  }
  
  if (!collateralAddress) {
    throw new Error(`Could not find collateral address for: ${collateralName}`)
  }
  
  // Load collateral data
  const collateralData = loadCollateralData(collateralAddress)
  if (!collateralData) {
    throw new Error(`Collateral ${collateralAddress} not found`)
  }
  
  console.log(`Collateral: ${collateralData.name}`)
  console.log(`Colors: ${collateralData.primaryColor}, ${collateralData.secondaryColor}\n`)
  
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Call previewSideAavegotchi to get full hands SVG
  console.log('Calling previewSideAavegotchi...')
  const hauntId = 1
  const traits = [50, 50, 50, 50, 50, 50]
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    hauntId,
    collateralAddress,
    traits,
    emptyWearables
  )
  
  const svgArray = parsePreviewResponse(response)
  const frontView = svgArray[0]
  
  // Find the hands groups in the front view
  const parser = new DOMParser()
  const doc = parser.parseFromString(frontView, 'image/svg+xml')
  const viewBox = doc.documentElement.getAttribute('viewBox') || '0 0 64 64'
  
  // Extract all three hand states
  const allHandStates = extractAllHandStates(frontView, collateralColors, viewBox)
  
  console.log('Extracted hand states:')
  console.log(`  Hands Up: ${allHandStates.up ? '✓' : '✗'}`)
  console.log(`  Hands Down Open: ${allHandStates.downOpen ? '✓' : '✗'}`)
  console.log(`  Hands Down Closed: ${allHandStates.downClosed ? '✓' : '✗'}\n`)
  
  // Update JSON - replace hands array with all three states
  jsonContent.hands = []
  
  if (allHandStates.downClosed) {
    jsonContent.hands.push(allHandStates.downClosed)
  }
  if (allHandStates.downOpen) {
    jsonContent.hands.push(allHandStates.downOpen)
  }
  if (allHandStates.up) {
    jsonContent.hands.push(allHandStates.up)
  }
  
  // Save updated JSON
  fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf8')
  
  console.log(`✓ Updated JSON saved to: ${jsonPath}`)
  console.log(`  Hands array now contains ${jsonContent.hands.length} states\n`)
}

// Export functions for use in other scripts
export { updateCollateralBaseWithAllHandStates, extractAllHandStates, loadCollateralData, parsePreviewResponse }

// Main execution (only if run directly)
const args = process.argv.slice(2)
const jsonPath = args[0]

if (jsonPath) {
  updateCollateralBaseWithAllHandStates(jsonPath).catch(error => {
    console.error('\n✗ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  })
} else if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('extractAllHandsStates.js')) {
  console.log('Usage: node cli/extractAllHandsStates.js <json_file_path>')
  console.log('')
  console.log('Example:')
  console.log('  node cli/extractAllHandsStates.js cli/exports/Body/collateral-base-amaave-1764615569457.json')
  process.exit(1)
}

