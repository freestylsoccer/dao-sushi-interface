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
import { V2BondDetails, v2BondDetails, UnknownDetails } from '../../helpers/v2BondDetails'

const ZERO = JSBI.BigInt(0)

const BASE_TOKEN_DECIMALS = 9

export interface IBondV2 extends IBondV2Core, IBondV2Meta, IBondV2Terms {
  index: number
  displayName: string
  priceUSD: number
  priceToken: number
  priceTokenBigNumber: BigNumber
  discount: number
  duration: string
  expiration: string
  isLP: boolean
  lpUrl: string
  marketPrice: number
  soldOut: boolean
  capacityInBaseToken: string
  capacityInQuoteToken: string
  maxPayoutInBaseToken: string
  maxPayoutInQuoteToken: string
  maxPayoutOrCapacityInQuote: string
  maxPayoutOrCapacityInBase: string
  // bondIconSvg: OHMTokenStackProps["tokens"];
  underlyinAsset: Currency
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

export function useDerivedBondInfo(): {
  liveBonds?: IBondV2[]
  error?: string
} {
  const { i18n } = useLingui()

  useBondingState()
  let error: string | undefined
  // pair
  const liveBondIndexes: BigNumber[] = useLiveMarkets()

  const {
    bond: liveBondPromises,
    bondMetadata: liveBondMetadataPromises,
    bondTerms: liveBondTermsPromises,
  } = useMarketsData()

  const liveBonds: IBondV2[] = []
  // console.log(liveBondPromises?.[0]?.[0]?.quoteToken)
  /*
  let v2BondDetail: V2BondDetails = v2BondDetails[chainId][liveBondPromises?.[0]?.[1]?.quoteToken?.toLocaleLowerCase()];
  // console.log(v2BondDetail)
  if (!v2BondDetail) {
    v2BondDetail = UnknownDetails;
    console.error(`Add details for bond index=${1}`);
  }
  
  const quoteTokenPrice = v2BondDetail.pricingFunction(liveBondPromises?.[0]?.[0]?.quoteToken?.toLocaleLowerCase());
  console.log(quoteTokenPrice)
  */

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
