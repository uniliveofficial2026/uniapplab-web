#!/usr/bin/env node
/** Print Vercel --project flag from .vercel/project.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectFile = path.join(root, '.vercel', 'project.json');
const configFile = path.join(root, 'config', 'vercel-project.json');

function fallbackName() {
  return (
    process.env.VERCEL_PROJECT_ID ||
    process.env.VERCEL_PROJECT_NAME ||
    'uniapplab-web-instacollab'
  );
}

function readProjectName() {
  for (const file of [projectFile, configFile]) {
    if (!fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const name = data.projectName || data.projectId;
      if (name) return name;
    } catch {
      /* try next */
    }
  }
  return fallbackName();
}

process.stdout.write(readProjectName());
