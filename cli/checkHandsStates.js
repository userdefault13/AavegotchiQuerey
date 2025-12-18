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
 * Find all hand groups in SVG
 */
function findHandGroups(svgString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  
  const handGroups = []
  
  // Find all groups with hand-related classes
  const allGroups = doc.getElementsByTagName('g')
  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i]
    const className = (group.getAttribute('class') || '').toLowerCase()
    
    if (className.includes('gotchi-hand')) {
      handGroups.push({
        className: group.getAttribute('class'),
        hasUp: className.includes('handsup') || className.includes('hands-up'),
        hasDownOpen: className.includes('handsdownopen') || className.includes('hands-down-open'),
        hasDownClosed: className.includes('handsdownclosed') || className.includes('hands-down-closed'),
        content: group.toString()
      })
    }
  }
  
  return handGroups
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const collateralAddress = args[0] || '0x8c8bdBe9CeE455732525086264a4Bf9Cf821C498'
  
  console.log('=== Check Hands States ===')
  console.log(`Collateral: ${collateralAddress}\n`)
  
  // Load collateral data
  const collateralData = loadCollateralData(collateralAddress)
  if (!collateralData) {
    console.error(`Collateral ${collateralAddress} not found`)
    process.exit(1)
  }
  
  console.log(`Found: ${collateralData.name}\n`)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Call previewSideAavegotchi
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
  console.log(`Received ${svgArray.length} views\n`)
  
  // Check Front view for hands
  const frontView = svgArray[0]
  console.log('=== Front View Hands Analysis ===\n')
  
  const handGroups = findHandGroups(frontView)
  console.log(`Found ${handGroups.length} hand-related groups:\n`)
  
  handGroups.forEach((group, idx) => {
    console.log(`Group ${idx + 1}: ${group.className}`)
    console.log(`  - Has Up: ${group.hasUp}`)
    console.log(`  - Has Down Open: ${group.hasDownOpen}`)
    console.log(`  - Has Down Closed: ${group.hasDownClosed}`)
    console.log(`  - Content length: ${group.content.length} chars\n`)
  })
  
  // Check for all three states using getElementsByTagName
  const parser = new DOMParser()
  const doc = parser.parseFromString(frontView, 'image/svg+xml')
  
  const allGroups = doc.getElementsByTagName('g')
  let hasHandsUp = false
  let hasHandsDownOpen = false
  let hasHandsDownClosed = false
  
  for (let i = 0; i < allGroups.length; i++) {
    const className = (allGroups[i].getAttribute('class') || '').toLowerCase()
    if (className.includes('gotchi-handsup')) hasHandsUp = true
    if (className.includes('gotchi-handsdownopen')) hasHandsDownOpen = true
    if (className.includes('gotchi-handsdownclosed')) hasHandsDownClosed = true
  }
  
  console.log('=== State Detection ===')
  console.log(`Hands Up state: ${hasHandsUp ? '✓ Found' : '✗ Not found'}`)
  console.log(`Hands Down Open state: ${hasHandsDownOpen ? '✓ Found' : '✗ Not found'}`)
  console.log(`Hands Down Closed state: ${hasHandsDownClosed ? '✓ Found' : '✗ Not found'}`)
  
  // Save full SVG to file for inspection
  const outputPath = path.join(__dirname, 'exports', `hands-inspection-${collateralData.name.toLowerCase()}.svg`)
  fs.writeFileSync(outputPath, frontView, 'utf8')
  console.log(`\n✓ Full SVG saved to: ${outputPath}`)
}

main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

