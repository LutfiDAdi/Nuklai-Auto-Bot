const { SigningStargateClient } = require("@cosmjs/stargate");
const { DirectSecp256k1HdWallet } = require("@cosmjs/proto-signing");
const { coins } = require("@cosmjs/amino");
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
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

const shortNamesValidator = ["genesisnode", "nuklai-validator-1", "nuklai-validator-2", "nuklai-validator-3"];

async function delegateTokens(wallet, account, index, proxy) {
  const randomValidator = getRandomValidator(validatorAddress);
  const validator = shortNamesValidator[Math.floor(Math.random() * shortNamesValidator.length)];
  const Validator = randomValidator.replace("", `${validator} - `);

  console.log('\x1b[34m%s\x1b[0m', `\n[Memulai Staking untuk wallet ${index + 1}]`);
  console.log('\x1b[32m%s\x1b[0m', `Validator: ${Validator}`);
  
  // Create client with proxy if available
  const clientOptions = {};
  if (proxy) {
    clientOptions.httpAgent = new HttpsProxyAgent(proxy); // Updated usage
  }
  
  const client = await SigningStargateClient.connectWithSigner(RPC_ENDPOINT, wallet, clientOptions);

  const delegatorAddress = account.address;
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
      randomValidator,
      amount,
      fee,
      "", 
    );

    console.log('\x1b[32m%s\x1b[0m', "Delegasi Berhasil!");
    console.log('\x1b[32m%s\x1b[0m', `Validator Name: ${Validator}`);
    
    const tx_hash = result.transactionHash;
    console.log('\x1b[36m%s\x1b[0m', `https://api-testnet.nuklaivm.com/cosmos/tx/v1beta1/txs/${tx_hash}`);
  } catch (error) {
    console.error("Gagal Delegasi:", error);
  }
}

async function requestTestnetTokens(address, index, proxy) {
  try {
    console.log('\x1b[34m%s\x1b[0m', `\n[Memulai Request Token untuk wallet ${index + 1}]`);
    
    const axiosConfig = {
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
    };
    
    // Add proxy if available
    if (proxy) {
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxy); // Updated usage
    }
    
    const response = await axios.post(
      'https://faucet-testnet.nuklaivm.com/request',
      { address: address },
      axiosConfig
    );
    
    const tx_hash = response.data.txHash;
    console.log('\x1b[32m%s\x1b[0m', "Berhasil request token testnet!")
    console.log('\x1b[36m%s\x1b[0m', `https://api-testnet.nuklaivm.com/cosmos/tx/v1beta1/txs/${tx_hash}`);
    return response.data;
  } catch (error) {
    console.error('Error requesting testnet tokens:', error.response?.data || error.message);
    throw error;
  }
}

async function processWallet(mnemonic, index, proxy) {
  try {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic.trim(), {
      prefix: "nuklai",
    });
    const [account] = await wallet.getAccounts();
    console.log('\x1b[33m%s\x1b[0m', `\nWallet ${index + 1} Address: ${account.address}`);

    await requestTestnetTokens(account.address, index, proxy);
    await delegateTokens(wallet, account, index, proxy);
    
    return { success: true, address: account.address };
  } catch (error) {
    console.error(`Error processing wallet #${index + 1}:`, error);
    return { success: false, address: null, error: error.message };
  }
}

async function loadProxies() {
  try {
    if (!fs.existsSync('proxy.txt')) {
      console.log('\x1b[33m%s\x1b[0m', 'File proxy.txt tidak ditemukan, akan berjalan tanpa proxy');
      return [];
    }
    
    const proxies = fs.readFileSync('proxy.txt', 'utf8')
      .split('\n')
      .filter(p => p.trim().length > 0)
      .map(p => p.trim());
    
    return proxies;
  } catch (error) {
    console.error('Error loading proxies:', error);
    return [];
  }
}

async function startScheduler() {
  const intervalMinutes = 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`Starting scheduler - requests every ${intervalMinutes} minutes`);
  
  await processAllWallets();
  
  setInterval(processAllWallets, intervalMs);
}

async function processAllWallets() {
  try {
    const mnemonics = fs.readFileSync('mnemonics.txt', 'utf8').split('\n').filter(m => m.trim());
    const proxies = await loadProxies();
    
    console.log('\x1b[35m%s\x1b[0m',`\nProcessing ${mnemonics.length} wallets...`);
    
    for (let i = 0; i < mnemonics.length; i++) {
      const proxy = proxies[i] || null; // Use corresponding proxy or null if not available
      if (proxy) {
        console.log(`Using proxy: ${proxy} for wallet ${i + 1}`);
      }
      
      await processWallet(mnemonics[i], i, proxy);
      
      if (i < mnemonics.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  } catch (error) {
    console.error('Error processing wallets:', error);
  }
}

async function main() {
  if (!fs.existsSync('mnemonics.txt')) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: File mnemonics.txt tidak ditemukan!');
    console.log('Buat file mnemonics.txt dan isi dengan mnemonic phrase (1 wallet per baris)');
    return;
  }

  const mnemonics = fs.readFileSync('mnemonics.txt', 'utf8')
    .split('\n')
    .filter(m => m.trim().length > 0);

  if (mnemonics.length === 0) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: Tidak ada mnemonic di mnemonics.txt!');
    return;
  }

  console.log('\x1b[35m%s\x1b[0m', `Menemukan ${mnemonics.length} wallet. Memulai...`);
  startScheduler();
}

main().catch(console.error);
