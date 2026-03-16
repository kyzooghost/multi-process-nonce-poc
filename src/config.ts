import fs from "node:fs";
import path from "node:path";
import {
  createWalletClient,
  defineChain,
  http,
  type Chain,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createFileNonceManager } from "./fileNonceSource.js";

export const LOCK_FILE =
  process.env.LOCK_FILE ?? "tmp/eth-nonce.lock";
export const NONCE_FILE =
  process.env.NONCE_FILE ?? "tmp/nonce.json";

export function ensureNonceFilesDir(): void {
  fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
  const nonceDir = path.dirname(NONCE_FILE);
  if (nonceDir !== path.dirname(LOCK_FILE)) {
    fs.mkdirSync(nonceDir, { recursive: true });
  }
}

export function createChain(chainId: number, rpcUrl: string): Chain {
  return defineChain({
    id: chainId,
    name: "Custom",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

export function createWalletClientForChain(
  chain: Chain,
  rpcUrl: string
): WalletClient {
  return createWalletClient({
    chain,
    transport: http(rpcUrl),
  });
}

export function createAccount(
  privateKey: `0x${string}`,
  lockPath: string,
  noncePath: string
): PrivateKeyAccount {
  const nonceManager = createFileNonceManager(lockPath, noncePath, {
    timeout: 5000,
    stale: 20000,
    logNonce: true,
  });

  return privateKeyToAccount(privateKey, { nonceManager });
}
