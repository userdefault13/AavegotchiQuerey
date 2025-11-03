import { ref, computed, watch } from 'vue'
import { useAppKitAccount } from '@reown/appkit/vue'
import { useQuery, useQueries } from '@tanstack/vue-query'
import { getContract } from '../utils/contract.js'

export function useAavegotchi() {
  // useAppKitAccount returns a Ref, need to access .value
  const accountRef = useAppKitAccount()
  const selectedGotchiId = ref(null)

  // Get address from account ref value
  const address = computed(() => {
    const account = accountRef.value
    return account?.address ?? null
  })

  // Watch address for debugging
  watch(address, (addr) => {
    console.log('Address in useAavegotchi:', addr)
  }, { immediate: true })

  // Fetch user's Aavegotchi token IDs
  const { data: tokenIds, isLoading: isLoadingTokens, error: tokensError } = useQuery({
    queryKey: computed(() => ['aavegotchi-tokens', address.value]),
    queryFn: async ({ queryKey }) => {
      const addr = queryKey[1]
      if (!addr) {
        console.log('No address, returning empty array')
        return []
      }
      
      console.log('Fetching tokens for address:', addr)
      try {
        const contract = getContract()
        const balance = await contract.balanceOf(addr)
        const count = Number(balance)
        
        console.log('Found balance:', count)

        if (count === 0) {
          console.log('No Aavegotchis found')
          return []
        }

        const ids = []
        for (let i = 0; i < count; i++) {
          const tokenId = await contract.tokenOfOwnerByIndex(addr, i)
          ids.push(Number(tokenId))
        }
        console.log('Token IDs:', ids)
        return ids
      } catch (error) {
        console.error('Error fetching tokens:', error)
        throw error
      }
    },
    enabled: computed(() => !!address.value),
    staleTime: 60000 // Cache for 1 minute
  })

  // Fetch all Aavegotchi data using useQueries
  const gotchiQueries = useQueries({
    queries: computed(() => {
      const ids = tokenIds.value || []
      console.log('Creating gotchi queries for token IDs:', ids)
      if (ids.length === 0) {
        return [] // Return empty array if no IDs yet
      }
      return ids.map(tokenId => ({
        queryKey: ['aavegotchi-data', tokenId],
        queryFn: async () => {
          console.log('Fetching gotchi data for token:', tokenId)
          const contract = getContract()
          const gotchi = await contract.getAavegotchi(tokenId)
          
          // Parse numeric traits
          const numericTraits = gotchi.numericTraits.map(t => Number(t))
          const nrg = numericTraits[0]
          const agg = numericTraits[1]
          const spk = numericTraits[2]
          const brn = numericTraits[3]
          const eys = numericTraits[4]
          const eyc = numericTraits[5]
          
          // Calculate BRS from traits
          // For each trait: if >= 50, BRS = trait value; if < 50, BRS = 100 - trait value
          const calculateTraitBRS = (trait) => {
            return trait >= 50 ? trait : 100 - trait
          }
          
          const baseBRS = calculateTraitBRS(nrg) + 
                         calculateTraitBRS(agg) + 
                         calculateTraitBRS(spk) + 
                         calculateTraitBRS(brn) + 
                         calculateTraitBRS(eys) + 
                         calculateTraitBRS(eyc)
          
          // Use calculated BRS (contract brs might not be accurate)
          const calculatedBRS = baseBRS
          const contractBRS = Number(gotchi.brs)
          
          // Parse the gotchi data
          const data = {
            tokenId: Number(gotchi.tokenId),
            name: gotchi.name,
            kinship: Number(gotchi.kinship),
            brs: calculatedBRS, // Use calculated BRS instead of contract value
            baseBRS: baseBRS, // Store base BRS separately
            contractBRS: contractBRS, // Store contract BRS for comparison
            xp: Number(gotchi.experience),
            nrg,
            agg,
            spk,
            brn,
            eys,
            eyc,
            hauntId: Number(gotchi.hauntId),
            collateral: gotchi.collateral,
            equippedWearables: gotchi.equippedWearables.map(w => Number(w)),
            numericTraits
          }
          console.log('Gotchi data fetched for token', tokenId, ':', {
            ...data,
            brsCalculation: {
              nrgBRS: calculateTraitBRS(nrg),
              aggBRS: calculateTraitBRS(agg),
              spkBRS: calculateTraitBRS(spk),
              brnBRS: calculateTraitBRS(brn),
              eysBRS: calculateTraitBRS(eys),
              eycBRS: calculateTraitBRS(eyc),
              baseBRS,
              calculatedBRS,
              contractBRS
            }
          })
          return data
        },
        enabled: !!tokenId,
        staleTime: 60000
      }))
    })
  })

  // Create a map of tokenId -> gotchi data for easy lookup
  const gotchiDataMap = computed(() => {
    const map = {}
    // Unwrap the ref to get the array
    let queriesArray = gotchiQueries.value
    
    // If it's still a ref, unwrap again
    if (queriesArray && typeof queriesArray === 'object' && '__v_isRef' in queriesArray) {
      queriesArray = queriesArray.value
    }
    
    // Ensure queriesArray is an array before iterating
    if (!Array.isArray(queriesArray)) {
      console.log('gotchiQueries is not an array yet:', typeof queriesArray, queriesArray)
      return map
    }
    
    queriesArray.forEach((query, index) => {
      const tokenId = tokenIds.value?.[index]
      if (!tokenId) return
      
      // Debug: check query structure
      if (index === 0) {
        console.log('Sample query structure:', {
          hasData: !!query?.data,
          dataType: typeof query?.data,
          dataValue: query?.data,
          dataValueValue: query?.data?.value,
          queryKeys: Object.keys(query || {})
        })
      }
      
      // Try different ways to access the data
      const data = query?.data?.value ?? query?.data ?? null
      if (data) {
        map[tokenId] = data
      }
    })
    
    console.log('Gotchi data map updated:', Object.keys(map).length, 'entries', map)
    return map
  })

  // Helper to get individual gotchi data (for backward compatibility)
  const getGotchiData = (tokenId) => {
    return computed(() => gotchiDataMap.value[tokenId])
  }

  // Fetch SVG views for all Aavegotchis using useQueries
  const svgQueries = useQueries({
    queries: computed(() => {
      const ids = tokenIds.value || []
      console.log('Creating SVG queries for token IDs:', ids)
      
      // No need to filter by gotchiData - just use tokenId
      return ids.map(tokenId => {
        return {
          queryKey: ['aavegotchi-svg', tokenId],
          queryFn: async () => {
            console.log('Fetching SVG for token:', tokenId)
            
            try {
              const contract = getContract()
              
              // Call getAavegotchiSvg directly with the tokenId - returns a single combined SVG string
              const response = await contract.getAavegotchiSvg(tokenId)
              
              // Handle both cases: ethers might return string directly or object with 'ag_' property
              let svgString = null
              if (typeof response === 'string') {
                svgString = response
              } else if (response && typeof response === 'object' && response.ag_) {
                svgString = response.ag_
              } else if (response && typeof response === 'object' && response.length === 1) {
                // Handle array response [string]
                svgString = response[0]
              } else {
                console.error('Unexpected response format:', response)
                throw new Error(`Invalid SVG response: expected string or object with ag_ property, got ${typeof response}`)
              }
              
              console.log('Raw SVG response for token', tokenId, ':', svgString?.substring(0, 100) + '...')
              console.log('SVG response type:', typeof svgString, 'length:', svgString?.length)
              
              if (!svgString || typeof svgString !== 'string') {
                throw new Error(`Invalid SVG response: expected string, got ${typeof svgString}`)
              }
              
              // Return the single combined SVG string
              console.log('SVG fetched successfully for token', tokenId, '- length:', svgString.length)
              return svgString
            } catch (error) {
              console.error('Error fetching SVG for token', tokenId, ':', error)
              console.error('Error details:', {
                message: error?.message,
                code: error?.code,
                data: error?.data,
                stack: error?.stack,
                reason: error?.reason
              })
              throw error
            }
          },
          enabled: !!tokenId, // Much simpler - just check if tokenId exists
          staleTime: 300000 // Cache SVGs for 5 minutes
        }
      })
    })
  })

  // Create a map of tokenId -> SVG data for easy lookup
  const svgDataMap = computed(() => {
    const map = {}
    // Unwrap the ref to get the array
    let queriesArray = svgQueries.value
    
    // If it's still a ref, unwrap again
    if (queriesArray && typeof queriesArray === 'object' && '__v_isRef' in queriesArray) {
      queriesArray = queriesArray.value
    }
    
    // Ensure queriesArray is an array before iterating
    if (!Array.isArray(queriesArray)) {
      console.log('svgQueries is not an array yet:', typeof queriesArray, queriesArray)
      return map
    }
    
    console.log('Processing SVG queries array, length:', queriesArray.length)
    
    queriesArray.forEach((query, index) => {
      // Use tokenId directly from tokenIds array (just like gotchiDataMap does)
      const tokenId = tokenIds.value?.[index]
      if (!tokenId) return
      
      // Debug: check query structure for first query
      if (index === 0 || index < 3) {
        console.log(`SVG query [${index}] for token ${tokenId}:`, {
          hasData: !!query?.data,
          dataType: typeof query?.data,
          status: query?.status,
          isPending: query?.isPending,
          isError: query?.isError,
          isSuccess: query?.isSuccess,
          error: query?.error,
          fetchStatus: query?.fetchStatus,
          enabled: query?.options?.enabled?.() ?? query?.enabled
        })
      }
      
      // Check for errors
      if (query?.isError && query?.error) {
        if (index === 0) {
          console.error('SVG query error for token', tokenId, ':', query.error)
        }
        return // Skip this query if it has an error
      }
      
      // Try different ways to access the data
      let data = null
      if (query?.data) {
        // Vue Query wraps data in a ref
        if (typeof query.data === 'object' && '__v_isRef' in query.data) {
          data = query.data.value
        } else if (typeof query.data === 'object' && 'value' in query.data) {
          data = query.data.value
        } else {
          data = query.data
        }
      }
      
      if (data) {
        map[tokenId] = data
        if (index === 0 || index < 3) {
          console.log('Extracted SVG data for token', tokenId, ':', {
            isString: typeof data === 'string',
            length: data?.length,
            firstChar: data?.substring(0, 50)
          })
        }
      } else {
        if (index === 0 || index < 3) {
          console.log('No SVG data found for query', tokenId, {
            status: query?.status,
            isPending: query?.isPending,
            isSuccess: query?.isSuccess,
            isError: query?.isError,
            fetchStatus: query?.fetchStatus,
            hasDataRef: !!query?.data
          })
        }
      }
    })
    
    console.log('SVG data map updated:', Object.keys(map).length, 'entries')
    return map
  })

  // Helper to get SVG views (for backward compatibility)
  const getSVGViews = (hauntId, collateral, numericTraits, equippedWearables) => {
    // Find matching tokenId from gotchiDataMap
    const matchingTokenId = Object.keys(gotchiDataMap.value).find(tokenId => {
      const data = gotchiDataMap.value[tokenId]
      return data?.hauntId === hauntId && 
             data?.collateral === collateral &&
             JSON.stringify(data?.numericTraits) === JSON.stringify(numericTraits) &&
             JSON.stringify(data?.equippedWearables) === JSON.stringify(equippedWearables)
    })
    
    return computed(() => matchingTokenId ? svgDataMap.value[matchingTokenId] : null)
  }

  return {
    tokenIds,
    isLoadingTokens,
    tokensError,
    selectedGotchiId,
    gotchiDataMap,
    svgDataMap,
    getGotchiData,
    getSVGViews
  }
}

