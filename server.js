'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'redorm.db');
const SCHEMA_PATH = path.join(ROOT, 'docs', 'schema.sql');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

function isoNow() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function initDatabase() {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!exists) db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count > 0) return;

  const insertUser = db.prepare(`
    INSERT INTO users (student_id, name, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const users = [
    ['D1348918', '張祐瑄'],
    ['D1350021', '林同學'],
    ['D1350088', '王同學'],
    ['D1350112', '陳同學']
  ];
  const userIds = {};
  for (const [studentId, name] of users) {
    const { salt, hash } = hashPassword('123456');
    const result = insertUser.run(studentId, name, hash, salt, isoNow());
    userIds[studentId] = Number(result.lastInsertRowid);
  }

  const insertProduct = db.prepare(`
    INSERT INTO products
      (user_id, name, category, price, condition, status, emoji, image_data, description, views, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const products = [
    ['D1348918','IKEA 白色書桌','家具',650,'保存良好','販售中','🪑',null,'桌面乾淨、結構穩固，適合宿舍或租屋使用，需至逢甲附近自取。',128,'2026-06-16T10:30:00.000Z'],
    ['D1350021','小型循環扇','家電',320,'有使用痕跡','販售中','🌀',null,'三段風速皆正常，夏天宿舍很好用，已完成清潔。',96,'2026-06-15T16:00:00.000Z'],
    ['D1350088','資料結構原文書','書籍',180,'保存良好','販售中','📚',null,'有少量鉛筆筆記，內容完整無缺頁，可校內面交。',74,'2026-06-14T09:20:00.000Z'],
    ['D1348918','三層收納推車','生活用品',280,'近全新','販售中','🧺',null,'購買後只使用一個月，滑輪正常，適合放保養品或零食。',162,'2026-06-13T18:10:00.000Z'],
    ['D1350112','宿舍床邊置物架','家具',150,'有使用痕跡','已售出','🛏️',null,'可夾在床邊，放手機、眼鏡與小物很方便。',55,'2026-06-12T11:00:00.000Z'],
    ['D1350021','快煮壺 1.2L','家電',260,'保存良好','販售中','🫖',null,'加熱速度正常，內部已除垢清潔，插電即可使用。',143,'2026-06-11T21:30:00.000Z'],
    ['D1348918','全新衣架 20 支','生活用品',100,'近全新','販售中','👕',null,'買太多用不到，整組出售，顏色為霧灰色。',41,'2026-06-10T13:40:00.000Z'],
    ['D1350088','離散數學筆記整理','書籍',90,'保存良好','販售中','📒',null,'含章節重點與題型整理，適合期中期末複習。',88,'2026-06-09T08:00:00.000Z']
  ];
  for (const p of products) {
    const [studentId, ...rest] = p;
    insertProduct.run(userIds[studentId], ...rest, rest[9]);
  }

  const insertMessage = db.prepare(`
    INSERT INTO messages (user_id, type, content, created_at) VALUES (?, ?, ?, ?)
  `);
  insertMessage.run(userIds.D1350112, '使用建議', '希望之後可以加入收藏清單，看到喜歡的商品會更方便。', '2026-06-16T19:20:00.000Z');
  insertMessage.run(userIds.D1350021, '交易回饋', '今天透過平台找到便宜的循環扇，校內面交很快速。', '2026-06-15T15:10:00.000Z');
  insertMessage.run(userIds.D1350088, '系統問題', '手機版搜尋很好用，商品圖片上傳也很方便。', '2026-06-14T12:30:00.000Z');

  const desk = db.prepare('SELECT id, user_id FROM products WHERE name = ?').get('IKEA 白色書桌');
  if (desk) {
    const result = db.prepare(`
      INSERT INTO conversations (product_id, buyer_id, seller_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(desk.id, userIds.D1350021, desk.user_id, '2026-06-17T08:30:00.000Z', '2026-06-17T08:36:00.000Z');
    const conversationId = Number(result.lastInsertRowid);
    const insertChat = db.prepare(`
      INSERT INTO chat_messages (conversation_id, sender_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `);
    insertChat.run(conversationId, userIds.D1350021, '你好，請問書桌還在嗎？可以在校內面交嗎？', '2026-06-17T08:30:00.000Z');
    insertChat.run(conversationId, desk.user_id, '還在，可以約逢甲正門或宿舍附近面交。', '2026-06-17T08:36:00.000Z');
  }
}

initDatabase();

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendError(res, status, message, details) {
  sendJson(res, status, { ok: false, message, ...(details ? { details } : {}) });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4_500_000) throw new Error('圖片或請求內容過大，請換一張較小的圖片');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('JSON 格式錯誤');
  }
}

function publicUser(row) {
  return row ? {
    id: row.id,
    name: row.name,
    studentId: row.student_id,
    createdAt: row.created_at
  } : null;
}

function getToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function getCurrentUser(req) {
  const token = getToken(req);
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.*, s.token, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) <= new Date()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

function requireUser(req, res) {
  const user = getCurrentUser(req);
  if (!user) sendError(res, 401, '請先登入後再操作');
  return user;
}

function cleanText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function productRow(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    condition: row.condition,
    status: row.status,
    emoji: row.emoji,
    imageData: row.image_data || '',
    description: row.description,
    views: row.views,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    seller: {
      id: row.user_id,
      name: row.seller_name,
      studentId: row.student_id
    }
  };
}

function productSelect(where = '') {
  return `
    SELECT p.*, u.name AS seller_name, u.student_id
    FROM products p JOIN users u ON u.id = p.user_id
    ${where}
  `;
}

function conversationMessages(conversationId, currentUserId) {
  return db.prepare(`
    SELECT cm.*, u.name AS sender_name, u.student_id AS sender_student_id
    FROM chat_messages cm JOIN users u ON u.id = cm.sender_id
    WHERE cm.conversation_id = ?
    ORDER BY cm.created_at ASC, cm.id ASC
  `).all(conversationId).map(row => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    mine: row.sender_id === currentUserId,
    sender: { id: row.sender_id, name: row.sender_name, studentId: row.sender_student_id }
  }));
}

function productConversationList(productId, sellerId) {
  return db.prepare(`
    SELECT c.id, c.buyer_id, c.created_at, c.updated_at,
           buyer.name AS buyer_name, buyer.student_id AS buyer_student_id,
           (
             SELECT cm.content FROM chat_messages cm
             WHERE cm.conversation_id = c.id
             ORDER BY cm.created_at DESC, cm.id DESC LIMIT 1
           ) AS last_message,
           (
             SELECT cm.created_at FROM chat_messages cm
             WHERE cm.conversation_id = c.id
             ORDER BY cm.created_at DESC, cm.id DESC LIMIT 1
           ) AS last_message_at
    FROM conversations c
    JOIN users buyer ON buyer.id = c.buyer_id
    WHERE c.product_id = ? AND c.seller_id = ?
    ORDER BY COALESCE(last_message_at, c.updated_at) DESC, c.id DESC
  `).all(productId, sellerId).map(row => ({
    id: row.id,
    buyer: { id: row.buyer_id, name: row.buyer_name, studentId: row.buyer_student_id },
    lastMessage: row.last_message || '',
    lastMessageAt: row.last_message_at || row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function validateStudentId(value) {
  return /^[A-Z]\d{7,10}$/.test(value);
}

function validateImageData(value) {
  if (!value) return '';
  const image = String(value);
  if (!/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) return null;
  if (image.length > 2_800_000) return null;
  return image;
}

function validateProduct(body) {
  const name = cleanText(body.name, 60);
  const category = cleanText(body.category, 30);
  const price = Number(body.price);
  const condition = cleanText(body.condition, 30);
  const status = cleanText(body.status, 20) || '販售中';
  const emoji = cleanText(body.emoji, 8) || '📦';
  const imageData = validateImageData(body.imageData);
  const description = cleanText(body.description, 300);
  const categories = ['家具', '家電', '書籍', '生活用品', '其他'];
  const conditions = ['近全新', '保存良好', '有使用痕跡'];
  const statuses = ['販售中', '已售出'];
  if (name.length < 2) return { error: '商品名稱至少需要 2 個字' };
  if (!categories.includes(category)) return { error: '商品分類不正確' };
  if (!Number.isInteger(price) || price < 0 || price > 1_000_000) return { error: '價格格式不正確' };
  if (!conditions.includes(condition)) return { error: '商品狀況不正確' };
  if (!statuses.includes(status)) return { error: '商品狀態不正確' };
  if (imageData === null) return { error: '圖片格式或大小不正確' };
  if (description.length < 5) return { error: '商品描述至少需要 5 個字' };
  return { name, category, price, condition, status, emoji, imageData, description };
}

async function handleApi(req, res, url) {
  const method = req.method || 'GET';
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    return sendJson(res, 200, { ok: true, database: 'SQLite', connected: true, productCount, time: isoNow() });
  }

  if (method === 'POST' && pathname === '/api/auth/register') {
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const studentId = cleanText(body.studentId, 20).toUpperCase();
    const password = String(body.password || '');
    if (!validateStudentId(studentId) || password.length < 6) {
      return sendError(res, 400, '請輸入正確學號與至少 6 碼密碼');
    }
    const exists = db.prepare('SELECT id FROM users WHERE student_id = ?').get(studentId);
    if (exists) return sendError(res, 409, '此學號已註冊');
    const { salt, hash } = hashPassword(password);
    const result = db.prepare(`
      INSERT INTO users (student_id, name, password_hash, password_salt, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(studentId, studentId, hash, salt, isoNow());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid));
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
    return sendJson(res, 201, { ok: true, token, user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const studentId = cleanText(body.studentId, 20).toUpperCase();
    const password = String(body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE student_id = ?').get(studentId);
    if (!user) return sendError(res, 401, '學號或密碼錯誤');
    const { hash } = hashPassword(password, user.password_salt);
    if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.password_hash, 'hex'))) {
      return sendError(res, 401, '學號或密碼錯誤');
    }
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(isoNow());
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, user.id, expiresAt);
    return sendJson(res, 200, { ok: true, token, user: publicUser(user) });
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    const token = getToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/auth/me') {
    return sendJson(res, 200, { ok: true, user: publicUser(getCurrentUser(req)) });
  }

  if (method === 'GET' && pathname === '/api/products') {
    const search = cleanText(url.searchParams.get('search'), 100);
    const category = cleanText(url.searchParams.get('category'), 30);
    const sort = cleanText(url.searchParams.get('sort'), 20) || 'newest';
    const mine = url.searchParams.get('mine') === '1';
    const currentUser = mine ? getCurrentUser(req) : null;
    if (mine && !currentUser) return sendError(res, 401, '請先登入');

    const clauses = [];
    const params = [];
    if (search) {
      clauses.push('(p.name LIKE ? OR p.description LIKE ? OR u.name LIKE ? OR u.student_id LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (category && category !== 'all') {
      clauses.push('p.category = ?');
      params.push(category);
    }
    if (mine) {
      clauses.push('p.user_id = ?');
      params.push(currentUser.id);
    }
    const orderMap = {
      newest: 'p.created_at DESC',
      priceLow: 'p.price ASC, p.created_at DESC',
      priceHigh: 'p.price DESC, p.created_at DESC',
      popular: 'p.views DESC, p.created_at DESC'
    };
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`${productSelect(where)} ORDER BY ${orderMap[sort] || orderMap.newest}`).all(...params);
    return sendJson(res, 200, { ok: true, products: rows.map(productRow) });
  }

  const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);
  const viewMatch = pathname.match(/^\/api\/products\/(\d+)\/view$/);
  const productContactMatch = pathname.match(/^\/api\/products\/(\d+)\/contact$/);
  const productContactMessagesMatch = pathname.match(/^\/api\/products\/(\d+)\/contact\/messages$/);

  if (method === 'GET' && productMatch) {
    const row = db.prepare(`${productSelect('WHERE p.id = ?')}`).get(Number(productMatch[1]));
    if (!row) return sendError(res, 404, '找不到商品');
    return sendJson(res, 200, { ok: true, product: productRow(row) });
  }

  if (method === 'POST' && viewMatch) {
    const id = Number(viewMatch[1]);
    const result = db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(id);
    if (!result.changes) return sendError(res, 404, '找不到商品');
    const row = db.prepare(`${productSelect('WHERE p.id = ?')}`).get(id);
    return sendJson(res, 200, { ok: true, product: productRow(row) });
  }

  if (method === 'POST' && pathname === '/api/products') {
    const user = requireUser(req, res);
    if (!user) return;
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const payload = validateProduct(body);
    if (payload.error) return sendError(res, 400, payload.error);
    const now = isoNow();
    const result = db.prepare(`
      INSERT INTO products (user_id, name, category, price, condition, status, emoji, image_data, description, views, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(user.id, payload.name, payload.category, payload.price, payload.condition, payload.status, payload.emoji, payload.imageData || null, payload.description, now, now);
    const row = db.prepare(`${productSelect('WHERE p.id = ?')}`).get(Number(result.lastInsertRowid));
    return sendJson(res, 201, { ok: true, product: productRow(row) });
  }

  if (method === 'PUT' && productMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(productMatch[1]);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, '找不到商品');
    if (existing.user_id !== user.id) return sendError(res, 403, '只能編輯自己的商品');
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const payload = validateProduct(body);
    if (payload.error) return sendError(res, 400, payload.error);
    db.prepare(`
      UPDATE products
      SET name=?, category=?, price=?, condition=?, status=?, emoji=?, image_data=?, description=?, updated_at=?
      WHERE id=?
    `).run(payload.name, payload.category, payload.price, payload.condition, payload.status, payload.emoji, payload.imageData || null, payload.description, isoNow(), id);
    const row = db.prepare(`${productSelect('WHERE p.id = ?')}`).get(id);
    return sendJson(res, 200, { ok: true, product: productRow(row) });
  }

  if (method === 'DELETE' && productMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(productMatch[1]);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, '找不到商品');
    if (existing.user_id !== user.id) return sendError(res, 403, '只能刪除自己的商品');
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && productContactMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const productId = Number(productContactMatch[1]);
    const product = db.prepare(`${productSelect('WHERE p.id = ?')}`).get(productId);
    if (!product) return sendError(res, 404, '找不到商品');

    const isSeller = product.user_id === user.id;
    let conversations = [];
    let activeConversation = null;
    let chatMessages = [];

    if (isSeller) {
      conversations = productConversationList(productId, user.id);
      const requestedId = Number(url.searchParams.get('conversationId'));
      const selected = conversations.find(item => item.id === requestedId) || conversations[0] || null;
      if (selected) {
        activeConversation = { id: selected.id, otherParty: selected.buyer, role: 'seller' };
        chatMessages = conversationMessages(selected.id, user.id);
      }
    } else {
      const row = db.prepare(`
        SELECT c.id, c.created_at, c.updated_at,
               seller.id AS seller_id, seller.name AS seller_name, seller.student_id AS seller_student_id
        FROM conversations c
        JOIN users seller ON seller.id = c.seller_id
        WHERE c.product_id = ? AND c.buyer_id = ? AND c.seller_id = ?
      `).get(productId, user.id, product.user_id);
      if (row) {
        activeConversation = {
          id: row.id,
          otherParty: { id: row.seller_id, name: row.seller_name, studentId: row.seller_student_id },
          role: 'buyer'
        };
        chatMessages = conversationMessages(row.id, user.id);
      }
    }

    return sendJson(res, 200, {
      ok: true,
      role: isSeller ? 'seller' : 'buyer',
      product: productRow(product),
      conversations,
      activeConversation,
      messages: chatMessages
    });
  }

  if (method === 'POST' && productContactMessagesMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const productId = Number(productContactMessagesMatch[1]);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return sendError(res, 404, '找不到商品');

    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const content = cleanText(body.content, 500);
    if (!content) return sendError(res, 400, '請輸入留言內容');

    let conversationId;
    if (product.user_id === user.id) {
      conversationId = Number(body.conversationId);
      if (!Number.isInteger(conversationId) || conversationId <= 0) return sendError(res, 400, '請先選擇要回覆的買家');
      const conversation = db.prepare(`
        SELECT id FROM conversations WHERE id = ? AND product_id = ? AND seller_id = ?
      `).get(conversationId, productId, user.id);
      if (!conversation) return sendError(res, 403, '無權回覆此留言');
    } else {
      const existing = db.prepare(`
        SELECT id FROM conversations WHERE product_id = ? AND buyer_id = ? AND seller_id = ?
      `).get(productId, user.id, product.user_id);
      if (existing) {
        conversationId = existing.id;
      } else {
        if (product.status === '已售出') return sendError(res, 400, '此商品已售出，無法建立新的聯絡');
        const now = isoNow();
        const result = db.prepare(`
          INSERT INTO conversations (product_id, buyer_id, seller_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(productId, user.id, product.user_id, now, now);
        conversationId = Number(result.lastInsertRowid);
      }
    }

    const now = isoNow();
    const result = db.prepare(`
      INSERT INTO chat_messages (conversation_id, sender_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(conversationId, user.id, content, now);
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, conversationId);
    return sendJson(res, 201, {
      ok: true,
      conversationId,
      messageId: Number(result.lastInsertRowid),
      createdAt: now
    });
  }

  if (method === 'GET' && pathname === '/api/messages') {
    const type = cleanText(url.searchParams.get('type'), 30);
    const where = type && type !== 'all' ? 'WHERE m.type = ?' : '';
    const params = where ? [type] : [];
    const rows = db.prepare(`
      SELECT m.*, u.name AS author_name, u.student_id
      FROM messages m JOIN users u ON u.id = m.user_id
      ${where}
      ORDER BY m.created_at DESC
    `).all(...params);
    const messages = rows.map(row => ({
      id: row.id,
      type: row.type,
      content: row.content,
      createdAt: row.created_at,
      author: { id: row.user_id, name: row.author_name, studentId: row.student_id }
    }));
    return sendJson(res, 200, { ok: true, messages });
  }

  if (method === 'POST' && pathname === '/api/messages') {
    const user = requireUser(req, res);
    if (!user) return;
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const type = cleanText(body.type, 30);
    const content = cleanText(body.content, 200);
    const allowed = ['使用建議', '系統問題', '交易回饋', '其他'];
    if (!allowed.includes(type) || content.length < 5) return sendError(res, 400, '留言至少需要 5 個字');
    const result = db.prepare('INSERT INTO messages (user_id, type, content, created_at) VALUES (?, ?, ?, ?)')
      .run(user.id, type, content, isoNow());
    return sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid) });
  }

  const messageMatch = pathname.match(/^\/api\/messages\/(\d+)$/);
  if (method === 'DELETE' && messageMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(messageMatch[1]);
    const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!existing) return sendError(res, 404, '找不到留言');
    if (existing.user_id !== user.id) return sendError(res, 403, '只能刪除自己的留言');
    db.prepare('DELETE FROM messages WHERE id = ?').run(id);
    return sendJson(res, 200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/conversations') {
    const user = requireUser(req, res);
    if (!user) return;
    const rows = db.prepare(`
      SELECT
        c.id, c.product_id, c.buyer_id, c.seller_id, c.created_at, c.updated_at,
        p.name AS product_name, p.emoji AS product_emoji, p.image_data AS product_image_data,
        p.price AS product_price, p.status AS product_status,
        CASE WHEN c.buyer_id = ? THEN seller.id ELSE buyer.id END AS other_id,
        CASE WHEN c.buyer_id = ? THEN seller.name ELSE buyer.name END AS other_name,
        CASE WHEN c.buyer_id = ? THEN seller.student_id ELSE buyer.student_id END AS other_student_id,
        (
          SELECT cm.content FROM chat_messages cm
          WHERE cm.conversation_id = c.id
          ORDER BY cm.created_at DESC, cm.id DESC LIMIT 1
        ) AS last_message,
        (
          SELECT cm.created_at FROM chat_messages cm
          WHERE cm.conversation_id = c.id
          ORDER BY cm.created_at DESC, cm.id DESC LIMIT 1
        ) AS last_message_at
      FROM conversations c
      JOIN products p ON p.id = c.product_id
      JOIN users buyer ON buyer.id = c.buyer_id
      JOIN users seller ON seller.id = c.seller_id
      WHERE c.buyer_id = ? OR c.seller_id = ?
      ORDER BY COALESCE(last_message_at, c.updated_at) DESC, c.id DESC
    `).all(user.id, user.id, user.id, user.id, user.id);
    const conversations = rows.map(row => ({
      id: row.id,
      product: {
        id: row.product_id,
        name: row.product_name,
        emoji: row.product_emoji,
        imageData: row.product_image_data || '',
        price: row.product_price,
        status: row.product_status
      },
      otherParty: { id: row.other_id, name: row.other_name, studentId: row.other_student_id },
      role: row.buyer_id === user.id ? 'buyer' : 'seller',
      lastMessage: row.last_message || '',
      lastMessageAt: row.last_message_at || row.updated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    return sendJson(res, 200, { ok: true, conversations });
  }

  if (method === 'POST' && pathname === '/api/conversations') {
    const user = requireUser(req, res);
    if (!user) return;
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const productId = Number(body.productId);
    if (!Number.isInteger(productId) || productId <= 0) return sendError(res, 400, '商品編號錯誤');
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return sendError(res, 404, '找不到商品');
    if (product.user_id === user.id) return sendError(res, 400, '不能聯絡自己刊登的商品');
    if (product.status === '已售出') return sendError(res, 400, '此商品已售出');
    const now = isoNow();
    db.prepare(`
      INSERT OR IGNORE INTO conversations (product_id, buyer_id, seller_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(productId, user.id, product.user_id, now, now);
    const conversation = db.prepare(`
      SELECT id FROM conversations WHERE product_id = ? AND buyer_id = ? AND seller_id = ?
    `).get(productId, user.id, product.user_id);
    return sendJson(res, 200, { ok: true, conversationId: conversation.id });
  }

  const conversationMatch = pathname.match(/^\/api\/conversations\/(\d+)$/);
  const conversationMessagesMatch = pathname.match(/^\/api\/conversations\/(\d+)\/messages$/);

  if (method === 'GET' && conversationMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(conversationMatch[1]);
    const conversation = db.prepare(`
      SELECT c.*, p.name AS product_name, p.emoji AS product_emoji, p.image_data AS product_image_data,
             p.price AS product_price, p.status AS product_status,
             buyer.name AS buyer_name, buyer.student_id AS buyer_student_id,
             seller.name AS seller_name, seller.student_id AS seller_student_id
      FROM conversations c
      JOIN products p ON p.id = c.product_id
      JOIN users buyer ON buyer.id = c.buyer_id
      JOIN users seller ON seller.id = c.seller_id
      WHERE c.id = ?
    `).get(id);
    if (!conversation) return sendError(res, 404, '找不到聯絡紀錄');
    if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) return sendError(res, 403, '無權查看此聯絡紀錄');
    const otherParty = conversation.buyer_id === user.id
      ? { id: conversation.seller_id, name: conversation.seller_name, studentId: conversation.seller_student_id }
      : { id: conversation.buyer_id, name: conversation.buyer_name, studentId: conversation.buyer_student_id };
    return sendJson(res, 200, {
      ok: true,
      conversation: {
        id: conversation.id,
        product: {
          id: conversation.product_id,
          name: conversation.product_name,
          emoji: conversation.product_emoji,
          imageData: conversation.product_image_data || '',
          price: conversation.product_price,
          status: conversation.product_status
        },
        otherParty,
        role: conversation.buyer_id === user.id ? 'buyer' : 'seller',
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at
      },
      messages: conversationMessages(id, user.id)
    });
  }

  if (method === 'POST' && conversationMessagesMatch) {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(conversationMessagesMatch[1]);
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conversation) return sendError(res, 404, '找不到聯絡紀錄');
    if (conversation.buyer_id !== user.id && conversation.seller_id !== user.id) return sendError(res, 403, '無權傳送訊息');
    let body;
    try { body = await readJson(req); } catch (error) { return sendError(res, 400, error.message); }
    const content = cleanText(body.content, 500);
    if (!content) return sendError(res, 400, '請輸入訊息內容');
    const now = isoNow();
    const result = db.prepare(`
      INSERT INTO chat_messages (conversation_id, sender_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, user.id, content, now);
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);
    return sendJson(res, 201, { ok: true, id: Number(result.lastInsertRowid), createdAt: now });
  }

  if (method === 'GET' && pathname === '/api/analytics') {
    const summary = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='販售中' THEN 1 ELSE 0 END) AS selling,
        SUM(CASE WHEN status='已售出' THEN 1 ELSE 0 END) AS sold,
        ROUND(AVG(price)) AS average_price,
        SUM(views) AS total_views
      FROM products
    `).get();
    const categories = db.prepare(`
      SELECT category, COUNT(*) AS count, ROUND(AVG(price)) AS averagePrice
      FROM products GROUP BY category ORDER BY count DESC, category ASC
    `).all();
    const popular = db.prepare(`${productSelect()} ORDER BY p.views DESC, p.created_at DESC LIMIT 5`).all().map(productRow);
    const activeSellers = db.prepare(`
      SELECT u.name, u.student_id AS studentId, COUNT(p.id) AS productCount, SUM(p.views) AS totalViews
      FROM users u JOIN products p ON p.user_id = u.id
      GROUP BY u.id ORDER BY productCount DESC, totalViews DESC LIMIT 5
    `).all();
    return sendJson(res, 200, { ok: true, summary, categories, popular, activeSellers });
  }

  return sendError(res, 404, '找不到 API 路徑');
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      const data = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': data.length });
      return res.end(data);
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) sendError(res, 500, '伺服器發生錯誤');
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ReDorm server running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${DB_PATH}`);
});
