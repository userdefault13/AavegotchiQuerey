import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Load collateral data to get colors
 */
function loadCollateralData(collateralAddress) {
  const haunt1Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt2.json')
  
  let collaterals = []
  
  if (fs.existsSync(haunt1Path)) {
    const haunt1Data = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
    collaterals = collaterals.concat(haunt1Data.collaterals || [])
  }
  
  if (fs.existsSync(haunt2Path)) {
    const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
    collaterals = collaterals.concat(haunt2Data.collaterals || [])
  }
  
  return collaterals.find(c => 
    c.collateralType.toLowerCase() === collateralAddress.toLowerCase()
  )
}

/**
 * Update SVG colors to match collateral colors
 * Since the SVG renderer may not support CSS classes properly,
 * we need to replace CSS classes with inline fill attributes
 */
function updateSvgColors(svgString, collateralColors) {
  if (!svgString || !collateralColors) return svgString
  
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  
  // Parse SVG with DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  
  // Update CSS in style tag
  const styleElements = doc.getElementsByTagName('style')
  for (let i = 0; i < styleElements.length; i++) {
    const style = styleElements[i]
    let cssText = style.textContent || ''
    
    cssText = cssText.replace(/\.gotchi-primary\{fill:[^;]+;/g, `.gotchi-primary{fill:${primaryColor};}`)
    cssText = cssText.replace(/\.gotchi-secondary\{fill:[^;]+;/g, `.gotchi-secondary{fill:${secondaryColor};}`)
    cssText = cssText.replace(/\.gotchi-cheek\{fill:[^;]+;/g, `.gotchi-cheek{fill:${cheekColor};}`)
    cssText = cssText.replace(/\.gotchi-eyeColor\{fill:[^;]+;/g, `.gotchi-eyeColor{fill:${primaryColor};}`)
    cssText = cssText.replace(/\.gotchi-primary-mouth\{fill:[^;]+;/g, `.gotchi-primary-mouth{fill:${primaryColor};}`)
    
    style.textContent = cssText
  }
  
  // Helper function to check if element has a class
  function hasClass(element, className) {
    const classAttr = element.getAttribute('class') || ''
    return classAttr.split(/\s+/).includes(className)
  }
  
  // Add inline fill attributes to paths based on their classes
  const allPaths = doc.getElementsByTagName('path')
  for (let i = 0; i < allPaths.length; i++) {
    const path = allPaths[i]
    const existingFill = path.getAttribute('fill')
    
    // Skip if already has fill="#fff" (white) - preserve white fills
    if (existingFill === '#fff' || existingFill === '#ffffff' || existingFill === 'white') {
      continue
    }
    
    // Check path classes
    const pathClasses = (path.getAttribute('class') || '').split(/\s+/).filter(c => c)
    const hasPrimaryClass = pathClasses.includes('gotchi-primary')
    const hasSecondaryClass = pathClasses.includes('gotchi-secondary')
    const hasWearableClass = pathClasses.includes('gotchi-wearable')
    
    // Check parent group classes
    let parent = path.parentNode
    let parentHasPrimary = false
    let parentHasSecondary = false
    
    while (parent && parent.nodeType === 1) {
      const parentClasses = (parent.getAttribute('class') || '').split(/\s+/).filter(c => c)
      if (parentClasses.includes('gotchi-primary')) {
        parentHasPrimary = true
      }
      if (parentClasses.includes('gotchi-secondary')) {
        parentHasSecondary = true
      }
      parent = parent.parentNode
    }
    
    // Determine which color to use
    // Priority: explicit class > parent class > wearable (defaults to primary)
    if (hasPrimaryClass || (hasWearableClass && !hasSecondaryClass && parentHasPrimary)) {
      path.setAttribute('fill', primaryColor)
    } else if (hasSecondaryClass || parentHasSecondary) {
      path.setAttribute('fill', secondaryColor)
    } else if (hasWearableClass && !existingFill) {
      // Default wearable to primary if no other indication
      path.setAttribute('fill', primaryColor)
    } else if (!existingFill) {
      // If no fill and no class info, default to primary
      path.setAttribute('fill', primaryColor)
    }
  }
  
  
  // Serialize back to string
  const serializer = new XMLSerializer()
  return serializer.serializeToString(doc)
}

/**
 * Find aseprite executable
 */
function findAseprite() {
  try {
    execSync('which aseprite', { stdio: 'ignore' })
    return 'aseprite'
  } catch (error) {
    // Try macOS app bundle location
    const macAsepritePath = '/Applications/Aseprite.app/Contents/MacOS/aseprite'
    if (fs.existsSync(macAsepritePath)) {
      return macAsepritePath
    }
    throw new Error('Aseprite not found. Please install Aseprite and ensure it\'s in your PATH or at /Applications/Aseprite.app')
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const handsDir = args[0] || path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output/hands')
  const outputDir = args[1] || path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')
  const svgImporterPath = path.join(__dirname, '../../aesprite-svgimporter/svg-importer-cli.lua')
  const tempDir = path.join(__dirname, '../../aesprite-svgimporter/tmp-hands')
  
  console.log('=== Convert Hands SVGs to Aseprite ===')
  console.log(`Hands directory: ${handsDir}`)
  console.log(`Output directory: ${outputDir}`)
  console.log(`SVG importer: ${svgImporterPath}\n`)
  
  if (!fs.existsSync(handsDir)) {
    console.error(`Error: Hands directory does not exist: ${handsDir}`)
    process.exit(1)
  }
  
  if (!fs.existsSync(svgImporterPath)) {
    console.error(`Error: SVG importer script not found: ${svgImporterPath}`)
    process.exit(1)
  }
  
  // Find aseprite
  let asepriteCmd
  try {
    asepriteCmd = findAseprite()
  } catch (error) {
    console.error(`Error: ${error.message}`)
    process.exit(1)
  }
  
  // Create temp directory for SVG files
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Read all hands JSON files
  const handsFiles = fs.readdirSync(handsDir)
    .filter(f => f.startsWith('hands-') && f.endsWith('.json'))
    .map(f => path.join(handsDir, f))
  
  console.log(`Found ${handsFiles.length} hands files\n`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const handsFilePath of handsFiles) {
    try {
      const handsData = JSON.parse(fs.readFileSync(handsFilePath, 'utf8'))
      const { name, hands, collateralAddress } = handsData
      
      if (!hands || !hands.left || !hands.right) {
        console.log(`  ⚠ Skipping ${name}: missing left or right hands`)
        continue
      }
      
      // Load collateral colors
      const collateralData = loadCollateralData(collateralAddress)
      if (!collateralData) {
        console.log(`  ⚠ Skipping ${name}: collateral data not found`)
        continue
      }
      
      console.log(`Processing ${name}...`)
      console.log(`  Primary: ${collateralData.primaryColor}, Secondary: ${collateralData.secondaryColor}`)
      
      // Process left hand
      if (hands.left) {
        const leftSvgPath = path.join(tempDir, `hands_left_${name.toLowerCase()}.svg`)
        const leftAsePath = path.join(outputDir, `hands_left_${name.toLowerCase()}.aseprite`)
        
        // Update SVG colors and write to temp file
        const updatedLeftSvg = updateSvgColors(hands.left, collateralData)
        fs.writeFileSync(leftSvgPath, updatedLeftSvg, 'utf8')
        
        // Convert to aseprite
        const scriptName = path.basename(svgImporterPath)
        const scriptDir = path.dirname(svgImporterPath)
        
        try {
          execSync(
            `cd "${scriptDir}" && SVG_FILE="${leftSvgPath}" SVG_WIDTH="64" SVG_HEIGHT="64" SVG_OUTPUT="${leftAsePath}" "${asepriteCmd}" -b --script "${scriptName}"`,
            { stdio: 'inherit', env: { ...process.env, SVG_FILE: leftSvgPath, SVG_WIDTH: '64', SVG_HEIGHT: '64', SVG_OUTPUT: leftAsePath } }
          )
          console.log(`  ✓ Left hand: ${path.basename(leftAsePath)}`)
          successCount++
        } catch (error) {
          console.error(`  ✗ Error converting left hand: ${error.message}`)
          errorCount++
        }
        
        // Clean up temp SVG
        if (fs.existsSync(leftSvgPath)) {
          fs.unlinkSync(leftSvgPath)
        }
      }
      
      // Process right hand
      if (hands.right) {
        const rightSvgPath = path.join(tempDir, `hands_right_${name.toLowerCase()}.svg`)
        const rightAsePath = path.join(outputDir, `hands_right_${name.toLowerCase()}.aseprite`)
        
        // Update SVG colors and write to temp file
        const updatedRightSvg = updateSvgColors(hands.right, collateralData)
        fs.writeFileSync(rightSvgPath, updatedRightSvg, 'utf8')
        
        // Convert to aseprite
        const scriptName = path.basename(svgImporterPath)
        const scriptDir = path.dirname(svgImporterPath)
        
        try {
          execSync(
            `cd "${scriptDir}" && SVG_FILE="${rightSvgPath}" SVG_WIDTH="64" SVG_HEIGHT="64" SVG_OUTPUT="${rightAsePath}" "${asepriteCmd}" -b --script "${scriptName}"`,
            { stdio: 'inherit', env: { ...process.env, SVG_FILE: rightSvgPath, SVG_WIDTH: '64', SVG_HEIGHT: '64', SVG_OUTPUT: rightAsePath } }
          )
          console.log(`  ✓ Right hand: ${path.basename(rightAsePath)}`)
          successCount++
        } catch (error) {
          console.error(`  ✗ Error converting right hand: ${error.message}`)
          errorCount++
        }
        
        // Clean up temp SVG
        if (fs.existsSync(rightSvgPath)) {
          fs.unlinkSync(rightSvgPath)
        }
      }
      
    } catch (error) {
      console.error(`  ✗ Error processing ${path.basename(handsFilePath)}:`, error.message)
      errorCount++
    }
  }
  
  // Clean up temp directory
  try {
    if (fs.existsSync(tempDir)) {
      const tempFiles = fs.readdirSync(tempDir)
      if (tempFiles.length === 0) {
        fs.rmdirSync(tempDir)
      }
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  console.log('\n=== Summary ===')
  console.log(`Total files processed: ${handsFiles.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`\n✓ Output directory: ${outputDir}`)
}

main()

