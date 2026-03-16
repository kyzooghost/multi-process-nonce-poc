import "dotenv/config";
import { parseEther } from "viem";
import { createPublicClient, http } from "viem";
import {
  LOCK_FILE,
  NONCE_FILE,
  createAccount,
  createChain,
  createWalletClientForChain,
  ensureNonceFilesDir,
} from "./config.js";
import { initNonceFromChain } from "./nonce.js";

const TX_DURATION_SEC = parseInt(process.env.TX_DURATION_SEC ?? "0", 10);
const TX_CONCURRENCY = parseInt(process.env.TX_CONCURRENCY ?? "10", 10);
const TX_DEBOUNCE_MS = parseInt(process.env.TX_DEBOUNCE_MS ?? "1000", 10);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  ensureNonceFilesDir();

  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const chainId = parseInt(process.env.CHAIN_ID ?? "31337", 10);

  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required");
  }

  const chain = createChain(chainId, rpcUrl);
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClientForChain(chain, rpcUrl);
  const account = createAccount(privateKey, LOCK_FILE, NONCE_FILE);

  await initNonceFromChain(
    LOCK_FILE,
    NONCE_FILE,
    publicClient,
    account.address
  );

  const sendOne = () =>
    walletClient.sendTransaction({
      chain,
      account,
      to: account.address,
      value: parseEther("0"),
    });

  if (TX_DURATION_SEC > 0) {
    const deadline = Date.now() + TX_DURATION_SEC * 1000;
    const pool: Promise<unknown>[] = [];
    let sent = 0;

    const add = () => {
      const p = sendOne()
        .then((hash) => {
          console.log(`Process ${process.pid} sent tx ${hash}`);
        })
        .catch((err) => {
          console.error(`Process ${process.pid} tx error:`, err.message);
        })
        .finally(() => {
          const i = pool.indexOf(p);
          if (i >= 0) pool.splice(i, 1);
        });
      pool.push(p);
      sent++;
    };

    while (Date.now() < deadline) {
      while (pool.length >= TX_CONCURRENCY) {
        await Promise.race(pool);
      }
      add();
      await sleep(TX_DEBOUNCE_MS);
    }

    await Promise.allSettled(pool);
    console.log(`Process ${process.pid} sent ${sent} txs in ${TX_DURATION_SEC}s`);
  } else {
    const hash = await sendOne();
    console.log(`Process ${process.pid} sent tx ${hash}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
