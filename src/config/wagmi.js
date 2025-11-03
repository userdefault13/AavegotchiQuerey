import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base } from '@reown/appkit/networks'
import { REOWN_PROJECT_ID, ALCHEMY_API_KEY } from './constants.js'
import { http } from 'wagmi'

let wagmiAdapterInstance = null

export function getWagmiAdapter() {
  if (!wagmiAdapterInstance) {
    wagmiAdapterInstance = new WagmiAdapter({
      networks: [base],
      projectId: REOWN_PROJECT_ID,
      // Pass custom RPC if needed
      customRpcUrls: ALCHEMY_API_KEY ? {
        [`eip155:${base.id}`]: [{ url: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}` }]
      } : undefined
    })
  }
  return wagmiAdapterInstance
}

export function getWagmiConfig() {
  return getWagmiAdapter().wagmiConfig
}

