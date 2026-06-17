'use strict';

const state = {
  token: localStorage.getItem('redorm_token') || '',
  user: null,
  products: [],
  myProducts: [],
  messages: [],
  conversations: [],
  activeConversationId: null,
  activeConversationData: null,
  analytics: null,
  currentView: 'home',
  pendingImageData: '',
  detailProductId: null,
  detailContactData: null,
  detailConversationId: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function formatMoney(value) {
  return new Intl.NumberFormat('zh-TW').format(Number(value || 0));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.textContent = message;
  $('#toastWrap').append(node);
  setTimeout(() => node.remove(), 3000);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  let data;
  try { data = await response.json(); } catch { data = { ok: false, message: '伺服器回傳格式錯誤' }; }
  if (!response.ok) {
    if (response.status === 401 && state.token) clearSession(false);
    throw new Error(data.message || '操作失敗');
  }
  return data;
}

function openModal(id) {
  if (id === 'authModal') resetAuthForms();
  $(`#${id}`).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(`#${id}`).classList.add('hidden');
  if ($$('.modal-backdrop:not(.hidden)').length === 0) document.body.style.overflow = '';
}

function requireLogin(action) {
  if (state.user) return true;
  toast(`請先登入後再${action}`, 'error');
  openModal('authModal');
  return false;
}

function setSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('redorm_token', token);
  renderProfile();
}

function clearSession(showToast = true) {
  state.token = '';
  state.user = null;
  state.myProducts = [];
  state.conversations = [];
  state.activeConversationId = null;
  state.activeConversationData = null;
  state.detailContactData = null;
  state.detailConversationId = null;
  localStorage.removeItem('redorm_token');
  renderProfile();
  renderManage();
  renderContacts();
  if (state.detailProductId && !$('#detailModal').classList.contains('hidden')) renderDetailContactGuest();
  if (showToast) toast('已登出');
}

function resetAuthForms() {
  $('#loginForm')?.reset();
  $('#registerForm')?.reset();
  $('#loginIdentifier').value = '';
  $('#loginPassword').value = '';
  $('#registerName').value = '';
  $('#registerStudentId').value = '';
  $('#registerPassword').value = '';
  $$('.tab-btn').forEach(node => node.classList.toggle('active', node.dataset.authTab === 'login'));
  $('#loginForm').classList.remove('hidden');
  $('#registerForm').classList.add('hidden');
}

async function init() {
  bindEvents();
  renderProductSkeletons();
  await Promise.allSettled([checkHealth(), restoreSession()]);
  await Promise.all([loadProducts(), loadMessages(), loadAnalytics(), loadConversations()]);
  renderAll();
}

async function checkHealth() {
  try {
    const data = await api('/api/health');
    $('#dbStatus').classList.add('connected');
    $('#dbStatus span:last-child').textContent = `${data.database} 已連線`;
  } catch {
    $('#dbStatus span:last-child').textContent = '資料庫連線失敗';
  }
}

async function restoreSession() {
  if (!state.token) return;
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    if (!state.user) clearSession(false);
  } catch {
    clearSession(false);
  }
  renderProfile();
}

async function loadProducts() {
  const params = new URLSearchParams();
  const search = $('#searchInput').value.trim();
  const category = $('#categoryFilter').value;
  const sort = $('#sortFilter').value;
  if (search) params.set('search', search);
  if (category !== 'all') params.set('category', category);
  params.set('sort', sort);
  try {
    const data = await api(`/api/products?${params}`);
    state.products = data.products;
    renderHome();
    renderMarket();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function loadMyProducts() {
  if (!state.user) {
    state.myProducts = [];
    renderManage();
    return;
  }
  try {
    const data = await api('/api/products?mine=1&sort=newest');
    state.myProducts = data.products;
    renderManage();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function loadMessages() {
  try {
    const type = $('#messageFilter').value;
    const data = await api(`/api/messages?type=${encodeURIComponent(type)}`);
    state.messages = data.messages;
    renderMessages();
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function loadConversations(preferredId = null) {
  if (!state.user) {
    state.conversations = [];
    state.activeConversationId = null;
    state.activeConversationData = null;
    renderContacts();
    return;
  }
  try {
    const data = await api('/api/conversations');
    state.conversations = data.conversations || [];
    const targetId = preferredId || state.activeConversationId || state.conversations[0]?.id || null;
    renderContacts();
    if (targetId && state.conversations.some(item => item.id === Number(targetId))) {
      await openConversation(Number(targetId));
    } else {
      state.activeConversationId = null;
      state.activeConversationData = null;
      renderContacts();
    }
  } catch (error) {
    toast(error.message, 'error');
  }
}

async function openConversation(id) {
  if (!state.user) return;
  try {
    const data = await api(`/api/conversations/${id}`);
    state.activeConversationId = Number(id);
    state.activeConversationData = data;
    renderContacts();
    requestAnimationFrame(scrollGlobalChat);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function scrollGlobalChat() {
  const box = $('#chatMessages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function loadAnalytics() {
  try {
    const data = await api('/api/analytics');
    state.analytics = data;
    renderStats();
    renderAnalytics();
  } catch (error) {
    toast(error.message, 'error');
  }
}

function switchView(view) {
  state.currentView = view;
  $$('.view').forEach(node => node.classList.toggle('active', node.id === `view-${view}`));
  $$('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === view));
  const labels = { home: '首頁', market: '商品市集', manage: '商品管理', messages: '留言板', contact: '買賣聯絡', analytics: '數據分析' };
  $('#sectionLabel').textContent = labels[view] || '首頁';
  $('#sidebar').classList.remove('open');
  $('#profileMenu').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'manage') loadMyProducts();
  if (view === 'contact') loadConversations();
  if (view === 'analytics') loadAnalytics();
}

function renderAll() {
  renderProfile();
  renderHome();
  renderMarket();
  renderManage();
  renderMessages();
  renderContacts();
  renderStats();
  renderAnalytics();
}

function renderProfile() {
  const user = state.user;
  $('#profileName').textContent = user ? user.name : '訪客模式';
  $('#profileStatus').textContent = user ? user.studentId : '點擊登入';
  $('#profileAvatar').textContent = user ? user.studentId.slice(0, 1) : '訪';
  $('#loginNotice').classList.toggle('hidden', Boolean(user));
  $('#contactLoginNotice').classList.toggle('hidden', Boolean(user));
  $('#contactWorkspace').classList.toggle('hidden', !user);
  $('#profileMenuUser').innerHTML = user
    ? `<strong>${escapeHtml(user.name)}</strong><small>學號：${escapeHtml(user.studentId)}</small>`
    : '<strong>尚未登入</strong><small>登入後可管理自己的商品</small>';
  $('#profileMenuLogin').classList.toggle('hidden', Boolean(user));
  $('#logoutBtn').classList.toggle('hidden', !user);
}

function renderProductSkeletons() {
  const skeleton = '<div class="loading-card"></div>'.repeat(4);
  $('#latestProducts').innerHTML = skeleton;
  $('#marketProducts').innerHTML = skeleton;
}

function productImageMarkup(product, className = '') {
  if (product.imageData) {
    return `<img class="${className}" src="${product.imageData}" alt="${escapeHtml(product.name)}商品圖片">`;
  }
  return `<span class="product-emoji ${className}">${escapeHtml(product.emoji)}</span>`;
}

function productCard(product) {
  return `
    <article class="product-card" data-product-id="${product.id}">
      <div class="product-media">
        ${productImageMarkup(product, 'card-image')}
        <b class="product-tag">${escapeHtml(product.category)}</b>
        ${product.status === '已售出' ? '<div class="sold-mask">已售出</div>' : ''}
      </div>
      <div class="product-body">
        <div class="product-meta"><span>${escapeHtml(product.condition)}</span><span>${formatDate(product.createdAt)}</span></div>
        <h3>${escapeHtml(product.name)}</h3>
        <div class="product-desc">${escapeHtml(product.description)}</div>
        <div class="product-bottom"><div class="price"><small>NT$</small>${formatMoney(product.price)}</div><div class="views">瀏覽 ${product.views}</div></div>
      </div>
    </article>`;
}

function renderHome() {
  const latest = [...state.products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 4);
  $('#latestProducts').innerHTML = latest.length ? latest.map(productCard).join('') : '<div class="empty-inline">目前沒有商品。</div>';
}

function renderMarket() {
  $('#marketProducts').innerHTML = state.products.map(productCard).join('');
  $('#resultCount').textContent = `共 ${state.products.length} 件商品`;
  $('#marketEmpty').classList.toggle('hidden', state.products.length > 0);
}

function renderManage() {
  $('#myProductCount').textContent = `${state.myProducts.length} 件`;
  $('#myProductsEmpty').classList.toggle('hidden', state.myProducts.length > 0);
  $('#myProductsBody').innerHTML = state.myProducts.map(product => `
    <tr>
      <td><div class="product-cell"><span class="product-cell-icon">${productImageMarkup(product, 'table-image')}</span><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.description)}</small></div></div></td>
      <td>${escapeHtml(product.category)}</td>
      <td>NT$ ${formatMoney(product.price)}</td>
      <td><span class="status-badge ${product.status === '已售出' ? 'sold' : ''}">${escapeHtml(product.status)}</span></td>
      <td>${product.views}</td>
      <td><div class="action-row"><button class="table-btn edit-product" data-id="${product.id}">編輯</button><button class="table-btn danger delete-product" data-id="${product.id}">刪除</button></div></td>
    </tr>`).join('');
}

function renderMessages() {
  $('#messageList').innerHTML = state.messages.length ? state.messages.map(message => `
    <article class="message-item">
      <div class="message-avatar">${escapeHtml(message.author.studentId.slice(0, 1))}</div>
      <div class="message-copy">
        <div class="message-top"><div><strong>${escapeHtml(message.author.name)}</strong><small>${escapeHtml(message.author.studentId)} · ${formatDate(message.createdAt)}</small></div><span>${escapeHtml(message.type)}</span></div>
        <p>${escapeHtml(message.content)}</p>
        ${state.user?.id === message.author.id ? `<button class="delete-message" data-id="${message.id}">刪除留言</button>` : ''}
      </div>
    </article>`).join('') : '<div class="empty-inline">目前沒有留言。</div>';
}

function conversationThumb(product) {
  return product.imageData
    ? `<img src="${product.imageData}" alt="${escapeHtml(product.name)}">`
    : escapeHtml(product.emoji);
}

function renderContacts() {
  const conversations = state.conversations || [];
  $('#conversationEmpty').classList.toggle('hidden', conversations.length > 0);
  $('#conversationList').innerHTML = conversations.map(item => `
    <button class="conversation-item ${item.id === state.activeConversationId ? 'active' : ''}" data-conversation-id="${item.id}">
      <span class="conversation-icon">${conversationThumb(item.product)}</span>
      <span class="conversation-copy"><strong>${escapeHtml(item.product.name)}</strong><small>${escapeHtml(item.otherParty.name)} · ${item.role === 'buyer' ? '我是買家' : '我是賣家'}</small><em>${escapeHtml(item.lastMessage || '尚未傳送訊息')}</em></span>
      <time>${formatDate(item.lastMessageAt)}</time>
    </button>`).join('');

  const data = state.activeConversationData;
  const hasActive = Boolean(data?.conversation && state.activeConversationId);
  $('#chatEmpty').classList.toggle('hidden', hasActive);
  $('#chatPanel').classList.toggle('hidden', !hasActive);
  if (!hasActive) return;

  const conversation = data.conversation;
  $('#chatHeader').innerHTML = `
    <div class="chat-person"><span class="avatar">${escapeHtml(conversation.otherParty.studentId.slice(0, 1))}</span><div><strong>${escapeHtml(conversation.otherParty.name)}</strong><small>${escapeHtml(conversation.otherParty.studentId)} · ${conversation.role === 'buyer' ? '商品賣家' : '商品買家'}</small></div></div>
    <button class="chat-product compact-product" data-open-product="${conversation.product.id}"><span>${conversationThumb(conversation.product)}</span><div><strong>${escapeHtml(conversation.product.name)}</strong><small>NT$ ${formatMoney(conversation.product.price)}</small></div></button>`;
  $('#chatMessages').innerHTML = chatMessagesMarkup(data.messages || []);
}

function chatMessagesMarkup(messages) {
  if (!messages.length) return '<div class="chat-start"><span>💬</span><p>尚未有訊息，開始討論商品吧。</p></div>';
  return messages.map(message => `
    <div class="chat-bubble-row ${message.mine ? 'mine' : 'theirs'}">
      <div class="chat-bubble"><p>${escapeHtml(message.content)}</p><small>${escapeHtml(message.sender.studentId)} · ${formatDate(message.createdAt)}</small></div>
    </div>`).join('');
}

function summaryStats() {
  const summary = state.analytics?.summary || {};
  return [
    ['📦', summary.total, '全部商品'],
    ['🛍️', summary.selling, '販售中'],
    ['✅', summary.sold, '已完成交易'],
    ['💰', `$${formatMoney(summary.average_price)}`, '平均商品價格']
  ];
}

function renderStats() {
  const html = summaryStats().map(([icon, value, label]) => `<div class="stat-card"><div class="stat-icon">${icon}</div><div><strong>${value ?? 0}</strong><span>${label}</span></div></div>`).join('');
  $('#homeStats').innerHTML = html;
  $('#analyticsStats').innerHTML = html;
}

function renderAnalytics() {
  if (!state.analytics) return;
  const categories = state.analytics.categories || [];
  const max = Math.max(1, ...categories.map(item => item.count));
  $('#categoryChart').innerHTML = categories.map(item => `
    <div class="bar-row"><span class="bar-label">${escapeHtml(item.category)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, item.count / max * 100)}%"></div></div><span class="bar-value">${item.count}</span></div>`).join('') || '<div class="empty-inline">尚無資料</div>';

  $('#popularList').innerHTML = (state.analytics.popular || []).map((product, index) => `
    <div class="rank-item"><span class="rank-number">${String(index + 1).padStart(2, '0')}</span><span class="rank-icon">${conversationThumb(product)}</span><div class="rank-copy"><strong>${escapeHtml(product.name)}</strong><small>NT$ ${formatMoney(product.price)} · ${escapeHtml(product.category)}</small></div><span class="rank-views">${product.views} 次</span></div>`).join('');

  $('#sellerList').innerHTML = (state.analytics.activeSellers || []).map(seller => `
    <div class="seller-item"><strong>${escapeHtml(seller.name)}</strong><small>${escapeHtml(seller.studentId)}</small><div class="seller-metric"><span>刊登 <b>${seller.productCount}</b> 件</span><span>瀏覽 <b>${seller.totalViews}</b></span></div></div>`).join('');
}

function detailImageMarkup(product) {
  return product.imageData
    ? `<img src="${product.imageData}" alt="${escapeHtml(product.name)}商品圖片">`
    : `<span class="detail-emoji">${escapeHtml(product.emoji)}</span>`;
}

async function openProductDetail(id) {
  try {
    const data = await api(`/api/products/${id}/view`, { method: 'POST' });
    const product = data.product;
    state.detailProductId = product.id;
    state.detailConversationId = null;
    $('#detailContent').innerHTML = `
      <div class="detail-layout">
        <div class="detail-media">${detailImageMarkup(product)}${product.status === '已售出' ? '<div class="sold-mask">已售出</div>' : ''}</div>
        <div class="detail-body">
          <span class="pill category-pill">${escapeHtml(product.category)}</span>
          <h2>${escapeHtml(product.name)}</h2>
          <p>${escapeHtml(product.description)}</p>
          <div class="detail-price">NT$ ${formatMoney(product.price)}</div>
          <div class="detail-meta">
            <div><small>商品狀況</small><strong>${escapeHtml(product.condition)}</strong></div>
            <div><small>商品狀態</small><strong>${escapeHtml(product.status)}</strong></div>
            <div><small>瀏覽次數</small><strong>${product.views} 次</strong></div>
            <div><small>上架時間</small><strong>${formatDate(product.createdAt)}</strong></div>
          </div>
          <div class="seller-box"><span class="avatar">${escapeHtml(product.seller.studentId.slice(0, 1))}</span><div><strong>${escapeHtml(product.seller.name)}</strong><small>${escapeHtml(product.seller.studentId)} · 校內面交</small></div></div>
        </div>
      </div>
      <section class="product-contact-section" id="detailContactSection">
        <div class="detail-contact-loading"><span class="spinner"></span><p>正在載入買賣留言區…</p></div>
      </section>`;
    openModal('detailModal');
    if (state.user) await loadProductContact(product.id);
    else renderDetailContactGuest();
    await Promise.all([loadProducts(), loadAnalytics()]);
  } catch (error) {
    toast(error.message, 'error');
  }
}

function renderDetailContactGuest() {
  const section = $('#detailContactSection');
  if (!section) return;
  section.innerHTML = `
    <div class="detail-contact-heading"><div><span class="eyebrow">BUYER & SELLER MESSAGE</span><h3>買賣家留言區</h3><p>留言只會顯示給此商品的買家與賣家。</p></div></div>
    <div class="detail-login-box"><span>🔒</span><div><strong>登入後即可留言詢問</strong><p>註冊只需要學號與密碼，不需要電子信箱。</p></div><button class="primary-btn" data-open-auth>登入／註冊</button></div>`;
}

async function loadProductContact(productId, conversationId = null) {
  if (!state.user) return renderDetailContactGuest();
  try {
    const query = conversationId ? `?conversationId=${conversationId}` : '';
    const data = await api(`/api/products/${productId}/contact${query}`);
    state.detailContactData = data;
    state.detailConversationId = data.activeConversation?.id || null;
    renderDetailContact();
    requestAnimationFrame(() => {
      const box = $('#detailChatMessages');
      if (box) box.scrollTop = box.scrollHeight;
    });
  } catch (error) {
    const section = $('#detailContactSection');
    if (section) section.innerHTML = `<div class="empty-inline">${escapeHtml(error.message)}</div>`;
  }
}

function renderDetailContact() {
  const section = $('#detailContactSection');
  const data = state.detailContactData;
  if (!section || !data) return;

  const product = data.product;
  const heading = `
    <div class="detail-contact-heading">
      <div><span class="eyebrow">BUYER & SELLER MESSAGE</span><h3>買賣家留言區</h3><p>討論商品狀況、面交時間與地點，訊息會存進資料庫。</p></div>
      <span class="private-badge">🔒 私人對話</span>
    </div>`;

  if (data.role === 'seller') {
    const conversations = data.conversations || [];
    if (!conversations.length) {
      section.innerHTML = `${heading}<div class="detail-chat-empty"><span>💬</span><h4>目前還沒有買家留言</h4><p>買家從此商品頁留言後，會顯示在這裡。</p></div>`;
      return;
    }
    section.innerHTML = `${heading}
      <div class="product-contact-workspace seller-mode">
        <div class="product-buyer-list">
          <strong>詢問此商品的買家</strong>
          ${conversations.map(item => `
            <button class="product-buyer-item ${item.id === state.detailConversationId ? 'active' : ''}" data-detail-conversation="${item.id}">
              <span class="avatar small-avatar">${escapeHtml(item.buyer.studentId.slice(0, 1))}</span>
              <span><b>${escapeHtml(item.buyer.name)}</b><small>${escapeHtml(item.buyer.studentId)}</small><em>${escapeHtml(item.lastMessage || '尚未傳送訊息')}</em></span>
            </button>`).join('')}
        </div>
        ${detailChatPanelMarkup(product, data.activeConversation, data.messages, true)}
      </div>`;
    return;
  }

  const canStart = product.status !== '已售出' || Boolean(data.activeConversation);
  section.innerHTML = `${heading}
    <div class="buyer-contact-intro"><span class="avatar">${escapeHtml(product.seller.studentId.slice(0, 1))}</span><div><strong>留言給 ${escapeHtml(product.seller.name)}</strong><small>賣家學號：${escapeHtml(product.seller.studentId)}</small></div></div>
    ${canStart
      ? detailChatPanelMarkup(product, data.activeConversation, data.messages, false)
      : '<div class="detail-chat-empty"><span>✓</span><h4>商品已售出</h4><p>目前無法建立新的買賣聯絡。</p></div>'}`;
}

function detailChatPanelMarkup(product, activeConversation, messages, sellerMode) {
  if (sellerMode && !activeConversation) {
    return '<div class="detail-chat-empty"><span>←</span><h4>選擇一位買家</h4><p>選擇左側紀錄後即可查看與回覆。</p></div>';
  }
  return `
    <div class="detail-chat-panel">
      <div class="detail-chat-messages" id="detailChatMessages">${chatMessagesMarkup(messages || [])}</div>
      <form class="detail-chat-form" id="detailChatForm" data-product-id="${product.id}">
        <textarea id="detailChatInput" rows="2" maxlength="500" placeholder="例如：請問商品還在嗎？明天下午可以面交嗎？" required></textarea>
        <button class="primary-btn" type="submit">傳送留言</button>
      </form>
    </div>`;
}

function updateImagePreview() {
  const preview = $('#imagePreview');
  if (state.pendingImageData) {
    preview.innerHTML = `<img src="${state.pendingImageData}" alt="商品圖片預覽">`;
    preview.classList.add('has-image');
    $('#removeImageBtn').classList.remove('hidden');
  } else {
    preview.innerHTML = '<span>📷</span><small>尚未選擇圖片</small>';
    preview.classList.remove('has-image');
    $('#removeImageBtn').classList.add('hidden');
  }
}

function openProductForm(product = null) {
  if (!requireLogin('上架商品')) return;
  $('#productForm').reset();
  $('#productId').value = product?.id || '';
  $('#productModalTitle').textContent = product ? '編輯商品' : '新增商品';
  $('#productSubmitBtn').textContent = product ? '儲存修改' : '儲存商品';
  state.pendingImageData = product?.imageData || '';
  updateImagePreview();
  if (product) {
    $('#productName').value = product.name;
    $('#productCategory').value = product.category;
    $('#productPrice').value = product.price;
    $('#productCondition').value = product.condition;
    $('#productStatus').value = product.status;
    $('#productEmoji').value = product.emoji;
    $('#productDescription').value = product.description;
  }
  openModal('productModal');
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('無法讀取圖片'));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('圖片格式無法讀取'));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔案');
  if (file.size > 12 * 1024 * 1024) throw new Error('原始圖片請勿超過 12 MB');
  const image = await fileToImage(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));
  let quality = 0.84;
  let result = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    result = canvas.toDataURL('image/jpeg', quality);
    if (result.length <= 2_600_000) break;
    width = Math.max(480, Math.round(width * 0.82));
    height = Math.max(480, Math.round(height * 0.82));
    quality = Math.max(0.62, quality - 0.07);
  }
  if (result.length > 2_800_000) throw new Error('圖片壓縮後仍太大，請換一張圖片');
  return result;
}

function bindEvents() {
  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      event.preventDefault();
      switchView(viewButton.dataset.view);
      return;
    }
    const openAuth = event.target.closest('[data-open-auth]');
    if (openAuth) {
      openModal('authModal');
      return;
    }
    const detailConversation = event.target.closest('[data-detail-conversation]');
    if (detailConversation && state.detailProductId) {
      loadProductContact(state.detailProductId, Number(detailConversation.dataset.detailConversation));
      return;
    }
    const conversationButton = event.target.closest('[data-conversation-id]');
    if (conversationButton) {
      openConversation(Number(conversationButton.dataset.conversationId));
      return;
    }
    const openProduct = event.target.closest('[data-open-product]');
    if (openProduct) {
      openProductDetail(Number(openProduct.dataset.openProduct));
      return;
    }
    const closeButton = event.target.closest('[data-close]');
    if (closeButton) {
      closeModal(closeButton.dataset.close);
      return;
    }
    const productCardNode = event.target.closest('.product-card');
    if (productCardNode) openProductDetail(Number(productCardNode.dataset.productId));
  });

  document.addEventListener('submit', async event => {
    if (event.target.id !== 'detailChatForm') return;
    event.preventDefault();
    if (!requireLogin('傳送留言') || !state.detailProductId) return;
    const input = $('#detailChatInput');
    const content = input.value.trim();
    if (!content) return;
    try {
      const data = await api(`/api/products/${state.detailProductId}/contact/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, conversationId: state.detailConversationId })
      });
      input.value = '';
      state.detailConversationId = data.conversationId;
      await Promise.all([
        loadProductContact(state.detailProductId, data.conversationId),
        loadConversations(data.conversationId)
      ]);
      toast('留言已傳送');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $$('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => {
    if (event.target === backdrop) closeModal(backdrop.id);
  }));

  $('#mobileMenuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#profileBtn').addEventListener('click', event => {
    event.stopPropagation();
    $('#profileMenu').classList.toggle('hidden');
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#profileMenu') && !event.target.closest('#profileBtn')) $('#profileMenu').classList.add('hidden');
  });
  $('#profileMenuLogin').addEventListener('click', () => openModal('authModal'));
  $('#noticeLoginBtn').addEventListener('click', () => openModal('authModal'));
  $('#contactLoginBtn').addEventListener('click', () => openModal('authModal'));
  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch {}
    clearSession();
    $('#profileMenu').classList.add('hidden');
  });

  $('#quickAddBtn').addEventListener('click', () => openProductForm());
  $('#openProductModalBtn').addEventListener('click', () => openProductForm());

  $$('.tab-btn').forEach(button => button.addEventListener('click', () => {
    $$('.tab-btn').forEach(node => node.classList.toggle('active', node === button));
    const login = button.dataset.authTab === 'login';
    $('#loginForm').classList.toggle('hidden', !login);
    $('#registerForm').classList.toggle('hidden', login);
  }));

  $('#loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: $('#loginIdentifier').value, password: $('#loginPassword').value })
      });
      setSession(data.token, data.user);
      closeModal('authModal');
      toast(`歡迎回來，${data.user.name}`);
      await Promise.all([loadMyProducts(), loadMessages(), loadConversations()]);
      if (state.detailProductId && !$('#detailModal').classList.contains('hidden')) await loadProductContact(state.detailProductId);
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('#registerForm').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: $('#registerName').value,
          studentId: $('#registerStudentId').value,
          password: $('#registerPassword').value
        })
      });
      setSession(data.token, data.user);
      closeModal('authModal');
      toast('註冊成功，已自動登入');
      await Promise.all([loadMyProducts(), loadConversations()]);
      if (state.detailProductId && !$('#detailModal').classList.contains('hidden')) await loadProductContact(state.detailProductId);
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  const debounce = (fn, delay = 280) => {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
  };
  $('#searchInput').addEventListener('input', debounce(loadProducts));
  $('#categoryFilter').addEventListener('change', loadProducts);
  $('#sortFilter').addEventListener('change', loadProducts);
  $('#clearFilterBtn').addEventListener('click', () => {
    $('#searchInput').value = '';
    $('#categoryFilter').value = 'all';
    $('#sortFilter').value = 'newest';
    loadProducts();
  });

  $('#productImage').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      $('#imagePreview').innerHTML = '<span class="spinner"></span><small>正在處理圖片…</small>';
      state.pendingImageData = await compressImage(file);
      updateImagePreview();
      toast('圖片已加入');
    } catch (error) {
      state.pendingImageData = '';
      updateImagePreview();
      toast(error.message, 'error');
    } finally {
      event.target.value = '';
    }
  });

  $('#removeImageBtn').addEventListener('click', () => {
    state.pendingImageData = '';
    updateImagePreview();
  });

  $('#productForm').addEventListener('submit', async event => {
    event.preventDefault();
    const id = $('#productId').value;
    const payload = {
      name: $('#productName').value,
      category: $('#productCategory').value,
      price: Number($('#productPrice').value),
      condition: $('#productCondition').value,
      status: $('#productStatus').value,
      emoji: $('#productEmoji').value,
      imageData: state.pendingImageData,
      description: $('#productDescription').value
    };
    try {
      const button = $('#productSubmitBtn');
      button.disabled = true;
      button.textContent = '儲存中…';
      await api(id ? `/api/products/${id}` : '/api/products', {
        method: id ? 'PUT' : 'POST', body: JSON.stringify(payload)
      });
      closeModal('productModal');
      toast(id ? '商品已更新' : '商品已成功上架');
      await Promise.all([loadProducts(), loadMyProducts(), loadAnalytics()]);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      $('#productSubmitBtn').disabled = false;
      $('#productSubmitBtn').textContent = id ? '儲存修改' : '儲存商品';
    }
  });

  $('#myProductsBody').addEventListener('click', async event => {
    const edit = event.target.closest('.edit-product');
    const remove = event.target.closest('.delete-product');
    if (edit) {
      const product = state.myProducts.find(item => item.id === Number(edit.dataset.id));
      if (product) openProductForm(product);
    }
    if (remove) {
      const product = state.myProducts.find(item => item.id === Number(remove.dataset.id));
      if (!product || !confirm(`確定要刪除「${product.name}」嗎？`)) return;
      try {
        await api(`/api/products/${product.id}`, { method: 'DELETE' });
        toast('商品已刪除');
        await Promise.all([loadProducts(), loadMyProducts(), loadAnalytics(), loadConversations()]);
      } catch (error) {
        toast(error.message, 'error');
      }
    }
  });

  $('#messageContent').addEventListener('input', () => {
    $('#messageCounter').textContent = `${$('#messageContent').value.length} / 200`;
  });
  $('#messageFilter').addEventListener('change', loadMessages);
  $('#messageForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!requireLogin('送出留言')) return;
    try {
      await api('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ type: $('#messageType').value, content: $('#messageContent').value })
      });
      $('#messageContent').value = '';
      $('#messageCounter').textContent = '0 / 200';
      toast('留言已送出');
      await loadMessages();
    } catch (error) {
      toast(error.message, 'error');
    }
  });
  $('#messageList').addEventListener('click', async event => {
    const button = event.target.closest('.delete-message');
    if (!button || !confirm('確定要刪除這則留言嗎？')) return;
    try {
      await api(`/api/messages/${button.dataset.id}`, { method: 'DELETE' });
      toast('留言已刪除');
      await loadMessages();
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('#chatForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!state.activeConversationId || !requireLogin('傳送訊息')) return;
    const input = $('#chatInput');
    const content = input.value.trim();
    if (!content) return;
    try {
      await api(`/api/conversations/${state.activeConversationId}/messages`, {
        method: 'POST', body: JSON.stringify({ content })
      });
      input.value = '';
      await loadConversations(state.activeConversationId);
    } catch (error) {
      toast(error.message, 'error');
    }
  });
}

init();
