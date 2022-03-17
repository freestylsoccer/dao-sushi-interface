import React, { useState, useCallback } from 'react'
import { useLingui } from '@lingui/react'
import { t } from '@lingui/macro'
import CurrencyLogo from '../../components/CurrencyLogo'
import { formatPercent, formatNumber } from '../../functions/format'
import { useCurrency } from '../../hooks/Tokens'
import { useRouter } from 'next/router'
import TransactionConfirmationModal, { ConfirmationModalContent } from '../../modals/TransactionConfirmationModal'
import ConfirmBondModalBottom from '../../features/bonds/ConfirmBondModalBottom'

const BondListItem = ({ bond, ...rest }) => {
  const { i18n } = useLingui()
  const quoteToken = useCurrency(bond?.quoteToken)
  const router = useRouter()

  // modal and loading
  const [showConfirm, setShowConfirm] = useState<boolean>(false)
  const [attemptingTxn, setAttemptingTxn] = useState<boolean>(false) // clicked confirm

  const [txHash, setTxHash] = useState<string>('')

  async function onAdd() {
    console.log('some')
  }

  const modalHeader = () => {
    return (
      <div className="pb-4">
        <div className="flex items-center justify-start gap-3">
          <div className="text-lg font-bold md:text-xl text-high-emphesis">{bond?.displayName}</div>
          <div className="grid grid-flow-col gap-2">
            <CurrencyLogo currency={quoteToken} size={48} />
          </div>
        </div>
        <div className="text-lg font-medium md:text-2xl text-high-emphesis">
          {}
          &nbsp;{i18n._(t`Tokens`)}
        </div>
        <div className="pt-3 text-xs italic text-secondary">
          {i18n._(t`The deposit rate can vary but can never be less than the initial defined rate.`)}
        </div>
      </div>
    )
  }

  const modalBottom = () => {
    return <ConfirmBondModalBottom bond={bond} onAdd={onAdd} />
  }
  const pendingText = i18n._(t`Bonding`)
  const handleDismissConfirmation = useCallback(() => {
    setShowConfirm(false)
    // if there was a tx hash, we want to clear the input
    setTxHash('')
  }, [txHash])

  return (
    <>
      <TransactionConfirmationModal
        isOpen={showConfirm}
        onDismiss={handleDismissConfirmation}
        attemptingTxn={attemptingTxn}
        hash={txHash}
        content={() => (
          <ConfirmationModalContent
            title={i18n._(t`You will deposit`)}
            onDismiss={handleDismissConfirmation}
            topContent={modalHeader}
            bottomContent={modalBottom}
          />
        )}
        pendingText={pendingText}
      />
      <div className="grid grid-cols-6">
        <div className="flex items-center justify-center">
          <CurrencyLogo currency={quoteToken} size={32} />
        </div>
        <div className="flex items-center justify-center">{bond?.displayName}</div>
        <div className="flex items-center justify-center">{formatNumber(bond?.priceUSD, true)}</div>
        <div className="flex items-center justify-center">{formatPercent(bond?.discount?.toString())}</div>
        <div className="flex items-center justify-center">{bond?.duration}</div>
        <div className="flex items-center justify-center">
          <button
            className="px-2 py-1 ml-3 text-xs font-bold border pointer-events-auto focus:outline-none focus:ring hover:bg-opacity-40 md:bg-cyan-blue md:bg-opacity-30 border-secondary md:border-cyan-blue rounded-2xl md:py-1 md:px-3 md:ml-4 md:text-sm md:font-normal md:text-cyan-blue"
            disabled={bond?.soldOut}
            onClick={() => {
              setShowConfirm(true)
            }}
          >
            {bond?.soldOut ? i18n._(t`Sold Out`) : i18n._(t`Bond`)}
          </button>
        </div>
      </div>
    </>
  )
}

export default BondListItem
