import * as path from "path";
import type { Project } from "../types.js";

export const REDACTED_PROJECT_NAME = "top secret";
export const REDACTED_SESSION_TITLE = "**********";

export function normalizeRedactionPath(input: string): string {
  return path.normalize(path.resolve(input));
}

function normalizePathEntry(entry: string): string {
  return path.normalize(path.resolve(entry));
}

export function isProjectRedacted(
  project: Project,
  redactedPaths: string[]
): boolean {
  if (redactedPaths.length === 0) return false;

  const normalizedRedactions = redactedPaths.map((p) => normalizePathEntry(p));
  const redactionBasenames = new Set(
    normalizedRedactions.map((p) => path.basename(p))
  );

  const projectPath = project.projectPath;
  const projectName = project.projectName;

  const normalizedProjectPath = path.isAbsolute(projectPath)
    ? path.normalize(projectPath)
    : null;

  if (
    normalizedProjectPath &&
    normalizedRedactions.includes(normalizedProjectPath)
  ) {
    return true;
  }

  if (redactionBasenames.has(path.basename(projectPath))) {
    return true;
  }

  if (redactedPaths.includes(projectPath) || redactedPaths.includes(projectName)) {
    return true;
  }

  return false;
}

export function applyRedactions(
  projects: Project[],
  redactedPaths: string[]
): Project[] {
  if (redactedPaths.length === 0) return projects;

  return projects.map((project) => {
    if (!isProjectRedacted(project, redactedPaths)) {
      return project;
    }

    return {
      ...project,
      projectName: REDACTED_PROJECT_NAME,
      sessions: project.sessions.map((session) => ({
        ...session,
        title: REDACTED_SESSION_TITLE,
      })),
    };
  });
}
