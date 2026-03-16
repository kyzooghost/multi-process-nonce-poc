import "dotenv/config";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPublicClient, http } from "viem";
import {
  LOCK_FILE,
  NONCE_FILE,
  createChain,
  ensureNonceFilesDir,
} from "../src/config.js";
import { initNonceFromChain } from "../src/nonce.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5", 10);
const SRC_PATH = path.resolve(__dirname, "../src/index.ts");

async function main() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";
  const chainId = parseInt(process.env.CHAIN_ID ?? "31337", 10);

  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required");
  }

  ensureNonceFilesDir();

  const chain = createChain(chainId, rpcUrl);
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
  const { privateKeyToAccount } = await import("viem/accounts");
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  await initNonceFromChain(
    LOCK_FILE,
    NONCE_FILE,
    publicClient,
    account.address
  );

  const workers: ReturnType<typeof spawn>[] = [];
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    workers.forEach((w) => w.kill(signal));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const txDurationSec = parseInt(process.env.TX_DURATION_SEC ?? "60", 10);
  const workerEnv = { ...process.env, TX_DURATION_SEC: String(txDurationSec) };

  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = spawn("npx", ["tsx", SRC_PATH], {
      stdio: "inherit",
      env: workerEnv,
    });

    workers.push(worker);

    worker.on("error", (err) => {
      console.error(`Worker ${i} error:`, err);
    });

    worker.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Worker ${i} exited with code ${code}`);
      }
      if (signal) {
        console.error(`Worker ${i} killed by signal ${signal}`);
      }
    });
  }

  await Promise.all(
    workers.map(
      (w) =>
        new Promise<void>((resolve, reject) => {
          w.on("close", (code) => {
            if (shuttingDown) resolve();
            else if (code === 0) resolve();
            else reject(new Error(`Worker exited with code ${code}`));
          });
        })
    )
  );

  console.log(
    shuttingDown ? "Shutdown complete" : `All ${WORKER_COUNT} workers completed`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
