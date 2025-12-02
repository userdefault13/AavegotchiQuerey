import { ethers } from 'ethers'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import { getAavegotchi } from './getAavegotchi.js'

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
 * Load collateral data from JSON files
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
  
  const collateral = collaterals.find(c => 
    c.collateralType.toLowerCase() === collateralAddress.toLowerCase()
  )
  
  return collateral
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
    // Handle Proxy array
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
 * Returns: { Front, Left, Right, Back }
 */
function determineViewOrder(svgArray) {
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  // Based on typical order: [front, left, right, back]
  return {
    Front: svgArray[0],
    Left: svgArray[1],
    Right: svgArray[2],
    Back: svgArray[3]
  }
}

/**
 * Helper function to find elements by class name
 */
function findElementsByClass(doc, className) {
  const results = []
  
  const walk = (node) => {
    if (node.nodeType === 1) { // ELEMENT_NODE
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
 * Extract base parts from SVG string
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
        if (mask || fill === '#dea8ff' || fill === '#dea8ff') {
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
  
  // Extract Mouth - look for gotchi-primary-mouth or gotchi-mouth
  const mouthClasses = ['gotchi-primary-mouth', 'gotchi-mouth']
  let mouthGroup = null
  for (const className of mouthClasses) {
    const elements = findElements(doc, 'g', className)
    if (elements.length > 0) {
      mouthGroup = elements[0]
      break
    }
  }
  if (mouthGroup) {
    parts.mouth_neutral = wrapInSvg(mouthGroup)
    
    // Check for happy mouth variant (simple check)
    const mouthContent = serializer.serializeToString(mouthGroup)
    if (mouthContent.includes('happy') || mouthContent.includes('Happy')) {
      parts.mouth_happy = wrapInSvg(mouthGroup)
    }
  }
  
  // Extract Eyes - look for gotchi-eyeColor (this is what's actually used)
  const eyesElements = findElements(doc, 'g', 'gotchi-eyeColor')
  if (eyesElements.length > 0) {
    const eyesGroup = eyesElements[0]
    const eyesContent = serializer.serializeToString(eyesGroup)
    
    // Check for different eye states
    if (eyesContent.includes('mad') || eyesContent.includes('Mad')) {
      parts.eyes_mad = wrapInSvg(eyesGroup)
    } else if (eyesContent.includes('sleepy') || eyesContent.includes('Sleepy')) {
      parts.eyes_sleepy = wrapInSvg(eyesGroup)
    } else {
      // Default to happy
      parts.eyes_happy = wrapInSvg(eyesGroup)
    }
  }
  
  // Extract Shadow
  const shadowElements = findElements(doc, 'g', 'gotchi-shadow')
  if (shadowElements.length > 0) {
    parts.shadow = wrapInSvg(shadowElements[0], false) // Don't include style for shadow
  }
  
  return parts
}

/**
 * Generate base JSON for a collateral
 */
async function generateCollateralBase(collateralAddress, traits, outputPath) {
  console.log('=== Generate Collateral Base JSON ===')
  console.log(`Collateral: ${collateralAddress}`)
  console.log(`Traits: [${traits.join(', ')}]`)
  console.log(`Empty Wearables: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]\n`)
  
  // Load collateral data for colors
  const collateralData = loadCollateralData(collateralAddress)
  if (!collateralData) {
    throw new Error(`Collateral ${collateralAddress} not found in database`)
  }
  
  console.log(`Found collateral: ${collateralData.name}`)
  console.log(`Primary Color: ${collateralData.primaryColor}`)
  console.log(`Secondary Color: ${collateralData.secondaryColor}`)
  console.log(`Cheek Color: ${collateralData.cheekColor}\n`)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Call previewSideAavegotchi
  console.log('Calling previewSideAavegotchi...')
  const hauntId = 1
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    hauntId,
    collateralAddress,
    traits,
    emptyWearables
  )
  
  // Parse response
  const svgArray = parsePreviewResponse(response)
  console.log(`Received ${svgArray.length} SVG views\n`)
  
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
  
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  // Extract from Front view
  const frontParts = extractBaseParts(views.Front, 'Front', collateralColors)
  if (frontParts.body) result.body.push(frontParts.body)
  if (frontParts.hands) result.hands.push(frontParts.hands)
  if (frontParts.mouth_neutral) result.mouth_neutral.push(frontParts.mouth_neutral)
  if (frontParts.mouth_happy) result.mouth_happy.push(frontParts.mouth_happy)
  if (frontParts.eyes_mad) result.eyes_mad.push(frontParts.eyes_mad)
  if (frontParts.eyes_happy) result.eyes_happy.push(frontParts.eyes_happy)
  if (frontParts.eyes_sleepy) result.eyes_sleepy.push(frontParts.eyes_sleepy)
  if (frontParts.shadow) result.shadow.push(frontParts.shadow)
  
  // Extract from Left view
  const leftParts = extractBaseParts(views.Left, 'Left', collateralColors)
  if (leftParts.body) result.body.push(leftParts.body)
  if (leftParts.hands) result.hands.push(leftParts.hands)
  
  // Extract from Right view
  const rightParts = extractBaseParts(views.Right, 'Right', collateralColors)
  if (rightParts.body) result.body.push(rightParts.body)
  if (rightParts.hands) result.hands.push(rightParts.hands)
  
  // Extract from Back view
  const backParts = extractBaseParts(views.Back, 'Back', collateralColors)
  if (backParts.body) result.body.push(backParts.body)
  if (backParts.hands) result.hands.push(backParts.hands)
  
  // Save to file
  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
    console.log(`\n✓ Saved to: ${outputPath}`)
  }
  
  // Display summary
  console.log('\n=== Extraction Summary ===')
  console.log(`Body views: ${result.body.length}`)
  console.log(`Hands views: ${result.hands.length}`)
  console.log(`Mouth neutral: ${result.mouth_neutral.length}`)
  console.log(`Mouth happy: ${result.mouth_happy.length}`)
  console.log(`Eyes mad: ${result.eyes_mad.length}`)
  console.log(`Eyes happy: ${result.eyes_happy.length}`)
  console.log(`Eyes sleepy: ${result.eyes_sleepy.length}`)
  console.log(`Shadow: ${result.shadow.length}`)
  
  return result
}

/**
 * Main function
 */
async function main() {
  // Parse arguments - skip 'node' and script name
  const args = process.argv.slice(2)
  const collateralAddress = args[0] || '0x8c8bdBe9CeE455732525086264a4Bf9Cf821C498'
  const tokenIdArg = args[1]
  const tokenId = tokenIdArg ? parseInt(tokenIdArg) : 954
  
  if (!collateralAddress || !collateralAddress.startsWith('0x')) {
    console.log('Usage: node cli/generateCollateralBase.js <collateralAddress> [tokenId]')
    console.log('')
    console.log('Arguments:')
    console.log('  collateralAddress  - Collateral contract address (required)')
    console.log('  tokenId           - Token ID to get traits from (optional, defaults to 954)')
    console.log('')
    console.log('Example:')
    console.log('  node cli/generateCollateralBase.js 0x8c8bdBe9CeE455732525086264a4Bf9Cf821C498 954')
    process.exit(1)
  }
  
  // Get traits from token if provided
  let traits = [50, 50, 50, 50, 50, 50] // Default neutral traits
  
  if (tokenId && !isNaN(tokenId)) {
    try {
      // Suppress console output from getAavegotchi
      const originalLog = console.log
      const originalError = console.error
      console.log = () => {}
      console.error = () => {}
      
      const gotchiData = await getAavegotchi(tokenId)
      
      // Restore console functions
      console.log = originalLog
      console.error = originalError
      
      traits = gotchiData.traits.numericTraits
      console.log(`Using traits from token ${tokenId}: [${traits.join(', ')}]\n`)
    } catch (error) {
      console.warn(`Could not fetch traits from token ${tokenId}, using neutral traits:`, error.message)
    }
  }
  
  // Generate output filename
  const collateralData = loadCollateralData(collateralAddress)
  const collateralName = collateralData?.name || 'unknown'
  const outputDir = path.join(__dirname, 'exports')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, `collateral-base-${collateralName.toLowerCase()}-${Date.now()}.json`)
  
  await generateCollateralBase(collateralAddress, traits, outputPath)
}

// Run the script
main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

