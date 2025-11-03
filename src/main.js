import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// Setup Vue Query
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

// Setup Reown AppKit
import { createAppKit } from '@reown/appkit/vue'
import { base } from '@reown/appkit/networks'
import { REOWN_PROJECT_ID } from './config/constants.js'
import { getWagmiAdapter } from './config/wagmi.js'

// Initialize Wagmi adapter first
const wagmiAdapter = getWagmiAdapter()

createAppKit({
  adapters: [wagmiAdapter],
  networks: [base],
  projectId: REOWN_PROJECT_ID,
  metadata: {
    name: 'Aavegotchi Viewer',
    description: 'View and interact with your Aavegotchis on Base',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
    icons: ['https://aavegotchi.com/favicon.ico']
  },
  features: {
    analytics: false
  }
})

const app = createApp(App)

// Register plugins before mounting
app.use(VueQueryPlugin, { queryClient })

app.mount('#app')
