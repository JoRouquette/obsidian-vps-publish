#!/usr/bin/env node
/**
 * Open latest HTML report in browser
 * Usage: node open-report.cjs [profile-name]
 *
 * Examples:
 *   node open-report.cjs quick
 *   node open-report.cjs load-300-balanced
 *   node open-report.cjs  # Opens most recent report
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const reportsDir = path.join(__dirname, '..', 'reports');
const profileName = process.argv[2];

if (profileName) {
  const reportPath = path.join(reportsDir, `${profileName}.html`);
  if (!fs.existsSync(reportPath)) {
    console.error(`❌ Report not found: ${reportPath}`);
    console.error(`\nAvailable reports:`);
    fs.readdirSync(reportsDir)
      .filter((f) => f.endsWith('.html'))
      .forEach((f) => console.error(`  - ${f.replace('.html', '')}`));
    process.exit(1);
  }

  openReport(reportPath);
} else {
  // Find most recent HTML report
  const htmlFiles = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => ({
      name: f,
      path: path.join(reportsDir, f),
      time: fs.statSync(path.join(reportsDir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (htmlFiles.length === 0) {
    console.error('❌ No HTML reports found in', reportsDir);
    process.exit(1);
  }

  console.log(`📊 Opening most recent report: ${htmlFiles[0].name}`);
  openReport(htmlFiles[0].path);
}

function openReport(reportPath) {
  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    command = `start "" "${reportPath}"`;
  } else if (platform === 'darwin') {
    command = `open "${reportPath}"`;
  } else {
    command = `xdg-open "${reportPath}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error('❌ Failed to open report:', error.message);
      console.error(`\n💡 Try opening manually: ${reportPath}`);
      process.exit(1);
    }
    console.log('✅ Report opened in browser');
  });
}
