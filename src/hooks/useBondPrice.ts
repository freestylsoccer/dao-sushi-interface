import { BigNumber } from 'ethers'
import { useSingleCallResult } from '../state/multicall/hooks'
import { useBondDepositoryContract } from './useContract'

// returns undefined if input token is undefined, or fails to get token contract,
// or contract total supply cannot be fetched
export function useBondPrice(index): BigNumber {
  const contract = useBondDepositoryContract()

  const price = useSingleCallResult(contract, 'marketPrice'[index])?.result?.[0]

  return price ? price : undefined
}
