import { Currency, CurrencyAmount, JSBI, NATIVE, Token } from '@sushiswap/sdk'
import { useMultipleContractSingleData, useSingleContractMultipleData } from '../multicall/hooks'

import ERC20_ABI from '../../constants/abis/erc20.json'
import { Interface } from '@ethersproject/abi'
import { SUSHI } from '../../constants'
import { isAddress } from '../../functions/validate'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { useAllTokens, useCurrency } from '../../hooks/Tokens'
import { useMemo } from 'react'
import { useMulticall2Contract } from '../../hooks/useContract'
import { useBondDepositoryContract } from '../../hooks'
import { v2BondDetails, V2BondDetails, UnknownDetails } from '../../helpers/v2BondDetails'
import { useBondPrice } from '../../hooks/useBondPrice'
import { ethers, BigNumber } from 'ethers'
import { prettifySecondsInDays } from '../../utils/timeUtil'
import { IBondV2, IBondV2Core, IBondV2Terms } from '../bonding/hooks'
import { useLiveMarkets } from '../../hooks/useLiveMarkets'

const BASE_TOKEN_DECIMALS = 9

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

export function useMarketsData() {
  const { chainId } = useActiveWeb3React()
  const indexes: BigInt[] = useLiveMarkets()
  const ids =
    indexes?.map((index) => {
      const id = index?.toString()
      return [id]
    }) ?? []

  const bonds = useMarketData(ids, 'markets')
  const bondsMetadata = useMarketData(ids, 'metadata')
  const bondsTerms = useMarketData(ids, 'terms')
  const bondsPrices = useMarketData(ids, 'marketPrice')

  const onlyBonds = bonds?.[0]
  const onlyMetadata = bondsMetadata?.[0]
  const onlyTerms = bondsTerms?.[0]
  const onlyBondsPrices: BigNumber[] = bondsPrices?.[0]

  let v2BondDetail: V2BondDetails[] = []
  const liveBonds: IBondV2[] = []
  let finalBond: IBondV2

  for (let i = 0; i < Object.keys(onlyBonds).length; i++) {
    let details = v2BondDetails[chainId][onlyBonds[i].quoteToken?.toLocaleLowerCase()]
    if (!details) {
      details = UnknownDetails
      console.error(`Add details for bond index=${i}`)
    }
    v2BondDetail.push(details)
  }

  for (let i = 0; i < Object.keys(onlyBonds).length; i++) {
    let bond = onlyBonds[i]
    let metadata = onlyMetadata[i]
    let terms = onlyTerms[i]
    // let rawBondPrice: BigNumber = onlyBondsPrices?.[i] | BigNumber.from(50)
    let rawBondPrice: BigNumber = BigNumber.from('30000000000')

    const quoteTokenPrice = 1
    const bondPriceBigNumber = rawBondPrice
    // console.log(bondPriceBigNumber);
    const bondPrice = +bondPriceBigNumber / Math.pow(10, BASE_TOKEN_DECIMALS)
    const bondPriceUSD = quoteTokenPrice * +bondPrice
    const ohmPrice = 35.5
    const bondDiscount = (ohmPrice - bondPriceUSD) / ohmPrice

    const { capacityInBaseToken, capacityInQuoteToken } = getBondCapacities(
      bond,
      metadata.quoteDecimals,
      bondPriceBigNumber
    )

    const maxPayoutInBaseToken: string = ethers.utils.formatUnits(bond.maxPayout, BASE_TOKEN_DECIMALS)
    const maxPayoutInQuoteToken: string = ethers.utils.formatUnits(
      convertAmountInBondUnitToQuoteTokenUnit(bond.maxPayout, bondPriceBigNumber, metadata.quoteDecimals),
      metadata.quoteDecimals
    )
    const duration = getBondDuration(terms)

    const soldOut = +capacityInBaseToken < 1 || +maxPayoutInBaseToken < 1

    const maxPayoutOrCapacityInQuote =
      +capacityInQuoteToken > +maxPayoutInQuoteToken ? maxPayoutInQuoteToken : capacityInQuoteToken
    const maxPayoutOrCapacityInBase =
      +capacityInBaseToken > +maxPayoutInBaseToken ? maxPayoutInBaseToken : capacityInBaseToken

    finalBond = {
      ...bond,
      ...metadata,
      ...terms,
      index: i,
      displayName: `${v2BondDetail?.[i]?.name}`,
      priceUSD: bondPriceUSD,
      priceToken: bondPrice,
      priceTokenBigNumber: bondPriceBigNumber,
      discount: bondDiscount,
      expiration: new Date(terms.vesting * 1000).toDateString(),
      duration,
      isLP: v2BondDetail?.[i]?.isLP,
      lpUrl: v2BondDetail?.[i]?.isLP ? v2BondDetail?.[i]?.lpUrl[chainId] : '',
      marketPrice: ohmPrice,
      quoteToken: bond.quoteToken.toLowerCase(),
      maxPayoutInQuoteToken,
      maxPayoutInBaseToken,
      capacityInQuoteToken,
      capacityInBaseToken,
      soldOut,
      maxPayoutOrCapacityInQuote,
      maxPayoutOrCapacityInBase,
    }
    liveBonds.push(finalBond)
  }

  return {
    bond: bonds,
    bondMetadata: bondsMetadata,
    bondTerms: bondsTerms,
    liveBonds: liveBonds,
  }
}

export function convertAmountInBondUnitToQuoteTokenUnit(
  amountInBondUnit: BigNumber,
  price: BigNumber,
  decimals: number
): BigNumber {
  return amountInBondUnit.mul(price).div(Math.pow(10, 2 * BASE_TOKEN_DECIMALS - decimals))
}

export function convertAmountInBondUnitToBaseTokenUnit(
  amountInBondUnit: BigNumber,
  decimals: number,
  price: BigNumber
): BigNumber {
  return amountInBondUnit.mul(Math.pow(10, 2 * BASE_TOKEN_DECIMALS - decimals)).div(price)
}

export function getBondCapacities(bond: IBondV2Core, quoteDecimals: number, bondPriceBigNumber: BigNumber) {
  let capacityInBaseToken: string, capacityInQuoteToken: string
  if (bond.capacityInQuote) {
    capacityInBaseToken = ethers.utils.formatUnits(
      convertAmountInBondUnitToBaseTokenUnit(bond.capacity, quoteDecimals, bondPriceBigNumber),
      BASE_TOKEN_DECIMALS
    )
    capacityInQuoteToken = ethers.utils.formatUnits(bond.capacity, quoteDecimals)
  } else {
    capacityInBaseToken = ethers.utils.formatUnits(bond.capacity, BASE_TOKEN_DECIMALS)
    capacityInQuoteToken = ethers.utils.formatUnits(
      convertAmountInBondUnitToQuoteTokenUnit(bond.capacity, bondPriceBigNumber, quoteDecimals),
      quoteDecimals
    )
  }
  return { capacityInBaseToken, capacityInQuoteToken }
}

export function getBondDuration(terms: IBondV2Terms): string {
  const currentTime = Date.now() / 1000
  let secondsRemaining = 0

  if (terms.fixedTerm) {
    secondsRemaining = terms.vesting
  } else {
    const conclusionTime = terms.conclusion
    secondsRemaining = conclusionTime - currentTime
  }

  return prettifySecondsInDays(secondsRemaining)
}
