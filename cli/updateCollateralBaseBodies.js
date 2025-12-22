import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const BODY_SVGS_JSON = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output/body-svgs.json')
const COLLATERAL_BASE_DIR = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/Body')

/**
 * Update collateral-base JSON files with new body SVGs
 * Body array order: [front, left, right, back]
 */
async function updateCollateralBaseBodies() {
  console.log('Updating collateral-base JSON files with new body SVGs...\n')
  
  // Read body-svgs.json
  if (!fs.existsSync(BODY_SVGS_JSON)) {
    console.error(`Error: ${BODY_SVGS_JSON} not found!`)
    console.error('Please run: npm run extract-all-body-with-cheeks first')
    process.exit(1)
  }
  
  const bodySvgsData = JSON.parse(fs.readFileSync(BODY_SVGS_JSON, 'utf8'))
  const bodies = bodySvgsData.bodies
  
  // Find all collateral-base JSON files
  const collateralFiles = fs.readdirSync(COLLATERAL_BASE_DIR)
    .filter(file => file.startsWith('collateral-base-') && file.endsWith('.json'))
    .sort()
  
  if (collateralFiles.length === 0) {
    console.log('No collateral-base JSON files found!')
    return
  }
  
  console.log(`Found ${collateralFiles.length} collateral-base files\n`)
  
  let updated = 0
  let skipped = 0
  
  for (const file of collateralFiles) {
    // Extract collateral name from filename: collateral-base-{name}.json
    const match = file.match(/^collateral-base-(.+)\.json$/)
    if (!match) {
      console.log(`  ⚠️  Skipping invalid filename: ${file}`)
      skipped++
      continue
    }
    
    const collateralName = match[1]
    
    // Check if we have SVGs for this collateral
    if (!bodies[collateralName]) {
      console.log(`  ⚠️  No SVGs found for collateral: ${collateralName}`)
      skipped++
      continue
    }
    
    const collateralSvgs = bodies[collateralName]
    
    // Check if all views exist
    const requiredViews = ['front', 'left', 'right', 'back']
    const missingViews = requiredViews.filter(view => !collateralSvgs[view])
    
    if (missingViews.length > 0) {
      console.log(`  ⚠️  Missing views for ${collateralName}: ${missingViews.join(', ')}`)
      skipped++
      continue
    }
    
    // Read the collateral-base JSON file
    const filePath = path.join(COLLATERAL_BASE_DIR, file)
    const collateralData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    
    // Update body array in order: [front, left, right, back]
    collateralData.body = [
      collateralSvgs.front,
      collateralSvgs.left,
      collateralSvgs.right,
      collateralSvgs.back
    ]
    
    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(collateralData, null, 2), 'utf8')
    
    console.log(`  ✓ Updated ${collateralName}`)
    updated++
  }
  
  console.log(`\n=== Complete ===`)
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
}

updateCollateralBaseBodies().catch(console.error)

