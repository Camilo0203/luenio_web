@echo off
set HOST=0.0.0.0
set PORT=4180
set ALLOWED_HOSTS=192.168.0.2,localhost,127.0.0.1
set PUBLIC_DEMO_MODE=true
node server.js > server-lan.log 2> server-lan-error.log
