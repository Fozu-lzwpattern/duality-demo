#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "📦 安装依赖..."
cd "$ROOT/packages/backend" && npm install --silent
cd "$ROOT/packages/frontend" && npm install --silent

echo "🚀 启动服务..."
cd "$ROOT/packages/backend" && npm run dev &
BACKEND_PID=$!

# 等后端起来
sleep 3

cd "$ROOT/packages/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 启动成功！"
echo "   前端: http://localhost:2026"
echo "   后端: http://localhost:3001"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
