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

// Eye color rarity mappings
const EYE_COLOR_RARITY_MAP = {
  mythical_low: { min: 0, max: 1, color: '#FF00FF' },
  rare_low: { min: 2, max: 4, color: '#0064FF' },
  uncommon_low: { min: 5, max: 9, color: '#5D24BF' },
  common: { min: 10, max: 89, color: null },
  uncommon_high: { min: 90, max: 94, color: '#36818E' },
  rare_high: { min: 95, max: 97, color: '#EA8C27' },
  mythical_high: { min: 98, max: 99, color: '#51FFA8' }
}

const eyeColorTraits = [
  { trait: 1, rarity: 'MythicalLow' },
  { trait: 3, rarity: 'RareLow' },
  { trait: 7, rarity: 'UncommonLow' },
  { trait: 50, rarity: 'Common' },
  { trait: 92, rarity: 'UncommonHigh' },
  { trait: 96, rarity: 'RareHigh' },
  { trait: 99, rarity: 'MythicalHigh' }
]

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

function extractEyes(svgString, collateralColors, eyeColorHex) {
  if (!svgString) return null
  
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgElement = doc.documentElement
  const viewBox = svgElement.getAttribute('viewBox') || '0 0 64 64'
  const serializer = new XMLSerializer()
  
  const eyeElements = findElements(doc, 'g', 'gotchi-eyeColor')
  if (eyeElements.length === 0) {
    return null
  }
  
  const eyeGroup = eyeElements[0]
  const wrapper = doc.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  wrapper.setAttribute('viewBox', viewBox)
  
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
  const primaryColor = collateralColors.primaryColor.replace('0x', '#')
  const secondaryColor = collateralColors.secondaryColor.replace('0x', '#')
  const cheekColor = collateralColors.cheekColor.replace('0x', '#')
  const eyeColor = eyeColorHex || primaryColor
  
  style.appendChild(doc.createTextNode(`
    .gotchi-primary{fill:${primaryColor};}
    .gotchi-secondary{fill:${secondaryColor};}
    .gotchi-cheek{fill:${cheekColor};}
    .gotchi-eyeColor{fill:${eyeColor};}
    .gotchi-primary-mouth{fill:${primaryColor};}
    .gotchi-sleeves-up{display:none;}
    .gotchi-handsUp{display:none;}
    .gotchi-handsDownOpen{display:block;}
    .gotchi-handsDownClosed{display:none;}
  `.trim()))
  wrapper.appendChild(style)
  
  const clone = eyeGroup.cloneNode(true)
  wrapper.appendChild(clone)
  
  return serializer.serializeToString(wrapper)
}

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

async function generateEyes(collateralData, eyeShapeTrait, eyeColorTrait, contract, hauntId) {
  const collateralAddress = collateralData.collateralType
  const collateralColors = {
    primaryColor: collateralData.primaryColor,
    secondaryColor: collateralData.secondaryColor,
    cheekColor: collateralData.cheekColor
  }
  
  let eyeColorHex = null
  let rarityName = 'Common'
  
  for (const [rarity, config] of Object.entries(EYE_COLOR_RARITY_MAP)) {
    if (eyeColorTrait >= config.min && eyeColorTrait <= config.max) {
      eyeColorHex = config.color || collateralColors.primaryColor.replace('0x', '#')
      rarityName = rarity.charAt(0).toUpperCase() + rarity.slice(1).replace('_', '')
      break
    }
  }
  
  const traits = [50, 50, 50, 50, eyeShapeTrait, eyeColorTrait]
  const emptyWearables = new Array(16).fill(0)
  
  const response = await contract.previewSideAavegotchi(
    hauntId,
    collateralAddress,
    traits,
    emptyWearables
  )
  
  const svgArray = parsePreviewResponse(response)
  if (svgArray.length < 4) {
    throw new Error(`Expected 4 views, got ${svgArray.length}`)
  }
  
  const views = determineViewOrder(svgArray)
  const result = { eyes: [] }
  
  const frontEyes = extractEyes(views.Front, collateralColors, eyeColorHex)
  if (frontEyes) result.eyes.push(frontEyes)
  
  const leftEyes = extractEyes(views.Left, collateralColors, eyeColorHex)
  if (leftEyes) result.eyes.push(leftEyes)
  
  const rightEyes = extractEyes(views.Right, collateralColors, eyeColorHex)
  if (rightEyes) result.eyes.push(rightEyes)
  
  const backEyes = extractEyes(views.Back, collateralColors, eyeColorHex)
  if (backEyes) result.eyes.push(backEyes)
  
  return { result, rarityName }
}

async function main() {
  console.log('=== Generate Collateral-Specific Eyes for amAAVE ===\n')
  
  const haunt2Path = path.join(__dirname, '../public/aavegotchi_db_collaterals_haunt2.json')
  const haunt2Data = JSON.parse(fs.readFileSync(haunt2Path, 'utf8'))
  const amaave = haunt2Data.collaterals.find(c => c.name === 'amAAVE')
  
  if (!amaave) {
    throw new Error('amAAVE collateral not found')
  }
  
  console.log(`Found amAAVE (Haunt ${amaave.haunt})\n`)
  
  const provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  const contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, provider)
  
  const outputDir = path.join(__dirname, 'exports/Eyes/amaave/Collateral/amAAVECollateral_Range_98-99')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  // Collateral-specific eye shape uses trait value 98 (range 98-99)
  const eyeShapeTrait = 98
  
  console.log(`Processing amAAVECollateral (trait value ${eyeShapeTrait})...`)
  
  for (const eyeColorConfig of eyeColorTraits) {
    try {
      const { result, rarityName } = await generateEyes(
        amaave,
        eyeShapeTrait,
        eyeColorConfig.trait,
        contract,
        amaave.haunt
      )
      
      if (result.eyes.length > 0) {
        const filename = `eyes-${eyeColorConfig.rarity.toLowerCase()}-${Date.now()}.json`
        const filepath = path.join(outputDir, filename)
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8')
        console.log(`  ✓ ${rarityName}: ${result.eyes.length} views`)
      } else {
        console.log(`  ⚠ ${rarityName}: No eyes extracted`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`  ✗ Error processing ${eyeColorConfig.rarity}:`, error.message)
    }
  }
  
  console.log('\n✓ Complete!')
}

main().catch(error => {
  console.error('\n✗ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
})

