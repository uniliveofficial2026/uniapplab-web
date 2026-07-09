#!/usr/bin/env node
/** Print Vercel --project flag from .vercel/project.json */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectFile = path.join(root, '.vercel', 'project.json');
if (!fs.existsSync(projectFile)) {
  console.error('Missing .vercel/project.json — run vercel link in repo root.');
  process.exit(1);
}
const { projectName, projectId } = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
const name = projectName || projectId;
if (!name) {
  console.error('Invalid .vercel/project.json — missing projectName/projectId.');
  process.exit(1);
}
process.stdout.write(name);
