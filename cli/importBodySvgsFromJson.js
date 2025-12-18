import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Paths
const BODY_JSON_PATH = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_body.json')
const OUTPUT_DIR = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')
const SVG_IMPORTER_PATH = path.join(__dirname, '../../aesprite-svgimporter/svg-importer-cli.lua')
const TEMP_DIR = path.join(__dirname, '../../aesprite-svgimporter/tmp-body')

// View names in order
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
 * Import body SVGs from JSON to Aseprite files
 */
async function importBodySvgsFromJson(collateralName = null) {
  console.log('=== Import Body SVGs from JSON ===\n')
  
  // Check JSON file exists
  if (!fs.existsSync(BODY_JSON_PATH)) {
    console.error(`Error: Body JSON file not found: ${BODY_JSON_PATH}`)
    process.exit(1)
  }
  
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
  console.log(`Body JSON: ${BODY_JSON_PATH}`)
  console.log(`Output directory: ${OUTPUT_DIR}\n`)
  
  // Create temp directory
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
  }
  
  // Read body JSON
  let bodyData
  try {
    bodyData = JSON.parse(fs.readFileSync(BODY_JSON_PATH, 'utf8'))
  } catch (error) {
    console.error(`Error reading body JSON: ${error.message}`)
    process.exit(1)
  }
  
  if (!bodyData.bodies || typeof bodyData.bodies !== 'object') {
    console.error('Error: Invalid body JSON structure. Expected "bodies" object.')
    process.exit(1)
  }
  
  // Get list of collaterals
  const collaterals = Object.keys(bodyData.bodies)
  
  if (collaterals.length === 0) {
    console.log('No collaterals found in body JSON!')
    return
  }
  
  // Filter to specific collateral if provided
  const collateralsToProcess = collateralName 
    ? [collateralName.toLowerCase()]
    : collaterals
  
  console.log(`Found ${collaterals.length} collaterals in JSON`)
  if (collateralName) {
    console.log(`Processing: ${collateralName}\n`)
  } else {
    console.log(`Processing all collaterals\n`)
  }
  
  let totalConverted = 0
  let totalErrors = 0
  
  for (const collateral of collateralsToProcess) {
    const collateralLower = collateral.toLowerCase()
    const bodyViews = bodyData.bodies[collateralLower]
    
    if (!bodyViews) {
      console.log(`  ⚠️  Collateral not found: ${collateral}`)
      totalErrors++
      continue
    }
    
    // Check if all 4 views exist
    const requiredViews = ['front', 'back', 'left', 'right']
    const missingViews = requiredViews.filter(view => !bodyViews[view])
    
    if (missingViews.length > 0) {
      console.log(`  ⚠️  Missing views for ${collateral}: ${missingViews.join(', ')}`)
      totalErrors++
      continue
    }
    
    console.log(`[${collateral}] Processing 4 body views...`)
    
    // Process each view
    for (const viewName of VIEW_NAMES) {
      const svgContent = bodyViews[viewName]
      
      if (!svgContent || typeof svgContent !== 'string') {
        console.log(`    ⚠️  Skipping ${viewName} view (invalid SVG)`)
        totalErrors++
        continue
      }
      
      // Create temp SVG file
      const tempSvgPath = path.join(TEMP_DIR, `body_${viewName}_${collateral}.svg`)
      fs.writeFileSync(tempSvgPath, svgContent, 'utf8')
      
      // Output Aseprite file path (directly in Output directory)
      const asePath = path.join(OUTPUT_DIR, `body_${viewName}_${collateral}.aseprite`)
      
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
        if (error.stdout) console.log(`      stdout: ${error.stdout.toString()}`)
        if (error.stderr) console.log(`      stderr: ${error.stderr.toString()}`)
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

// Get collateral name from command line args
const collateralName = process.argv[2] || null

importBodySvgsFromJson(collateralName).catch(console.error)

