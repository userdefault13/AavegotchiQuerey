import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Helper function to find elements by class name
 */
function findElementsByClass(doc, className) {
  const results = []
  const walk = (node) => {
    if (node.nodeType === 1) {
      const nodeClass = node.getAttribute('class') || ''
      if (nodeClass.includes(className)) {
        results.push(node)
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i])
      }
    }
  }
  walk(doc)
  return results
}

/**
 * Helper function to find elements by tag and class
 */
function findElements(doc, tagName, className) {
  const results = []
  let elements = []
  try {
    if (doc.getElementsByTagName) {
      elements = Array.from(doc.getElementsByTagName(tagName))
    }
  } catch (e) {}
  
  if (elements.length === 0) {
    const walk = (node) => {
      if (node && node.nodeType === 1) {
        if (node.nodeName === tagName || tagName === '*') {
          elements.push(node)
        }
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i])
          }
        }
      }
    }
    walk(doc)
  }
  
  if (className) {
    for (const element of elements) {
      const nodeClass = (element.getAttribute('class') || '').trim()
      const classes = nodeClass.split(/\s+/).filter(c => c.length > 0)
      if (classes.includes(className) || nodeClass.includes(className)) {
        results.push(element)
      }
    }
  } else {
    results.push(...elements)
  }
  return results
}

/**
 * Extract hand elements from side view (left/right)
 * In side views, hands are individual path elements with gotchi-wearable classes
 */
function extractHandsFromSideView(svgString, viewName, collateralColors) {
  if (!svgString) return null
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  const serializer = new XMLSerializer()
  
  // Look for gotchi-hand-wearable group first
  let handGroup = findElementsByClass(doc, 'gotchi-hand-wearable')
  
  // If no group found, look for individual hand paths
  // In side views, hands are paths with gotchi-wearable and gotchi-primary/gotchi-secondary classes
  if (handGroup.length === 0) {
    // Find all paths and groups with gotchi-wearable class
    const wearablePaths = findElements(doc, 'path', 'gotchi-wearable')
    const wearableGroups = findElements(doc, 'g', 'gotchi-wearable')
    
    // Filter to only hand-related paths
    // Hand paths in side views are typically around y=40-45 area (check path data)
    // They come after body/face elements in the DOM
    const handPaths = wearablePaths.filter(path => {
      const d = path.getAttribute('d') || ''
      // Check if path contains coordinates that suggest it's a hand
      // Hands are typically in the lower portion of the SVG (y around 40-45)
      // Look for paths with coordinates in the hand area
      const hasHandCoords = d.includes('40') || d.includes('41') || d.includes('42') || 
                            d.includes('43') || d.includes('44') || d.includes('45') ||
                            d.includes('M25') || d.includes('M39') || d.includes('M33') ||
                            d.includes('M32') || d.includes('M29') || d.includes('M31')
      // Exclude body paths (they have different coordinate patterns)
      const isBodyPath = d.includes('14') || d.includes('15') || d.includes('51') ||
                         d.includes('M43') && d.includes('14') || d.includes('M21') && d.includes('14')
      return hasHandCoords && !isBodyPath
    })
    
    // Also include wearable groups that might contain hand elements
    const handGroups = wearableGroups.filter(group => {
      const children = Array.from(group.childNodes).filter(n => n.nodeType === 1)
      // Check if group contains hand-like paths
      return children.some(child => {
        const d = child.getAttribute('d') || ''
        return d.includes('40') || d.includes('41') || d.includes('42') || 
               d.includes('43') || d.includes('44') || d.includes('45')
      })
    })
    
    if (handPaths.length > 0 || handGroups.length > 0) {
      // Create a group to contain all hand paths and groups
      handGroup = [doc.createElementNS('http://www.w3.org/2000/svg', 'g')]
      handGroup[0].setAttribute('class', 'gotchi-hand-wearable')
      
      // Add hand paths
      handPaths.forEach(path => {
        const clone = path.cloneNode(true)
        handGroup[0].appendChild(clone)
      })
      
      // Add hand groups
      handGroups.forEach(group => {
        const clone = group.cloneNode(true)
        handGroup[0].appendChild(clone)
      })
    }
  }
  
  if (handGroup.length === 0) {
    return null
  }
  
  // Wrap in SVG with proper styles
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  
  // Add style block with collateral colors
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  
  // For side views, hands are typically in down state
  style.appendChild(doc.createTextNode(`
    .gotchi-primary{fill:${primaryColor};}
    .gotchi-secondary{fill:${secondaryColor};}
    .gotchi-cheek{fill:${cheekColor};}
    .gotchi-eyeColor{fill:${primaryColor};}
    .gotchi-primary-mouth{fill:${primaryColor};}
    .gotchi-sleeves-up{display:none;}
    .gotchi-handsUp{display:none;}
    .gotchi-handsDownOpen{display:block;}
    .gotchi-handsDownClosed{display:none;}
  `.trim()))
  wrapper.appendChild(style)
  
  const clone = handGroup[0].cloneNode(true)
  wrapper.appendChild(clone)
  
  return serializer.serializeToString(wrapper)
}

/**
 * Extract hands from back view (both up and down states)
 */
function extractBackViewHands(svgString, collateralColors) {
  if (!svgString) return null
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  const serializer = new XMLSerializer()
  
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  
  const result = {
    up: null,
    down: null
  }
  
  // Find gotchi-handsUp and gotchi-handsDownOpen/gotchi-handsDownClosed groups
  const handsUpGroups = findElementsByClass(doc, 'gotchi-handsUp')
  const handsDownOpenGroups = findElementsByClass(doc, 'gotchi-handsDownOpen')
  const handsDownClosedGroups = findElementsByClass(doc, 'gotchi-handsDownClosed')
  
  // Helper to wrap in SVG
  const wrapInSvg = (element, visibleState) => {
    if (!element) return null
    
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
    const cssRules = [
      `.gotchi-primary{fill:${primaryColor};}`,
      `.gotchi-secondary{fill:${secondaryColor};}`,
      `.gotchi-cheek{fill:${cheekColor};}`,
      `.gotchi-eyeColor{fill:${primaryColor};}`,
      `.gotchi-primary-mouth{fill:${primaryColor};}`,
      `.gotchi-sleeves-up{display:none;}`,
      `.gotchi-handsUp{display:${visibleState === 'up' ? 'block' : 'none'};}`,
      `.gotchi-handsDownOpen{display:${visibleState === 'down' ? 'block' : 'none'};}`,
      `.gotchi-handsDownClosed{display:none;}`
    ].join('\n        ')
    
    style.appendChild(doc.createTextNode(cssRules))
    wrapper.appendChild(style)
    
    const clone = element.cloneNode(true)
    wrapper.appendChild(clone)
    
    return serializer.serializeToString(wrapper)
  }
  
  // Extract up state
  if (handsUpGroups.length > 0) {
    result.up = wrapInSvg(handsUpGroups[0], 'up')
  }
  
  // Extract down state (prefer DownOpen, fallback to DownClosed)
  if (handsDownOpenGroups.length > 0) {
    result.down = wrapInSvg(handsDownOpenGroups[0], 'down')
  } else if (handsDownClosedGroups.length > 0) {
    result.down = wrapInSvg(handsDownClosedGroups[0], 'down')
  }
  
  return result
}

/**
 * Load collateral data to get colors
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
  
  return collaterals.find(c => 
    c.collateralType.toLowerCase() === collateralAddress.toLowerCase()
  )
}

/**
 * Process a collateral output file and extract hands from left/right/back views
 */
function processCollateralFile(filePath) {
  console.log(`\nProcessing: ${path.basename(filePath)}`)
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const { svgs, collateralAddress, name, haunt } = data
  
  if (!svgs || svgs.length < 4) {
    console.error(`  ✗ Invalid SVG array (expected 4 views, got ${svgs?.length || 0})`)
    return null
  }
  
  // Views are: [Front, Left, Right, Back]
  const frontView = svgs[0]
  const leftView = svgs[1]
  const rightView = svgs[2]
  const backView = svgs[3]
  
  // Load collateral data to get colors
  const collateralData = loadCollateralData(collateralAddress)
  
  if (!collateralData) {
    console.error(`  ✗ Could not find collateral data for ${collateralAddress}`)
    return null
  }
  
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  // Extract hands from left and right views
  const leftHands = extractHandsFromSideView(leftView, 'Left', collateralColors)
  const rightHands = extractHandsFromSideView(rightView, 'Right', collateralColors)
  
  // For back view, extract both up and down states
  const backHands = extractBackViewHands(backView, collateralColors)
  
  const result = {
    collateralAddress,
    name,
    haunt,
    timestamp: Date.now(),
    hands: {
      left: leftHands,
      right: rightHands,
      back: backHands
    }
  }
  
  console.log(`  ✓ Left hands: ${leftHands ? 'extracted' : 'not found'}`)
  console.log(`  ✓ Right hands: ${rightHands ? 'extracted' : 'not found'}`)
  console.log(`  ✓ Back hands: ${backHands ? JSON.stringify(Object.keys(backHands)) : 'not found'}`)
  
  return result
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const inputDir = args[0] || path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')
  const outputDir = args[1] || path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output/hands')
  
  console.log('=== Extract Side View Hands ===')
  console.log(`Input directory: ${inputDir}`)
  console.log(`Output directory: ${outputDir}\n`)
  
  if (!fs.existsSync(inputDir)) {
    console.error(`Error: Input directory does not exist: ${inputDir}`)
    process.exit(1)
  }
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Find all collateral JSON files
  const files = fs.readdirSync(inputDir)
    .filter(f => f.startsWith('collateral-') && f.endsWith('.json'))
    .map(f => path.join(inputDir, f))
  
  console.log(`Found ${files.length} collateral files\n`)
  
  let successCount = 0
  let errorCount = 0
  
  for (const filePath of files) {
    try {
      const result = processCollateralFile(filePath)
      
      if (result) {
        // Save extracted hands
        const outputFilename = `hands-${result.name.toLowerCase()}-haunt${result.haunt}-${result.timestamp}.json`
        const outputPath = path.join(outputDir, outputFilename)
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
        console.log(`  ✓ Saved to: ${outputFilename}`)
        successCount++
      } else {
        errorCount++
      }
    } catch (error) {
      console.error(`  ✗ Error processing ${path.basename(filePath)}:`, error.message)
      errorCount++
    }
  }
  
  console.log('\n=== Summary ===')
  console.log(`Total: ${files.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`\n✓ Output directory: ${outputDir}`)
}

main()


