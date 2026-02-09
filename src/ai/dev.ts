import { glob } from 'glob';

/**
 * Lists all flow files that should be loaded by the dev server.
 * This is used by the Genkit CLI.
 */
export async function lazyLoad() {
  const flowFiles = await glob('src/ai/flows/**/*.ts', {
    cwd: process.cwd(),
  });
  const toolFiles = await glob('src/ai/tools/**/*.ts', {
    cwd: process.cwd(),
  });

  const filesToLoad = flowFiles
    .concat(toolFiles)
    .filter((path) => !path.endsWith('dev.ts'));

  for (const file of filesToLoad) {
    // The path from glob starts with 'src/', so we replace it with '@/src/'
    // to create a valid module path that the Next.js builder can resolve.
    const modulePath = file.replace(/^src/, '@/');
    console.log(`Lazily loading: ${modulePath}`);
    await import(modulePath);
  }
}
