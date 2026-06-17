// run.js — edukisa 강의 자동 수강 (백그라운드, headless, 실시간 재생)
// 실행: EDU_ID=.. EDU_PW=.. node run.js
// 동작: 차시표 파싱 → 잠기지 않은 진도율<100% 첫 차시 → 영상 끝까지 재생 → 다음 → 반복
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const PROFILE_DIR = path.join(__dirname, 'chrome-profile');
const LOG = path.join(__dirname, 'progress.log');
const COURSE_URL = process.env.COURSE_URL ||
  'https://corp.edukisa.or.kr/service/em/page/my_class_std.do?lmYyyy=2026&lmOpenNum=42889&lmTrainingCodeNm=%EC%9D%B8%ED%84%B0%EB%84%B7&lmTrainingCode=A';
const EDU_ID = process.env.EDU_ID, EDU_PW = process.env.EDU_PW;

const SCHEDULE = path.join(__dirname, 'schedule.md');
const SESSION = path.join(__dirname, 'session.log');
const STATUS = path.join(__dirname, 'status.json');
const DONE_FLAG = path.join(__dirname, 'DONE');

const ts = () => new Date().toLocaleString('ko-KR', { hour12: false });
const log = (s) => { const line = `[${ts()}] ${s}`; fs.appendFileSync(LOG, line + '\n'); console.log(line); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sessionLog = (s) => { try { fs.appendFileSync(SESSION, `[${ts()}] ${s}\n`); } catch (e) {} };
const writeStatus = (o) => { try { fs.writeFileSync(STATUS, JSON.stringify({ alive: ts(), ...o }, null, 2)); } catch (e) {} };
function appendSchedule(row) {
  try {
    if (!fs.existsSync(SCHEDULE)) fs.writeFileSync(SCHEDULE, '# 수강 스케줄표\n\n| 완료시각 | 차시 | 소요 | 결과 |\n|---|---|---|---|\n');
    fs.appendFileSync(SCHEDULE, row + '\n');
  } catch (e) {}
}

// 네트워크 불안정 대비: 최대 6회 백오프 재시도. 성공 시 true.
async function gotoCourse(page) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(1500);
      if (/login/i.test(page.url())) {
        log('세션 만료 → 재로그인');
        await page.fill('#user_id', EDU_ID);
        await page.fill('#user_pw', EDU_PW);
        await Promise.all([
          page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
          page.click('a:has-text("로그인")'),
        ]);
        await sleep(2000);
        await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        await sleep(1500);
      }
      if (/my_class_std/.test(page.url())) return true;
    } catch (e) {
      log(`  네트워크 재시도 ${attempt}/6: ${(e.message || '').slice(0, 60)}`);
    }
    await sleep(Math.min(5000 * attempt, 30000)); // 백오프(최대 30s)
  }
  return false;
}

// 차시 표 파싱
async function getLessons(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('tr.tbl-sec')]
      .map((tr) => {
        const txt = (tr.textContent || '').replace(/\s+/g, ' ').trim();
        if (!/^차시/.test(txt)) return null; // 과목 헤더행 제외
        const m = txt.match(/진도율\s*(\d+)%/);
        const pct = m ? parseInt(m[1], 10) : null;
        const btn = tr.querySelector('button');
        const oc = btn ? btn.getAttribute('onclick') || '' : '';
        const cls = btn ? btn.className || '' : '';
        const locked = !btn || /fnEduUseN/.test(oc) || cls.includes('disabled');
        const name = txt.split('강의시간')[0].replace(/^차시/, '').trim();
        return { name, pct, locked };
      })
      .filter(Boolean);
  });
}

// 특정 차시 버튼 클릭(이름 매칭 → row의 버튼 클릭 → fnChkEduPsb 실행)
async function startLesson(page, name) {
  return page.evaluate((nm) => {
    const tr = [...document.querySelectorAll('tr.tbl-sec')].find(
      (t) => /^\s*차시/.test(t.textContent || '') && (t.textContent || '').includes(nm)
    );
    const b = tr && tr.querySelector('button');
    if (b) { b.click(); return true; }
    return false;
  }, name);
}

// 시험(응시 가능/완료) 상태 스캔 — 시험은 자동 응시하지 않고 알림만.
async function getExams(page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll('a,button')]
      .map((el) => ({ txt: (el.textContent || '').replace(/\s+/g, ' ').trim(), oc: el.getAttribute('onclick') || '' }))
      .filter((e) => /응시하기|응시 하기|시험 응시|재응시/.test(e.txt))
      .map((e) => e.txt.slice(0, 30));
  });
}

async function videoState(page) {
  return page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return null;
    return { cur: v.currentTime, dur: v.duration, paused: v.paused, ended: v.ended, ready: v.readyState };
  });
}

async function forcePlay(page) {
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) { v.muted = true; v.playbackRate = 1; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  });
}

const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 40);

// 현재 영상 프레임을 jpeg Buffer로 (canvas 우선, 실패 시 video 요소 스크린샷)
async function grabFrame(page) {
  const dataUrl = await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v || !v.videoWidth) return null;
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.72);
    } catch (e) { return 'ERR'; }
  }).catch(() => null);
  if (dataUrl && dataUrl !== 'ERR') return Buffer.from(dataUrl.split(',')[1], 'base64');
  return page.locator('video').first().screenshot().catch(() => null); // CORS 차단 시 폴백
}

async function watchToEnd(page, name) {
  // 영상 로드 대기
  let loaded = false;
  for (let i = 0; i < 30; i++) {
    const v = await videoState(page);
    if (v && v.dur && v.dur > 0 && isFinite(v.dur)) { loaded = true; break; }
    await sleep(1000);
  }
  if (!loaded) { log(`  ! 영상 로드 실패: ${name}`); return false; }
  await forcePlay(page);

  const startV = await videoState(page);
  log(`  ▶ 재생 시작: ${name} (${Math.round(startV.cur)}/${Math.round(startV.dur)}s)`);
  const deadline = Date.now() + (startV.dur + 600) * 1000; // dur + 10분 안전마진
  let lastCur = -1, stallCount = 0, lastBeat = 0, lastCap = 0, lastBuf = null;

  // 강의 프레임 캡처 폴더 (차시별)
  const capDir = path.join(__dirname, 'captures', safeName(name));
  fs.mkdirSync(capDir, { recursive: true });
  const doCapture = async (sec) => {
    const buf = await grabFrame(page);
    if (buf && (!lastBuf || Buffer.compare(buf, lastBuf) !== 0)) {
      fs.writeFileSync(path.join(capDir, String(Math.round(sec)).padStart(5, '0') + 's.jpg'), buf);
      lastBuf = buf;
    }
  };

  while (Date.now() < deadline) {
    await sleep(10000);
    const v = await videoState(page);
    if (!v) { log('  ! video 사라짐'); return false; }

    // 20초마다 강의 프레임 캡처 (동일 슬라이드 중복 제거)
    if (Date.now() - lastCap > 20000) { await doCapture(v.cur).catch(() => {}); lastCap = Date.now(); }

    // 완료 판정
    if (v.ended || (v.dur && v.cur >= v.dur - 2)) {
      await doCapture(v.cur).catch(() => {});
      log(`  ✅ 영상 종료: ${name} (${Math.round(v.cur)}/${Math.round(v.dur)}s)`);
      await sleep(8000); // 마지막 진도 저장 대기
      return true;
    }
    // 정지/멈춤 감지 → 재생 재시도, 장기 정지 시 재로드 신호
    if (v.paused || Math.abs(v.cur - lastCur) < 0.5) {
      stallCount++;
      if (stallCount === 2 || stallCount === 5 || stallCount === 8) { await forcePlay(page).catch(() => {}); }
      if (stallCount >= 12) { // ≈120초 무진행 → 네트워크 추정, 페이지 재로드해 이어보기
        log(`  ! 장기 정지(네트워크 추정) → 재로드 후 이어보기: ${name} (${Math.round(v.cur)}s)`);
        return false;
      }
    } else stallCount = 0;
    lastCur = v.cur;

    // 30초마다 heartbeat + 상태파일
    if (Date.now() - lastBeat > 30000) {
      const pc = v.dur ? Math.round((v.cur / v.dur) * 100) : 0;
      log(`  … ${name}: ${Math.round(v.cur)}/${Math.round(v.dur)}s (${pc}%)`);
      writeStatus({ phase: 'playing', lesson: name, cur: Math.round(v.cur), dur: Math.round(v.dur), pct: pc });
      lastBeat = Date.now();
    }
  }
  log(`  ! 시간초과: ${name}`);
  return false;
}

const fmtDur = (ms) => { const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000); return `${m}분${s}초`; };

(async () => {
  if (!EDU_ID || !EDU_PW) { log('EDU_ID/EDU_PW 환경변수 필요'); process.exit(1); }
  // 비정상 종료도 기록 (감시자가 재시작)
  process.on('SIGINT', () => { sessionLog('SIGINT 수신 → 종료'); process.exit(130); });
  process.on('SIGTERM', () => { sessionLog('SIGTERM 수신 → 종료'); process.exit(143); });
  process.on('uncaughtException', (e) => { sessionLog('uncaughtException: ' + (e && e.message)); log('✖ 예외: ' + (e && e.message)); process.exit(1); });
  process.on('unhandledRejection', (e) => { sessionLog('unhandledRejection: ' + (e && e.message || e)); });

  sessionLog('프로세스 시작');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true, channel: 'chrome', viewport: { width: 1280, height: 900 },
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    window.addEventListener('visibilitychange', (e) => e.stopImmediatePropagation(), true);
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.on('dialog', async (d) => { log(`[dialog] ${d.message()}`); await d.accept().catch(() => {}); });

  log('==== 자동 수강 시작 ====');
  let safety = 0, stuckCount = 0, notifiedExams = new Set(), attempts = {};
  while (safety++ < 2000) {
    try {
      const ok0 = await gotoCourse(page);
      if (!ok0) { log('  강의 페이지 접속 실패(네트워크) → 30초 후 재시도'); writeStatus({ phase: 'network_down' }); await sleep(30000); continue; }

      const lessons = await getLessons(page);
      const done = lessons.filter((l) => l.pct === 100).length;
      const total = lessons.length;
      log(`현황: ${done}/${total} 완료`);
      writeStatus({ phase: 'browsing', done, total });

      // 응시 가능한 시험 알림 (자동 응시는 하지 않음 — 사용자/대화에서 처리)
      const exams = await getExams(page);
      for (const ex of exams) {
        if (!notifiedExams.has(ex)) { notifiedExams.add(ex); log(`⚠ 시험 응시 가능: ${ex}`); sessionLog(`시험 응시 가능: ${ex}`); }
      }

      const next = lessons.find((l) => !l.locked && (l.pct === null || l.pct < 100));
      if (!next) {
        const remainingLocked = lessons.find((l) => l.locked && (l.pct === null || l.pct < 100));
        if (remainingLocked) {
          stuckCount++;
          if (stuckCount >= 4) {
            log(`⚠ 진행 정체: 다음 차시 잠김(${remainingLocked.name}). 시험 응시 등 조치 필요.`);
            sessionLog(`진행 정체(시험 대기 추정): ${remainingLocked.name}`);
            writeStatus({ phase: 'blocked_exam', blocked: remainingLocked.name });
            await sleep(60000); stuckCount = 0; continue; // 종료하지 않고 대기(시험 처리 후 자동 진행)
          }
          log(`잠긴 차시 남음 → 재시도(${stuckCount}/4): ${remainingLocked.name}`);
          await sleep(8000); continue;
        }
        log('🎉 모든 차시 100% 완료!');
        sessionLog('전체 강의 완료');
        appendSchedule(`| ${ts()} | **전체 완료** | - | 🎉 ${done}/${total} |`);
        writeStatus({ phase: 'done', done, total });
        fs.writeFileSync(DONE_FLAG, ts() + '\n');
        break;
      }
      stuckCount = 0;

      attempts[next.name] = (attempts[next.name] || 0) + 1;
      log(`▶ 다음 차시: ${next.name} (현재 ${next.pct}%, 시도 ${attempts[next.name]})`);
      writeStatus({ phase: 'starting', lesson: next.name, pct: next.pct, done, total });
      const ok = await startLesson(page, next.name);
      if (!ok) { log(`  ! 버튼 클릭 실패: ${next.name}`); await sleep(3000); continue; }
      await sleep(3000);

      const startedAt = Date.now();
      const finished = await watchToEnd(page, next.name);

      // 완료 검증
      await gotoCourse(page);
      const after = (await getLessons(page)).find((l) => l.name === next.name);
      if (after && after.pct === 100) {
        log(`  ✔ 확인: ${next.name} 100%`);
        appendSchedule(`| ${ts()} | ${next.name} | ${fmtDur(Date.now() - startedAt)} | ✅ 100% |`);
        sessionLog(`차시 완료: ${next.name}`);
      } else {
        log(`  ↻ ${next.name} 아직 ${after ? after.pct : '?'}% → 다음 루프에서 이어서`);
        if (attempts[next.name] >= 8) { // 한 차시에서 8회 이상 정체 시 기록만 남기고 계속 시도
          appendSchedule(`| ${ts()} | ${next.name} | - | ⚠ ${after ? after.pct : '?'}% (재시도중) |`);
          sessionLog(`차시 정체(계속 재시도): ${next.name} ${after ? after.pct : '?'}%`);
        }
        await sleep(5000);
      }
    } catch (e) {
      log('  ✖ 루프 오류(계속): ' + (e.message || '').slice(0, 80));
      sessionLog('루프 오류: ' + (e.message || ''));
      writeStatus({ phase: 'error', msg: (e.message || '').slice(0, 120) });
      await sleep(15000); // 네트워크 회복 대기 후 계속
    }
  }

  log('==== 종료 ====');
  sessionLog('프로세스 정상 종료(루프 탈출)');
  await ctx.close().catch(() => {});
})();
