import { useSingleCallResult } from '../state/multicall/hooks'
import { useBondDepositoryContract } from './useContract'

// returns undefined if input token is undefined, or fails to get token contract,
// or contract total supply cannot be fetched
export function useLiveMarkets() {
  const contract = useBondDepositoryContract()

  const liveMarkets: [] = useSingleCallResult(contract, 'liveMarkets')?.result?.[0]

  return liveMarkets ? liveMarkets : undefined
}
