'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { disposable } = require('./observatory-server.cjs');

function executable() {
  if (process.env.SPHERE_NATIVE_BROWSER) return process.env.SPHERE_NATIVE_BROWSER;
  if (process.platform === 'win32') {
    const chrome = path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe');
    if (fs.existsSync(chrome)) return chrome;
  }
  return undefined; // Playwright's installed Chromium
}

async function session() {
  if (!process.env.SPHERE_URL) return disposable(process.env.SPHERE_TEST_TRANSPORT || 'http');
  const origin = new URL(process.env.SPHERE_URL).origin;
  return { origin, async attach() {}, async close() {},
    async dispatch(url) {
      const response = await fetch(url);
      if (!response.ok) throw Error('HTTP ' + response.status + ' for ' + url);
      return { body: Buffer.from(await response.arrayBuffer()) };
    }
  };
}
module.exports = { session, executable };
