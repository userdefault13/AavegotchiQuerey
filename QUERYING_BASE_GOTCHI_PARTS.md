# Querying Base Gotchi Parts and Parsing to SVGs

This guide explains how to query the Aavegotchi smart contract on Base chain to fetch base Gotchi parts (without wearables) and parse them into individual SVG components.

## Overview

The process involves:
1. **Contract Setup**: Connecting to the Aavegotchi Diamond contract on Base
2. **Querying Base Parts**: Using `previewSideAavegotchi` with neutral traits and empty wearables
3. **Parsing Response**: Extracting SVG strings from the contract response
4. **Extracting Parts**: Parsing each SVG to extract individual parts (Body, Eyes, Mouth, etc.)

## Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- Access to Base network (via Alchemy RPC or similar)
- `ethers.js` library

## Contract Information

- **Contract Address**: `0xA99c4B08201F2913Db8D28e71d020c4298F29dBF`
- **Network**: Base (Chain ID: 8453)
- **RPC Provider**: Alchemy (or your preferred provider)

## Step 1: Contract Setup

First, set up your contract connection:

```javascript
import { ethers } from 'ethers'

const AAVEGOTCHI_DIAMOND = '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF'
const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY`

// Minimal ABI for previewSideAavegotchi
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

// Create provider and contract
const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
```

## Step 2: Querying Base Gotchi Parts

To get clean base Gotchi parts (without wearables), call `previewSideAavegotchi` with:
- **hauntId**: `1` (Haunt 1 - the base template)
- **collateral**: The collateral address (e.g., `0x...` for a specific collateral type)
- **numericTraits**: `[50, 50, 50, 50, 50, 50]` (neutral traits) OR use actual gotchi traits to preserve eye shape/color
- **equippedWearables**: `[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]` (empty array)

```javascript
async function fetchBaseGotchiParts(collateral) {
  const baseHauntId = 1
  const neutralTraits = [50, 50, 50, 50, 50, 50] // Neutral traits
  // OR use actual gotchi traits to preserve eye shape/color:
  // const traitsForCleanPreview = numericTraits || [50, 50, 50, 50, 50, 50]
  const emptyWearables = new Array(16).fill(0)
  
  console.log('Calling previewSideAavegotchi with:', {
    hauntId: baseHauntId,
    collateral: collateral,
    traits: neutralTraits,
    wearables: emptyWearables
  })
  
  const response = await contract.previewSideAavegotchi(
    baseHauntId,
    collateral,
    neutralTraits,
    emptyWearables
  )
  
  return response
}
```

## Step 3: Parsing the Response

The contract response can be in different formats. Handle all cases:

```javascript
function parsePreviewResponse(response) {
  let svgArray = []
  
  if (response && typeof response === 'object') {
    // Case 1: Array-like object with length property
    if (typeof response.length === 'number' && response.length > 0) {
      svgArray = []
      for (let i = 0; i < response.length; i++) {
        if (response[i] !== undefined) {
          svgArray.push(response[i])
        }
      }
    }
    // Case 2: Object with ag_ property (ethers.js format)
    else if (response.ag_) {
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
    }
    // Case 3: Real array
    else if (Array.isArray(response)) {
      svgArray = response
    }
  }
  
  return svgArray
}
```

The response contains 4 SVG views in order:
- **Index 0**: Front view
- **Index 1**: Left or Right view (check content to determine)
- **Index 2**: Right or Left view (check content to determine)
- **Index 3**: Back view

To determine left/right order:

```javascript
function determineViewOrder(svgArray) {
  const view1 = (svgArray[1] || '').toLowerCase()
  const view2 = (svgArray[2] || '').toLowerCase()
  
  const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')
  const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft')
  
  const views = {
    Front: svgArray[0],
    Back: svgArray[3]
  }
  
  if (view1IsLeft && !view2IsLeft) {
    views.Left = svgArray[1]
    views.Right = svgArray[2]
  } else if (view2IsLeft && !view1IsLeft) {
    views.Left = svgArray[2]
    views.Right = svgArray[1]
  } else {
    // Default fallback
    views.Left = svgArray[1]
    views.Right = svgArray[2]
  }
  
  return views
}
```

## Step 4: Extracting Individual Parts from SVG

Each SVG contains multiple parts that need to be extracted. The base parts include:

- **Background** (`g.gotchi-bg`)
- **Body** (`g.gotchi-body`, `g.gotchi-bodyLeft`, `g.gotchi-bodyRight`)
- **Mouth** (`g.gotchi-mouth`)
- **Eyes** (`g.gotchi-eyes`)
- **Collateral** (`g.gotchi-collateral`)
- **Hands** (`g.gotchi-hands`)
- **Shadow** (`g.gotchi-shadow`)

### Extraction Function

```javascript
function extractBaseParts(svgString, viewName = 'Unknown') {
  if (!svgString) return {}
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  
  const parts = {}
  
  // Helper function to extract and wrap an element
  const extractPart = (selectors, partName) => {
    const selectorArray = Array.isArray(selectors) ? selectors : [selectors]
    
    for (const selector of selectorArray) {
      const element = doc.querySelector(selector)
      if (element) {
        const clone = element.cloneNode(true)
        const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        wrapper.setAttribute('viewBox', viewBox)
        wrapper.appendChild(clone)
        const serializer = new XMLSerializer()
        return serializer.serializeToString(wrapper)
      }
    }
    return ''
  }
  
  // Extract Background
  const bgElement = doc.querySelector('g.gotchi-bg')
  if (bgElement) {
    const clone = bgElement.cloneNode(true)
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    wrapper.appendChild(clone)
    const serializer = new XMLSerializer()
    parts.Background = serializer.serializeToString(wrapper)
  }
  
  // Extract Body - try multiple selectors for front and side views
  const bodyGroup = doc.querySelector('g.gotchi-body, g[class*="gotchi-bodyLeft"], g[class*="gotchi-bodyRight"]')
  if (bodyGroup) {
    // Extract all paths including primary, secondary, and white fill paths
    const bodyPaths = Array.from(bodyGroup.querySelectorAll('path'))
    
    // Sort paths: primary -> secondary -> white fill (white fill on top)
    const sortedPaths = [...bodyPaths].sort((a, b) => {
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
    const newBodyGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g')
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
    
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    wrapper.setAttribute('viewBox', viewBox)
    
    // Include style element if it exists
    const styleElement = doc.querySelector('style')
    if (styleElement) {
      const styleClone = styleElement.cloneNode(true)
      wrapper.appendChild(styleClone)
    }
    
    wrapper.appendChild(newBodyGroup)
    const serializer = new XMLSerializer()
    parts.Body = serializer.serializeToString(wrapper)
  }
  
  // Extract Mouth
  parts.Mouth = extractPart('g.gotchi-mouth', 'Mouth')
  
  // Extract Eyes
  parts.Eyes = extractPart('g.gotchi-eyes', 'Eyes')
  
  // Extract Collateral
  parts.Collateral = extractPart('g.gotchi-collateral', 'Collateral')
  
  // Extract Hands
  parts.Hands = extractPart('g.gotchi-hands', 'Hands')
  
  // Extract Shadow
  parts.Shadow = extractPart('g.gotchi-shadow', 'Shadow')
  
  return parts
}
```

## Complete Example

Here's a complete example that ties everything together:

```javascript
import { ethers } from 'ethers'

async function getBaseGotchiParts(collateral) {
  // Setup contract (see Step 1)
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  // Fetch base parts (see Step 2)
  const baseHauntId = 1
  const neutralTraits = [50, 50, 50, 50, 50, 50]
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    baseHauntId,
    collateral,
    neutralTraits,
    emptyWearables
  )
  
  // Parse response (see Step 3)
  const svgArray = parsePreviewResponse(response)
  const views = determineViewOrder(svgArray)
  
  // Extract parts from each view (see Step 4)
  const basePartsByView = {}
  
  for (const [viewName, svgString] of Object.entries(views)) {
    if (svgString) {
      const parts = extractBaseParts(svgString, viewName)
      basePartsByView[viewName] = parts
      
      console.log(`${viewName} view parts:`, {
        parts: Object.keys(parts),
        hasBackground: !!parts.Background,
        hasBody: !!parts.Body,
        hasMouth: !!parts.Mouth,
        hasEyes: !!parts.Eyes,
        hasCollateral: !!parts.Collateral,
        hasHands: !!parts.Hands,
        hasShadow: !!parts.Shadow
      })
    }
  }
  
  return basePartsByView
}

// Usage
const collateral = '0x...' // Your collateral address
const baseParts = await getBaseGotchiParts(collateral)

// Access individual parts
console.log('Front view body:', baseParts.Front.Body)
console.log('Left view eyes:', baseParts.Left.Eyes)
```

## Important Notes

1. **Neutral vs Actual Traits**: Using neutral traits `[50, 50, 50, 50, 50, 50]` gives you a base template. Using actual gotchi traits preserves eye shape/color but may affect other visual aspects.

2. **Body Path Ordering**: The body extraction is complex because it needs to preserve the correct z-order: primary color (bottom) → secondary color (middle) → white fill (top).

3. **Side View Differences**: Side views may have different class names (`gotchi-bodyLeft`, `gotchi-bodyRight`) compared to front view (`gotchi-body`).

4. **White Fill Paths**: Some body parts include white fill paths that need to be extracted separately and placed on top of the colored paths.

5. **Response Format**: The contract response format can vary depending on your ethers.js version and how the contract returns data. Always handle multiple response formats.

6. **Error Handling**: Always wrap contract calls in try-catch blocks and validate responses before parsing.

## Troubleshooting

- **Empty response**: Check that you're using the correct collateral address and hauntId
- **Missing parts**: Some views may not have all parts (e.g., Back view might not have Eyes)
- **Parsing errors**: Ensure SVG strings are valid XML before parsing
- **Path ordering issues**: Verify that body paths are sorted correctly (primary → secondary → white fill)

## See Also

- `src/components/Stage.vue` - Full implementation with error handling
- `src/composables/useAavegotchi.js` - Vue composable for fetching gotchi data
- `src/utils/contract.js` - Contract interaction utilities


