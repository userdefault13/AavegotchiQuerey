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

// Aavegotchi contract ABI - getAavegotchi function
const AAVEGOTCHI_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: '_tokenId', type: 'uint256' }],
    name: 'getAavegotchi',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'uint256', name: 'randomNumber', type: 'uint256' },
          { internalType: 'uint256', name: 'randomNumber2', type: 'uint256' },
          { internalType: 'uint256', name: 'status', type: 'uint256' },
          { internalType: 'int16[6]', name: 'numericTraits', type: 'int16[6]' },
          { internalType: 'int16[6]', name: 'modifiedNumericTraits', type: 'int16[6]' },
          { internalType: 'uint16[16]', name: 'equippedWearables', type: 'uint16[16]' },
          { internalType: 'address', name: 'collateral', type: 'address' },
          { internalType: 'address', name: 'escrow', type: 'address' },
          { internalType: 'uint256', name: 'stakedAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'minimumStake', type: 'uint256' },
          { internalType: 'uint256', name: 'kinship', type: 'uint256' },
          { internalType: 'uint256', name: 'lastInteracted', type: 'uint256' },
          { internalType: 'uint256', name: 'experience', type: 'uint256' },
          { internalType: 'uint256', name: 'toNextLevel', type: 'uint256' },
          { internalType: 'uint256', name: 'level', type: 'uint256' },
          { internalType: 'uint256', name: 'hauntId', type: 'uint256' },
          { internalType: 'uint256', name: 'owner', type: 'uint256' },
          { internalType: 'uint8', name: 'brs', type: 'uint8' },
          { internalType: 'uint8', name: 'brsLastModified', type: 'uint8' },
          { internalType: 'uint256', name: 'locked', type: 'uint256' }
        ],
        internalType: 'struct AavegotchiInfo',
        name: '',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

/**
 * Calculate BRS from numeric traits
 */
function calculateBRS(numericTraits) {
  const calculateTraitBRS = (trait) => {
    return trait >= 50 ? trait : 100 - trait
  }
  
  return numericTraits.reduce((sum, trait) => sum + calculateTraitBRS(Number(trait)), 0)
}

/**
 * Get Aavegotchi data by token ID
 */
export async function getAavegotchi(tokenId) {
  console.log('=== Aavegotchi Query CLI ===')
  console.log(`Querying token ID: ${tokenId}`)
  console.log(`Contract: ${AAVEGOTCHI_DIAMOND}`)
  console.log(`RPC: ${ALCHEMY_RPC_URL.replace(ALCHEMY_API_KEY, '***')}\n`)

  try {
    // Connect to provider
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
    console.log('✓ Connected to provider')

    // Create contract instance
    const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
    console.log('✓ Contract instance created\n')

    // Fetch Aavegotchi data
    console.log('Fetching Aavegotchi data...')
    const gotchi = await contract.getAavegotchi(tokenId)

    // Parse numeric traits
    const numericTraits = gotchi.numericTraits.map(t => Number(t))
    const [nrg, agg, spk, brn, eys, eyc] = numericTraits

    // Calculate BRS
    const calculatedBRS = calculateBRS(numericTraits)

    // Parse equipped wearables
    const equippedWearables = gotchi.equippedWearables.map(w => Number(w)).filter(w => w > 0)

    // Build result object
    const result = {
      tokenId: Number(gotchi.tokenId),
      name: gotchi.name,
      hauntId: Number(gotchi.hauntId),
      collateral: gotchi.collateral,
      kinship: Number(gotchi.kinship),
      experience: Number(gotchi.experience),
      level: Number(gotchi.level),
      brs: {
        contract: Number(gotchi.brs),
        calculated: calculatedBRS
      },
      traits: {
        nrg,
        agg,
        spk,
        brn,
        eys,
        eyc,
        numericTraits
      },
      equippedWearables,
      stakedAmount: gotchi.stakedAmount.toString(),
      minimumStake: gotchi.minimumStake.toString(),
      status: Number(gotchi.status)
    }

    // Display results
    console.log('✓ Aavegotchi data fetched successfully\n')
    console.log('=== Results ===')
    console.log(`Token ID: ${result.tokenId}`)
    console.log(`Name: ${result.name || 'Unnamed'}`)
    console.log(`Haunt: ${result.hauntId}`)
    console.log(`Collateral: ${result.collateral}`)
    console.log(`Kinship: ${result.kinship}`)
    console.log(`Experience: ${result.experience}`)
    console.log(`Level: ${result.level}`)
    console.log(`BRS: ${result.brs.calculated} (contract: ${result.brs.contract})`)
    console.log(`\nTraits:`)
    console.log(`  NRG: ${nrg}`)
    console.log(`  AGG: ${agg}`)
    console.log(`  SPK: ${spk}`)
    console.log(`  BRN: ${brn}`)
    console.log(`  EYS: ${eys} (Eye Shape)`)
    console.log(`  EYC: ${eyc} (Eye Color)`)
    console.log(`\nEquipped Wearables: ${equippedWearables.length > 0 ? equippedWearables.join(', ') : 'None'}`)

    // Optionally save to JSON file
    const saveToFile = process.argv.includes('--save') || process.argv.includes('-s')
    if (saveToFile) {
      const outputDir = path.join(__dirname, 'exports')
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      
      const filename = `aavegotchi-${tokenId}-${Date.now()}.json`
      const filepath = path.join(outputDir, filename)
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8')
      console.log(`\n✓ Saved to: ${filepath}`)
    }

    return result
  } catch (error) {
    console.error('\n✗ Error:', error.message)
    if (error.message.includes('execution reverted')) {
      console.error('  This token ID may not exist or may not be an Aavegotchi')
    }
    console.error(error.stack)
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  const tokenId = process.argv[2] ? parseInt(process.argv[2]) : null

  if (!tokenId || isNaN(tokenId)) {
    console.log('Aavegotchi Query CLI')
    console.log('Usage: node cli/getAavegotchi.js <tokenId> [--save]')
    console.log('')
    console.log('Arguments:')
    console.log('  tokenId  - Aavegotchi token ID to query (required)')
    console.log('  --save   - Save results to JSON file (optional)')
    console.log('')
    console.log('Examples:')
    console.log('  node cli/getAavegotchi.js 1')
    console.log('  node cli/getAavegotchi.js 123 --save')
    console.log('  npm run get-aavegotchi 456')
    process.exit(1)
  }

  await getAavegotchi(tokenId)
}

// Run the script only if this is the main module
// Check if this file is being run directly (not imported)
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('getAavegotchi.js') ||
  process.argv[1].includes('getAavegotchi.js')
)

if (isMainModule) {
  main()
}

