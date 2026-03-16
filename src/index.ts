import "dotenv/config";
import { parseEther } from "viem";
import { createPublicClient, http } from "viem";
import {
  LOCK_FILE,
  NONCE_FILE,
  createAccount,
  createChain,
  createWalletClientForChain,
} from "./config.js";
import { initNonceFromChain } from "./nonce.js";

async function main() {
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

  const hash = await walletClient.sendTransaction({
    chain: chain,
    account,
    to: account.address,
    value: parseEther("0"),
  });

  console.log(`Process ${process.pid} sent tx ${hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
