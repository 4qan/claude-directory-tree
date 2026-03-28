import writeFileAtomic from 'write-file-atomic';
import { homedir } from 'node:os';
import { join } from 'node:path';
import fs from 'node:fs/promises';

const CONFIG_DIR = join(homedir(), '.claude-directory-tree');
const CONFIG_FILE = join(CONFIG_DIR, 'projects.json');

interface ProjectConfig {
  projects: string[];
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export async function getRegisteredProjects(configFile?: string): Promise<string[]> {
  const file = configFile ?? CONFIG_FILE;
  try {
    const raw = await fs.readFile(file, 'utf-8');
    const config: ProjectConfig = JSON.parse(raw);
    return config.projects ?? [];
  } catch {
    return [];
  }
}

export async function addProject(absolutePath: string, configFile?: string): Promise<void> {
  const file = configFile ?? CONFIG_FILE;
  const dir = join(file, '..');
  const existing = await getRegisteredProjects(file);
  if (existing.includes(absolutePath)) return;
  await fs.mkdir(dir, { recursive: true });
  const config: ProjectConfig = { projects: [...existing, absolutePath] };
  await writeFileAtomic(file, JSON.stringify(config, null, 2));
}

export async function removeProject(absolutePath: string, configFile?: string): Promise<void> {
  const file = configFile ?? CONFIG_FILE;
  const existing = await getRegisteredProjects(file);
  const filtered = existing.filter((p) => p !== absolutePath);
  if (filtered.length === existing.length) return;
  const dir = join(file, '..');
  await fs.mkdir(dir, { recursive: true });
  const config: ProjectConfig = { projects: filtered };
  await writeFileAtomic(file, JSON.stringify(config, null, 2));
}
