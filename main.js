const { SigningStargateClient } = require("@cosmjs/stargate");
const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { coins } = require("@cosmjs/amino");
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');

const RPC_ENDPOINT = "https://rpc-testnet.nuklaivm.com/";
const DENOM = "nai";

const validatorAddress = [
  "nuklaivaloper1hv8suc2vuspa88h0creaqhkuydj80myxz9k4q8",
  "nuklaivaloper1ram2r9jjeshze6y7xzvtg9k39emtvawkxrlpez",
  "nuklaivaloper1s5m35dazarlxxldpa2v799lv4gddhhdvgcn6sn",
  "nuklaivaloper1xg89zc82qhy88xr4uf5pysdyyc73r7wcy60qfh",
];

function getRandomValidator(arr) {
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

const randomValidator = getRandomValidator(validatorAddress);

const shortNamesValidator = ["genesisnode", "nuklai-validator-1", "nuklai-validator-2", "nuklai-validator-3"];
const validator = shortNamesValidator[Math.floor(Math.random() * shortNamesValidator.length)];

const Validator = randomValidator.replace("", `${validator} - `);

async function delegateTokens(wallet, account) {
  console.log('\x1b[34m%s\x1b[0m',`\n[Memulai Staking]`);
  console.log('\x1b[32m%s\x1b[0m',`Validator: ${Validator}`);
  const client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, wallet);

  const delegatorAddress = account.address;
  const validatorAddress = validator;
  const amount = {
    denom: DENOM,
    amount: "1000000",
  };

  try {
    const fee = {
      amount: coins(5220, DENOM),
      gas: "208771",
    };

    const result = await client.delegateTokens(
      delegatorAddress,
      validatorAddress,
      amount,
      fee,
      "", 
    );

    console.log('\x1b[32m%s\x1b[0m', "Delegasi Berhasil!");
    console.log('\x1b[32m%s\x1b[0m', `Validator Name: ${validatorAddress}`);
    
    const tx_hash = result.transactionHash;
    console.log('\x1b[36m%s\x1b[0m', `https://api-testnet.nuklaivm.com/cosmos/tx/v1beta1/txs/${tx_hash}`);
  } catch (error) {
    console.error("Gagal Delegasi:", error);
  }
}

async function requestTestnetTokens(address) {
  try {
    console.log('\x1b[34m%s\x1b[0m',`\n[Memulai Request Token]`);
    const response = await axios.post(
      'https://faucet-testnet.nuklaivm.com/request',
      { address: address },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://nuklaivm.com',
          'Priority': 'u=1, i',
          'Sec-Ch-Ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-site',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
        }
      }
    );
    tx_hash = response.data.txHash;
    console.log('\x1b[32m%s\x1b[0m', "Berhasil request token testnet!")
    console.log('\x1b[36m%s\x1b[0m', `https://api-testnet.nuklaivm.com/cosmos/tx/v1beta1/txs/${tx_hash}`);
    return response.data;
  } catch (error) {
    console.error('Error requesting testnet tokens:', error.response?.data || error.message);
    throw error;
  }
}

async function startScheduler(address, wallet, account) {
  const intervalMinutes = 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`Starting scheduler - requests every ${intervalMinutes} minutes`);
  
  await requestTestnetTokens(address).catch(console.error);
  await delegateTokens(wallet, account).catch(console.error);
  
  setInterval(() => {
    requestTestnetTokens().catch(console.error);
  }, intervalMs);
}



async function main() {
  const mnemonic = fs.readFileSync('mnemonic.txt', 'utf8');

  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: "nuklai",
  });
  const [account] = await wallet.getAccounts();
  const address = account.address;
  console.log('\x1b[33m%s\x1b[0m', `\nAddress: ${address}`);

  startScheduler(address, wallet, account)
  
}

main().catch(console.error);
