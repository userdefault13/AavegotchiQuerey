export const AAVEGOTCHI_DIAMOND = import.meta.env.VITE_CONTRACT_ADDRESS || '0xA99c4B08201F2913Db8D28e71d020c4298F29dBF'
export const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY || 'cePVnDpeOovd0mRN3jGWWuzrtkgIfcJr'
export const REOWN_PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID || 'c7a4e051946682fb3f824cf398390343'

export const BASE_CHAIN_ID = 8453
export const ALCHEMY_RPC_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`

// Aavegotchi contract ABI - minimal set for our needs
export const AAVEGOTCHI_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'uint256', name: 'index', type: 'uint256' }
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_tokenId', type: 'uint256' }],
    name: 'getAavegotchi',
    outputs: [
      {
        components: [
          { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'uint256', name: 'randomNumber', type: 'uint256' },
          { internalType: 'uint256', name: 'randomNumber2', type: 'uint256' },
          { internalType: 'uint256', name: 'status', type: 'uint256' },
          { internalType: 'int16[6]', name: 'numericTraits', type: 'int16[6]' },
          { internalType: 'int16[6]', name: 'modifiedNumericTraits', type: 'int16[6]' },
          { internalType: 'uint16[16]', name: 'equippedWearables', type: 'uint16[16]' },
          { internalType: 'address', name: 'collateral', type: 'address' },
          { internalType: 'address', name: 'escrow', type: 'address' },
          { internalType: 'uint256', name: 'stakedAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'minimumStake', type: 'uint256' },
          { internalType: 'uint256', name: 'kinship', type: 'uint256' },
          { internalType: 'uint256', name: 'lastInteracted', type: 'uint256' },
          { internalType: 'uint256', name: 'experience', type: 'uint256' },
          { internalType: 'uint256', name: 'toNextLevel', type: 'uint256' },
          { internalType: 'uint256', name: 'level', type: 'uint256' },
          { internalType: 'uint256', name: 'hauntId', type: 'uint256' },
          { internalType: 'uint256', name: 'owner', type: 'uint256' },
          { internalType: 'uint8', name: 'brs', type: 'uint8' },
          { internalType: 'uint8', name: 'brsLastModified', type: 'uint8' },
          { internalType: 'uint256', name: 'locked', type: 'uint256' }
        ],
        internalType: 'struct AavegotchiInfo',
        name: '',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
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
  },
  {
    inputs: [{ internalType: 'uint256', name: '_tokenId', type: 'uint256' }],
    name: 'getAavegotchiSvg',
    outputs: [
      { internalType: 'string', name: 'ag_', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'uint256', name: '_tokenId', type: 'uint256' }],
    name: 'getAavegotchiSideSvgs',
    outputs: [
      { internalType: 'string[]', name: 'ag_', type: 'string[]' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'string', name: '_svgType', type: 'string' },
      { internalType: 'uint256', name: '_id', type: 'uint256' }
    ],
    name: 'getSvg',
    outputs: [
      { internalType: 'string', name: 'ag_', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_itemId', type: 'uint256' }
    ],
    name: 'getItemSvg',
    outputs: [
      { internalType: 'string', name: 'ag_', type: 'string' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_itemId', type: 'uint256' }
    ],
    name: 'getItemType',
    outputs: [
      {
        components: [
          { internalType: 'string', name: 'name', type: 'string' },
          { internalType: 'string', name: 'description', type: 'string' },
          { internalType: 'string', name: 'author', type: 'string' },
          { internalType: 'int8[6]', name: 'traitModifiers', type: 'int8[6]' },
          { internalType: 'bool[16]', name: 'slotPositions', type: 'bool[16]' },
          { internalType: 'uint8[]', name: 'allowedCollaterals', type: 'uint8[]' },
          {
            components: [
              { internalType: 'uint8', name: 'x', type: 'uint8' },
              { internalType: 'uint8', name: 'y', type: 'uint8' },
              { internalType: 'uint8', name: 'width', type: 'uint8' },
              { internalType: 'uint8', name: 'height', type: 'uint8' }
            ],
            internalType: 'struct Dimensions',
            name: 'dimensions',
            type: 'tuple'
          },
          { internalType: 'uint256', name: 'ghstPrice', type: 'uint256' },
          { internalType: 'uint256', name: 'maxQuantity', type: 'uint256' },
          { internalType: 'uint256', name: 'totalQuantity', type: 'uint256' },
          { internalType: 'uint32', name: 'svgId', type: 'uint32' },
          { internalType: 'uint8', name: 'rarityScoreModifier', type: 'uint8' },
          { internalType: 'bool', name: 'canPurchaseWithGhst', type: 'bool' },
          { internalType: 'uint16', name: 'minLevel', type: 'uint16' },
          { internalType: 'bool', name: 'canBeTransferred', type: 'bool' },
          { internalType: 'uint8', name: 'category', type: 'uint8' },
          { internalType: 'int16', name: 'kinshipBonus', type: 'int16' },
          { internalType: 'uint32', name: 'experienceBonus', type: 'uint32' }
        ],
        internalType: 'struct ItemType',
        name: 'itemType_',
        type: 'tuple'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
]

