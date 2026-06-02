import fs from "fs";
import path from "path";

export function loadDesignSystem() {
  return fs.readFileSync(
    path.join(process.cwd(), "ai/prompts/design-system.md"),
    "utf8"
  );
}