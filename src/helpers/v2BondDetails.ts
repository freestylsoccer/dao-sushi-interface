import { ethers } from 'ethers'

import { ChainId, Currency } from '@sushiswap/sdk'
import { getTokenByContract, getTokenPrice } from './index'

export interface V2BondDetails {
  name: string
  pricingFunction(quoteToken: string): Promise<number>
  isLP: boolean
  lpUrl: { [key: number]: string }
}

const DaiDetails: V2BondDetails = {
  name: 'DAI',
  pricingFunction: async () => {
    return getTokenPrice('dai')
  },
  isLP: false,
  lpUrl: {},
}

const UsdcDetails: V2BondDetails = {
  name: 'USDC',
  pricingFunction: async () => {
    return getTokenByContract('0x883930ee7247b8a5e940c0990b524c9ed9f7d3ba')
  },
  isLP: false,
  lpUrl: {},
}

export const UnknownDetails: V2BondDetails = {
  name: 'unknown',
  pricingFunction: async () => {
    return 1
  },
  isLP: false,
  lpUrl: '',
}

/**
 * DOWNCASE ALL THE ADDRESSES!!! for comparison purposes
 */
export const v2BondDetails: { [key: number]: { [key: string]: V2BondDetails } } = {
  [ChainId.MATIC_TESTNET]: {
    ['0x2dd2b797d8fbd892d8ce6c9260f8488ccd6c9a6c']: DaiDetails,
    ['0x883930ee7247b8a5e940c0990b524c9ed9f7d3ba']: UsdcDetails,
  },
}
