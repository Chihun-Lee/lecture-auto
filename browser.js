// 브라우저 실행 옵션 — 2026-09-18 사용자 지정: Google Chrome 대신 Aside(Chromium 계열) 우선.
// Aside가 없는 PC에서는 종전대로 Google Chrome 채널로 폴백한다.
const fs = require('fs');
const ASIDE = [
  '/Applications/Aside.app/Contents/MacOS/Aside',
  '/Applications/Aside 2.app/Contents/MacOS/Aside',
].find((p) => fs.existsSync(p));
module.exports = {
  ASIDE,
  launchOpts: ASIDE ? { executablePath: ASIDE } : { channel: 'chrome' },
};
