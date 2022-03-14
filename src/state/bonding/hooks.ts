import { AppDispatch, AppState } from '../index'
import { Currency, CurrencyAmount, JSBI, Pair, Percent, Price, Token } from '@sushiswap/sdk'
import { Field, typeInput } from './actions'
import { PairState, useV2Pair } from '../../hooks/useV2Pairs'
import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { t } from '@lingui/macro'
import { tryParseAmount } from '../../functions/parse'
import { useActiveWeb3React } from '../../hooks/useActiveWeb3React'
import { useCurrencyBalances } from '../wallet/hooks'
import { useLingui } from '@lingui/react'
import { useTotalSupply } from '../../hooks/useTotalSupply'
import { useLiveMarkets } from '../../hooks/useLiveMarkets'
import { useAppSelector } from '../hooks'
import { useMarkets } from '../../hooks/useMarkets'
import { useMarketsData } from '../bond-promise/hooks'
import { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import { useBondPrice } from '../../hooks/useBondPrice'
import { useUSDCPrice } from '../../hooks'
import { useCurrency } from '../../hooks/Tokens'
import { prettifySecondsInDays } from '../../utils/timeUtil'

const ZERO = JSBI.BigInt(0)

const BASE_TOKEN_DECIMALS = 9

export interface IBondV2 extends IBondV2Core, IBondV2Meta, IBondV2Terms {
  index: number
  // displayName: string;
  // priceUSD: number;
  priceToken: number
  priceTokenBigNumber: BigNumber
  // discount: number;
  duration: string
  expiration: string
  // isLP: boolean;
  // lpUrl: string;
  // marketPrice: number;
  soldOut: boolean
  capacityInBaseToken: string
  capacityInQuoteToken: string
  maxPayoutInBaseToken: string
  maxPayoutInQuoteToken: string
  maxPayoutOrCapacityInQuote: string
  maxPayoutOrCapacityInBase: string
  // bondIconSvg: OHMTokenStackProps["tokens"];
}

export interface IBondV2Balance {
  allowance: BigNumber
  balance: BigNumber
  tokenAddress: string
}

export interface IBondV2Core {
  quoteToken: string
  capacityInQuote: boolean
  capacity: BigNumber
  totalDebt: BigNumber
  maxPayout: BigNumber
  purchased: BigNumber
  sold: BigNumber
}

interface IBondV2Meta {
  lastTune: number
  lastDecay: number
  length: number
  depositInterval: number
  tuneInterval: number
  quoteDecimals: number
}

export interface IBondV2Terms {
  fixedTerm: boolean
  controlVariable: BigNumber
  vesting: number
  conclusion: number
  maxDebt: BigNumber
}

export interface IUserNote {
  payout: number
  created: number
  matured: number
  redeemed: number
  marketID: number
  fullyMatured: boolean
  originalDurationSeconds: number
  remainingDurationSeconds: number
  originalDuration: string
  timeLeft: string
  claimed: boolean
  displayName: string
  quoteToken: string
  // bondIconSvg: OHMTokenStackProps["tokens"];
  index: number
}

export interface V2BondDetails {
  name: string
  pricingFunction(provider: ethers.providers.JsonRpcProvider, quoteToken: string): Promise<number>
  isLP: boolean
  lpUrl: { [key: number]: string }
}

export function useBondingState(): AppState['bonding'] {
  return useSelector<AppState, AppState['bonding']>((state) => state.bonding)
}

export function useMintActionHandlers(noLiquidity: boolean | undefined): {
  onFieldAInput: (typedValue: string) => void
  onFieldBInput: (typedValue: string) => void
} {
  const dispatch = useDispatch<AppDispatch>()

  const onFieldAInput = useCallback(
    (typedValue: string) => {
      dispatch(
        typeInput({
          field: Field.CURRENCY_A,
          typedValue,
          noLiquidity: noLiquidity === true,
        })
      )
    },
    [dispatch, noLiquidity]
  )
  const onFieldBInput = useCallback(
    (typedValue: string) => {
      dispatch(
        typeInput({
          field: Field.CURRENCY_B,
          typedValue,
          noLiquidity: noLiquidity === true,
        })
      )
    },
    [dispatch, noLiquidity]
  )

  return {
    onFieldAInput,
    onFieldBInput,
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

export function useProcessBond(bond: IBondV2Core, metadata: IBondV2Meta, terms: IBondV2Terms, index: number): IBondV2 {
  // const v2BondDetail: V2BondDetails = v2BondDetails[networkID][bond.quoteToken.toLowerCase()];
  const quoteToken = useCurrency(bond?.quoteToken?.toLocaleLowerCase())

  const quoteTokenPrice = useUSDCPrice(quoteToken)

  const bondPriceBigNumber = useBondPrice(index)
  const bondPrice = +bondPriceBigNumber / Math.pow(10, BASE_TOKEN_DECIMALS)
  // const bondPriceUSD = quoteTokenPrice * +bondPrice;

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
  return {
    ...bond,
    ...metadata,
    ...terms,
    index: index,
    // displayName: `${v2BondDetail.name}`,
    // priceUSD: bondPriceUSD,
    priceToken: bondPrice,
    priceTokenBigNumber: bondPriceBigNumber,
    // discount: bondDiscount,
    expiration: new Date(terms.vesting * 1000).toDateString(),
    duration,
    // isLP: v2BondDetail.isLP,
    // lpUrl: v2BondDetail.isLP ? v2BondDetail.lpUrl[networkID] : "",
    // marketPrice: ohmPrice,
    quoteToken: bond.quoteToken.toLowerCase(),
    maxPayoutInQuoteToken,
    maxPayoutInBaseToken,
    capacityInQuoteToken,
    capacityInBaseToken,
    soldOut,
    maxPayoutOrCapacityInQuote,
    maxPayoutOrCapacityInBase,
    // bondIconSvg: v2BondDetail.bondIconSvg,
  }
}
export function useDerivedBondInfo(): {
  liveBonds?: IBondV2[]
  error?: string
} {
  const { i18n } = useLingui()
  const { account } = useActiveWeb3React()

  useBondingState()
  let error: string | undefined
  // pair
  const liveBondIndexes = useLiveMarkets()

  const {
    bond: liveBondPromises,
    bondMetadata: liveBondMetadataPromises,
    bondTerms: liveBondTermsPromises,
  } = useMarketsData(liveBondIndexes)

  const liveBonds: IBondV2[] = []
  // console.log(liveBondPromises?.[0])
  for (let i = 0; i < liveBondIndexes?.length; i++) {
    const bondIndex = +liveBondIndexes?.[i]
    try {
      const bond: IBondV2Core = liveBondPromises?.[0]?.[i]
      const bondMetadata: IBondV2Meta = liveBondMetadataPromises?.[0]?.[i]
      const bondTerms: IBondV2Terms = liveBondTermsPromises?.[0]?.[i]
      // const finalBond = useProcessBond(bond, bondMetadata, bondTerms, bondIndex);
      // liveBonds.push(finalBond);
      // console.log(bond?.quoteToken?.toLocaleLowerCase())
    } catch (e) {
      console.log('getAllBonds Error for Bond Index: ', bondIndex)
      // console.error(e)
      error = i18n._(t`getAllBonds Error for Bond Index: ${bondIndex}`)
    }
  }
  /*
  // balances
  const balances = useCurrencyBalances(account ?? undefined, [
    currencies[Field.CURRENCY_A],
    currencies[Field.CURRENCY_B],
  ])
*/
  return {
    liveBonds,
    error,
  }
}
