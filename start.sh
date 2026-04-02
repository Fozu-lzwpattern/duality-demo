#!/usr/bin/env bash
# Duality Demo — 一键启动脚本
# 用法: ./start.sh
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=3001
FRONTEND_PORT=2026

# 颜色
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  ██████  ██    ██  █████  ██      ██ ████████ ██    ██ ${NC}"
echo -e "${CYAN}  ██   ██ ██    ██ ██   ██ ██      ██    ██     ██  ██  ${NC}"
echo -e "${CYAN}  ██   ██ ██    ██ ███████ ██      ██    ██      ████   ${NC}"
echo -e "${CYAN}  ██   ██ ██    ██ ██   ██ ██      ██    ██       ██    ${NC}"
echo -e "${CYAN}  ██████   ██████  ██   ██ ███████ ██    ██       ██    ${NC}"
echo ""
echo -e "${CYAN}  Demo — SuperSwitch AI 治理系统${NC}"
echo ""

# 检查 Node.js
if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ 未检测到 Node.js，请先安装 Node.js 18+${NC}"
  exit 1
fi

NODE_VERSION=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 版本过低（当前 v$NODE_VERSION），需要 v18+${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Node.js v$(node --version | tr -d 'v') 检测通过${NC}"

# 释放端口（如果被占用）
for PORT in $BACKEND_PORT $FRONTEND_PORT; do
  PID=$(lsof -ti:$PORT 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo -e "${YELLOW}⚠️  端口 $PORT 被占用，正在释放 (PID $PID)...${NC}"
    kill -9 $PID 2>/dev/null || true
    sleep 1
  fi
done

# 安装后端依赖
echo ""
echo -e "${CYAN}📦 安装后端依赖...${NC}"
cd "$ROOT/packages/backend"
if [ ! -d "node_modules" ]; then
  npm install --silent
  echo -e "${GREEN}✓ 后端依赖安装完成${NC}"
else
  echo -e "${GREEN}✓ 后端依赖已存在，跳过安装${NC}"
fi

# 启动后端
echo ""
echo -e "${CYAN}🔧 启动后端服务 (port $BACKEND_PORT)...${NC}"
npm run dev > /tmp/duality-backend.log 2>&1 &
BACKEND_PID=$!

# 等待后端就绪
echo -n "   等待后端启动"
for i in $(seq 1 20); do
  sleep 0.5
  if curl -sf "http://localhost:$BACKEND_PORT/api/coupon/stats" >/dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
  echo -n "."
  if [ $i -eq 20 ]; then
    echo ""
    echo -e "${RED}❌ 后端启动超时，查看日志: /tmp/duality-backend.log${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
done

# 安装前端依赖
echo ""
echo -e "${CYAN}📦 安装前端依赖...${NC}"
cd "$ROOT/packages/frontend"
if [ ! -d "node_modules" ]; then
  npm install --silent
  echo -e "${GREEN}✓ 前端依赖安装完成${NC}"
else
  echo -e "${GREEN}✓ 前端依赖已存在，跳过安装${NC}"
fi

# 启动前端
echo ""
echo -e "${CYAN}🎨 启动前端服务 (port $FRONTEND_PORT)...${NC}"
npm run dev > /tmp/duality-frontend.log 2>&1 &
FRONTEND_PID=$!

# 等待前端就绪
echo -n "   等待前端启动"
for i in $(seq 1 20); do
  sleep 0.5
  if curl -sf "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
  echo -n "."
  if [ $i -eq 20 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  前端启动超时，但服务可能仍在启动中，请稍等后访问${NC}"
  fi
done

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🎉  Duality Demo 启动成功！         ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  前端:  http://localhost:$FRONTEND_PORT       ║${NC}"
echo -e "${GREEN}║  后端:  http://localhost:$BACKEND_PORT       ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  按 Ctrl+C 停止所有服务              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# 捕获退出信号
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 正在停止服务...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}✓ 服务已停止${NC}"
  exit 0
}
trap cleanup INT TERM

wait
