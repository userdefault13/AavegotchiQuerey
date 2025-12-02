import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'

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
 * Helper function to find elements by tag and class
 */
function findElements(doc, tagName, className) {
  const results = []
  
  // Use getElementsByTagName if available (more reliable)
  let elements = []
  try {
    if (doc.getElementsByTagName) {
      elements = Array.from(doc.getElementsByTagName(tagName))
    }
  } catch (e) {
    // Fallback to manual walk
  }
  
  // If getElementsByTagName didn't work or returned empty, use manual walk
  if (elements.length === 0) {
    const walk = (node) => {
      if (node && node.nodeType === 1) { // ELEMENT_NODE
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
  
  // Filter by class if specified
  if (className) {
    for (const element of elements) {
      const nodeClass = (element.getAttribute('class') || '').trim()
      // Split by whitespace and check if any class matches
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
 * Extract base parts from SVG string (simplified version for batch processing)
 */
function extractBaseParts(svgString, viewName, collateralColors) {
  if (!svgString) return {}
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  
  const parts = {}
  const serializer = new XMLSerializer()
  
  // Helper to wrap element in full SVG
  const wrapInSvg = (element, includeStyle = true) => {
    if (!element) return ''
    
    const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    // Add style block with collateral colors
    if (includeStyle) {
      const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
      const primaryColor = collateralColors.primaryColor.replace('0x', '#')
      const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
      const cheekColor = collateralColors.cheekColor.replace('0x', '#')
      
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
    }
    
    const clone = element.cloneNode(true)
    wrapper.appendChild(clone)
    
    return serializer.serializeToString(wrapper)
  }
  
  // Extract Body - try multiple class names
  const bodyClasses = ['gotchi-body', 'gotchi-bodyLeft', 'gotchi-bodyRight']
  let bodyGroup = null
  for (const className of bodyClasses) {
    const elements = findElements(doc, 'g', className)
    if (elements.length > 0) {
      bodyGroup = elements[0]
      break
    }
  }
  
  // If no body group found, check for body paths directly (side views use gotchi-wearable classes)
  if (!bodyGroup) {
    // Find paths with gotchi-primary or gotchi-secondary that aren't in hands groups
    const allPaths = findElements(doc, 'path', 'gotchi-primary')
    const secondaryPaths = findElements(doc, 'path', 'gotchi-secondary')
    const whitePaths = findElements(doc, 'path', 'gotchi-wearable')
    
    // Filter out paths that are inside hands groups
    const bodyPaths = []
    const handsGroups = findElements(doc, 'g', 'gotchi-hand')
    
    const isInHandsGroup = (path) => {
      let parent = path.parentNode
      while (parent) {
        if (parent.nodeType === 1 && parent.nodeName === 'g') {
          const className = parent.getAttribute('class') || ''
          if (className.includes('gotchi-hand')) {
            return true
          }
        }
        parent = parent.parentNode
      }
      return false
    }
    
    // Collect body paths (primary, secondary, and white fill)
    // Exclude background paths (those with mask attributes or fill="#dea8ff")
    const seenPaths = new Set()
    for (const path of [...allPaths, ...secondaryPaths, ...whitePaths]) {
      if (!isInHandsGroup(path)) {
        const className = path.getAttribute('class') || ''
        const fill = path.getAttribute('fill') || ''
        const mask = path.getAttribute('mask') || ''
        const pathId = path.getAttribute('d') || ''
        
        // Skip background paths (have mask or specific background fills)
        if (mask || fill === '#dea8ff') {
          continue
        }
        
        // Skip if we've already seen this path (duplicate check)
        if (seenPaths.has(pathId)) {
          continue
        }
        
        // Include if it's gotchi-primary, gotchi-secondary, or white fill with gotchi-wearable
        if ((className.includes('gotchi-primary') && className.includes('gotchi-wearable')) || 
            (className.includes('gotchi-secondary') && className.includes('gotchi-wearable')) ||
            ((fill === '#fff' || fill === '#ffffff') && className.includes('gotchi-wearable'))) {
          bodyPaths.push(path)
          seenPaths.add(pathId)
        }
      }
    }
    
    // If we found body paths, create a body group
    if (bodyPaths.length > 0) {
      bodyGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
      bodyGroup.setAttribute('class', 'gotchi-body')
      for (const path of bodyPaths) {
        const clone = path.cloneNode(true)
        // Remove gotchi-wearable class, keep primary/secondary
        const className = clone.getAttribute('class') || ''
        const newClass = className.replace('gotchi-wearable', '').trim()
        clone.setAttribute('class', newClass)
        bodyGroup.appendChild(clone)
      }
    }
  }
  
  if (bodyGroup) {
    parts.body = wrapInSvg(bodyGroup)
  }
  
  // Extract Hands - look for gotchi-handsDownClosed, gotchi-handsDownOpen, gotchi-handsUp
  const handsClasses = ['gotchi-handsDownClosed', 'gotchi-handsDownOpen', 'gotchi-handsUp', 'gotchi-hands']
  let handsGroup = null
  for (const className of handsClasses) {
    const elements = findElements(doc, 'g', className)
    if (elements.length > 0) {
      handsGroup = elements[0]
      break
    }
  }
  if (handsGroup) {
    parts.hands = wrapInSvg(handsGroup)
  }
  
  // Extract Shadow
  const shadowElements = findElements(doc, 'g', 'gotchi-shadow')
  if (shadowElements.length > 0) {
    parts.shadow = wrapInSvg(shadowElements[0], false) // Don't include style for shadow
  }
  
  return parts
}

/**
 * Load base templates from aavegotchi_db_main.json
 */
function loadBaseTemplates() {
  const mainPath = path.join(__dirname, '../public/aavegotchi_db_main.json')
  if (!fs.existsSync(mainPath)) {
    throw new Error(`Base templates file not found: ${mainPath}`)
  }
  
  const mainData = JSON.parse(fs.readFileSync(mainPath, 'utf8'))
  return {
    mouth_neutral: mainData.mouth_neutral || [],
    mouth_happy: mainData.mouth_happy || [],
    eyes_mad: mainData.eyes_mad || [],
    eyes_happy: mainData.eyes_happy || [],
    eyes_sleepy: mainData.eyes_sleepy || []
  }
}

/**
 * Apply collateral colors to a base template SVG
 */
function applyCollateralColors(svgString, collateralColors) {
  if (!svgString) return ''
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const serializer = new XMLSerializer()
  const viewBox = '0 0 64 64'
  
  // Create wrapper SVG with style
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  
  // Add style block with collateral colors
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  
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
  
  // Extract the content from the template
  // Templates are usually just <g> elements, so we need to extract them
  let content = svgString.trim()
  
  // If it's already wrapped in SVG, extract inner content
  if (content.startsWith('<svg')) {
    const contentDoc = parser.parseFromString(content, 'image/svg+xml')
    const contentSvg = contentDoc.documentElement
    for (let i = 0; i < contentSvg.childNodes.length; i++) {
      const child = contentSvg.childNodes[i]
      if (child.nodeType === 1) { // ELEMENT_NODE
        wrapper.appendChild(child.cloneNode(true))
      }
    }
  } else {
    // Content is just a group or path, wrap it
    const contentDoc = parser.parseFromString(`<svg>${content}</svg>`, 'image/svg+xml')
    const contentSvg = contentDoc.documentElement
    for (let i = 0; i < contentSvg.childNodes.length; i++) {
      const child = contentSvg.childNodes[i]
      if (child.nodeType === 1) { // ELEMENT_NODE
        wrapper.appendChild(child.cloneNode(true))
      }
    }
  }
  
  return serializer.serializeToString(wrapper)
}

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
 * Determine view order from SVG array
 */
function determineViewOrder(svgArray) {
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  return {
    Front: svgArray[0],
    Left: svgArray[1],
    Right: svgArray[2],
    Back: svgArray[3]
  }
}

/**
 * Generate base JSON for a single collateral
 */
async function generateCollateralBase(collateralData, baseTemplates, contract) {
  const collateralAddress = collateralData.collateralType
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  console.log(`\nProcessing ${collateralData.name} (${collateralAddress})...`)
  
  // Call previewSideAavegotchi
  const hauntId = 1
  const neutralTraits = [50, 50, 50, 50, 50, 50]
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    hauntId,
    collateralAddress,
    neutralTraits,
    emptyWearables
  )
  
  // Parse response
  const svgArray = parsePreviewResponse(response)
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  const views = determineViewOrder(svgArray)
  
  // Extract parts from each view
  const result = {
    body: [],
    hands: [],
    mouth_neutral: [],
    mouth_happy: [],
    eyes_mad: [],
    eyes_happy: [],
    eyes_sleepy: [],
    shadow: []
  }
  
  // Extract body, hands, shadow from all views
  const frontParts = extractBaseParts(views.Front, 'Front', collateralColors)
  if (frontParts.body) result.body.push(frontParts.body)
  if (frontParts.hands) result.hands.push(frontParts.hands)
  if (frontParts.shadow) result.shadow.push(frontParts.shadow)
  
  const leftParts = extractBaseParts(views.Left, 'Left', collateralColors)
  if (leftParts.body) result.body.push(leftParts.body)
  if (leftParts.hands) result.hands.push(leftParts.hands)
  
  const rightParts = extractBaseParts(views.Right, 'Right', collateralColors)
  if (rightParts.body) result.body.push(rightParts.body)
  if (rightParts.hands) result.hands.push(rightParts.hands)
  
  const backParts = extractBaseParts(views.Back, 'Back', collateralColors)
  if (backParts.body) result.body.push(backParts.body)
  if (backParts.hands) result.hands.push(backParts.hands)
  
  // Apply collateral colors to base templates for eyes and mouth variants
  if (baseTemplates.mouth_neutral.length > 0) {
    result.mouth_neutral = baseTemplates.mouth_neutral.map(template => 
      applyCollateralColors(template, collateralColors)
    )
  }
  
  if (baseTemplates.mouth_happy.length > 0) {
    result.mouth_happy = baseTemplates.mouth_happy.map(template => 
      applyCollateralColors(template, collateralColors)
    )
  }
  
  if (baseTemplates.eyes_mad.length > 0) {
    result.eyes_mad = baseTemplates.eyes_mad.map(template => 
      applyCollateralColors(template, collateralColors)
    )
  }
  
  if (baseTemplates.eyes_happy.length > 0) {
    result.eyes_happy = baseTemplates.eyes_happy.map(template => 
      applyCollateralColors(template, collateralColors)
    )
  }
  
  if (baseTemplates.eyes_sleepy.length > 0) {
    result.eyes_sleepy = baseTemplates.eyes_sleepy.map(template => 
      applyCollateralColors(template, collateralColors)
    )
  }
  
  return result
}

/**
 * Main function
 */
async function main() {
  console.log('=== Generate All Collateral Base JSONs ===\n')
  
  // Load collateral data
  const haunt1Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt2.json')
  
  let allCollaterals = []
  
  if (fs.existsSync(haunt1Path)) {
    const haunt1Data = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
    allCollaterals = allCollaterals.concat(haunt1Data.collaterals || [])
  }
  
  if (fs.existsSync(haunt2Path)) {
    const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
    allCollaterals = allCollaterals.concat(haunt2Data.collaterals || [])
  }
  
  console.log(`Found ${allCollaterals.length} collaterals\n`)
  
  // Load base templates
  console.log('Loading base templates...')
  const baseTemplates = loadBaseTemplates()
  console.log('✓ Base templates loaded')
  console.log(`  Mouth neutral: ${baseTemplates.mouth_neutral.length}`)
  console.log(`  Mouth happy: ${baseTemplates.mouth_happy.length}`)
  console.log(`  Eyes mad: ${baseTemplates.eyes_mad.length}`)
  console.log(`  Eyes happy: ${baseTemplates.eyes_happy.length}`)
  console.log(`  Eyes sleepy: ${baseTemplates.eyes_sleepy.length}\n`)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Create output directory
  const outputDir = path.join(__dirname, 'exports')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Process each collateral
  let successCount = 0
  let errorCount = 0
  const errors = []
  
  for (let i = 0; i < allCollaterals.length; i++) {
    const collateral = allCollaterals[i]
    
    try {
      const result = await generateCollateralBase(collateral, baseTemplates, contract)
      
      // Save individual file
      const filename = `collateral-base-${collateral.name.toLowerCase()}-${Date.now()}.json`
      const filepath = path.join(outputDir, filename)
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8')
      
      console.log(`✓ [${i + 1}/${allCollaterals.length}] Saved: ${filename}`)
      console.log(`  Body: ${result.body.length}, Hands: ${result.hands.length}, Shadow: ${result.shadow.length}`)
      console.log(`  Mouth: neutral=${result.mouth_neutral.length}, happy=${result.mouth_happy.length}`)
      console.log(`  Eyes: mad=${result.eyes_mad.length}, happy=${result.eyes_happy.length}, sleepy=${result.eyes_sleepy.length}`)
      
      successCount++
      
      // Small delay to avoid rate limiting
      if (i < allCollaterals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error(`✗ [${i + 1}/${allCollaterals.length}] Error processing ${collateral.name}:`, error.message)
      errors.push({ collateral: collateral.name, error: error.message })
      errorCount++
    }
  }
  
  // Summary
  console.log('\n=== Summary ===')
  console.log(`Total collaterals: ${allCollaterals.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  
  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(e => console.log(`  - ${e.collateral}: ${e.error}`))
  }
  
  console.log(`\nFiles saved to: ${outputDir}`)
}

// Run the script
main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

