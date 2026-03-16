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

      // Check stale lock (empty/corrupt = crashed process, treat as stale)
      try {
        const raw = await fs.readFile(lockPath, "utf8");
        const meta = JSON.parse(raw) as { pid: number; createdAt: number };

        const isStaleByTime =
          !meta.createdAt || Date.now() - meta.createdAt > stale;
        let isStaleByPid = false;
        if (meta.pid) {
          try {
            process.kill(meta.pid, 0);
          } catch {
            isStaleByPid = true;
          }
        }

        if (isStaleByTime || isStaleByPid) {
          await fs.unlink(lockPath).catch(() => {});
          continue;
        }
      } catch {
        await fs.unlink(lockPath).catch(() => {});
        continue;
      }

      await sleep(retryDelay);
    }
  }

  throw new Error("Lock timeout");
}
