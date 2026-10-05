#!/usr/bin/env sh
set -eu
npm run build
mkdir -p logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 start ecosystem.config.cjs
pm2 save
