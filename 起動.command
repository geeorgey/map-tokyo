#!/bin/zsh
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  print 'Node.jsをインストールしてから、もう一度開いてください。'
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
npm run dev -- --open --port 5173
