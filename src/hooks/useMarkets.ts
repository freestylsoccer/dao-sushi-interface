import { BigNumber } from 'ethers'
import { useSingleCallResult } from '../state/multicall/hooks'
import { useBondDepositoryContract } from './useContract'

// returns undefined if input token is undefined, or fails to get token contract,
// or contract total supply cannot be fetched
export function useMarkets(index): BigNumber {
  const contract = useBondDepositoryContract()

  const market = useSingleCallResult(contract, 'markets'[index])?.result?.[0]

  return market ? market : undefined
}
