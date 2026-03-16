import fs from "node:fs/promises";
import type { Address } from "viem";
import { getTransactionCount } from "viem/actions";
import type { Client } from "viem";
import { acquireLock, type AcquireLockOptions } from "./lock.js";

export interface NonceState {
  nextNonce: number;
}

export interface GetNextNonceOptions extends AcquireLockOptions {}

export async function getNextNonce(
  lockPath: string,
  noncePath: string,
  options: GetNextNonceOptions = {}
): Promise<number> {
  const release = await acquireLock(lockPath, {
    timeout: 5000,
    stale: 20000,
    ...options,
  });

  try {
    let state: NonceState = { nextNonce: 0 };

    try {
      const raw = await fs.readFile(noncePath, "utf8");
      state = JSON.parse(raw) as NonceState;
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== "ENOENT") throw err;
    }

    const nonce = state.nextNonce;
    state.nextNonce++;

    await fs.writeFile(noncePath, JSON.stringify(state));

    return nonce;
  } finally {
    await release();
  }
}

export async function initNonceFromChain(
  lockPath: string,
  noncePath: string,
  client: Client,
  address: Address,
  options?: AcquireLockOptions
): Promise<void> {
  const release = await acquireLock(lockPath, {
    timeout: 5000,
    stale: 20000,
    ...options,
  });

  try {
    try {
      const raw = await fs.readFile(noncePath, "utf8");
      const state = JSON.parse(raw) as NonceState;
      if (state.nextNonce !== undefined) {
        return;
      }
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== "ENOENT") throw err;
    }

    const chainNonce = await getTransactionCount(client, {
      address,
      blockTag: "pending",
    });

    await fs.writeFile(
      noncePath,
      JSON.stringify({ nextNonce: chainNonce } satisfies NonceState)
    );
  } finally {
    await release();
  }
}
