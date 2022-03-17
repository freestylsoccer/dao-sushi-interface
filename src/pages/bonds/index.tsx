import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/outline'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import { BAR_ADDRESS, ZERO } from '@sushiswap/sdk'
import React, { useEffect, useState } from 'react'
import { SUSHI, XSUSHI } from '../../constants'

import Button from '../../components/Button'
import { ChainId } from '@sushiswap/sdk'
import Container from '../../components/Container'
import Dots from '../../components/Dots'
import Head from 'next/head'
import Image from 'next/image'
import { Input as NumericalInput } from '../../components/NumericalInput'
import TransactionFailedModal from '../../components/TransactionFailedModal'
import { request } from 'graphql-request'
import styled from 'styled-components'
import sushiData from '@sushiswap/sushi-data'
import { t } from '@lingui/macro'
import { tryParseAmount } from '../../functions/parse'
import useActiveWeb3React from '../../hooks/useActiveWeb3React'
import { useLingui } from '@lingui/react'
import useSWR from 'swr'
import useSushiBar from '../../hooks/useSushiBar'
import { useSushiPrice } from '../../services/graph'
import { useTokenBalance } from '../../state/wallet/hooks'
import { useWalletModalToggle } from '../../state/application/hooks'
import { useSortableData } from '../../hooks'
import { useMarketsData } from '../../state/bond-promise/hooks'
import BondListItem from './BondListItem'

const INPUT_CHAR_LIMIT = 18

const sendTx = async (txFunc: () => Promise<any>): Promise<boolean> => {
  let success = true
  try {
    const ret = await txFunc()
    if (ret?.error) {
      success = false
    }
  } catch (e) {
    console.error(e)
    success = false
  }
  return success
}

const StyledNumericalInput = styled(NumericalInput)`
  caret-color: #e3e3e3;
`

const tabStyle = 'flex justify-center items-center h-full w-full rounded-lg cursor-pointer text-sm md:text-base'
const activeTabStyle = `${tabStyle} text-high-emphesis font-bold bg-dark-900`
const inactiveTabStyle = `${tabStyle} text-secondary`

const buttonStyle =
  'flex justify-center items-center w-full h-14 rounded font-bold md:font-medium md:text-lg mt-5 text-sm focus:outline-none focus:ring'
const buttonStyleEnabled = `${buttonStyle} text-high-emphesis bg-gradient-to-r from-pink-red to-light-brown hover:opacity-90`
const buttonStyleInsufficientFunds = `${buttonStyleEnabled} opacity-60`
const buttonStyleDisabled = `${buttonStyle} text-secondary bg-dark-700`
const buttonStyleConnectWallet = `${buttonStyle} text-high-emphesis bg-cyan-blue hover:bg-opacity-90`

const fetcher = (query) => request('https://api.thegraph.com/subgraphs/name/matthewlilley/bar', query)

export default function Bonds() {
  const { i18n } = useLingui()
  const { account } = useActiveWeb3React()
  const sushiBalance = useTokenBalance(account ?? undefined, SUSHI[ChainId.MAINNET])
  const xSushiBalance = useTokenBalance(account ?? undefined, XSUSHI)

  const sushiPrice = useSushiPrice()

  const { enter, leave } = useSushiBar()

  const { data } = useSWR(`{bar(id: "0x8798249c2e607446efb7ad49ec89dd1865ff4272") {ratio, totalSupply}}`, fetcher)

  const xSushiPerSushi = parseFloat(data?.bar?.ratio)

  const walletConnected = !!account
  const toggleWalletModal = useWalletModalToggle()

  const [activeTab, setActiveTab] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)

  const [input, setInput] = useState<string>('')
  const [usingBalance, setUsingBalance] = useState(false)

  const balance = activeTab === 0 ? sushiBalance : xSushiBalance

  const formattedBalance = balance?.toSignificant(4)

  const parsedAmount = usingBalance ? balance : tryParseAmount(input, balance?.currency)

  const [approvalState, approve] = useApproveCallback(parsedAmount, BAR_ADDRESS[ChainId.MAINNET])

  const handleInput = (v: string) => {
    if (v.length <= INPUT_CHAR_LIMIT) {
      setUsingBalance(false)
      setInput(v)
    }
  }

  const handleClickMax = () => {
    setInput(parsedAmount ? parsedAmount.toSignificant(balance.currency.decimals).substring(0, INPUT_CHAR_LIMIT) : '')
    setUsingBalance(true)
  }

  const insufficientFunds = (balance && balance.equalTo(ZERO)) || parsedAmount?.greaterThan(balance)

  const inputError = insufficientFunds

  const [pendingTx, setPendingTx] = useState(false)

  const buttonDisabled = !input || pendingTx || (parsedAmount && parsedAmount.equalTo(ZERO))

  const handleClickButton = async () => {
    if (buttonDisabled) return

    if (!walletConnected) {
      toggleWalletModal()
    } else {
      setPendingTx(true)

      if (activeTab === 0) {
        if (approvalState === ApprovalState.NOT_APPROVED) {
          const success = await sendTx(() => approve())
          if (!success) {
            setPendingTx(false)
            // setModalOpen(true)
            return
          }
        }
        const success = await sendTx(() => enter(parsedAmount))
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
          return
        }
      } else if (activeTab === 1) {
        const success = await sendTx(() => leave(parsedAmount))
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
          return
        }
      }

      handleInput('')
      setPendingTx(false)
    }
  }

  const [apr, setApr] = useState<any>()

  const { liveBonds } = useMarketsData()
  const { items, requestSort, sortConfig } = useSortableData(liveBonds, { key: 'priceToken' })

  // TODO: DROP AND USE SWR HOOKS INSTEAD
  useEffect(() => {
    const fetchData = async () => {
      const results = await sushiData.exchange.dayData()
      const apr = (((results[1].volumeUSD * 0.05) / data?.bar?.totalSupply) * 365) / (data?.bar?.ratio * sushiPrice)

      setApr(apr)
    }
    fetchData()
  }, [data?.bar?.ratio, data?.bar?.totalSupply, sushiPrice])

  return (
    <Container id="bar-page" className="py-4 md:py-24 lg:py-24" maxWidth="full">
      <Head>
        <title key="title">Bond | Sushi</title>
        <meta
          key="description"
          name="description"
          content="Stake SUSHI in return for xSUSHI, an interest bearing and fungible ERC20 token designed to share revenue generated by all SUSHI products."
        />
        <meta key="twitter:url" name="twitter:url" content="https://app.sushi.com/stake" />
        <meta key="twitter:title" name="twitter:title" content="STAKE SUSHI" />
        <meta
          key="twitter:description"
          name="twitter:description"
          content="Stake SUSHI in return for xSUSHI, an interest bearing and fungible ERC20 token designed to share revenue generated by all SUSHI products."
        />
        <meta key="twitter:image" name="twitter:image" content="https://app.sushi.com/xsushi-sign.png" />
        <meta key="og:title" property="og:title" content="STAKE SUSHI" />
        <meta key="og:url" property="og:url" content="https://app.sushi.com/stake" />
        <meta key="og:image" property="og:image" content="https://app.sushi.com/xsushi-sign.png" />
        <meta
          key="og:description"
          property="og:description"
          content="Stake SUSHI in return for xSUSHI, an interest bearing and fungible ERC20 token designed to share revenue generated by all SUSHI products."
        />
      </Head>
      <div className="flex flex-col w-full min-h-full py-4 md:py-6 lg:py-8">
        <div className="flex flex-col justify-center md:flex-row">
          <div className="flex flex-col w-full max-w-3xl mx-auto mb-4 md:m-0">
            <div>
              <TransactionFailedModal isOpen={modalOpen} onDismiss={() => setModalOpen(false)} />
              <div className="w-full max-w-3xl px-3 pt-2 pb-6 rounded bg-dark-900 md:pb-9 md:pt-4 md:px-8">
                <div className="flex w-full rounded h-14 bg-dark-800">
                  <div className="flex text-left items-center h-full w-full rounded-lg text-sm md:text-base text-high-emphesis font-bold bg-dark-900">
                    <p>{i18n._(t`Bond (4,4)`)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full mt-6">
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-bold md:text-lg text-high-emphesis">
                      {xSushiBalance ? xSushiBalance.toSignificant(4) : '-'}
                    </p>
                    <p className="text-sm md:text-base text-primary">{i18n._(t`Treasury Balance`)}</p>
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-bold md:text-lg text-high-emphesis">
                      {xSushiBalance ? xSushiBalance.toSignificant(4) : '-'}
                    </p>
                    <p className="text-sm md:text-base text-primary">{i18n._(t`POFI Price`)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full mt-6">
                  <div className="grid grid-cols-6 text-base font-bold text-primary">
                    <div
                      className="flex items-center justify-center cursor-pointer hover:text-high-emphesis"
                      onClick={() => requestSort('displayName')}
                    >
                      <div className="hover:text-high-emphesis">{i18n._(t``)}</div>
                      {sortConfig &&
                        sortConfig.key === 'displayName' &&
                        ((sortConfig.direction === 'ascending' && <ChevronUpIcon width={12} height={12} />) ||
                          (sortConfig.direction === 'descending' && <ChevronDownIcon width={12} height={12} />))}
                    </div>
                    <div
                      className="flex items-center justify-center cursor-pointer hover:text-high-emphesis"
                      onClick={() => requestSort('displayName')}
                    >
                      <div className="hover:text-high-emphesis">{i18n._(t`Bond`)}</div>
                      {sortConfig &&
                        sortConfig.key === 'displayName' &&
                        ((sortConfig.direction === 'ascending' && <ChevronUpIcon width={12} height={12} />) ||
                          (sortConfig.direction === 'descending' && <ChevronDownIcon width={12} height={12} />))}
                    </div>
                    <div
                      className="flex items-center justify-center cursor-pointer hover:text-high-emphesis"
                      onClick={() => requestSort('pTokenBalance')}
                    >
                      {i18n._(t`Price`)}
                      {sortConfig &&
                        sortConfig.key === 'pTokenBalance' &&
                        ((sortConfig.direction === 'ascending' && <ChevronUpIcon width={12} height={12} />) ||
                          (sortConfig.direction === 'descending' && <ChevronDownIcon width={12} height={12} />))}
                    </div>
                    <div
                      className="flex items-center justify-end px-4 cursor-pointer hover:text-high-emphesis"
                      onClick={() => requestSort('roiPerYear')}
                    >
                      {i18n._(t`Discount`)}
                      {sortConfig &&
                        sortConfig.key === 'roiPerYear' &&
                        ((sortConfig.direction === 'ascending' && <ChevronUpIcon width={12} height={12} />) ||
                          (sortConfig.direction === 'descending' && <ChevronDownIcon width={12} height={12} />))}
                    </div>
                    <div
                      className="flex items-center justify-end px-4 cursor-pointer hover:text-high-emphesis"
                      onClick={() => requestSort('roiPerYear')}
                    >
                      {i18n._(t`Duration`)}
                      {sortConfig &&
                        sortConfig.key === 'roiPerYear' &&
                        ((sortConfig.direction === 'ascending' && <ChevronUpIcon width={12} height={12} />) ||
                          (sortConfig.direction === 'descending' && <ChevronDownIcon width={12} height={12} />))}
                    </div>
                    <div
                      className="flex items-center justify-end px-4 cursor-pointer hover:text-high-emphesis"
                      onClick={() => requestSort('roiPerYear')}
                    >
                      {i18n._(t``)}
                      {sortConfig &&
                        sortConfig.key === 'roiPerYear' &&
                        ((sortConfig.direction === 'ascending' && <ChevronUpIcon width={12} height={12} />) ||
                          (sortConfig.direction === 'descending' && <ChevronDownIcon width={12} height={12} />))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between w-full mt-6">
                  <div className="space-y-4 w-full">
                    {items.map((bond, index) => (
                      <BondListItem key={index} bond={bond} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center mb-6">
          <div className="flex flex-col w-full max-w-xl mt-auto mb-2">
            <div className="max-w-lg pr-3 mb-2 text-center text-sm leading-5 text-gray-500 md:text-base md:mb-4 md:pr-0">
              {i18n._(
                t`Bonds are auto-staked (accrue rebase rewards) and no longer vest linearly. Simply claim as sOHM or gOHM at the end of the term.`
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
