import { createNonceManager } from "viem/nonce";
import { getNextNonce, type GetNextNonceOptions } from "./nonce.js";

export function createFileNonceManager(
  lockPath: string,
  noncePath: string,
  options?: GetNextNonceOptions & { logNonce?: boolean }
) {
  const { logNonce, ...nonceOptions } = options ?? {};
  return createNonceManager({
    source: {
      async get() {
        const nonce = await getNextNonce(lockPath, noncePath, nonceOptions);
        if (logNonce) {
          console.log(`Process ${process.pid} got nonce ${nonce}`);
        }
        return nonce;
      },
      async set() {},
    },
  });
}
