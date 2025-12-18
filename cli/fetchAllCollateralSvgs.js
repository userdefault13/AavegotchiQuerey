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
 * Parse previewSideAavegotchi response
 */
function parsePreviewResponse(response) {
  let svgArray = []
  
  if (Array.isArray(response)) {
    svgArray = response
  } else if (response && response.ag_) {
    svgArray = Array.isArray(response.ag_) ? response.ag_ : [response.ag_]
  } else if (response && typeof response.length === 'number') {
    // Handle Proxy array
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
 * Load all collaterals from JSON files
 */
function loadAllCollaterals() {
  const haunt1Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt2.json')
  
  let allCollaterals = []
  
  // Load haunt 1 collaterals
  if (fs.existsSync(haunt1Path)) {
    const haunt1Data = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
    const collaterals = haunt1Data.collaterals || []
    allCollaterals = allCollaterals.concat(collaterals.map(c => ({ ...c, haunt: 1 })))
    console.log(`Loaded ${collaterals.length} collaterals from haunt 1`)
  } else {
    console.warn(`Warning: ${haunt1Path} not found`)
  }
  
  // Load haunt 2 collaterals
  if (fs.existsSync(haunt2Path)) {
    const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
    const collaterals = haunt2Data.collaterals || []
    allCollaterals = allCollaterals.concat(collaterals.map(c => ({ ...c, haunt: c.haunt || 2 })))
    console.log(`Loaded ${collaterals.length} collaterals from haunt 2`)
  } else {
    console.warn(`Warning: ${haunt2Path} not found`)
  }
  
  return allCollaterals
}

/**
 * Fetch SVG array for a single collateral
 */
async function fetchCollateralSvgs(collateral, provider, contract) {
  const { collateralType, haunt, name } = collateral
  
  console.log(`\nProcessing: ${name} (${collateralType})`)
  console.log(`  Haunt: ${haunt}`)
  
  try {
    // Call previewSideAavegotchi
    const traits = [50, 50, 50, 50, 50, 50]
    const emptyWearables = new Array(16).fill(0)
    
    const response = await contract.previewSideAavegotchi(
      haunt,
      collateralType,
      traits,
      emptyWearables
    )
    
    // Parse response
    const svgArray = parsePreviewResponse(response)
    
    if (svgArray.length < 4) {
      throw new Error(`Expected 4 views, got ${svgArray.length}`)
    }
    
    console.log(`  ✓ Received ${svgArray.length} SVG views`)
    
    return {
      collateralAddress: collateralType,
      name: name,
      haunt: haunt,
      timestamp: Date.now(),
      svgs: svgArray
    }
  } catch (error) {
    console.error(`  ✗ Error fetching ${name}:`, error.message)
    throw error
  }
}

/**
 * Main function
 */
async function main() {
  console.log('=== Fetch All Collateral SVGs ===\n')
  
  // Load all collaterals
  const allCollaterals = loadAllCollaterals()
  
  if (allCollaterals.length === 0) {
    console.error('No collaterals found!')
    process.exit(1)
  }
  
  console.log(`\nTotal collaterals to process: ${allCollaterals.length}\n`)
  
  // Setup provider and contract
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Create output directory
  const outputDir = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`Created output directory: ${outputDir}\n`)
  }
  
  // Process each collateral
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < allCollaterals.length; i++) {
    const collateral = allCollaterals[i]
    const { name } = collateral
    
    try {
      console.log(`[${i + 1}/${allCollaterals.length}]`)
      
      const result = await fetchCollateralSvgs(collateral, provider, contract)
      
      // Save to file
      const filename = `collateral-${name.toLowerCase()}-haunt${result.haunt}-${result.timestamp}.json`
      const outputPath = path.join(outputDir, filename)
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
      
      console.log(`  ✓ Saved to: ${filename}`)
      successCount++
      
      // Small delay to avoid rate limiting
      if (i < allCollaterals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`  ✗ Failed to process ${name}`)
      errorCount++
      errors.push({ name, error: error.message })
    }
  }
  
  // Summary
  console.log('\n=== Summary ===')
  console.log(`Total: ${allCollaterals.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`)
    })
  }
  
  console.log(`\n✓ Output directory: ${outputDir}`)
}

// Run the script
main().catch(error => {
  console.error('\n✗ Fatal Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

