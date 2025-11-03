import { computed } from 'vue'
import { useAppKitAccount, useDisconnect } from '@reown/appkit/vue'

export function useWallet() {
  // useAppKitAccount returns a Ref that contains the account object
  const accountRef = useAppKitAccount()
  const { disconnect } = useDisconnect()

  console.log('Account ref:', accountRef)
  console.log('Account ref value:', accountRef.value)
  console.log('Account value keys:', accountRef.value ? Object.keys(accountRef.value) : 'no value')
  
  // Access the nested object via .value - the ref contains { address, isConnected, status }
  const address = computed(() => {
    const account = accountRef.value
    if (!account) return null
    // The account object should have address as a ref or direct value
    const addr = account.address?.value ?? account.address ?? null
    console.log('Address from account:', addr, 'account.address:', account.address)
    return addr
  })
  
  const isConnected = computed(() => {
    const account = accountRef.value
    if (!account) return false
    // Use isConnected if available, otherwise check address
    const connected = account.isConnected?.value ?? account.isConnected ?? !!address.value
    console.log('isConnected computed:', connected, 'account.isConnected:', account.isConnected, 'address.value:', address.value)
    return connected
  })

  const status = computed(() => {
    const account = accountRef.value
    if (!account) return 'disconnected'
    return account.status?.value ?? account.status ?? 'disconnected'
  })

  const shortAddress = computed(() => {
    const addr = address.value
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  })

  const isConnecting = computed(() => status.value === 'connecting')

  return {
    address,
    isConnected,
    isConnecting,
    shortAddress,
    disconnect
  }
}

