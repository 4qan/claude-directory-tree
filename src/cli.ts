import getPort, { portNumbers } from 'get-port';
import open from 'open';
import { runScan } from './scanner/index.js';
import { startServer } from './server/index.js';

const DEFAULT_PORT = 3737;

// Parse args
const args = process.argv.slice(2);
let targetDir = process.cwd();

for (let i = 0; i < args.length; i++) {
  if (!args[i].startsWith('-')) {
    targetDir = args[i];
  }
}

// Port allocation
const port = await getPort({ port: portNumbers(DEFAULT_PORT, DEFAULT_PORT + 20) });
if (port !== DEFAULT_PORT) {
  console.log(`Port ${DEFAULT_PORT} in use, using ${port}`);
}

// Initial scan for terminal output
console.log(`\nScanning ${targetDir}...\n`);
const scanResult = await runScan(targetDir);

for (const scope of scanResult.scopes) {
  console.log(`  ${scope.label}: ${scope.artifactCount} artifacts`);
}
console.log(`\nTotal: ${scanResult.totalArtifacts} artifacts across ${scanResult.scopes.length} scopes`);

// Start server
await startServer({ port, targetDir });
const url = `http://127.0.0.1:${port}`;
console.log(`\nOpen: ${url}`);

// Open browser
await open(url);

// Keep process alive until Ctrl+C
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
