import fs from "node:fs/promises";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface AcquireLockOptions {
  retryDelay?: number;
  timeout?: number;
  stale?: number;
}

export async function acquireLock(
  lockPath: string,
  {
    retryDelay = 100,
    timeout = 10000,
    stale = 30000,
  }: AcquireLockOptions = {}
): Promise<() => Promise<void>> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    try {
      const handle = await fs.open(lockPath, "wx");

      await handle.writeFile(
        JSON.stringify({
          pid: process.pid,
          createdAt: Date.now(),
        })
      );

      return async function release() {
        await handle.close();
        await fs.unlink(lockPath).catch(() => {});
      };
    } catch (err) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code !== "EEXIST") throw err;

      // Check stale lock
      try {
        const raw = await fs.readFile(lockPath, "utf8");
        const meta = JSON.parse(raw) as { pid: number; createdAt: number };

        if (Date.now() - meta.createdAt > stale) {
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        /* ignore parse/read errors */
      }

      await sleep(retryDelay);
    }
  }

  throw new Error("Lock timeout");
}
