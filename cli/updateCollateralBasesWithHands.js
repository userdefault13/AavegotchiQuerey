import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Extract collateral name from filename
 * e.g., "collateral-base-amaave-1764615569457.json" -> "amaave"
 */
function extractCollateralName(filename) {
  const match = filename.match(/collateral-base-([^-]+)-/)
  return match ? match[1] : null
}

/**
 * Extract collateral name from hands filename
 * e.g., "hands-amaave-haunt2-1765864969724.json" -> "amaave"
 */
function extractHandsCollateralName(filename) {
  const match = filename.match(/hands-([^-]+)-/)
  return match ? match[1] : null
}

/**
 * Update a collateral base JSON with hands data
 */
function updateCollateralBaseWithHands(baseFilePath, handsData) {
  const baseData = JSON.parse(fs.readFileSync(baseFilePath, 'utf8'))
  
  // Ensure hands array exists
  if (!baseData.hands) {
    baseData.hands = []
  }
  
  // Build the hands array in the correct order:
  // [0] Front view - downClosed (already exists)
  // [1] Front view - downOpen (already exists)
  // [2] Front view - up (already exists)
  // [3] Back view - down (from hands.back.down)
  // [4] Left view (from hands.left)
  // [5] Right view (from hands.right)
  
  // Ensure we have at least 3 items (front view hands)
  while (baseData.hands.length < 3) {
    baseData.hands.push('')
  }
  
  // Update or add back view hands (index 3)
  const backHandsDown = handsData.hands?.back?.down || handsData.hands?.back?.up || null
  if (backHandsDown) {
    baseData.hands[3] = backHandsDown
  } else if (baseData.hands[3] === '') {
    // Remove empty string if it exists
    baseData.hands.splice(3, 1)
  }
  
  // Update or add left view hands (index 4)
  if (handsData.hands?.left) {
    // Adjust index if back hands were removed
    const leftIndex = baseData.hands.length >= 4 ? 4 : baseData.hands.length
    baseData.hands[leftIndex] = handsData.hands.left
  } else if (baseData.hands[4] === '') {
    // Remove empty string if it exists
    baseData.hands.splice(4, 1)
  }
  
  // Update or add right view hands (index 5)
  if (handsData.hands?.right) {
    // Adjust index based on current array length
    const rightIndex = baseData.hands.length >= 5 ? 5 : baseData.hands.length
    baseData.hands[rightIndex] = handsData.hands.right
  } else if (baseData.hands[5] === '') {
    // Remove empty string if it exists
    baseData.hands.splice(5, 1)
  }
  
  // Clean up: remove any remaining empty strings
  baseData.hands = baseData.hands.filter(svg => svg !== '' && svg !== null)
  
  // Write back to file
  fs.writeFileSync(baseFilePath, JSON.stringify(baseData, null, 2), 'utf8')
  
  return {
    back: backHandsDown ? 'added' : 'skipped',
    left: handsData.hands?.left ? 'added' : 'missing',
    right: handsData.hands?.right ? 'added' : 'missing'
  }
}

/**
 * Main function
 */
function main() {
  const baseDir = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/Body')
  const handsDir = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output/hands')
  
  console.log('=== Update Collateral Bases with Hands ===')
  console.log(`Base directory: ${baseDir}`)
  console.log(`Hands directory: ${handsDir}\n`)
  
  if (!fs.existsSync(baseDir)) {
    console.error(`Error: Base directory does not exist: ${baseDir}`)
    process.exit(1)
  }
  
  if (!fs.existsSync(handsDir)) {
    console.error(`Error: Hands directory does not exist: ${handsDir}`)
    process.exit(1)
  }
  
  // Read all base files
  const baseFiles = fs.readdirSync(baseDir)
    .filter(f => f.startsWith('collateral-base-') && f.endsWith('.json'))
    .map(f => ({
      filename: f,
      path: path.join(baseDir, f),
      name: extractCollateralName(f)
    }))
  
  // Read all hands files
  const handsFiles = fs.readdirSync(handsDir)
    .filter(f => f.startsWith('hands-') && f.endsWith('.json'))
    .map(f => ({
      filename: f,
      path: path.join(handsDir, f),
      name: extractHandsCollateralName(f)
    }))
  
  // Create a map of hands data by collateral name
  const handsMap = new Map()
  for (const handsFile of handsFiles) {
    if (handsFile.name) {
      const handsData = JSON.parse(fs.readFileSync(handsFile.path, 'utf8'))
      handsMap.set(handsFile.name.toLowerCase(), handsData)
    }
  }
  
  console.log(`Found ${baseFiles.length} base files`)
  console.log(`Found ${handsFiles.length} hands files\n`)
  
  let successCount = 0
  let skippedCount = 0
  let errorCount = 0
  
  for (const baseFile of baseFiles) {
    if (!baseFile.name) {
      console.error(`  ✗ Could not extract name from: ${baseFile.filename}`)
      errorCount++
      continue
    }
    
    const handsData = handsMap.get(baseFile.name.toLowerCase())
    
    if (!handsData) {
      console.log(`  ⚠ Skipping ${baseFile.name}: no matching hands file`)
      skippedCount++
      continue
    }
    
    try {
      const result = updateCollateralBaseWithHands(baseFile.path, handsData)
      console.log(`  ✓ Updated ${baseFile.name}`)
      console.log(`    - Back: ${result.back}`)
      console.log(`    - Left: ${result.left}`)
      console.log(`    - Right: ${result.right}`)
      successCount++
    } catch (error) {
      console.error(`  ✗ Error updating ${baseFile.name}:`, error.message)
      errorCount++
    }
  }
  
  console.log('\n=== Summary ===')
  console.log(`Total: ${baseFiles.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Skipped: ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
}

main()

