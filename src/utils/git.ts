import simpleGit from "simple-git";
import * as fs from "fs";
import * as path from "path";

export async function initRepo(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath);
  await git.init();
}

export async function commitAndPush(
  repoPath: string,
  message: string
): Promise<void> {
  const git = simpleGit(repoPath);

  // Stage all changes
  await git.add(".");

  // Check if there are changes to commit
  const status = await git.status();
  if (status.files.length === 0) {
    return;
  }

  // Commit
  await git.commit(message);

  // Push
  await git.push();
}

export async function hasChanges(repoPath: string): Promise<boolean> {
  const git = simpleGit(repoPath);
  const status = await git.status();
  return status.files.length > 0;
}

export function ensureDataDir(repoPath: string): void {
  const dataDir = path.join(repoPath, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function writeLatestJson(repoPath: string, data: object): void {
  ensureDataDir(repoPath);
  const filePath = path.join(repoPath, "data", "latest.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function writeReadme(repoPath: string, content: string): void {
  fs.writeFileSync(path.join(repoPath, "README.md"), content);
}

export function writeGitkeep(repoPath: string): void {
  ensureDataDir(repoPath);
  const gitkeepPath = path.join(repoPath, "data", ".gitkeep");
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, "");
  }
}
