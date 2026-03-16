# multi-signer-poc

POC for nonce coordination when one signer is used by multiple Node.js processes. Uses a file-based lock and shared nonce file for cross-process allocation, wired into Viem's `createNonceManager`.

## Usage

1. Fill in `.env` as per `.env.example`
2. Run `npm run run-workers`
