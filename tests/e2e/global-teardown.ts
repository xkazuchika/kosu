import { rmSync } from "node:fs";

export default function globalTeardown() {
  const dataDir = process.env.KOSU_E2E_DATA_DIR;

  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}
