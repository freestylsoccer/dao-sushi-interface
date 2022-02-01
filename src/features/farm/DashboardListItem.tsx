import { classNames, formatNumber, formatPercent } from '../../functions'

import { Disclosure } from '@headlessui/react'
import DoubleLogo from '../../components/DoubleLogo'
import DashboardListItemDetails from './DashboardListItemDetails'
import Image from '../../components/Image'
import { PairType } from './enum'
import QuestionHelper from '../../components/QuestionHelper'
import React from 'react'
import { useCurrency } from '../../hooks/Tokens'
import CurrencyLogo from '../../components/CurrencyLogo'
import { formatBigNumberToFixed, formatBigNumber } from '../../utils/formatBalance'
import { BigNumber } from 'ethers'
import Button from '../../components/Button'
import { useRouter } from 'next/router'

const DashboardListItem = ({ project, ...rest }) => {
  const underlyingAsset = useCurrency(project?.underlyingAsset)
  const router = useRouter()
  const interestEarned = BigNumber.from(project?.aTokenBalance).sub(BigNumber.from(project?.pTokenBalance))
  console.log(project)
  return (
    <Disclosure {...rest}>
      {({ open }) => (
        <div>
          <Disclosure.Button
            className={classNames(
              open && 'rounded-b-none',
              'w-full px-4 py-6 text-left rounded cursor-pointer select-none bg-dark-900 text-primary text-sm md:text-lg'
            )}
          >
            <div className="grid grid-cols-6">
              <div className="flex col-span-2 space-x-4 md:col-span-2">
                <CurrencyLogo currency={underlyingAsset} size={40} />
                <div className="flex flex-col justify-center">
                  <div>
                    <span className="font-bold">{project?.reserve?.name}</span>
                  </div>
                  <div className="text-xs md:text-base text-secondary">{project?.reserve?.symbol}</div>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center font-bold">
                {formatBigNumberToFixed(
                  BigNumber.from(project?.pTokenBalance),
                  2,
                  Number(project?.reserve?.decimals)
                ).replace(/\d(?=(\d{3})+\.)/g, '$&,')}
              </div>
              <div className="flex flex-col items-end justify-center">
                <div className="flex flex-row items-center font-bold text-right text-high-emphesis">
                  {`${formatBigNumberToFixed(project?.reserve?.liquidityRate, 1, 25)}%`}
                  {project?.reserve?.liquidityRate == '0' && (
                    <QuestionHelper
                      text={
                        <div className="flex flex-col">
                          <div>
                            The calculation of interest will begin at the time the borrower withdraws the funds.
                          </div>
                        </div>
                      }
                    />
                  )}
                </div>
                <div className="text-xs text-right md:text-base text-secondary">annualized</div>
              </div>
              <div className="flex flex-col items-end justify-center">
                {project?.reserve?.depositsEnabled && (
                  <div className="text-xs text-right md:text-base text-secondary">
                    <Button
                      size="xs"
                      color="blue"
                      onClick={() => {
                        router.push(`/deposit/${project?.underlyingAsset}/${project?.project}`)
                      }}
                    >
                      Deposit
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end justify-center">
                {project?.reserve?.withdrawalsEnabled && (
                  <div className="text-xs text-right md:text-base text-secondary">
                    <Button
                      size="xs"
                      color="gray"
                      variant="link"
                      onClick={() => {
                        router.push(
                          `/withdraw/${project?.reserve?.aTokenAddress}/${project?.underlyingAsset}/${project?.project}`
                        )
                      }}
                    >
                      Withdraw
                    </Button>
                    <QuestionHelper
                      text={
                        <div className="flex flex-col">
                          <div>You can withdraw your funds when the project ends.</div>
                        </div>
                      }
                    />
                  </div>
                )}
                {project?.reserve?.interestWithdrawalsEnabled &&
                  formatBigNumber(
                    interestEarned,
                    Number(project?.reserve?.decimals),
                    Number(project?.reserve?.decimals)
                  ) != '0.0' && (
                    <div className="text-xs text-right md:text-base text-secondary">
                      <Button
                        size="xs"
                        color="gray"
                        variant="link"
                        onClick={() => {
                          router.push(
                            `/withdraw/${project?.reserve?.aTokenAddress}/${project?.underlyingAsset}/${project?.project}`
                          )
                        }}
                      >
                        Withdraw interest
                      </Button>
                      <QuestionHelper
                        text={
                          <div className="flex flex-col">
                            <div>Withdraw the interest generated by your investment.</div>
                          </div>
                        }
                      />
                    </div>
                  )}
              </div>
            </div>
          </Disclosure.Button>
        </div>
      )}
    </Disclosure>
  )
}

export default DashboardListItem
