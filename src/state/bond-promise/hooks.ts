import { Currency, CurrencyAmount, JSBI, NATIVE, Token } from '@sushiswap/sdk'
import { useMultipleContractSingleData, useSingleContractMultipleData } from '../multicall/hooks'

import ERC20_ABI from '../../constants/abis/erc20.json'
import { Interface } from '@ethersproject/abi'
import { SUSHI } from '../../constants'
import { isAddress } from '../../functions/validate'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { useAllTokens } from '../../hooks/Tokens'
import { useMemo } from 'react'
import { useMulticall2Contract } from '../../hooks/useContract'
import { BigNumber } from 'ethers'
import { useBondDepositoryContract } from '../../hooks'

/**
 * Returns a map of token addresses to their eventually consistent token balances for a single account.
 */

export function useMarketsDataWithLoadingIndicator(indexes: string[][], method: string): [{}, boolean] {
  const bondDepository = useBondDepositoryContract()
  const marketsData = useSingleContractMultipleData(bondDepository, method, indexes, undefined, 100_000)

  const anyLoading: boolean = useMemo(() => marketsData.some((callState) => callState.loading), [marketsData])

  return [
    useMemo(
      () =>
        indexes.length > 0
          ? indexes.reduce<{}>((memo, index, i) => {
              const market = marketsData?.[i]?.result
              if (market) {
                memo[i] = market
              }
              return memo
            }, {})
          : {},
      [indexes, marketsData]
    ),
    anyLoading,
  ]
}

export function useMarketData(indexes?: string[][], method?: string): {} {
  const data = useMarketsDataWithLoadingIndicator(indexes, method)
  return useMemo(() => data, [data])
}

export function useMarketsData(indexes?: (BigNumber | undefined)[]) {
  const ids =
    indexes?.map((index) => {
      const id = index?.toString()
      return [id]
    }) ?? []

  const bonds = useMarketData(ids, 'markets')
  const bondsMetadata = useMarketData(ids, 'metadata')
  const bondsTerms = useMarketData(ids, 'terms')

  return {
    bond: bonds,
    bondMetadata: bondsMetadata,
    bondTerms: bondsTerms,
  }
}
