#!/bin/bash
# stop.sh — 감시자 + run.js + 잔여 Chrome 종료. (진도 보존을 위해 kill 대신 항상 이걸 사용)
cd "$(dirname "$0")"
stamp() { date '+%Y-%m-%d %H:%M:%S'; }
[ -f supervisor.pid ] && kill "$(cat supervisor.pid)" 2>/dev/null
pkill -f "$(pwd)/supervisor.sh" 2>/dev/null
pkill -f "$(pwd)/run.js" 2>/dev/null
pkill -f "$(pwd)/chrome-profile" 2>/dev/null
sleep 1
rm -f chrome-profile/Singleton* supervisor.pid 2>/dev/null
echo "[$(stamp)] 사용자 stop.sh → 전체 중지" >> session.log
echo "중지 완료."
