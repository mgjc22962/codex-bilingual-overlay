import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export function isRunnablePython(executable) {
  if (!existsSync(executable)) return false;
  const result = spawnSync(executable, ["-c", "import sys; print(sys.executable)"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 10_000,
  });
  return result.status === 0 && Boolean(result.stdout?.trim());
}
