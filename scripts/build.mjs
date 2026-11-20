import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function projectFiles(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) projectFiles(full, found);
    else if (name === 'project.json') found.push(full);
  }
  return found;
}

const buildable = projectFiles('apps').concat(projectFiles('libs')).filter((file) => {
  const project = JSON.parse(readFileSync(file, 'utf8'));
  return Boolean(project.targets?.build);
});

if (buildable.length === 0) {
  mkdirSync('dist', { recursive: true });
  writeFileSync(path.join('dist', '.gitkeep'), '');
  console.log('No projects with target build. Nothing to build.');
  process.exit(0);
}

execSync(
  'pnpm exec nx run-many --target=build --prod --no-outputhashing --emptyOutDir',
  { stdio: 'inherit' },
);
