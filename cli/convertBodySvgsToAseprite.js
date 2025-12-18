import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const COLLATERAL_BASE_DIR = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/Body')
const OUTPUT_DIR = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')
const SVG_IMPORTER_PATH = path.join(__dirname, '../../aesprite-svgimporter/svg-importer-cli.lua')
const TEMP_DIR = path.join(__dirname, '../../aesprite-svgimporter/tmp-body')

// View names in order (matching body array order: front, left, right, back)
const VIEW_NAMES = ['front', 'left', 'right', 'back']

/**
 * Find aseprite executable
 */
function findAseprite() {
  try {
    execSync('which aseprite', { stdio: 'ignore' })
    return 'aseprite'
  } catch {
    const macAsepritePath = '/Applications/Aseprite.app/Contents/MacOS/aseprite'
    if (fs.existsSync(macAsepritePath)) {
      return macAsepritePath
    }
    throw new Error('Aseprite not found. Please install Aseprite and ensure it\'s in your PATH or at /Applications/Aseprite.app')
  }
}

/**
 * Convert body SVGs to Aseprite files
 */
async function convertBodySvgsToAseprite() {
  console.log('=== Convert Body SVGs to Aseprite ===\n')
  
  // Check SVG importer exists
  if (!fs.existsSync(SVG_IMPORTER_PATH)) {
    console.error(`Error: SVG importer script not found: ${SVG_IMPORTER_PATH}`)
    process.exit(1)
  }
  
  // Find aseprite
  let asepriteCmd
  try {
    asepriteCmd = findAseprite()
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
  
  console.log(`Aseprite: ${asepriteCmd}`)
  console.log(`SVG importer: ${SVG_IMPORTER_PATH}`)
  console.log(`Output directory: ${OUTPUT_DIR}\n`)
  
  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
  
  // Find all collateral-base JSON files
  const collateralFiles = fs.readdirSync(COLLATERAL_BASE_DIR)
    .filter(file => file.startsWith('collateral-base-') && file.endsWith('.json'))
    .sort()
  
  if (collateralFiles.length === 0) {
    console.log('No collateral-base JSON files found!')
    return
  }
  
  console.log(`Found ${collateralFiles.length} collateral-base files\n`)
  
  let totalConverted = 0
  let totalErrors = 0
  
  for (const file of collateralFiles) {
    // Extract collateral name from filename: collateral-base-{name}.json
    const match = file.match(/^collateral-base-(.+)\.json$/)
    if (!match) {
      console.log(`  ⚠️  Skipping invalid filename: ${file}`)
      continue
    }
    
    const collateralName = match[1]
    const filePath = path.join(COLLATERAL_BASE_DIR, file)
    
    // Read collateral-base JSON
    let collateralData
    try {
      collateralData = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch (error) {
      console.log(`  ⚠️  Error reading ${file}: ${error.message}`)
      totalErrors++
      continue
    }
    
    // Check if body array exists
    if (!collateralData.body || !Array.isArray(collateralData.body)) {
      console.log(`  ⚠️  No body array found in ${file}`)
      totalErrors++
      continue
    }
    
    const bodySvgs = collateralData.body
    
    if (bodySvgs.length !== 4) {
      console.log(`  ⚠️  Expected 4 body SVGs, found ${bodySvgs.length} in ${file}`)
      totalErrors++
      continue
    }
    
    console.log(`[${collateralName}] Processing ${bodySvgs.length} body views...`)
    
    // Process each view
    for (let i = 0; i < bodySvgs.length; i++) {
      const viewName = VIEW_NAMES[i]
      const svgContent = bodySvgs[i]
      
      if (!svgContent || typeof svgContent !== 'string') {
        console.log(`    ⚠️  Skipping ${viewName} view (invalid SVG)`)
        totalErrors++
        continue
      }
      
      // Create temp SVG file
      const tempSvgPath = path.join(TEMP_DIR, `body_${viewName}_${collateralName}.svg`)
      fs.writeFileSync(tempSvgPath, svgContent, 'utf8')
      
      // Output Aseprite file path
      const asePath = path.join(OUTPUT_DIR, `body_${viewName}_${collateralName}.aseprite`)
      
      // Convert to aseprite
      const scriptName = path.basename(SVG_IMPORTER_PATH)
      const scriptDir = path.dirname(SVG_IMPORTER_PATH)
      
      try {
        execSync(
          `cd "${scriptDir}" && SVG_FILE="${tempSvgPath}" SVG_WIDTH="64" SVG_HEIGHT="64" SVG_OUTPUT="${asePath}" "${asepriteCmd}" -b --script "${scriptName}"`,
          { stdio: 'pipe' }
        )
        
        console.log(`    ✓ ${viewName} -> ${path.basename(asePath)}`)
        totalConverted++
      } catch (error) {
        console.log(`    ✗ Error converting ${viewName}: ${error.message}`)
        totalErrors++
      }
    }
    
    console.log('')
  }
  
  // Cleanup temp directory
  try {
    const tempFiles = fs.readdirSync(TEMP_DIR)
    for (const tempFile of tempFiles) {
      if (tempFile.endsWith('.svg')) {
        fs.unlinkSync(path.join(TEMP_DIR, tempFile))
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  console.log('=== Complete ===')
  console.log(`Converted: ${totalConverted}`)
  console.log(`Errors: ${totalErrors}`)
  console.log(`Output directory: ${OUTPUT_DIR}`)
}

convertBodySvgsToAseprite().catch(console.error)
