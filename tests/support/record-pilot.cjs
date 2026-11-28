'use strict';
const fs = require('node:fs');
const path = require('node:path');

async function recordPilot(page, directory, action) {
  fs.mkdirSync(directory, {recursive: true});
  const session = await page.context().newCDPSession(page);
  const frames = [];
  session.on('Page.screencastFrame', frame => {
    void session.send('Page.screencastFrameAck', {sessionId: frame.sessionId}).catch(() => {});
    const filename = 'frame-' + String(frames.length).padStart(4, '0') + '.jpg';
    fs.writeFileSync(path.join(directory, filename), Buffer.from(frame.data, 'base64'));
    frames.push({filename, t: frame.metadata.timestamp});
  });
  try {
    await session.send('Page.startScreencast', {format: 'jpeg', quality: 72, maxWidth: 1056, maxHeight: 660, everyNthFrame: 2});
    await action();
    await page.waitForTimeout(800);
  } finally {
    try {
      await session.send('Page.stopScreencast');
    } finally {
      await session.detach();
      fs.writeFileSync(path.join(directory, 'times.json'), JSON.stringify(frames));
    }
  }
}

module.exports = {recordPilot};
