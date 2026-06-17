'use strict';
const fs = require('node:fs');
const path = require('node:path');
const dbPath = path.join(__dirname, 'data', 'redorm.db');
for (const suffix of ['', '-shm', '-wal']) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) fs.rmSync(file);
}
console.log('資料庫已重設。下次 npm start 會重新建立測試資料。');
