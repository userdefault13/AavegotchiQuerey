import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'body-svgs.json')

/**
 * Combine all body SVG files into a single JSON file
 */
async function combineBodySvgsToJson() {
  console.log('Combining body SVGs into JSON...\n')
  
  // Find all body SVG files
  const svgFiles = fs.readdirSync(OUTPUT_DIR)
    .filter(file => file.startsWith('body_') && file.endsWith('.svg'))
    .sort()
  
  if (svgFiles.length === 0) {
    console.log('No SVG files found!')
    return
  }
  
  console.log(`Found ${svgFiles.length} SVG files`)
  
  // Organize by collateral, then by view
  const bodySvgs = {}
  
  for (const file of svgFiles) {
    // Parse filename: body_{view}_{collateral}.svg
    const match = file.match(/^body_(front|back|left|right)_(.+)\.svg$/)
    if (!match) {
      console.log(`  ⚠️  Skipping invalid filename: ${file}`)
      continue
    }
    
    const [, view, collateral] = match
    
    // Read SVG content
    const filePath = path.join(OUTPUT_DIR, file)
    const svgContent = fs.readFileSync(filePath, 'utf8')
    
    // Initialize collateral if needed
    if (!bodySvgs[collateral]) {
      bodySvgs[collateral] = {}
    }
    
    // Store SVG content
    bodySvgs[collateral][view] = svgContent.trim()
  }
  
  // Create final structure
  const result = {
    metadata: {
      totalCollaterals: Object.keys(bodySvgs).length,
      totalSvgs: svgFiles.length,
      generatedAt: new Date().toISOString(),
      views: ['front', 'back', 'left', 'right']
    },
    bodies: bodySvgs
  }
  
  // Write to JSON file
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(result, null, 2), 'utf8')
  
  console.log(`\n✓ Successfully combined ${svgFiles.length} SVGs into JSON`)
  console.log(`  Output: ${OUTPUT_JSON}`)
  console.log(`  Collaterals: ${Object.keys(bodySvgs).length}`)
  
  // Show summary
  console.log('\nSummary by collateral:')
  for (const [collateral, views] of Object.entries(bodySvgs)) {
    const viewCount = Object.keys(views).length
    const viewsList = Object.keys(views).join(', ')
    console.log(`  ${collateral}: ${viewCount} views (${viewsList})`)
  }
}

combineBodySvgsToJson().catch(console.error)
