import { ethers } from 'ethers'
import { AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, ALCHEMY_RPC_URL } from '../config/constants.js'

let provider = null
let contract = null

export function getProvider() {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(ALCHEMY_RPC_URL)
  }
  return provider
}

export function getContract() {
  if (!contract) {
    const prov = getProvider()
    contract = new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, prov)
  }
  return contract
}

export async function getContractWithSigner(signer) {
  const prov = getProvider()
  return new ethers.Contract(AAVEGOTCHI_DIAMOND, AAVEGOTCHI_ABI, signer)
}

