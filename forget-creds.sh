#!/bin/bash
# forget-creds.sh — 이 맥북 키체인에 저장된 자격증명 삭제.
security delete-generic-password -s "edukisa-auto" 2>/dev/null && echo "키체인 자격증명 삭제됨." || echo "저장된 자격증명이 없습니다."
