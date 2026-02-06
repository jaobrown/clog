import { execSync } from "child_process";

export function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] });
    } else if (process.platform === "linux") {
      try {
        execSync("xclip -selection clipboard", {
          input: text,
          stdio: ["pipe", "ignore", "ignore"],
        });
      } catch {
        execSync("xsel --clipboard --input", {
          input: text,
          stdio: ["pipe", "ignore", "ignore"],
        });
      }
    } else if (process.platform === "win32") {
      execSync("clip", { input: text, stdio: ["pipe", "ignore", "ignore"] });
    } else {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
