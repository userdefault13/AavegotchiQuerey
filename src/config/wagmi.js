import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { base } from '@reown/appkit/networks'
import { REOWN_PROJECT_ID } from './constants.js'

let wagmiAdapterInstance = null

export function getWagmiAdapter() {
  if (!wagmiAdapterInstance) {
    wagmiAdapterInstance = new WagmiAdapter({
      networks: [base],
      projectId: REOWN_PROJECT_ID
    })
  }
  return wagmiAdapterInstance
}

export function getWagmiConfig() {
  return getWagmiAdapter().wagmiConfig
}

