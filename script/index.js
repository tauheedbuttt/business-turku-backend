import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Get command line arguments (npm start <type>)
const args = process.argv.slice(2);
const type = args[0]?.toLowerCase();

async function main() {
  if (type === 'investor') {
    console.log('🎯 Running investor data pipeline...\n');
    try {
      const { stdout, stderr } = await execAsync('node investor/index.js', { 
        cwd: __dirname,
        maxBuffer: 1024 * 1024 * 10
      });
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error) {
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      process.exit(1);
    }
  } else if (type === 'company' || !type) {
    console.log('🏢 Running company data pipeline...\n');
    try {
      const { stdout, stderr } = await execAsync('node company/index.js', { 
        cwd: __dirname,
        maxBuffer: 1024 * 1024 * 10
      });
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
    } catch (error) {
      if (error.stdout) console.log(error.stdout);
      if (error.stderr) console.error(error.stderr);
      process.exit(1);
    }
  } else {
    console.log(`
❌ Invalid argument: "${type}"

Usage:
  npm start              - Run company data pipeline (default)
  npm start company      - Run company data pipeline  
  npm start investor     - Run investor data pipeline

Examples:
  npm start
  npm start company
  npm start investor
    `);
    process.exit(1);
  }
}

main();
