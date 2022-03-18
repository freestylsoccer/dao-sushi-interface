import { Currency, CurrencyAmount, Fraction, Percent } from '@sushiswap/sdk'

import Button from '../../components/Button'
import { Field } from '../../state/mint/actions'
import React, { useState } from 'react'
import { t } from '@lingui/macro'
import { useLingui } from '@lingui/react'
import { formatBigNumberToFixed } from '../../utils/formatBalance'
import { BigNumber } from 'ethers'
import { IBondV2 } from '../../state/bonding/hooks'
import { formatNumber, tryParseAmount } from '../../functions'
import useActiveWeb3React from '../../hooks/useActiveWeb3React'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import { useTokenBalance } from '../../state/wallet/hooks'
import { useToken } from '../../hooks/Tokens'
import { BOND_DEPOSITORY_V2_ADDRESS } from '../../constants'
import styled from 'styled-components'
import { Input as NumericalInput } from '../../components/NumericalInput'
import { BIG_INT_ZERO } from '../../constants'
import Image from 'next/image'
import Dots from '../../components/Dots'
import { useWalletModalToggle } from '../../state/application/hooks'
import { Input as PercentInput } from '../../components/PercentInput'
import TransactionSettings from '../../components/TransactionSettings'
import { AdjustmentsIcon, XIcon } from '@heroicons/react/solid'
import { useUserSlippageToleranceWithDefault } from '../../state/user/hooks'
import { useBondDepositoryContract } from '../../hooks'
import { TransactionResponse } from '@ethersproject/providers'

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
const buttonStyle =
  'flex justify-center items-center w-full h-14 rounded font-bold md:font-medium md:text-lg mt-5 text-sm focus:outline-none focus:ring'
const buttonStyleEnabled = `${buttonStyle} text-high-emphesis bg-gradient-to-r from-pink-red to-light-brown hover:opacity-90`

export function ConfirmAddModalBottom({ bond }: { bond: IBondV2 }) {
  const INPUT_CHAR_LIMIT = 18
  const { i18n } = useLingui()
  const { account, chainId } = useActiveWeb3React()

  const walletConnected = !!account
  const toggleWalletModal = useWalletModalToggle()

  const quoteTokenBalance = useTokenBalance(account ?? undefined, useToken(bond?.quoteToken))
  const [input, setInput] = useState<string>('')
  const [usingBalance, setUsingBalance] = useState(false)

  const balance = quoteTokenBalance

  const formattedBalance = balance?.toSignificant(4)

  const parsedAmount = usingBalance ? balance : tryParseAmount(input, balance?.currency)
  const [approvalState, approve] = useApproveCallback(parsedAmount, BOND_DEPOSITORY_V2_ADDRESS[chainId])

  const insufficientFunds = (balance && balance.equalTo(BIG_INT_ZERO)) || parsedAmount?.greaterThan(balance)

  const inputError = insufficientFunds

  const [pendingTx, setPendingTx] = useState(false)

  const buttonDisabled = !input || pendingTx || (parsedAmount && parsedAmount.equalTo(BIG_INT_ZERO))

  const slippage = new Percent(50, 10_000)

  const userSplippage = useUserSlippageToleranceWithDefault(slippage)

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

  const handleClickButton = async () => {
    if (buttonDisabled) return

    if (!walletConnected) {
      toggleWalletModal()
    } else {
      setPendingTx(true)

      if (approvalState === ApprovalState.NOT_APPROVED) {
        const success = await sendTx(() => approve())
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
          return
        }
      }
      const success = undefined //await sendTx(() => (parsedAmount))
      if (!success) {
        setPendingTx(false)
        // setModalOpen(true)
        return
      }
      handleInput('')
      setPendingTx(false)
    }
  }

  const bondDepositoryContract = useBondDepositoryContract()

  async function onBond() {
    if (!chainId || !account || !bondDepositoryContract) return

    if (!parsedAmount || !userSplippage) {
      return
    }
    let estimate,
      method: (...args: any) => Promise<TransactionResponse>,
      args: Array<string | string[] | number>,
      value: BigNumber | null
    estimate = bondDepositoryContract.estimateGas.deposit
    method = bondDepositoryContract.deposit
    args = [parsedAmount]
    value = null
    console.log(userSplippage)
  }

  const [recipientAddress, setRecipientAddress] = useState(account)
  const [displaySettings, setDisplaySettings] = useState(false)

  return (
    <div className="p-6 mt-0 -m-6 rounded bg-dark-800">
      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <div className="text-xl text-high-emphesis">{i18n._(t`Bond Price`)}</div>
          <div className="text-xl text-high-emphesis">{i18n._(t`Market Price`)}</div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xl text-high-emphesis">{formatNumber(bond?.priceUSD, true)}</div>
          <div className="text-xl text-high-emphesis">{formatNumber(bond?.marketPrice, true)}</div>
        </div>

        <StyledNumericalInput
          value={input}
          onUserInput={handleInput}
          className={`w-full h-14 px-3 md:px-5 mt-5 rounded bg-dark-800 text-sm md:text-lg font-bold text-dark-800 whitespace-nowrap${
            inputError ? ' pl-9 md:pl-12' : ''
          }`}
          placeholder=" "
        />
        {/* input overlay: */}
        <div className="relative w-full h-0 pointer-events-none bottom-14">
          <div
            className={`flex justify-between items-center h-14 rounded px-3 md:px-5 ${
              inputError ? ' border border-red' : ''
            }`}
          >
            <div className="flex space-x-2 ">
              {inputError && (
                <Image
                  className="mr-2 max-w-4 md:max-w-5"
                  src="/error-triangle.svg"
                  alt="error"
                  width="20px"
                  height="20px"
                />
              )}
              <p
                className={`text-sm md:text-lg font-bold whitespace-nowrap ${
                  input ? 'text-high-emphesis' : 'text-secondary'
                }`}
              >
                {`${input ? input : '0'} ${bond?.displayName}`}
              </p>
            </div>
            <div className="flex items-center text-sm text-secondary md:text-base">
              <div className={input ? 'hidden md:flex md:items-center' : 'flex items-center'}>
                <p>{i18n._(t`Balance`)}:&nbsp;</p>
                <p className="text-base font-bold">{formattedBalance}</p>
              </div>
              <button
                className="px-2 py-1 ml-3 text-xs font-bold border pointer-events-auto focus:outline-none focus:ring hover:bg-opacity-40 md:bg-cyan-blue md:bg-opacity-30 border-secondary md:border-cyan-blue rounded-2xl md:py-1 md:px-3 md:ml-4 md:text-sm md:font-normal md:text-cyan-blue"
                onClick={handleClickMax}
              >
                {i18n._(t`MAX`)}
              </button>
            </div>
          </div>
        </div>
        {approvalState === ApprovalState.NOT_APPROVED || approvalState === ApprovalState.PENDING ? (
          <Button color="gradient" disabled={approvalState === ApprovalState.PENDING} onClick={approve}>
            {approvalState === ApprovalState.PENDING ? <Dots>{i18n._(t`Approving`)} </Dots> : i18n._(t`Approve`)}
          </Button>
        ) : (
          <Button color="gradient" onClick={onBond} disabled={buttonDisabled || inputError}>
            {!walletConnected
              ? i18n._(t`Connect Wallet`)
              : !input
              ? i18n._(t`Enter Amount`)
              : insufficientFunds
              ? i18n._(t`Insufficient Balance`)
              : i18n._(t`Confirm`)}
          </Button>
        )}
        <div className="flex items-center justify-between pt-2">
          <div className="text-lg text-high-emphesis">{i18n._(t`Settings`)}</div>
          <div
            className="flex items-center justify-between rounded cursor-pointer"
            onClick={() => {
              setDisplaySettings(!displaySettings)
            }}
            id="open-settings-dialog-button"
          >
            {!displaySettings ? (
              <AdjustmentsIcon className="w-[26px] h-[26px] transform rotate-90" />
            ) : (
              <XIcon width={24} height={24} />
            )}
          </div>
        </div>
        {displaySettings && (
          <>
            <div className="h-px my-6 bg-gray-700" />
            <TransactionSettings placeholderSlippage={slippage} />
            <div className="flex items-center justify-between">
              <div className="text-sm text-high-emphesis">{i18n._(t`Recipient Address`)}</div>
            </div>
            <div className="flex items-center justify-between">
              <input
                type="text"
                className="w-full h-10 px-2 mt-2 text-sm border-2 rounded bg-dark-800 border-dark-700 lx:text-lg text-primary"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                maxLength={42}
              />
            </div>
            <div className="flex items-center justify-between pb-4">
              <div className="text-xs text-primary">
                {i18n._(t`Choose recipient address. By default, this is your currently connected address`)}
              </div>
            </div>
          </>
        )}
      </div>

      {/*<div className="h-px my-6 bg-gray-700" />
      <div className="grid gap-1 pb-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-secondary">{i18n._(t`${currencies[Field.CURRENCY_A]?.symbol} Deposited`)}</div>
          <div className="text-sm font-bold justify-center items-center flex right-align pl-1.5 text-high-emphesis">
            <div>{parsedAmounts[Field.CURRENCY_A]?.toSignificant(6)}</div>
            <span className="ml-1">{parsedAmounts[Field.CURRENCY_A]?.currency.symbol}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-secondary">{i18n._(t`${currencies[Field.CURRENCY_B]?.symbol} Deposited`)}</div>
          <div className="text-sm font-bold justify-center items-center flex right-align pl-1.5 text-high-emphesis">
            <div>{parsedAmounts[Field.CURRENCY_B]?.toSignificant(6)}</div>
            <span className="ml-1">{parsedAmounts[Field.CURRENCY_B]?.currency.symbol}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-secondary">{i18n._(t`Share of Pool:`)}</div>
          <div className="text-sm font-bold justify-center items-center flex right-align pl-1.5 text-high-emphesis">
            {noLiquidity ? '100' : poolTokenPercentage?.toSignificant(4)}%
          </div>
        </div>
      </div>*/}

      {/*<Button color="gradient" size="lg" onClick={onAdd}>
        {i18n._(t`Confirm Deposit`)}
    </Button>*/}
    </div>
  )
}

export default ConfirmAddModalBottom
