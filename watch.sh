#!/bin/bash
# 실시간 진행상황 대시보드. 종료: Ctrl+C
cd "$(dirname "$0")"
exec node watch.js
