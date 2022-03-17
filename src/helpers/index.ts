import axios from 'axios'

/**
 * gets price of token from coingecko
 * @param tokenId STRING taken from https://www.coingecko.com/api/documentations/v3#/coins/get_coins_list
 * @returns INTEGER usd value
 */
export async function getTokenPrice(tokenId = 'olympus'): Promise<number> {
  let tokenPrice = 0
  const priceApiURL = 'https://api.olympusdao.finance/api/rest/coingecko_name'
  try {
    const ohmResp = (await axios.get(`${priceApiURL}/${tokenId}`)) as {
      data: { coingeckoTicker: { value: number } }
    }
    tokenPrice = ohmResp.data.coingeckoTicker.value
  } catch (e) {
    console.warn(`Error accessing OHM API ${priceApiURL} . Falling back to coingecko API`, e)
    // fallback to coingecko
    const cgResp = (await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`
    )) as {
      data: { [id: string]: { usd: number } }
    }
    tokenPrice = cgResp.data[tokenId].usd
  } finally {
    // console.info(`Token price from coingecko: ${tokenPrice}`);
    return tokenPrice
  }
}

/**
 * gets price of token from coingecko
 * @param contractAddress STRING representing address
 * @returns INTEGER usd value
 */
export async function getTokenByContract(contractAddress: string): Promise<number> {
  const downcasedAddress = contractAddress.toLowerCase()
  const chainName = 'ethereum'
  try {
    const resp = (await axios.get(
      `https://api.coingecko.com/api/v3/simple/token_price/${chainName}?contract_addresses=${downcasedAddress}&vs_currencies=usd`
    )) as {
      data: { [address: string]: { usd: number } }
    }
    const tokenPrice: number = resp.data[downcasedAddress].usd
    return tokenPrice
  } catch (e) {
    // console.log("coingecko api error: ", e);
    return 0
  }
}
