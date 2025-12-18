import { ethers } from 'ethers'
import { DOMParser, XMLSerializer } from '@xmldom/xmldom'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Constants
const AAVEGOTCHI_DIAMOND = process.env.VITE_CONTRACT_ADDRESS || '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF'
const ALCHEMY_API_KEY = process.env.VITE_ALCHEMY_API_KEY || 'cePVnDpeOovd0mRN3jGWWuzrtkgIfcJr'
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// ABI for previewSideAavegotchi
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

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/Output')

// Debug flag
let debugFirstCollateral = true
let debugFirstSideView = true

/**
 * Helper function to find elements by tag and class
 */
function findElements(doc, tagName, className) {
  const results = []
  const elements = Array.from(doc.getElementsByTagName(tagName))
  
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
 * Load collateral data
 */
function loadCollateralData() {
  const haunt1Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt2.json')
  
  const haunt1 = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
  const haunt2 = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
  
  let haunt1Array = []
  let haunt2Array = []
  
  if (Array.isArray(haunt1)) {
    haunt1Array = haunt1
  } else if (haunt1.collaterals && Array.isArray(haunt1.collaterals)) {
    haunt1Array = haunt1.collaterals
  } else {
    haunt1Array = Object.values(haunt1)
  }
  
  if (Array.isArray(haunt2)) {
    haunt2Array = haunt2
  } else if (haunt2.collaterals && Array.isArray(haunt2.collaterals)) {
    haunt2Array = haunt2.collaterals
  } else {
    haunt2Array = Object.values(haunt2)
  }
  
  return [...haunt1Array, ...haunt2Array]
}

/**
 * Parse preview response
 */
function parsePreviewResponse(response) {
  let svgArray = []
  
  if (response && typeof response === 'object') {
    if (response.ag_) {
      const agValue = response.ag_
      if (Array.isArray(agValue)) {
        svgArray = agValue
      } else if (typeof agValue === 'string') {
        svgArray = [agValue]
      } else if (agValue && typeof agValue.length === 'number') {
        svgArray = []
        for (let i = 0; i < agValue.length; i++) {
          if (agValue[i] !== undefined) {
            svgArray.push(agValue[i])
          }
        }
      }
    } else if (Array.isArray(response)) {
      svgArray = response
    } else if (typeof response.length === 'number') {
      svgArray = []
      for (let i = 0; i < response.length; i++) {
        if (response[i] !== undefined) {
          svgArray.push(response[i])
        }
      }
    }
  }
  
  return svgArray
}

/**
 * Extract body (including cheeks) from SVG
 * Cheeks are preserved separately at root level (not in body group)
 * Hand paths are excluded to remove black hand outlines
 */
function extractBodyWithCheeks(svgString, collateralColors, viewName = '') {
  if (!svgString) return null
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  const serializer = new XMLSerializer()
  
  // Try multiple body class names (case-insensitive search)
  const bodyClasses = ['gotchi-body', 'gotchi-bodyLeft', 'gotchi-bodyRight', 'gotchi-bodyleft', 'gotchi-bodyright']
  let bodyGroup = null
  
  // First try exact class match
  for (const className of bodyClasses) {
    const elements = findElements(doc, 'g', className)
    if (elements.length > 0) {
      bodyGroup = elements[0]
      break
    }
  }
  
  // If not found, try case-insensitive search
  if (!bodyGroup) {
    const allGroups = findElements(doc, 'g', null)
    for (const group of allGroups) {
      const classAttr = (group.getAttribute('class') || '').toLowerCase()
      if (classAttr.includes('gotchi-body')) {
        bodyGroup = group
        break
      }
    }
  }
  
  // Variable to store body paths if we need to create bodyGroup from scattered paths
  let scatteredBodyPaths = []
  
  // If still no body group found, try to find paths with body-related classes directly
  // (Side views don't have a gotchi-body group, so paths are scattered)
  if (!bodyGroup) {
    // Look for paths with primary/secondary classes that might be the body
    const allPaths = []
    const walkPaths = (node) => {
      if (node && node.nodeType === 1) {
        if (node.nodeName === 'path') {
          allPaths.push(node)
        }
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            walkPaths(node.childNodes[i])
          }
        }
      }
    }
    walkPaths(doc.documentElement)
    
    // For side views, we need to find body paths more carefully
    // In side views, body paths might have gotchi-wearable class but are still the base body
    // We need to exclude paths that are in specific groups (collateral, eyes, shadow, bg, hands)
    // But include gotchi-wearable paths that are NOT in those groups (they're the body)
    
    // Helper to get parent group classes
    const getParentGroupClasses = (path) => {
      const groupClasses = []
      let parent = path.parentNode
      while (parent) {
        if (parent.nodeType === 1 && parent.nodeName === 'g') {
          const className = (parent.getAttribute('class') || '').toLowerCase()
          if (className) {
            groupClasses.push(...className.split(/\s+/))
          }
        }
        parent = parent.parentNode
      }
      return groupClasses
    }
    
    // Helper to check if a path is inside a specific group
    const isInGroup = (path, groupClass) => {
      const parentClasses = getParentGroupClasses(path)
      return parentClasses.some(pc => pc.includes(groupClass.toLowerCase()))
    }
    
    // Filter body paths: include paths that are NOT in excluded groups
    // In side views, body paths might not have classes themselves, but their parent groups do
    // Exclude hand groups and paths - they have black outlines that shouldn't be in the body
    const excludeGroupClasses = ['gotchi-collateral', 'gotchi-eyecolor', 'gotchi-shadow', 'gotchi-bg', 'gotchi-hand', 'gotchi-handsdownclosed', 'gotchi-handsdownopen', 'gotchi-handsup']
    
    // Debug: Log path info for first side view
    if (debugFirstSideView) {
      debugFirstSideView = false
      console.log(`    Debug - Total paths in side view: ${allPaths.length}`)
      
      // Find all unique parent group classes
      const allGroupClasses = new Set()
      allPaths.forEach(p => {
        const parentClasses = getParentGroupClasses(p)
        parentClasses.forEach(pc => allGroupClasses.add(pc))
      })
      console.log(`    Debug - All parent group classes found: ${Array.from(allGroupClasses).join(', ')}`)
      
      // Show paths NOT in excluded groups
      const nonExcludedPaths = allPaths.filter(p => {
        const inExcludedGroup = excludeGroupClasses.some(groupClass => isInGroup(p, groupClass))
        return !inExcludedGroup
      })
      console.log(`    Debug - Paths NOT in excluded groups: ${nonExcludedPaths.length}`)
      
      if (nonExcludedPaths.length > 0) {
        const pathInfo = nonExcludedPaths.slice(0, 10).map(p => {
          const pathClasses = (p.getAttribute('class') || '').toLowerCase()
          const parentClasses = getParentGroupClasses(p)
          return { 
            pathClass: pathClasses || 'none', 
            parentClasses: parentClasses.join(',') || 'none',
            d: (p.getAttribute('d') || '').substring(0, 30) 
          }
        })
        console.log(`    Debug - Non-excluded paths:`, JSON.stringify(pathInfo, null, 2))
      }
    }
    
    scatteredBodyPaths = allPaths.filter(p => {
      const pathClasses = (p.getAttribute('class') || '').toLowerCase()
      const parentClasses = getParentGroupClasses(p)
      const allClasses = [...pathClasses.split(/\s+/), ...parentClasses]
      
      const isCheek = allClasses.some(c => c.includes('gotchi-cheek'))
      const isPrimary = allClasses.some(c => c.includes('gotchi-primary'))
      const isSecondary = allClasses.some(c => c.includes('gotchi-secondary'))
      const hasWearableClass = allClasses.some(c => c.includes('gotchi-wearable'))
      const isHand = allClasses.some(c => c.includes('gotchi-hand'))
      
      // Check if path is in an excluded group (including hand groups)
      const inExcludedGroup = excludeGroupClasses.some(groupClass => isInGroup(p, groupClass))
      if (inExcludedGroup) return false
      
      // Exclude hand-related paths (they have black outlines)
      if (isHand) return false
      
      // Exclude paths with black fill - these are typically hand outlines
      const fill = (p.getAttribute('fill') || '').toLowerCase()
      if (fill === '#000' || fill === '#000000' || fill === 'black') {
        // Black paths are hand outlines - exclude them
        return false
      }
      
      // For side views, exclude small detail paths in hand area (y=37-45)
      // These are hand details, not body parts
      // BUT don't exclude paths that are part of the main body (they may pass through hand area)
      if (viewName === 'left' || viewName === 'right') {
        const d = (p.getAttribute('d') || '').toLowerCase()
        
        // Check if this is a main body path first (starts at y=14-15)
        const startsAtTop = d.includes('14') || d.includes('15')
        
        // Check if path coordinates are in hand area
        const handAreaY = [37, 38, 39, 40, 41, 42, 43, 44, 45]
        const isInHandArea = handAreaY.some(y => d.includes(y.toString()))
        
        // Also check x coordinates for hand areas (left: x=7-10, right: x=54-57)
        const handAreaXLeft = [7, 8, 9, 10]
        const handAreaXRight = [54, 55, 56, 57]
        const isInHandXArea = handAreaXLeft.some(x => d.includes(x.toString())) || 
                              handAreaXRight.some(x => d.includes(x.toString()))
        
        // Only exclude small paths in hand area if they're NOT main body paths
        // Main body paths may pass through hand area but are still part of the body
        if ((isInHandArea || isInHandXArea) && !startsAtTop) {
          const pathLength = d.length
          // Small paths (< 60 chars) in hand area are likely hand details
          if (pathLength < 60) {
            return false
          }
        }
      }
      
      // For side views: include paths with gotchi-wearable class
      // Body paths in side views have: gotchi-wearable + (gotchi-primary OR gotchi-secondary OR white fill)
      // Also include white fill paths that are part of the main body shape
      if (hasWearableClass) {
        const fill = (p.getAttribute('fill') || '').toLowerCase()
        const isWhiteFill = fill === '#fff' || fill === '#ffffff' || fill === 'white'
        
        // Include if it has primary/secondary class OR is white fill
        if (isPrimary || isSecondary || isWhiteFill) {
          // For side views, check if this is ONLY a hand detail path (not the main body)
          if (viewName === 'left' || viewName === 'right') {
            const d = (p.getAttribute('d') || '').toLowerCase()
            const handAreaY = [37, 38, 39, 40, 41, 42, 43, 44, 45]
            const isInHandArea = handAreaY.some(y => d.includes(y.toString()))
            
            // Check if this is the main body shape (starts around y=14-15, extends down)
            // Main body paths start at y=14-15 and extend to y=49-55 or have v41/v39 (which extends beyond)
            // White fill paths may extend to y=37 (v37) which is still part of the body
            const startsAtTop = d.includes('14') || d.includes('15')
            const extendsToBottom = d.includes('49') || d.includes('50') || d.includes('51') || d.includes('52') || d.includes('53') || d.includes('54') || d.includes('55')
            // Paths with v41 (vertical to y=41) are part of the main body shape even if they don't explicitly have y=49+
            // Also check for 'v39' which appears in secondary paths, and 'v37' which appears in white fill paths
            const hasV41 = d.includes('v41') || d.includes('V41')
            const hasV39 = d.includes('v39') || d.includes('V39')
            const hasV37 = d.includes('v37') || d.includes('V37')
            // White fill paths that start at top and extend down (even to y=37) are main body shapes
            const isMainBodyShape = startsAtTop && (extendsToBottom || hasV41 || hasV39 || (isWhiteFill && hasV37))
            
            // For primary/secondary/white fill paths: if they're main body shape, always include them
            // They may pass through hand area (y=41) but are still part of the body
            if (isMainBodyShape) {
              return true
            }
            
            // Exclude if it's ONLY in hand area (y=40-45) and doesn't extend to main body area
            // Hand paths are small and only exist in the hand area, not extending to y=49+
            if (isInHandArea && !isMainBodyShape) {
              // Check if path extends beyond hand area
              const extendsBeyondHandArea = d.includes('49') || d.includes('50') || d.includes('51') || d.includes('52') || d.includes('53') || d.includes('54') || d.includes('55') || hasV41 || hasV39
              if (!extendsBeyondHandArea) {
                // This is a hand detail path, exclude it
                return false
              }
            }
          }
          // If not a side view, or if it passed the side view checks, include it
          return true
        }
      }
      
      // Include: primary, secondary paths that aren't in excluded groups
      // DO NOT include cheek paths here - they should be separate (at root level)
      // Also include paths with no class if they're not in excluded groups (might be body details in side views)
      return (isPrimary || isSecondary) && !isCheek && (pathClasses === '' && !inExcludedGroup)
    })
    
    if (debugFirstCollateral && scatteredBodyPaths.length === 0) {
      debugFirstCollateral = false
      console.log(`    Debug - No body paths found! Total paths: ${allPaths.length}`)
    }
    
    if (scatteredBodyPaths.length > 0) {
      // Create a body group from these paths
      bodyGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
      bodyGroup.setAttribute('class', 'gotchi-body')
    }
  }
  
  if (!bodyGroup) {
    return null
  }
  
  // Extract all paths from body group
  // If bodyGroup was created from scattered paths, use those paths directly
  // Otherwise, walk the existing bodyGroup to extract paths
  let finalBodyPaths = []
  
  if (scatteredBodyPaths.length > 0) {
    // BodyGroup was created from scattered paths - use those paths
    finalBodyPaths = scatteredBodyPaths.map(p => p.cloneNode(true))
    // Add them to the bodyGroup
    finalBodyPaths.forEach(path => bodyGroup.appendChild(path))
  } else {
    // BodyGroup already has paths (from existing gotchi-body group)
    const walk = (node) => {
      if (node && node.nodeType === 1) {
        if (node.nodeName === 'path') {
          finalBodyPaths.push(node)
        }
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) {
            walk(node.childNodes[i])
          }
        }
      }
    }
    walk(bodyGroup)
  }
  
  // Also search for cheek paths anywhere in the SVG (they might be outside the body group)
  const allPathsInSvg = []
  const walkAllPaths = (node) => {
    if (node && node.nodeType === 1) {
      if (node.nodeName === 'path') {
        allPathsInSvg.push(node)
      }
      if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
          walkAllPaths(node.childNodes[i])
        }
      }
    }
  }
  walkAllPaths(doc.documentElement)
  
  // Find cheek paths - they should be at root level, NOT in body group
  // Cheeks are separate from the body and should be preserved separately
  const cheekPaths = allPathsInSvg.filter(p => {
    const classes = (p.getAttribute('class') || '').toLowerCase()
    return classes.includes('gotchi-cheek')
  })
  
  // Deduplicate cheek paths by comparing their 'd' attribute
  const uniqueCheekPaths = []
  const seenCheekPaths = new Set()
  for (const cheekPath of cheekPaths) {
    const d = (cheekPath.getAttribute('d') || '').trim()
    if (d && !seenCheekPaths.has(d)) {
      seenCheekPaths.add(d)
      uniqueCheekPaths.push(cheekPath.cloneNode(true))
    }
  }
  
  // Note: Cheeks will be added at root level after the body group (see below)
  // We don't add them to bodyGroup - they're separate elements
  
  // Sort paths: primary -> secondary -> white fill (white fill on top)
  // Cheeks are included automatically as they're part of the body group
  const sortedPaths = [...finalBodyPaths].sort((a, b) => {
    const aClasses = (a.getAttribute('class') || '').toLowerCase()
    const bClasses = (b.getAttribute('class') || '').toLowerCase()
    const aFill = a.getAttribute('fill') || ''
    const bFill = b.getAttribute('fill') || ''
    
    const aIsPrimary = aClasses.includes('gotchi-primary')
    const bIsPrimary = bClasses.includes('gotchi-primary')
    const aIsSecondary = aClasses.includes('gotchi-secondary')
    const bIsSecondary = bClasses.includes('gotchi-secondary')
    const aIsWhiteFill = aFill === '#fff' || aFill === '#ffffff'
    const bIsWhiteFill = bFill === '#fff' || bFill === '#ffffff'
    
    // Primary first (bottom layer)
    if (aIsPrimary && !bIsPrimary) return -1
    if (!aIsPrimary && bIsPrimary) return 1
    
    // Secondary second (middle layer)
    if (aIsSecondary && !bIsSecondary) return -1
    if (!aIsSecondary && bIsSecondary) return 1
    
    // White fill last (top layer)
    if (aIsWhiteFill && !bIsWhiteFill) return 1
    if (!aIsWhiteFill && bIsWhiteFill) return -1
    
    return 0
  })
  
  // Create new body group with sorted paths
  const newBodyGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g')
  newBodyGroup.setAttribute('class', bodyGroup.getAttribute('class') || 'gotchi-body')
  
  // Ensure white fill paths use #ffffff format
  sortedPaths.forEach(path => {
    const clonedPath = path.cloneNode(true)
    const fill = clonedPath.getAttribute('fill')
    if (fill === '#fff' || fill === '#ffffff') {
      clonedPath.setAttribute('fill', '#ffffff')
    }
    newBodyGroup.appendChild(clonedPath)
  })
  
  // Create wrapper SVG with style
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  
  // Add style with colors
  if (collateralColors) {
    const primaryColor = collateralColors.primaryColor.replace('0x', '#')
    const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
    const cheekColor = collateralColors.cheekColor.replace('0x', '#')
    
    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.appendChild(doc.createTextNode(`
      .gotchi-primary{fill:${primaryColor};}
      .gotchi-secondary{fill:${secondaryColor};}
      .gotchi-cheek{fill:${cheekColor};}
    `.trim()))
    wrapper.appendChild(style)
  }
  
  // Add body group
  wrapper.appendChild(newBodyGroup)
  
  // Add cheek paths at root level (NOT inside body group)
  // This matches the structure from the sample SVG where cheeks are separate
  for (const cheekPath of uniqueCheekPaths) {
    wrapper.appendChild(cheekPath)
  }
  
  return serializer.serializeToString(wrapper)
}

/**
 * Determine view order
 */
function determineViewOrder(svgArray) {
  const view1 = (svgArray[1] || '').toLowerCase()
  const view2 = (svgArray[2] || '').toLowerCase()
  
  const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft') || view1.includes('left')
  const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft') || view2.includes('left')
  const view1IsRight = view1.includes('bodyright') || view1.includes('gotchi-bodyright') || view1.includes('right')
  const view2IsRight = view2.includes('bodyright') || view2.includes('gotchi-bodyright') || view2.includes('right')
  
  const views = {
    front: svgArray[0],
    back: svgArray[3]
  }
  
  if (view1IsLeft && view2IsRight) {
    views.left = svgArray[1]
    views.right = svgArray[2]
  } else if (view1IsRight && view2IsLeft) {
    views.left = svgArray[2]
    views.right = svgArray[1]
  } else if (view1IsLeft && !view2IsLeft) {
    views.left = svgArray[1]
    views.right = svgArray[2]
  } else if (view2IsLeft && !view1IsLeft) {
    views.left = svgArray[2]
    views.right = svgArray[1]
  } else {
    // Default fallback - assume order is left, right
    views.left = svgArray[1]
    views.right = svgArray[2]
  }
  
  return views
}

/**
 * Get collateral name from address
 */
function getCollateralName(collateralAddress, collaterals) {
  const collateral = collaterals.find(c => {
    const addr = (c.collateralType || c.collateral || '').toLowerCase()
    return addr === collateralAddress.toLowerCase()
  })
  
  if (collateral) {
    // Try to extract name from collateral data
    if (collateral.name) return collateral.name.toLowerCase()
    if (collateral.collateralType) {
      // Extract from address or use a default
      return collateralAddress.slice(2, 8).toLowerCase()
    }
  }
  
  return collateralAddress.slice(2, 8).toLowerCase()
}

async function main() {
  console.log('=== Extracting Body (with Cheeks) for All Collaterals ===\n')
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  }
  
  // Load collaterals
  const collaterals = loadCollateralData()
  console.log(`Loaded ${collaterals.length} collaterals\n`)
  
  // Connect to provider
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  const baseHauntId = 1
  const neutralTraits = [50, 50, 50, 50, 50, 50]
  const emptyWearables = new Array(16).fill(0)
  
  const viewNames = ['front', 'left', 'right', 'back']
  let successCount = 0
  let errorCount = 0
  
  for (let i = 0; i < collaterals.length; i++) {
    const collateral = collaterals[i]
    const collateralAddress = collateral.collateralType || collateral.collateral
    
    if (!collateralAddress) {
      console.log(`[${i + 1}/${collaterals.length}] Skipping - no address`)
      continue
    }
    
    const collateralName = getCollateralName(collateralAddress, collaterals)
    const collateralColors = {
      primaryColor: collateral.primaryColor || '0x000000',
      secondaryColor: collateral.secondaryColor || '0x000000',
      cheekColor: collateral.cheekColor || '0x000000'
    }
    
    try {
      console.log(`[${i + 1}/${collaterals.length}] Processing ${collateralName} (${collateralAddress.slice(0, 10)}...)`)
      
      // Fetch SVG data
      const response = await contract.previewSideAavegotchi(
        baseHauntId,
        collateralAddress,
        neutralTraits,
        emptyWearables
      )
      
      const svgArray = parsePreviewResponse(response)
      
      if (svgArray.length < 4) {
        console.log(`  ⚠️  Only received ${svgArray.length} views, skipping`)
        errorCount++
        continue
      }
      
      const views = determineViewOrder(svgArray)
      
      // Extract body from each view
      for (const [viewName, svgString] of Object.entries(views)) {
        if (!svgString || svgString.length < 100) {
          if (viewName === 'left' || viewName === 'right') {
            console.log(`  ⚠️  ${viewName} view is empty or too short`)
          }
          continue
        }
        
        const bodySvg = extractBodyWithCheeks(svgString, collateralColors, viewName)
        
        if (bodySvg) {
          const filename = `body_${viewName}_${collateralName}.svg`
          const filepath = path.join(OUTPUT_DIR, filename)
          fs.writeFileSync(filepath, bodySvg, 'utf8')
          console.log(`  ✓ Saved ${viewName} view body`)
        } else {
          console.log(`  ⚠️  No body found in ${viewName} view`)
        }
      }
      
      successCount++
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`)
      errorCount++
    }
  }
  
  console.log(`\n=== Complete ===`)
  console.log(`Success: ${successCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log(`Output directory: ${OUTPUT_DIR}`)
}

main().catch(console.error)

