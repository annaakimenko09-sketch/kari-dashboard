#!/bin/bash
# Скрипт запуска КАРИ Dashboard
# Дважды кликните на этот файл для запуска

cd "$(dirname "$0")"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  NODE_TGZ="node-v22.13.1-darwin-arm64.tar.gz"
  NODE_DIR="/tmp/node-v22.13.1-darwin-arm64"
  NODE_URL="https://nodejs.org/dist/v22.13.1/$NODE_TGZ"
else
  NODE_TGZ="node-v22.13.1-darwin-x64.tar.gz"
  NODE_DIR="/tmp/node-v22.13.1-darwin-x64"
  NODE_URL="https://nodejs.org/dist/v22.13.1/$NODE_TGZ"
fi

if [ ! -f "$NODE_DIR/bin/node" ]; then
  echo "Загружаю Node.js (первый запуск)..."
  curl -fsSL "$NODE_URL" -o "/tmp/$NODE_TGZ"
  tar -xzf "/tmp/$NODE_TGZ" -C /tmp/
fi

NODE="$NODE_DIR/bin/node"
VITE="./node_modules/.bin/vite"

echo ""
echo "======================================"
echo "  КАРИ Dashboard - Вывозы и приёмки"
echo "======================================"
echo ""
echo "  Открывайте в браузере:"
echo "  http://localhost:3030"
echo ""
echo "  Для остановки: Ctrl+C"
echo "======================================"
echo ""

"$NODE" "$VITE" --port 3030 --open
