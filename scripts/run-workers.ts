import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKER_COUNT = parseInt(process.env.WORKER_COUNT ?? "5", 10);
const SRC_PATH = path.resolve(__dirname, "../src/index.ts");

async function main() {
  const workers: ReturnType<typeof spawn>[] = [];

  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = spawn("npx", ["tsx", SRC_PATH], {
      stdio: "inherit",
      env: { ...process.env },
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
            if (code === 0) resolve();
            else reject(new Error(`Worker exited with code ${code}`));
          });
        })
    )
  );

  console.log(`All ${WORKER_COUNT} workers completed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
