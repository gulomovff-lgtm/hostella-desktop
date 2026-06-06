#!/usr/bin/env node
/**
 * Kills any process listening on port 5173 before starting dev server.
 * Prevents "Port already in use" errors when restarting npm run dev.
 */
const { execSync } = require('child_process');

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(
        `for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port} ^| findstr LISTENING') do taskkill /PID %a /F`,
        { shell: 'cmd.exe', stdio: 'pipe' }
      );
      console.log(`[kill-dev] Killed process on port ${port}`);
    } else {
      execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: 'pipe' });
      console.log(`[kill-dev] Killed process on port ${port}`);
    }
  } catch {
    // No process on that port — that's fine
    console.log(`[kill-dev] Port ${port} is free`);
  }
}

killPort(5173);
