// ==========================================================================
//  ARIYAK STORE - MAIN APPLICATION LOGIC (js/app.js)
// ==========================================================================

// Safe Language Resolution (Strict Khmer or English)
let safeLang = localStorage.getItem('ariyak_lang');
if (safeLang !== 'km' && safeLang !== 'en') {
    safeLang = 'km';
    localStorage.setItem('ariyak_lang', 'km');
}

// Safe Currency Resolution (USD or KHR)
let safeCurrency = localStorage.getItem('ariyak_currency');
if (safeCurrency !== 'USD' && safeCurrency !== 'KHR') {
    safeCurrency = 'USD';
    localStorage.setItem('ariyak_currency', 'USD');
}

// Detect current hosted URL for Mini App button
const detectedMiniAppUrl = (window.location.protocol.startsWith('http'))
    ? window.location.origin + window.location.pathname
    : 'https://romthanun.github.io/Ministore/';

// Global Application State & Telegram Bot Config
let appState = {
    lang: safeLang,
    currency: safeCurrency,
    bakongId: localStorage.getItem('ariyak_bakong_id') || 'ariyak_store@aclb',
    botUsername: 'MiniStoreKH_bot',
    botToken: '9174197595:AAFy9sSS8DiGEjVwJee2OTAHdP45bsDVJIE',
    adminTelegram: localStorage.getItem('ariyak_admin_username') || 'MiniStoreKH_bot',
    adminChatId: localStorage.getItem('ariyak_admin_chat_id') || '',
    miniAppUrl: localStorage.getItem('ariyak_miniapp_url') || detectedMiniAppUrl,
    currentCategory: 'all',
    filterInStockOnly: false,
    activeProduct: null,
    selectedPlanIndex: 0,
    timerInterval: null,
    lastUpdateId: parseInt(localStorage.getItem('ariyak_last_update_id') || '0', 10)
};

// Saved Orders from LocalStorage
let orderHistory = [];
try {
    orderHistory = JSON.parse(localStorage.getItem('ariyak_orders') || '[]');
} catch (e) {
    orderHistory = [];
}

// Stock Overrides (Persisted in LocalStorage)
let savedStock = {};
try {
    savedStock = JSON.parse(localStorage.getItem('ariyak_stock_overrides') || '{}');
} catch (e) {
    savedStock = {};
}

// Check if product is in stock
function isProductInStock(productId) {
    if (savedStock && Object.prototype.hasOwnProperty.call(savedStock, productId)) {
        return savedStock[productId];
    }
    if (typeof PRODUCTS !== 'undefined') {
        const p = PRODUCTS.find(item => item.id === productId);
        return p ? p.defaultInStock : true;
    }
    return true;
}

// Toggle product stock state (Settings / Admin)
function toggleProductStock(productId) {
    const current = isProductInStock(productId);
    savedStock[productId] = !current;
    localStorage.setItem('ariyak_stock_overrides', JSON.stringify(savedStock));

    renderProductsList();
    renderStockManagementList();

    const p = (typeof PRODUCTS !== 'undefined') ? PRODUCTS.find(item => item.id === productId) : null;
    const statusName = savedStock[productId] ? 'In Stock (មានក្នុងស្តុក)' : 'Out of Stock (អស់ស្តុក)';
    showToast(`${p ? p.name : productId}: ${statusName}`);

    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
}

// Format Price based on active Currency
function formatPrice(amountUsd) {
    const rate = (typeof KHR_RATE !== 'undefined') ? KHR_RATE : 4100;
    if (appState.currency === 'KHR') {
        const khr = Math.round(amountUsd * rate);
        return `${khr.toLocaleString()} ៛`;
    }
    return `$${amountUsd.toFixed(2)}`;
}

// ==========================================================================
//  TELEGRAM BOT: MENU BUTTON SETUP & AUTO-REPLY TO /start WITH STORE BUTTON
// ==========================================================================

// 1-Click Configure Bot Menu Button & Welcome Store Button on @MiniStoreKH_bot
async function configureBotMenuButton() {
    const urlInput = document.getElementById('settingMiniAppUrl');
    const cleanUrl = (urlInput && urlInput.value.trim()) ? urlInput.value.trim() : appState.miniAppUrl;

    if (!cleanUrl.startsWith('https://')) {
        alert('Telegram Mini Apps require an https:// URL (for example: https://romthanun.github.io/Ministore/)');
        return;
    }

    appState.miniAppUrl = cleanUrl;
    localStorage.setItem('ariyak_miniapp_url', cleanUrl);

    try {
        // 1. Set the persistent bottom-left Menu Button in @MiniStoreKH_bot to launch the WebApp
        const menuRes = await fetch(`https://api.telegram.org/bot${appState.botToken}/setChatMenuButton`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                menu_button: {
                    type: 'web_app',
                    text: '🛍️ Open Store',
                    web_app: { url: cleanUrl }
                }
            })
        });
        const menuData = await menuRes.json();

        // 2. Register Bot Commands (/start, /store, /support)
        await fetch(`https://api.telegram.org/bot${appState.botToken}/setMyCommands`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                commands: [
                    { command: 'start', description: '🛍️ បើកហាង Ariyak Mini Store (Open Store)' },
                    { command: 'store', description: '💎 មើលបញ្ជីទំនិញ AI & VIP Accounts' },
                    { command: 'support', description: '💬 ទាក់ទង Admin ២៤/៧' }
                ]
            })
        });

        // 3. Send a pinned store launch card with an inline WebApp button to Admin chat
        const targetChatId = await syncAdminChatId();
        if (targetChatId) {
            await sendStoreLaunchMessage(targetChatId, cleanUrl);
        }

        if (menuData.ok) {
            showToast('✅ បានភ្ជាប់ប៊ូតុង Mini Store ទៅ @MiniStoreKH_bot ជោគជ័យ!');
        } else {
            showToast('⚠️ Bot API: ' + (menuData.description || 'Check URL'));
        }
    } catch (err) {
        console.error('configureBotMenuButton error:', err);
        showToast('❌ មិនអាចភ្ជាប់ទៅ Telegram API បានទេ');
    }
}

// Sends a rich message in the bot chat with a clickable "🛍️ Open Ariyak Store" WebApp button
async function sendStoreLaunchMessage(chatId, storeUrl) {
    const urlToUse = storeUrl || appState.miniAppUrl;
    if (!urlToUse.startsWith('https://')) return;

    const welcomeHtml =
        `💎 <b>ស្វាគមន៍មកកាន់ ARIYAK STORE</b>\n` +
        `គណនី AI & VIP កម្រិត Premium (CapCut, Gemini, ChatGPT, Claude, Canva, Netflix...)\n\n` +
        `⚡ ដឹកជញ្ជូនរហ័ស • 🛡️ ធានាពេញគម្រោង • 🇰🇭 ស្កេន KHQR Bakong\n\n` +
        `👇 <b>ចុចប៊ូតុងខាងក្រោមដើម្បីបើកហាង និងទិញដោយស្វ័យប្រវត្តិ៖</b>`;

    try {
        await fetch(`https://api.telegram.org/bot${appState.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: welcomeHtml,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: '🛍️ បើកហាង Ariyak Store (Open Mini App)',
                                web_app: { url: urlToUse }
                            }
                        ],
                        [
                            {
                                text: '🌐 បើកលើ Browser ធម្មតា',
                                url: urlToUse
                            }
                        ]
                    ]
                }
            })
        });
    } catch (e) {
        console.warn('sendStoreLaunchMessage warning:', e);
    }
}

// Sync Admin Chat ID & auto-respond to new /start or /store messages in @MiniStoreKH_bot
async function syncAdminChatId() {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    try {
        const res = await fetch(`https://api.telegram.org/bot${appState.botToken}/getUpdates?limit=15`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
            for (const item of data.result) {
                const msg = item.message;
                if (msg && msg.chat && msg.chat.id) {
                    if (!appState.adminChatId) {
                        appState.adminChatId = String(msg.chat.id);
                        localStorage.setItem('ariyak_admin_chat_id', appState.adminChatId);
                    }
                    // If a user sent /start or /store and we haven't replied to this update_id yet
                    if (item.update_id > appState.lastUpdateId && typeof msg.text === 'string') {
                        const txt = msg.text.trim().toLowerCase();
                        if (txt === '/start' || txt === '/store' || txt.startsWith('/start ')) {
                            appState.lastUpdateId = item.update_id;
                            localStorage.setItem('ariyak_last_update_id', String(item.update_id));
                            sendStoreLaunchMessage(msg.chat.id, appState.miniAppUrl);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.warn('Could not fetch updates from Telegram Bot API:', err);
    }

    if (!appState.adminChatId && tgUser?.id) {
        appState.adminChatId = String(tgUser.id);
    }
    return appState.adminChatId;
}

// Send instant order notification to @MiniStoreKH_bot
async function sendOrderToTelegramBot(orderObj) {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const customerName = tgUser
        ? `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim()
        : 'Web Customer';
    const customerHandle = tgUser?.username ? `@${tgUser.username}` : 'No username';
    const customerId = tgUser?.id || 'N/A';

    const textMessage =
        `🛒 <b>NEW ORDER - ARIYAK STORE</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Order Ref:</b> <code>${orderObj.id}</code>\n` +
        `📦 <b>Product:</b> ${orderObj.productName}\n` +
        `⏳ <b>Plan:</b> ${orderObj.planName}\n` +
        `💰 <b>Amount:</b> ${orderObj.amount}\n` +
        `📅 <b>Date:</b> ${orderObj.date}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Customer:</b> ${customerName} (${customerHandle})\n` +
        `🔢 <b>Telegram ID:</b> <code>${customerId}</code>\n` +
        `💳 <b>Bakong ID:</b> <code>${appState.bakongId}</code>\n\n` +
        `<i>⚠️ Waiting for payment screenshot verification.</i>`;

    const targetChatId = await syncAdminChatId();
    if (!targetChatId) return;

    try {
        await fetch(`https://api.telegram.org/bot${appState.botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: targetChatId,
                text: textMessage,
                parse_mode: 'HTML'
            })
        });

        if (tgUser?.id && String(tgUser.id) !== String(targetChatId)) {
            await fetch(`https://api.telegram.org/bot${appState.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: tgUser.id,
                    text: `✅ <b>Order Received (${orderObj.id})</b>\n\nThank you for ordering <b>${orderObj.productName} (${orderObj.planName})</b> — <b>${orderObj.amount}</b>.\n\n📸 Please reply here with your <b>payment screenshot</b> so Admin can verify and send your login credentials!`,
                    parse_mode: 'HTML'
                })
            });
        }
    } catch (err) {
        console.error('Telegram Bot sendMessage error:', err);
    }
}

// ==========================================================================
//  PRODUCTS CATALOG RENDERING & FILTERING
// ==========================================================================
function renderProductsList() {
    try {
        if (typeof PRODUCTS === 'undefined' || typeof i18n === 'undefined') return;

        const grid = document.getElementById('productsGrid');
        if (!grid) return;

        const searchInput = document.getElementById('searchInput');
        const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const lang = appState.lang || 'km';

        const filtered = PRODUCTS.filter(p => {
            const matchesCat = appState.currentCategory === 'all' || p.category === appState.currentCategory;
            const descText = (p.desc && p.desc[lang]) ? p.desc[lang].toLowerCase() : (p.desc && p.desc.km ? p.desc.km.toLowerCase() : '');
            const nameText = p.name.toLowerCase();
            const matchesSearch = !searchVal || nameText.includes(searchVal) || descText.includes(searchVal);
            const inStock = isProductInStock(p.id);
            const matchesStockFilter = !appState.filterInStockOnly || inStock;

            return matchesCat && matchesSearch && matchesStockFilter;
        });

        const counterEl = document.getElementById('itemCounter');
        if (counterEl) {
            counterEl.textContent = `${filtered.length} items`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px 10px; color: var(--text-muted);">
                    <div style="font-size: 40px; margin-bottom: 8px;">🔍</div>
                    <p>${lang === 'km' ? 'រកមិនឃើញទំនិញទេ' : 'No products found'}</p>
                </div>
            `;
            return;
        }

        const dictionary = i18n[lang] || i18n.km;

        grid.innerHTML = filtered.map(p => {
            const basePrice = p.plans[0].priceUsd;
            const inStock = isProductInStock(p.id);
            const desc = (p.desc && p.desc[lang]) ? p.desc[lang] : p.desc.km;

            const stockPillHtml = inStock
                ? `<span class="stock-status-pill stock-in"><span class="status-dot-sm"></span><span class="stock-label-text">${dictionary.inStockLabel}</span></span>`
                : `<span class="stock-status-pill stock-out"><span class="status-dot-sm"></span><span class="stock-label-text">${dictionary.outStockLabel}</span></span>`;

            const actionBtnHtml = inStock
                ? `<button type="button" class="buy-mini-btn" data-buy-id="${p.id}">${dictionary.buyNow}</button>`
                : `<button type="button" class="buy-mini-btn btn-out-stock" disabled>${dictionary.soldOut}</button>`;

            return `
                <div class="product-card ${!inStock ? 'card-out-stock' : ''}" data-product-id="${p.id}" onclick="openProductModal('${p.id}')">
                    <div class="card-header-icon">
                        <div class="prod-icon-box">${p.icon}</div>
                        <span class="prod-tag ${p.tagClass}">${p.tag}</span>
                    </div>
                    <div>
                        ${stockPillHtml}
                        <div class="prod-title">${p.name}</div>
                        <div class="prod-snippet">${desc}</div>
                    </div>
                    <div class="card-footer-price">
                        <div class="price-stack">
                            <span class="price-starting">${dictionary.startingAt}</span>
                            <span class="price-figure">${formatPrice(basePrice)}</span>
                        </div>
                        ${actionBtnHtml}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('renderProductsList error:', e);
    }
}

function filterProducts() {
    renderProductsList();
}

function toggleInStockFilter() {
    appState.filterInStockOnly = !appState.filterInStockOnly;
    const btn = document.getElementById('inStockFilterBtn');
    if (btn) {
        btn.classList.toggle('active', appState.filterInStockOnly);
    }
    renderProductsList();
}

function selectCategory(cat, btn) {
    document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    appState.currentCategory = cat;
    renderProductsList();
}

// ==========================================================================
//  UNIFIED MODAL: PRODUCT DETAILS + LIVE EXACT KHQR CODE
// ==========================================================================
function openProductModal(productId) {
    if (typeof PRODUCTS === 'undefined') return;
    appState.activeProduct = PRODUCTS.find(p => p.id === productId);
    if (!appState.activeProduct) return;
    appState.selectedPlanIndex = 0;

    const p = appState.activeProduct;
    const lang = appState.lang || 'km';
    const dictionary = (typeof i18n !== 'undefined' && i18n[lang]) ? i18n[lang] : { inStockLabel: 'មានក្នុងស្តុក', outStockLabel: 'អស់ពីស្តុក' };
    const inStock = isProductInStock(p.id);

    // Populate Details
    document.getElementById('modalProductIcon').textContent = p.icon;
    document.getElementById('modalProductName').textContent = p.name;
    document.getElementById('modalProductBadge').textContent = p.tag;
    document.getElementById('modalProductBadge').className = `prod-tag ${p.tagClass}`;

    const stockEl = document.getElementById('modalProductStock');
    stockEl.className = `stock-status-pill ${inStock ? 'stock-in' : 'stock-out'}`;
    stockEl.innerHTML = `<span class="status-dot-sm"></span><span class="stock-text">${inStock ? dictionary.inStockLabel : dictionary.outStockLabel}</span>`;

    document.getElementById('modalProductDesc').textContent = (p.desc && p.desc[lang]) ? p.desc[lang] : p.desc.km;

    // Features List
    const featuresUl = document.getElementById('modalProductFeatures');
    const feats = (p.features && p.features[lang]) ? p.features[lang] : p.features.km;
    featuresUl.innerHTML = feats.map(f => `<li>${f}</li>`).join('');

    // Order Reference & Bakong ID
    const randomCode = '#AK-' + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('displayOrderRef').textContent = randomCode;
    document.getElementById('displayBakongId').textContent = appState.bakongId;

    // Render Plans & Dynamic QR
    renderModalPlans();
    updateModalQR();

    // 15-Minute Countdown Timer
    startCountdownTimer(15 * 60);

    openModal('productModal');

    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
}

function renderModalPlans() {
    const p = appState.activeProduct;
    if (!p) return;
    const lang = appState.lang || 'km';
    const plansDiv = document.getElementById('modalPlansList');

    plansDiv.innerHTML = p.plans.map((plan, idx) => {
        const isSelected = idx === appState.selectedPlanIndex;
        const label = lang === 'km' ? plan.labelKm : plan.labelEn;
        return `
            <div class="plan-box ${isSelected ? 'selected' : ''}" onclick="pickPlan(${idx})">
                <div class="plan-box-title">${label}</div>
                <div class="plan-box-price">${formatPrice(plan.priceUsd)}</div>
            </div>
        `;
    }).join('');
}

function pickPlan(idx) {
    appState.selectedPlanIndex = idx;
    renderModalPlans();
    updateModalQR();
    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}

// Generate & Update Live Exact KHQR
function updateModalQR() {
    const p = appState.activeProduct;
    if (!p) return;
    const inStock = isProductInStock(p.id);
    const qrSection = document.getElementById('modalQRSection');
    const outStockBanner = document.getElementById('modalOutStockBanner');

    if (!inStock) {
        if (qrSection) qrSection.style.display = 'none';
        if (outStockBanner) outStockBanner.style.display = 'block';
        return;
    }

    if (qrSection) qrSection.style.display = 'flex';
    if (outStockBanner) outStockBanner.style.display = 'none';

    const plan = p.plans[appState.selectedPlanIndex];
    const lang = appState.lang || 'km';
    const planLabel = lang === 'km' ? plan.labelKm : plan.labelEn;

    const qrSubEl = document.getElementById('qrPlanSubtitle');
    if (qrSubEl) {
        qrSubEl.textContent = `${p.name} • ${planLabel}`;
    }

    const rate = (typeof KHR_RATE !== 'undefined') ? KHR_RATE : 4100;
    const exactUsd = plan.priceUsd;
    const exactKhr = Math.round(exactUsd * rate);

    if (appState.currency === 'USD') {
        document.getElementById('qrExactAmountDisplay').textContent = `$${exactUsd.toFixed(2)}`;
        document.getElementById('qrDualCurrencyDisplay').textContent = `≈ ${exactKhr.toLocaleString()} KHR (៛)`;
    } else {
        document.getElementById('qrExactAmountDisplay').textContent = `${exactKhr.toLocaleString()} ៛`;
        document.getElementById('qrDualCurrencyDisplay').textContent = `≈ $${exactUsd.toFixed(2)} USD`;
    }

    const qrContainer = document.getElementById('qrCodeArea');
    qrContainer.innerHTML = '';

    if (typeof generateExactKHQRPayload === 'function' && typeof QRCode !== 'undefined') {
        const qrPayload = generateExactKHQRPayload(appState.bakongId, exactUsd, appState.currency);
        new QRCode(qrContainer, {
            text: qrPayload,
            width: 220,
            height: 220,
            colorDark: '#0b0e17',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }
}

function startCountdownTimer(seconds) {
    clearInterval(appState.timerInterval);
    let timeLeft = seconds;
    const el = document.getElementById('qrCountdownClock');

    function tick() {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        if (el) el.textContent = `${m}:${s}`;
        if (timeLeft <= 0) {
            clearInterval(appState.timerInterval);
            if (el) el.textContent = 'Expired';
            showToast('⏰ QR Code has expired. Please try again.');
        }
        timeLeft--;
    }
    tick();
    appState.timerInterval = setInterval(tick, 1000);
}

// ==========================================================================
//  PAYMENT SUBMISSION & ORDERS LOGIC
// ==========================================================================
async function completePayment() {
    if (!appState.activeProduct) return;
    const p = appState.activeProduct;
    const plan = p.plans[appState.selectedPlanIndex];
    const orderRef = document.getElementById('displayOrderRef').textContent;
    const lang = appState.lang || 'km';

    const newOrder = {
        id: orderRef,
        productName: p.name,
        planName: lang === 'km' ? plan.labelKm : plan.labelEn,
        amount: formatPrice(plan.priceUsd),
        date: new Date().toLocaleDateString(),
        status: 'pending'
    };

    orderHistory.unshift(newOrder);
    localStorage.setItem('ariyak_orders', JSON.stringify(orderHistory));

    closeModal('productModal');

    // Push instant notification to @MiniStoreKH_bot
    sendOrderToTelegramBot(newOrder);

    const successText = lang === 'km'
        ? `✅ បានកត់ត្រាការទូទាត់សម្រាប់ ${p.name} (${newOrder.id})! កំពុងភ្ជាប់ទៅ @${appState.botUsername}...`
        : `✅ Payment recorded for ${p.name} (${newOrder.id})! Connecting to @${appState.botUsername}...`;

    showToast(successText);

    if (window.Telegram?.WebApp?.showPopup) {
        Telegram.WebApp.HapticFeedback?.notificationOccurred('success');
        Telegram.WebApp.showPopup({
            title: lang === 'km' ? '✅ ការបញ្ជាទិញជោគជ័យ' : '✅ Order Submitted',
            message: `${newOrder.productName} (${newOrder.planName})\nAmount: ${newOrder.amount}\nRef: ${newOrder.id}\n\nPlease send your payment screenshot to @${appState.botUsername} on Telegram to receive your login credentials.`,
            buttons: [
                { id: 'send_proof', type: 'default', text: '📸 Send Screenshot' },
                { id: 'close', type: 'cancel' }
            ]
        }, (buttonId) => {
            if (buttonId === 'send_proof') {
                openAdminTelegram(newOrder);
            }
        });
    }

    renderOrdersPage();
}

function renderOrdersPage() {
    const container = document.getElementById('ordersListContainer');
    if (!container) return;
    const lang = appState.lang || 'km';
    const dictionary = (typeof i18n !== 'undefined' && i18n[lang]) ? i18n[lang] : { orderEmpty: 'No orders yet', orderPending: 'Pending' };

    if (!orderHistory || orderHistory.length === 0) {
        container.innerHTML = `
            <div class="empty-orders">
                <div class="empty-orders-icon">📦</div>
                <p style="font-size:14px; font-weight:600; margin-bottom:8px;">${dictionary.orderEmpty}</p>
                <p style="font-size:12px; color:var(--text-muted);">${lang === 'km' ? 'ទំនិញដែលអ្នកបានទិញនឹងបង្ហាញនៅទីនេះ' : 'Your purchases will appear here.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = orderHistory.map((ord, idx) => {
        const statusBadge = ord.status === 'active'
            ? `<span class="order-status-badge status-active">Active</span>`
            : `<span class="order-status-badge status-pending">${dictionary.orderPending}</span>`;

        return `
            <div class="order-card">
                <div class="order-card-header">
                    <div>
                        <span style="font-size:12px; color:var(--text-muted);">${ord.date}</span>
                        <h4 style="font-size:15px; font-weight:700;">${ord.productName}</h4>
                    </div>
                    ${statusBadge}
                </div>
                <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">
                    ${ord.planName} • <strong style="color:var(--accent-green);">${ord.amount}</strong>
                </div>
                <div style="font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                    <span>Ref: <b style="color:var(--accent-amber);">${ord.id}</b></span>
                    <button type="button" class="buy-mini-btn" style="padding:4px 10px; font-size:10px;" onclick="openAdminTelegramByIndex(${idx})">
                        💬 Get Account
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openAdminTelegramByIndex(idx) {
    const ord = orderHistory[idx] || null;
    openAdminTelegram(ord);
}

// ==========================================================================
//  STOCK MANAGEMENT (FOR SETTINGS PAGE)
// ==========================================================================
function renderStockManagementList() {
    if (typeof PRODUCTS === 'undefined') return;
    const container = document.getElementById('stockManagementList');
    if (!container) return;

    container.innerHTML = PRODUCTS.map(p => {
        const inStock = isProductInStock(p.id);
        const btnClass = inStock ? 'btn-state-in' : 'btn-state-out';
        const label = inStock ? '🟢 In Stock (មានស្តុក)' : '🔴 Out of Stock (អស់)';

        return `
            <div class="stock-toggle-row">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span>${p.icon}</span>
                    <span style="font-size:13px; font-weight:600;">${p.name}</span>
                </div>
                <button type="button" class="stock-btn-action ${btnClass}" onclick="toggleProductStock('${p.id}')">
                    ${label}
                </button>
            </div>
        `;
    }).join('');
}

// ==========================================================================
//  PAGE SWITCHING & TELEGRAM DEEP-LINK NAVIGATION
// ==========================================================================
function switchPage(pageName, btn) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) targetPage.classList.add('active');
    if (btn) btn.classList.add('active');

    if (pageName === 'orders') renderOrdersPage();
    if (pageName === 'settings') renderStockManagementList();

    if (window.Telegram?.WebApp?.HapticFeedback) {
        Telegram.WebApp.HapticFeedback.selectionChanged();
    }
}

// Opens @MiniStoreKH_bot on Telegram Mobile, Desktop, or Web K
function openAdminTelegram(orderContext = null) {
    const cleanHandle = (appState.adminTelegram || appState.botUsername).replace(/^@/, '').trim();

    let tMeUrl = `https://t.me/${cleanHandle}`;
    if (orderContext && orderContext.id) {
        const cleanRef = orderContext.id.replace('#', '');
        tMeUrl = `https://t.me/${cleanHandle}?start=order_${cleanRef}`;
    }

    if (window.Telegram?.WebApp?.initData) {
        Telegram.WebApp.openTelegramLink(tMeUrl);
        return;
    }

    const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isDesktop) {
        const webKUrl = `https://web.telegram.org/k/#@${cleanHandle}`;
        window.open(webKUrl, '_blank');
    } else {
        window.open(tMeUrl, '_blank');
    }
}

// ==========================================================================
//  LANGUAGE & CURRENCY TOGGLE
// ==========================================================================
function toggleLanguage() {
    appState.lang = appState.lang === 'km' ? 'en' : 'km';
    localStorage.setItem('ariyak_lang', appState.lang);
    applyLanguage();
    renderProductsList();
    renderOrdersPage();
    showToast(appState.lang === 'km' ? '🇰🇭 បានប្តូរទៅជាភាសាខ្មែរ' : '🇬🇧 Switched to English');
}

function applyLanguage() {
    try {
        if (typeof i18n === 'undefined') return;
        const l = appState.lang || 'km';
        const d = i18n[l] || i18n.km;
        document.documentElement.lang = l;

        const langFlag = document.getElementById('langFlag');
        if (langFlag) langFlag.textContent = l === 'km' ? '🇰🇭' : '🇬🇧';

        const langText = document.getElementById('langText');
        if (langText) langText.textContent = l === 'km' ? 'ខ្មែរ' : 'EN';

        const topBrandSub = document.getElementById('topBrandSubtitle');
        if (topBrandSub) topBrandSub.textContent = d.brandSub;

        const heroBadge = document.getElementById('heroBadge');
        if (heroBadge) heroBadge.textContent = d.heroBadge;

        const heroTitle = document.getElementById('heroTitle');
        if (heroTitle) heroTitle.textContent = d.heroTitle;

        const heroSub = document.getElementById('heroSubtitle');
        if (heroSub) heroSub.textContent = d.heroSub;

        const pInstant = document.getElementById('perkInstant');
        if (pInstant) pInstant.textContent = d.instant;

        const pWarranty = document.getElementById('perkWarranty');
        if (pWarranty) pWarranty.textContent = d.warranty;

        const pKHQR = document.getElementById('perkKHQR');
        if (pKHQR) pKHQR.textContent = d.khqr;

        const searchInp = document.getElementById('searchInput');
        if (searchInp) searchInp.placeholder = d.searchPlaceholder;

        const stockFil = document.getElementById('stockFilterText');
        if (stockFil) stockFil.textContent = `${d.filterInStock} (${l === 'km' ? 'In Stock Only' : 'មានក្នុងស្តុក'})`;

        const catTitle = document.getElementById('catalogTitle');
        if (catTitle) catTitle.textContent = d.popularTitle;

        const sheetHeading = document.getElementById('modalSheetHeading');
        if (sheetHeading) sheetHeading.textContent = d.modalHeading;

        const featLabel = document.getElementById('modalFeaturesLabel');
        if (featLabel) featLabel.textContent = d.featuresLabel;

        const choosePlan = document.getElementById('modalChoosePlanLabel');
        if (choosePlan) choosePlan.textContent = d.chooseDuration;

        const timerLabel = document.getElementById('timerLabel');
        if (timerLabel) timerLabel.textContent = d.expiresIn;

        const qrNotice = document.getElementById('qrScanNotice');
        if (qrNotice) qrNotice.textContent = d.scanNote;

        const btnConfirm = document.getElementById('btnConfirmPaid');
        if (btnConfirm) btnConfirm.textContent = d.iHavePaid;

        const btnContact = document.getElementById('btnContactAdmin');
        if (btnContact) btnContact.textContent = d.contactAdmin;

        const nStore = document.getElementById('navStore');
        if (nStore) nStore.textContent = d.navStore;

        const nOrders = document.getElementById('navOrders');
        if (nOrders) nOrders.textContent = d.navOrders;

        const nSupport = document.getElementById('navSupport');
        if (nSupport) nSupport.textContent = d.navSupport;

        const nSettings = document.getElementById('navSettings');
        if (nSettings) nSettings.textContent = d.navSettings;

        const ordTitle = document.getElementById('ordersPageTitle');
        if (ordTitle) ordTitle.textContent = l === 'km' ? 'ប្រវត្តិនៃការបញ្ជាទិញ (My Orders)' : 'My Orders';

        const settLang = document.getElementById('settLangDisplay');
        if (settLang) settLang.textContent = l === 'km' ? '🇰🇭 ខ្មែរ (Khmer)' : '🇬🇧 English';
    } catch (e) {
        console.error('applyLanguage error:', e);
    }
}

function toggleCurrency() {
    appState.currency = appState.currency === 'USD' ? 'KHR' : 'USD';
    localStorage.setItem('ariyak_currency', appState.currency);

    document.getElementById('currencyBadge').textContent = appState.currency === 'USD' ? 'USD $' : 'KHR ៛';
    document.getElementById('settCurrDisplay').textContent = appState.currency === 'USD' ? 'USD ($)' : 'KHR (៛)';

    renderProductsList();
    if (appState.activeProduct) {
        renderModalPlans();
        updateModalQR();
    }
    showToast(`Currency: ${appState.currency}`);
}

function saveMerchantSettings() {
    const inputVal = document.getElementById('settingBakongId').value.trim();
    if (!inputVal) {
        alert('Please enter a valid Bakong ID / phone number.');
        return;
    }
    appState.bakongId = inputVal;
    localStorage.setItem('ariyak_bakong_id', inputVal);
    showToast('✅ Saved Bakong Account ID: ' + inputVal);
}

// ==========================================================================
//  MODAL HELPERS & TOAST
// ==========================================================================
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    document.body.style.overflow = '';
    clearInterval(appState.timerInterval);
}

function showToast(msg) {
    const bubble = document.getElementById('toastBubble');
    if (!bubble) return;
    document.getElementById('toastMsg').textContent = msg;
    bubble.classList.add('show');
    setTimeout(() => bubble.classList.remove('show'), 3000);
}

// ==========================================================================
//  EVENT DELEGATION & INITIALIZATION (GUARANTEES CLICKS ALWAYS WORK)
// ==========================================================================
function initAriyakStore() {
    // Initialize Telegram Mini App SDK
    if (window.Telegram?.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
        Telegram.WebApp.setHeaderColor?.('#0b0e17');
        Telegram.WebApp.setBackgroundColor?.('#0b0e17');
    }

    // Close modal when clicking dark backdrop
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    // Delegated click listener for product cards (works even if inline onclick is blocked)
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.product-card');
            if (card && card.dataset.productId) {
                openProductModal(card.dataset.productId);
            }
        });
    }

    // Populate initial settings fields
    const setBakong = document.getElementById('settingBakongId');
    if (setBakong) setBakong.value = appState.bakongId;

    const setMiniUrl = document.getElementById('settingMiniAppUrl');
    if (setMiniUrl) setMiniUrl.value = appState.miniAppUrl;

    const currBadge = document.getElementById('currencyBadge');
    if (currBadge) currBadge.textContent = appState.currency === 'USD' ? 'USD $' : 'KHR ៛';

    const settCurr = document.getElementById('settCurrDisplay');
    if (settCurr) settCurr.textContent = appState.currency === 'USD' ? 'USD ($)' : 'KHR (៛)';

    applyLanguage();
    renderProductsList();
    renderStockManagementList();
    syncAdminChatId();
}

// Run when DOM and fallback scripts finish loading
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initAriyakStore, 80));
} else {
    setTimeout(initAriyakStore, 80);
}