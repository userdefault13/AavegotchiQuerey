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

// Load collateral data
function loadCollateralData() {
  const haunt1Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt1.json')
  const haunt2Path = path.join(__dirname, '../../Aseprite-AavegotchiPaaint/JSONs/aavegotchi_db_collaterals_haunt2.json')
  
  const haunt1 = JSON.parse(fs.readFileSync(haunt1Path, 'utf8'))
  const haunt2 = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
  
  // Handle different JSON structures
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

// Parse preview response
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

// Check for mouth and cheeks in SVG
function checkMouthAndCheeks(svgString, viewName) {
  if (!svgString) {
    return { hasMouth: false, hasCheeks: false, mouthClass: null, cheekElements: [] }
  }
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  
  // Check for mouth groups
  const mouthClasses = ['gotchi-primary-mouth', 'gotchi-mouth']
  let mouthGroup = null
  let mouthClass = null
  
  for (const className of mouthClasses) {
    const elements = doc.getElementsByTagName('g')
    for (let i = 0; i < elements.length; i++) {
      const classes = (elements[i].getAttribute('class') || '').split(/\s+/)
      if (classes.includes(className)) {
        mouthGroup = elements[i]
        mouthClass = className
        break
      }
    }
    if (mouthGroup) break
  }
  
  // Check for cheek elements (paths with gotchi-cheek class)
  const allPaths = doc.getElementsByTagName('path')
  const cheekElements = []
  
  for (let i = 0; i < allPaths.length; i++) {
    const classes = (allPaths[i].getAttribute('class') || '').split(/\s+/)
    if (classes.includes('gotchi-cheek')) {
      cheekElements.push(allPaths[i])
    }
  }
  
  // Also check for cheek in groups
  const allGroups = doc.getElementsByTagName('g')
  for (let i = 0; i < allGroups.length; i++) {
    const classes = (allGroups[i].getAttribute('class') || '').split(/\s+/)
    if (classes.includes('gotchi-cheek')) {
      cheekElements.push(allGroups[i])
    }
  }
  
  return {
    hasMouth: !!mouthGroup,
    hasCheeks: cheekElements.length > 0,
    mouthClass: mouthClass,
    cheekCount: cheekElements.length,
    mouthContent: mouthGroup ? new XMLSerializer().serializeToString(mouthGroup).substring(0, 200) : null
  }
}

async function main() {
  const collaterals = loadCollateralData()
  // Use amAAVE if available, otherwise first collateral
  const testCollateral = collaterals.find(c => c && (c.collateralType || c.collateral) && (
    (c.collateralType && c.collateralType.toLowerCase().includes('e0b22e0037b130a9f56bbb537684e6fa18192341')) ||
    (c.collateral && c.collateral.toLowerCase().includes('e0b22e0037b130a9f56bbb537684e6fa18192341'))
  ))
  
  // Use first valid collateral
  const collateral = testCollateral || collaterals.find(c => c && (c.collateralType || c.collateral)) || collaterals[0]
  
  if (!collateral || (!collateral.collateralType && !collateral.collateral)) {
    console.error('No valid collateral found')
    process.exit(1)
  }
  
  const collateralAddress = collateral.collateralType || collateral.collateral
  console.log('Checking mouth and cheeks structure for:', collateralAddress)
  console.log('Collateral name:', collateral.name || 'Unknown')
  console.log('')
  
  try {
    const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
    const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
    
    const baseHauntId = 1
    const neutralTraits = [50, 50, 50, 50, 50, 50]
    const emptyWearables = new Array(16).fill(0)
    
    console.log('Fetching SVG data from contract...')
    const collateralAddress = collateral.collateralType || collateral.collateral
    const response = await contract.previewSideAavegotchi(
      baseHauntId,
      collateralAddress,
      neutralTraits,
      emptyWearables
    )
    
    const svgArray = parsePreviewResponse(response)
    console.log(`Received ${svgArray.length} views\n`)
    
    const viewNames = ['Front', 'Left/Right (1)', 'Right/Left (2)', 'Back']
    
    for (let i = 0; i < svgArray.length && i < 4; i++) {
      const svgString = svgArray[i]
      const viewName = viewNames[i] || `View ${i}`
      
      console.log(`=== ${viewName} View ===`)
      const result = checkMouthAndCheeks(svgString, viewName)
      
      console.log(`Has Mouth: ${result.hasMouth}`)
      if (result.hasMouth) {
        console.log(`  Mouth Class: ${result.mouthClass}`)
        console.log(`  Mouth Preview: ${result.mouthContent ? result.mouthContent + '...' : 'N/A'}`)
      }
      
      console.log(`Has Cheeks: ${result.hasCheeks}`)
      if (result.hasCheeks) {
        console.log(`  Cheek Elements Count: ${result.cheekCount}`)
      }
      
      console.log('')
    }
    
    // Determine which is left and which is right
    const view1 = (svgArray[1] || '').toLowerCase()
    const view2 = (svgArray[2] || '').toLowerCase()
    
    const view1IsLeft = view1.includes('bodyleft') || view1.includes('gotchi-bodyleft')
    const view2IsLeft = view2.includes('bodyleft') || view2.includes('gotchi-bodyleft')
    
    console.log('=== View Order Determination ===')
    if (view1IsLeft && !view2IsLeft) {
      console.log('View 1 is LEFT, View 2 is RIGHT')
      console.log('\nLEFT View:')
      const leftResult = checkMouthAndCheeks(svgArray[1], 'Left')
      console.log(`  Has Mouth: ${leftResult.hasMouth}, Has Cheeks: ${leftResult.hasCheeks}`)
      
      console.log('\nRIGHT View:')
      const rightResult = checkMouthAndCheeks(svgArray[2], 'Right')
      console.log(`  Has Mouth: ${rightResult.hasMouth}, Has Cheeks: ${rightResult.hasCheeks}`)
    } else if (view2IsLeft && !view1IsLeft) {
      console.log('View 1 is RIGHT, View 2 is LEFT')
      console.log('\nLEFT View:')
      const leftResult = checkMouthAndCheeks(svgArray[2], 'Left')
      console.log(`  Has Mouth: ${leftResult.hasMouth}, Has Cheeks: ${leftResult.hasCheeks}`)
      
      console.log('\nRIGHT View:')
      const rightResult = checkMouthAndCheeks(svgArray[1], 'Right')
      console.log(`  Has Mouth: ${rightResult.hasMouth}, Has Cheeks: ${rightResult.hasCheeks}`)
    } else {
      console.log('Could not determine view order, checking both:')
      console.log('\nView 1:')
      const v1Result = checkMouthAndCheeks(svgArray[1], 'View 1')
      console.log(`  Has Mouth: ${v1Result.hasMouth}, Has Cheeks: ${v1Result.hasCheeks}`)
      
      console.log('\nView 2:')
      const v2Result = checkMouthAndCheeks(svgArray[2], 'View 2')
      console.log(`  Has Mouth: ${v2Result.hasMouth}, Has Cheeks: ${v2Result.hasCheeks}`)
    }
    
  } catch (error) {
    console.error('Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()


