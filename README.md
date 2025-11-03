# Aavegotchi Viewer

A Vue 3 web application for viewing and interacting with Aavegotchis on the Base blockchain.

## Features

- 🔗 **Wallet Connection**: Connect your wallet using Reown (formerly WalletConnect)
- 🖼️ **Gallery View**: Browse all your Aavegotchis in a beautiful grid layout
- 🎭 **Stage View**: Detailed view of each Aavegotchi showing:
  - ID, name, kinship, BRS, XP
  - Traits: NRG, AGG, SPK, BRN, EYS, EYC
  - 4 SVG views (front, back, left, right) with copy buttons
  - SVG metadata (canvas size, part dimensions, offsets)

## Tech Stack

- **Vue 3** with Composition API
- **Vite** for build tooling
- **Reown AppKit** for wallet connectivity
- **Wagmi** + **Viem** for blockchain interactions
- **Ethers.js** for contract interactions
- **Tailwind CSS** for styling
- **Vue Query** for data fetching and caching

## Setup

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```env
   VITE_ALCHEMY_API_KEY=YOUR_KEY
   VITE_REOWN_PROJECT_ID=YOUR_KEY
   VITE_CONTRACT_ADDRESS=YOUR_KEY
   ```

### Development

Run the development server:
```bash
npm run dev
```

### Build

Build for production:
```bash
npm run build
```

### Preview

Preview the production build:
```bash
npm run preview
```

## Deployment to Vercel

1. Push your code to a Git repository
2. Import the project to Vercel
3. Add environment variables in Vercel dashboard:
   - `VITE_ALCHEMY_API_KEY`
   - `VITE_REOWN_PROJECT_ID`
   - `VITE_CONTRACT_ADDRESS`
4. Deploy!

The `vercel.json` file is already configured for optimal deployment.

## Contract Information

- **Aavegotchi Diamond Contract**: `0xA99c4B08201F2913Db8D28e71d020c4298F29dBF`
- **Network**: Base (Chain ID: 8453)
- **RPC Provider**: Alchemy

## Project Structure

```
src/
  components/
    Gallery.vue          # Grid view of Aavegotchis
    Stage.vue           # Detailed view of selected Aavegotchi
    AavegotchiCard.vue  # Individual card component
    SVGViewer.vue       # SVG display with copy functionality
  composables/
    useAavegotchi.js    # Hook for fetching Aavegotchi data
    useWallet.js        # Hook for wallet state management
  config/
    constants.js        # Contract addresses and constants
    wagmi.js            # Wagmi configuration
  utils/
    contract.js         # Contract interaction utilities
    svgParser.js        # SVG parsing and metadata extraction
  App.vue               # Main app component
  main.js               # App initialization
```

## License

MIT
