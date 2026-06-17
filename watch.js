// watch.js — 실시간 진행상황 대시보드 (의존성 없음). 종료: Ctrl+C
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const read = (f) => { try { return fs.readFileSync(path.join(dir, f), 'utf8'); } catch (e) { return ''; } };
const mtime = (f) => { try { return fs.statSync(path.join(dir, f)).mtimeMs; } catch (e) { return 0; } };
const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const bar = (pct, w = 32) => { pct = Math.max(0, Math.min(100, pct || 0)); const f = Math.round(pct / 100 * w); return '█'.repeat(f) + '░'.repeat(w - f); };
const phaseLabel = {
  playing: '▶ 재생중', starting: '⏳ 시작중', browsing: '📖 목록확인', network_down: '📡 네트워크 끊김(재시도중)',
  blocked_exam: '⚠ 시험 대기(잠김)', error: '✖ 오류(복구중)', done: '🎉 전체 완료',
};

function render() {
  let st = {};
  try { st = JSON.parse(read('status.json')); } catch (e) {}
  const total = st.total || 24;
  const schedRows = read('schedule.md').trim().split('\n').filter((l) => l.startsWith('|') && !l.includes('---') && !l.includes('완료시각'));
  const done = st.done != null ? st.done : schedRows.length;
  const stale = (Date.now() - mtime('status.json')) / 1000; // 마지막 갱신 경과(초)
  const log = read('progress.log').trimEnd().split('\n');

  const out = [];
  out.push('\x1b[2J\x1b[H'); // clear
  out.push('\x1b[1m═══════════════════════════════════════════════════════════════\x1b[0m');
  out.push('\x1b[1m  edukisa 자동 수강 — 실시간 진행상황\x1b[0m   (Ctrl+C 종료)');
  out.push('\x1b[1m═══════════════════════════════════════════════════════════════\x1b[0m');
  out.push('');

  const opc = Math.round(done / total * 100);
  out.push(`  전체   ${String(done).padStart(2)}/${total} 차시  \x1b[36m${bar(opc)}\x1b[0m ${opc}%`);

  // 남은 시간 대략(차시당 30분 가정 + 현재 차시 남은 분)
  const remLessons = total - done - (st.lesson && st.pct < 100 ? 1 : 0);
  const curRemMin = st.dur ? Math.max(0, (st.dur - (st.cur || 0)) / 60) : 0;
  const etaMin = Math.round(remLessons * 30 + curRemMin);
  out.push(`  예상   약 ${Math.floor(etaMin / 60)}시간 ${etaMin % 60}분 남음 (차시당 30분 가정)`);
  out.push('');

  // 상태/생존
  const ph = phaseLabel[st.phase] || st.phase || '-';
  const liveMark = stale < 70 ? '\x1b[32m●\x1b[0m' : '\x1b[31m●\x1b[0m';
  out.push(`  상태   ${liveMark} ${ph}    (마지막 갱신 ${Math.round(stale)}초 전)`);
  if (stale >= 70) out.push('         \x1b[33m↳ 갱신 지연 — 네트워크 끊김/재시도 중일 수 있음 (자동 복구함)\x1b[0m');
  out.push('');

  // 현재 차시
  if (st.lesson) {
    out.push(`  현재   ${st.lesson}`);
    if (st.dur) {
      const p = st.pct != null ? st.pct : Math.round((st.cur || 0) / st.dur * 100);
      out.push(`         ${fmt(st.cur)} / ${fmt(st.dur)}  \x1b[32m${bar(p)}\x1b[0m ${p}%   남은 ${fmt(st.dur - (st.cur || 0))}`);
    }
    const safe = st.lesson.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 40);
    let cap = 0; try { cap = fs.readdirSync(path.join(dir, 'captures', safe)).length; } catch (e) {}
    out.push(`         캡처 ${cap}장`);
  }
  out.push('');

  // 최근 완료
  out.push('  \x1b[1m최근 완료\x1b[0m');
  const recentDone = schedRows.slice(-3);
  if (recentDone.length) recentDone.forEach((r) => { const c = r.split('|').map((x) => x.trim()); out.push(`    ✅ ${c[2]}  (${c[3]})`); });
  else out.push('    (아직 없음)');
  out.push('');

  // 최근 로그
  out.push('  \x1b[1m최근 로그\x1b[0m');
  log.slice(-10).forEach((l) => out.push('    \x1b[2m' + l.slice(0, 72) + '\x1b[0m'));

  process.stdout.write(out.join('\n') + '\n');
}

process.on('SIGINT', () => { process.stdout.write('\n종료.\n'); process.exit(0); });
render();
setInterval(render, 2000);
