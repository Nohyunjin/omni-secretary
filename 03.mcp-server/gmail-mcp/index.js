#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

// 로깅 설정
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 로그 파일 경로
const logFile = path.join(
  logDir,
  `gmail-mcp-${new Date().toISOString().split('T')[0]}.log`
);

// 로그 함수
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

log('Gmail MCP 서버 시작...');

// 원본 라이브러리 실행
const result = spawnSync(
  'npx',
  ['@gongrzhe/server-gmail-autoauth-mcp', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  }
);

// 종료 코드 처리
if (result.status !== 0) {
  log(`오류 발생: 종료 코드 ${result.status}`);
  process.exit(result.status);
}

log('Gmail MCP 서버 종료');
