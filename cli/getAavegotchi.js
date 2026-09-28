import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Aavegotchi core subgraph (Aarcade home Envio indexer, keyless proxy)
const SUBGRAPH_URL = process.env.AAVEGOTCHI_SUBGRAPH_URL || 'https://aarcadeghst.com/api/subgraph/aavegotchi-core-base'

const AAVEGOTCHI_QUERY = `query ($id: ID!) {
  aavegotchi(id: $id) {
    gotchiId name hauntId collateral kinship experience level status
    numericTraits equippedWearables stakedAmount minimumStake baseRarityScore
  }
}`

async function fetchAavegotchi(tokenId) {
  const res = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: AAVEGOTCHI_QUERY, variables: { id: String(tokenId) } })
  })
  if (!res.ok) throw new Error(`Subgraph HTTP ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(json.errors.map(e => e.message).join('; '))
  if (!json.data?.aavegotchi) throw new Error(`Aavegotchi ${tokenId} not found in the subgraph`)
  return json.data.aavegotchi
}

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
  console.log(`Subgraph: ${SUBGRAPH_URL}\n`)

  try {
    console.log('Fetching Aavegotchi data...')
    const gotchi = await fetchAavegotchi(tokenId)

    // Parse numeric traits
    const numericTraits = gotchi.numericTraits.map(t => Number(t))
    const [nrg, agg, spk, brn, eys, eyc] = numericTraits

    // Calculate BRS
    const calculatedBRS = calculateBRS(numericTraits)

    // Parse equipped wearables
    const equippedWearables = gotchi.equippedWearables.map(w => Number(w)).filter(w => w > 0)

    // Build result object
    const result = {
      tokenId: Number(gotchi.gotchiId),
      name: gotchi.name,
      hauntId: Number(gotchi.hauntId),
      collateral: gotchi.collateral,
      kinship: Number(gotchi.kinship),
      experience: Number(gotchi.experience),
      level: Number(gotchi.level),
      brs: {
        contract: Number(gotchi.baseRarityScore),
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

