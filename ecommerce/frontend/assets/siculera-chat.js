/**
 * Siculera AI Chat Widget — v1.0.0
 * Self-contained IIFE — no external dependencies.
 * Embed: <script src="/assets/siculera-chat.js" defer></script>
 */
(function (window, document) {
  'use strict';

  /* ── Config ────────────────────────────────────────────────────────────── */
  // In production, use dedicated API host. In local dev, use localhost backend.
  const _devPorts = ['8080', '5500', '3000', '5173', '4173', '4000'];
  const _host = window.location.hostname;
  const _explicitApiBase = (window.SICULERA_API_BASE || '').trim();
  const _apiOrigin = _explicitApiBase
    ? _explicitApiBase.replace(/\/$/, '')
    : ((_host === 'localhost' || _host === '127.0.0.1' || _devPorts.includes(window.location.port))
      ? 'http://localhost:4000'
      : 'https://api.siculera.com');
  const API_BASE   = _apiOrigin + '/api/chat';
  const STORAGE_TOKEN   = 'siculera_chat_token';
  const STORAGE_CONSENT = 'siculera_chat_consent';

  const CHAT_LOCALES = {
    en: {
      bubbleAria: 'Open Siculera chat assistant',
      bubbleTitle: 'Chat with us',
      headerTitle: 'Siculera Assistant',
      headerSubtitle: 'AI-powered • Always available',
      expandAria: 'Expand chat',
      expandTitle: 'Expand',
      collapseTitle: 'Collapse',
      disclosureDismiss: 'Got it',
      consentBody: "To personalise your experience and remember our conversation, we'd like to save this chat session. You can decline and still use the assistant.",
      consentDecline: 'Decline (anonymous)',
      consentAccept: 'Accept & save chat',
      inputPlaceholder: 'Ask about our products, orders…',
      inputAria: 'Your message',
      sendAria: 'Send message',
      welcomeMessage: 'Welcome! 👋 I\'m your Siculera assistant. How can I help you today? I can help you explore our artisanal Sicilian products, check your order, or find the perfect gift.',
      quickReplyBrowseProducts: 'Browse products',
      quickReplyBrowseCatalog: 'Browse catalog',
      quickReplyCheckMyOrder: 'Check my order',
      quickReplyViewMyCart: 'View my cart',
      quickReplyProceedToCheckout: 'Proceed to checkout',
      quickReplyTrackOrder: 'Track my order',
      quickReplyTrackAnotherOrder: 'Track another order',
      quickReplySeeAllProducts: 'See all products',
      quickReplyShowGiftOptions: 'Show gift options',
      quickReplyViewShippingRates: 'View shipping rates',
      quickReplyGiftIdeas: 'Gift ideas',
      quickReplyTalkToHuman: 'Talk to a human',
      quickReplyBrowseMoreProducts: 'Browse more products',
      poweredBy: 'Powered by Siculera AI',
      errorConnection: 'I\'m sorry, something went wrong. Please try again or click "Talk to a human" for immediate help.',
      productCollectionLabel: 'Our artisanal collection — {count} product{plural}',
      addToCart: 'Add to Cart',
      addedToCart: 'Added to Cart!',
      addedQuantityToCart: 'Added {count}× to Cart!',
      outOfStock: 'Out of Stock',
      viewDetails: 'View Details →',
      backToProducts: '← Back to Products',
      quantityLabel: 'Quantity',
      yourCart: 'Your Cart',
      yourCartEmpty: 'Your cart is empty. Browse our products to get started!',
      cartTotalLabel: 'Total',
      continueShopping: '← Continue Shopping',
      proceedToCheckout: 'Proceed to Checkout →',
      cartTotalLabel: 'Total',
      itemCount: '{count} item{plural}',
      giftBadge: 'Gift',
      perfectGift: 'Perfect Gift',
      decrease: 'Decrease',
      increase: 'Increase',
      remove: 'Remove',
      emptyCartWarning: 'Your cart is empty. Add some products first!'
    },
    it: {
      bubbleAria: 'Apri l’assistente chat Siculera',
      bubbleTitle: 'Chatta con noi',
      headerTitle: 'Assistente Siculera',
      headerSubtitle: 'AI disponibile • Sempre pronta',
      expandAria: 'Espandi chat',
      expandTitle: 'Espandi',
      collapseTitle: 'Comprimi',
      disclosureDismiss: 'Ho capito',
      consentBody: "Per personalizzare la tua esperienza e ricordare la conversazione, vorremmo salvare questa sessione di chat. Puoi rifiutare e usare comunque l’assistente.",
      consentDecline: 'Rifiuta (anonimo)',
      consentAccept: 'Accetta e salva la chat',
      inputPlaceholder: 'Chiedi dei nostri prodotti, ordini…',
      inputAria: 'Il tuo messaggio',
      sendAria: 'Invia messaggio',
      welcomeMessage: 'Benvenuto! 👋 Sono il tuo assistente Siculera. Come posso aiutarti oggi? Posso aiutarti a scoprire i nostri prodotti artigianali siciliani, controllare il tuo ordine o trovare il regalo perfetto.',
      quickReplyBrowseProducts: 'Sfoglia prodotti',
      quickReplyBrowseCatalog: 'Sfoglia il catalogo',
      quickReplyCheckMyOrder: 'Controlla il mio ordine',
      quickReplyViewMyCart: 'Vedi il mio carrello',
      quickReplyProceedToCheckout: 'Procedi al pagamento',
      quickReplyTrackOrder: 'Traccia il mio ordine',
      quickReplyTrackAnotherOrder: 'Traccia un altro ordine',
      quickReplySeeAllProducts: 'Vedi tutti i prodotti',
      quickReplyShowGiftOptions: 'Mostra opzioni regalo',
      quickReplyViewShippingRates: 'Vedi tariffe di spedizione',
      quickReplyGiftIdeas: 'Idee regalo',
      quickReplyTalkToHuman: 'Parla con un operatore',
      quickReplyBrowseMoreProducts: 'Sfoglia altri prodotti',
      poweredBy: 'Realizzato con Siculera AI',
      errorConnection: 'Ci dispiace, qualcosa è andato storto. Riprova oppure fai clic su "Parla con un operatore" per assistenza immediata.',
      productCollectionLabel: 'La nostra collezione artigianale — {count} prodotto{plural}',
      addToCart: 'Aggiungi al carrello',
      addedToCart: 'Aggiunto al carrello!',
      addedQuantityToCart: 'Aggiunti {count}× al carrello!',
      outOfStock: 'Esaurito',
      viewDetails: 'Vedi dettagli →',
      backToProducts: '← Torna ai prodotti',
      quantityLabel: 'Quantità',
      yourCart: 'Il tuo carrello',
      yourCartEmpty: 'Il tuo carrello è vuoto. Sfoglia i prodotti per iniziare!',
      cartTotalLabel: 'Totale',
      continueShopping: '← Continua acquisti',
      proceedToCheckout: 'Procedi al pagamento →',
      cartTotalLabel: 'Totale',
      itemCount: '{count} articolo{plural}',
      giftBadge: 'Regalo',
      perfectGift: 'Regalo perfetto',
      decrease: 'Diminuisci',
      increase: 'Aumenta',
      remove: 'Rimuovi',
      emptyCartWarning: 'Il tuo carrello è vuoto. Aggiungi prima alcuni prodotti!'
    }
  };

  let chatLocale = getChatLocale();

  function getChatLocale() {
    const saved = localStorage.getItem('siculera_locale');
    return saved === 'it' ? 'it' : 'en';
  }

  function chatTranslate(key, vars = {}) {
    const locale = CHAT_LOCALES[chatLocale] || CHAT_LOCALES.en;
    let value = locale[key] || CHAT_LOCALES.en[key] || key;
    value = value.replace(/\{plural\}/g, vars.count === 1 ? '' : 's');
    return value.replace(/\{(\w+)\}/g, (_, name) => vars[name] || '');
  }

  const QUICK_REPLY_TRANSLATIONS = {
    'Browse catalog': 'quickReplyBrowseCatalog',
    'Check my order': 'quickReplyCheckMyOrder',
    'View my cart': 'quickReplyViewMyCart',
    'Proceed to checkout': 'quickReplyProceedToCheckout',
    'Track another order': 'quickReplyTrackAnotherOrder',
    'See all products': 'quickReplySeeAllProducts',
    'Show gift options': 'quickReplyShowGiftOptions',
    'View shipping rates': 'quickReplyViewShippingRates'
  };

  function translateQuickReply(label) {
    const key = QUICK_REPLY_TRANSLATIONS[label];
    return key ? chatTranslate(key) : label;
  }

  function setChatLanguage(lang) {
    if (!CHAT_LOCALES[lang]) lang = 'en';
    chatLocale = lang;
    renderChatStaticText();
    updateCartBar();
  }

  function renderChatStaticText() {
    const bubble = document.getElementById('sic-bubble');
    if (bubble) {
      bubble.setAttribute('aria-label', chatTranslate('bubbleAria'));
      bubble.title = chatTranslate('bubbleTitle');
    }
    const headerTitle = document.getElementById('sic-header-title');
    if (headerTitle) headerTitle.textContent = chatTranslate('headerTitle');
    const headerSubtitle = document.getElementById('sic-header-subtitle');
    if (headerSubtitle) headerSubtitle.textContent = chatTranslate('headerSubtitle');
    const expand = document.getElementById('sic-expand');
    if (expand) {
      expand.setAttribute('aria-label', chatTranslate('expandAria'));
      expand.title = chatTranslate('expandTitle');
    }
    const disclosureBtn = document.getElementById('sic-disclosure-dismiss');
    if (disclosureBtn) disclosureBtn.textContent = chatTranslate('disclosureDismiss');
    const consentBody = document.querySelector('#sic-consent p');
    if (consentBody) consentBody.textContent = chatTranslate('consentBody');
    const consentDecline = document.getElementById('sic-consent-decline');
    if (consentDecline) consentDecline.textContent = chatTranslate('consentDecline');
    const consentAccept = document.getElementById('sic-consent-accept');
    if (consentAccept) consentAccept.textContent = chatTranslate('consentAccept');
    const input = document.getElementById('sic-input');
    if (input) {
      input.placeholder = chatTranslate('inputPlaceholder');
      input.setAttribute('aria-label', chatTranslate('inputAria'));
    }
    const humanLink = document.getElementById('sic-human-link');
    if (humanLink) humanLink.textContent = chatTranslate('quickReplyTalkToHuman');
    const footerLabel = document.getElementById('sic-footer-label');
    if (footerLabel) footerLabel.textContent = chatTranslate('poweredBy');
    const send = document.getElementById('sic-send');
    if (send) send.setAttribute('aria-label', chatTranslate('sendAria'));
    const viewBtn = document.getElementById('sic-bar-view');
    if (viewBtn) viewBtn.textContent = chatTranslate('yourCart');
    const checkoutBtn = document.getElementById('sic-bar-checkout');
    if (checkoutBtn) checkoutBtn.textContent = chatTranslate('proceedToCheckout');
  }

  window.addEventListener('siculeraLanguageChange', e => {
    if (e && e.detail && e.detail.lang) setChatLanguage(e.detail.lang);
  });
  window.addEventListener('storage', e => {
    if (e.key === 'siculera_locale') setChatLanguage(e.newValue);
  });

  /* ── Design tokens ─────────────────────────────────────────────────────── */
  const CSS = `
    :root {
      --sic-gold: #b8975a;
      --sic-gold-light: #d4af7a;
      --sic-ink: #27312a;
      --sic-bg: #fbf7f1;
      --sic-white: #ffffff;
      --sic-line: #e8ddd0;
      --sic-muted: #8a8f88;
      --sic-error: #c0392b;
      --sic-success: #2ecc71;
      --sic-serif: 'Cormorant Garamond', Georgia, serif;
      --sic-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --sic-radius: 16px;
      --sic-shadow: 0 8px 40px rgba(39,49,42,0.18);
    }

    #sic-root * { box-sizing: border-box; margin: 0; padding: 0; }
    /* Restore padding for elements that use class-level padding rules (class < ID specificity) */
    #sic-root .sic-qr            { padding: 7px 15px; }
    #sic-root .sic-card-btn      { padding: 7px 18px; }
    #sic-root .sic-card-body     { padding: 9px 10px 12px; }
    #sic-root .sic-card-gift-badge { padding: 1px 6px; }
    #sic-root .sic-cart-header,
    #sic-root .sic-order-header  { padding: 10px 14px; }
    #sic-root .sic-cart-item     { padding: 8px 14px; }
    #sic-root .sic-cart-footer   { padding: 10px 14px 4px; }
    #sic-root .sic-cart-empty    { padding: 14px; }
    #sic-root .sic-cart-checkout   { padding: 11px 0; margin: 8px 14px 12px; }
    #sic-root .sic-bar-view-btn    { padding: 8px 0; }
    #sic-root .sic-bar-checkout-btn { padding: 8px 0; }
    #sic-root .sic-cart-qty-btn   { padding: 0; }
    #sic-root .sic-cart-del       { padding: 0 0 0 4px; }
    #sic-root .sic-order-status-badge { padding: 4px 12px; margin: 10px 14px 4px; }
    #sic-root .sic-order-row     { padding: 7px 14px; }
    #sic-root .sic-products-label { padding: 0 2px; }
    #sic-root .sic-msg           { padding: 11px 15px; }
    #sic-root .sic-msg-system    { padding: 4px 8px; }
    #sic-root .sic-cart-card,
    #sic-root .sic-order-card,
    #sic-root .sic-thankyou-card { display: flex; flex-direction: column; overflow: hidden; min-height: fit-content; }
    #sic-root .sic-thankyou-header { padding: 12px 16px; }
    #sic-root .sic-thankyou-body   { padding: 4px 0 8px; }
    #sic-root .sic-thankyou-ref    { padding: 10px 14px 4px; }
    #sic-root .sic-thankyou-payment { padding: 6px 14px 2px; }
    #sic-root .sic-thankyou-email  { padding: 2px 14px 10px; }

    /* ── Sticky Cart Bar ── */
    #sic-cart-bar {
      display: none;
      flex-shrink: 0;
      flex-direction: column;
      gap: 8px;
      background: var(--sic-ink);
      padding: 11px 14px 13px;
      border-top: 2px solid var(--sic-gold);
    }
    #sic-root #sic-cart-bar-info {
      display: flex; align-items: center; gap: 6px;
    }
    #sic-root #sic-cart-bar-count {
      font-family: var(--sic-sans); font-size: 12px; font-weight: 700; color: #fff;
    }
    #sic-root #sic-cart-bar-total {
      font-family: var(--sic-sans); font-size: 12px; font-weight: 600;
      color: var(--sic-gold-light);
    }
    #sic-root #sic-cart-bar-btns {
      display: flex; gap: 8px;
    }
    #sic-root .sic-bar-view-btn {
      flex: 1; background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.22); color: #fff;
      border-radius: 8px; font-family: var(--sic-sans); font-size: 12px; font-weight: 600;
      cursor: pointer; transition: background 0.15s; text-align: center;
    }
    #sic-root .sic-bar-view-btn:hover { background: rgba(255,255,255,0.2); }
    #sic-root .sic-bar-checkout-btn {
      flex: 1.4; background: var(--sic-gold); border: none; color: #fff;
      border-radius: 8px; font-family: var(--sic-sans); font-size: 12px; font-weight: 700;
      cursor: pointer; letter-spacing: 0.02em; transition: background 0.15s; text-align: center;
    }
    #sic-root .sic-bar-checkout-btn:hover { background: var(--sic-gold-light); }

    /* ── Bubble ── */
    #sic-bubble {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--sic-gold);
      box-shadow: 0 4px 20px rgba(184,151,90,0.45);
      cursor: pointer;
      z-index: 9000;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    #sic-bubble:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 28px rgba(184,151,90,0.55);
    }
    #sic-bubble svg { width: 28px; height: 28px; fill: #fff; }

    /* Badge for escalated sessions */
    #sic-badge {
      position: absolute;
      top: -3px; right: -3px;
      width: 18px; height: 18px;
      background: #e74c3c;
      border-radius: 50%;
      border: 2px solid #fff;
      font-size: 10px;
      color: #fff;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: var(--sic-sans);
      font-weight: 700;
    }

    /* ── Panel ── */
    #sic-panel {
      position: fixed;
      bottom: 100px;
      right: 28px;
      width: 390px;
      max-width: calc(100vw - 32px);
      height: min(680px, 85vh);
      max-height: min(680px, 85vh);
      background: var(--sic-bg);
      border-radius: var(--sic-radius);
      box-shadow: var(--sic-shadow);
      z-index: 9001;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(20px) scale(0.97);
      opacity: 0;
      pointer-events: none;
      transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease,
                  width 0.3s ease, height 0.3s ease, max-height 0.3s ease,
                  inset 0.3s ease;
    }
    #sic-panel.sic-open {
      transform: translateY(0) scale(1);
      opacity: 1;
      pointer-events: all;
    }

    /* Expanded (centered overlay) state */
    #sic-panel.sic-expanded {
      top: 4vh;
      left: 5vw;
      right: 5vw;
      bottom: 4vh;
      width: auto;
      max-width: none;
      height: auto;
      max-height: none;
      border-radius: var(--sic-radius);
      transform: scale(0.97);
      opacity: 0;
    }
    #sic-panel.sic-expanded.sic-open {
      transform: scale(1);
      opacity: 1;
    }

    /* Expanded backdrop */
    #sic-backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(39,49,42,0.45);
      backdrop-filter: blur(2px);
      z-index: 9000;
      animation: sic-fade-in 0.2s ease;
    }
    #sic-backdrop.sic-visible { display: block; }
    @keyframes sic-fade-in { from { opacity: 0; } to { opacity: 1; } }

    /* Mobile full-screen */
    @media (max-width: 720px) {
      #sic-panel {
        bottom: 0; right: 0;
        left: 0;
        width: 100vw;
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 0;
        padding-bottom: env(safe-area-inset-bottom, 0);
      }
      #sic-panel.sic-expanded {
        left: 0;
        width: 100vw;
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 0;
      }
      #sic-bubble {
        bottom: 16px;
        right: 16px;
        width: 52px;
        height: 52px;
      }
      #sic-panel {
        box-shadow: none;
      }
      #sic-header {
        padding: 16px 16px 14px;
      }
      #sic-input {
        min-height: 48px;
      }
      .sic-qr {
        padding: 10px 14px;
      }
      .sic-msg {
        padding: 12px 14px;
      }
    }

    /* ── Header ── */
    #sic-header {
      background: var(--sic-ink);
      color: #fff;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    #sic-header-logo {
      width: 34px; height: 34px;
      background: var(--sic-gold);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    #sic-header-logo svg { width: 20px; height: 20px; fill: #fff; }
    #sic-header-info { flex: 1; }
    #sic-header-title {
      font-family: var(--sic-serif);
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1.2;
    }
    #sic-header-subtitle {
      font-family: var(--sic-sans);
      font-size: 11px;
      color: var(--sic-gold-light);
      margin-top: 1px;
    }
    #sic-close, #sic-expand {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      color: rgba(255,255,255,0.6);
      display: flex; align-items: center;
      transition: color 0.15s;
    }
    #sic-close:hover, #sic-expand:hover { color: #fff; }
    #sic-close svg { width: 20px; height: 20px; }
    #sic-expand svg { width: 18px; height: 18px; }
    #sic-expand { margin-right: 2px; }

    /* ── Disclosure banner (EU AI Act) ── */
    #sic-disclosure {
      background: #27312a;
      color: rgba(255,255,255,0.82);
      font-family: var(--sic-sans);
      font-size: 11.5px;
      line-height: 1.5;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    #sic-disclosure span { flex: 1; }
    #sic-disclosure-dismiss {
      background: none;
      border: 1px solid rgba(255,255,255,0.3);
      color: rgba(255,255,255,0.7);
      border-radius: 6px;
      padding: 3px 9px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
      font-family: var(--sic-sans);
    }
    #sic-disclosure-dismiss:hover { border-color: rgba(255,255,255,0.6); color: #fff; }

    /* ── Consent bar (GDPR) ── */
    #sic-consent {
      background: #fff;
      border-bottom: 1px solid var(--sic-line);
      padding: 12px 16px;
      font-family: var(--sic-sans);
      font-size: 12px;
      color: var(--sic-ink);
      line-height: 1.5;
      flex-shrink: 0;
    }
    #sic-consent p { margin-bottom: 10px; }
    #sic-consent-actions { display: flex; gap: 8px; }
    .sic-consent-btn {
      flex: 1;
      border: none;
      border-radius: 8px;
      padding: 8px;
      font-size: 12px;
      font-family: var(--sic-sans);
      cursor: pointer;
      font-weight: 500;
      transition: opacity 0.15s;
    }
    .sic-consent-btn:hover { opacity: 0.85; }
    .sic-consent-accept { background: var(--sic-gold); color: #fff; }
    .sic-consent-decline { background: var(--sic-line); color: var(--sic-ink); }

    /* ── Messages ── */
    #sic-messages {
      flex: 1;
      min-height: 180px;
      overflow-y: auto;
      padding: 18px 14px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      scroll-behavior: smooth;
    }
    #sic-messages::-webkit-scrollbar { width: 4px; }
    #sic-messages::-webkit-scrollbar-track { background: transparent; }
    #sic-messages::-webkit-scrollbar-thumb { background: var(--sic-line); border-radius: 4px; }

    .sic-msg {
      max-width: 82%;
      padding: 11px 15px;
      border-radius: 14px;
      font-family: var(--sic-sans);
      font-size: 13.5px;
      line-height: 1.7;
      word-break: break-word;
    }
    .sic-msg br { display: block; content: ''; margin-top: 6px; }
    .sic-msg-user {
      background: var(--sic-gold);
      color: #fff;
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .sic-msg-assistant {
      background: var(--sic-white);
      color: var(--sic-ink);
      align-self: flex-start;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .sic-msg-system {
      background: transparent;
      color: var(--sic-muted);
      font-size: 11px;
      align-self: center;
      text-align: center;
      padding: 4px 8px;
    }

    /* Typing indicator */
    #sic-typing {
      display: none;
      align-self: flex-start;
      background: var(--sic-white);
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      padding: 12px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    #sic-typing span {
      display: inline-block;
      width: 6px; height: 6px;
      background: var(--sic-gold);
      border-radius: 50%;
      margin: 0 2px;
      animation: sic-bounce 1.2s infinite ease-in-out;
    }
    #sic-typing span:nth-child(2) { animation-delay: 0.2s; }
    #sic-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes sic-bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    /* ── Quick replies ── */
    #sic-quick-replies {
      padding: 8px 14px 10px;
      display: flex;
      gap: 7px;
      overflow-x: auto;
      flex-shrink: 0;
      scrollbar-width: none;
      flex-wrap: wrap;
    }
    #sic-quick-replies::-webkit-scrollbar { display: none; }
    #sic-quick-replies:empty { display: none; }
    .sic-qr {
      white-space: nowrap;
      background: var(--sic-ink);
      color: rgba(255,255,255,0.88);
      border: none;
      border-radius: 20px;
      padding: 7px 15px;
      font-size: 12px;
      font-family: var(--sic-sans);
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, transform 0.1s;
      flex-shrink: 0;
      letter-spacing: 0.01em;
    }
    .sic-qr:hover {
      background: var(--sic-gold);
      color: #fff;
      transform: translateY(-1px);
    }
    .sic-qr:active { transform: scale(0.97); }

    /* ── Input row ── */
    #sic-input-row {
      padding: 10px 12px;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      background: var(--sic-white);
      border-top: 1px solid var(--sic-line);
      flex-shrink: 0;
    }
    #sic-input {
      flex: 1;
      border: 1px solid var(--sic-line);
      border-radius: 12px;
      padding: 9px 13px;
      font-size: 13.5px;
      font-family: var(--sic-sans);
      color: var(--sic-ink);
      background: var(--sic-bg);
      resize: none;
      outline: none;
      max-height: 100px;
      overflow-y: auto;
      line-height: 1.4;
      transition: border-color 0.15s;
    }
    #sic-input:focus { border-color: var(--sic-gold); }
    #sic-input::placeholder { color: var(--sic-muted); }
    #sic-send {
      width: 38px; height: 38px;
      background: var(--sic-gold);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      transition: background 0.15s, transform 0.15s;
    }
    #sic-send:hover:not(:disabled) { background: var(--sic-gold-light); transform: scale(1.05); }
    #sic-send:disabled { background: var(--sic-line); cursor: not-allowed; }
    #sic-send svg { width: 16px; height: 16px; fill: #fff; }

    /* ── Footer ── */
    #sic-footer {
      padding: 6px 16px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--sic-white);
      border-top: 1px solid var(--sic-line);
      flex-shrink: 0;
    }
    #sic-human-link {
      font-family: var(--sic-sans);
      font-size: 11px;
      color: var(--sic-gold);
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
    }
    #sic-footer-label {
      font-family: var(--sic-sans);
      font-size: 10px;
      color: var(--sic-muted);
    }

    /* ── Product grid ── */
    .sic-products-wrap {
      align-self: stretch;
      max-width: 100%;
    }
    .sic-products-label {
      font-family: var(--sic-serif);
      font-size: 12.5px;
      color: var(--sic-muted);
      margin-bottom: 10px;
      padding: 0 2px;
      letter-spacing: 0.02em;
    }
    .sic-products-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .sic-product-card {
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 12px rgba(0,0,0,0.09);
      display: flex;
      flex-direction: column;
    }
    .sic-card-img {
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .sic-card-emoji {
      font-size: 34px;
      line-height: 1;
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25));
    }
    .sic-card-gift-badge {
      position: absolute;
      top: 5px;
      right: 5px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255,255,255,0.94);
      border-radius: 10px;
      padding: 3px 8px;
      font-size: 9px;
      font-family: var(--sic-sans);
      font-weight: 700;
      color: var(--sic-ink);
      letter-spacing: .04em;
    }
    .sic-card-gift-badge::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background: linear-gradient(135deg,#b8915d,#8c6a33);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.6);
    }
      color: var(--sic-ink);
    }
    .sic-card-body {
      padding: 9px 10px 12px;
      display: flex;
      flex-direction: column;
      flex: 1;
      gap: 3px;
    }
    .sic-card-name {
      font-family: var(--sic-serif);
      font-size: 12.5px;
      font-weight: 700;
      color: var(--sic-ink);
      line-height: 1.2;
    }
    .sic-card-desc {
      font-family: var(--sic-sans);
      font-size: 10px;
      color: var(--sic-muted);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-top: 2px;
    }
    .sic-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 7px;
    }
    .sic-card-price {
      font-family: var(--sic-sans);
      font-size: 14px;
      font-weight: 700;
      color: var(--sic-ink);
    }
    .sic-card-weight {
      font-family: var(--sic-sans);
      font-size: 10px;
      color: var(--sic-muted);
    }
    .sic-card-btn {
      display: block;
      width: fit-content;
      margin: 10px auto 0;
      padding: 7px 18px;
      background: var(--sic-gold);
      color: #fff;
      border: none;
      border-radius: 20px;
      font-size: 11px;
      font-family: var(--sic-sans);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .sic-card-btn:hover:not(:disabled) { background: var(--sic-gold-light); }
    .sic-card-btn:active:not(:disabled) { transform: scale(0.97); }
    .sic-card-btn.sic-added { background: var(--sic-success); }
    .sic-card-btn:disabled { background: var(--sic-line); color: var(--sic-muted); cursor: default; }
    /* Real product image inside product card */
    .sic-card-real-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    /* "View Details" link button */
    .sic-card-details-btn {
      display: block; margin: 6px auto 0; padding: 0; background: none; border: none;
      font-family: var(--sic-sans); font-size: 10px; font-weight: 600;
      color: var(--sic-gold); cursor: pointer; letter-spacing: 0.02em;
      text-decoration: underline; text-underline-offset: 2px; transition: opacity 0.15s;
    }
    .sic-card-details-btn:hover { opacity: 0.7; }

    /* ── Product detail card ── */
    #sic-root .sic-detail-card {
      align-self: stretch; background: var(--sic-white); border: 1px solid var(--sic-line);
      border-radius: var(--sic-radius); overflow: hidden; margin: 4px 0 8px;
      flex-shrink: 0;
    }
    #sic-root .sic-detail-back {
      position: relative; z-index: 2; background: rgba(0,0,0,0.35); border: none;
      color: #fff; font-family: var(--sic-sans); font-size: 11px; font-weight: 600;
      cursor: pointer; padding: 7px 12px; display: block; width: 100%;
      text-align: left; letter-spacing: 0.02em; transition: background 0.15s;
    }
    #sic-root .sic-detail-back:hover { background: rgba(0,0,0,0.5); }
    #sic-root .sic-detail-img {
      height: 160px; display: flex; align-items: center; justify-content: center;
      overflow: hidden; position: relative;
    }
    #sic-root .sic-detail-real-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    #sic-root .sic-detail-emoji    { font-size: 56px; line-height: 1; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.3)); }
    #sic-root .sic-detail-body     { padding: 12px 14px 4px; }
    #sic-root .sic-detail-name-row { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
    #sic-root .sic-detail-name     { font-family: var(--sic-serif); font-size: 17px; font-weight: 700; color: var(--sic-ink); flex: 1; line-height: 1.2; }
    #sic-root .sic-detail-badge    {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #fdf3e3; color: var(--sic-gold); border: 1px solid #f0d9a8;
      border-radius: 20px; font-family: var(--sic-sans); font-size: 9px; font-weight: 700;
      padding: 3px 8px; white-space: nowrap; align-self: center;
    }
    #sic-root .sic-detail-badge::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 2px;
      background: linear-gradient(135deg,#b8915d,#8c6a33);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.6);
    }
    #sic-root .sic-detail-meta     { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    #sic-root .sic-detail-price    { font-family: var(--sic-sans); font-size: 16px; font-weight: 700; color: var(--sic-ink); }
    #sic-root .sic-detail-weight   { font-family: var(--sic-sans); font-size: 11px; color: var(--sic-muted); }
    #sic-root .sic-detail-flavour  {
      display: inline-block; background: var(--sic-bg); border: 1px solid var(--sic-line);
      border-radius: 20px; padding: 2px 10px; font-family: var(--sic-sans);
      font-size: 10px; color: var(--sic-muted); margin-bottom: 8px;
    }
    #sic-root .sic-detail-desc     { font-family: var(--sic-sans); font-size: 12px; line-height: 1.55; color: var(--sic-ink); margin-bottom: 6px; }
    #sic-root .sic-detail-footer   { padding: 10px 14px 14px; border-top: 1px solid var(--sic-line); }
    #sic-root .sic-detail-qty-row  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    #sic-root .sic-detail-qty-label { font-family: var(--sic-sans); font-size: 11px; font-weight: 600; color: var(--sic-ink); }
    #sic-root .sic-detail-qty-ctrl { display: flex; align-items: center; gap: 0; border: 1px solid var(--sic-line); border-radius: 8px; overflow: hidden; }
    #sic-root .sic-detail-qty-btn  {
      background: var(--sic-bg); border: none; width: 30px; height: 30px;
      font-size: 16px; font-family: var(--sic-sans); color: var(--sic-ink); cursor: pointer;
      display: flex; align-items: center; justify-content: center; transition: background 0.15s;
    }
    #sic-root .sic-detail-qty-btn:hover { background: var(--sic-line); }
    #sic-root .sic-detail-qty-num  { min-width: 32px; text-align: center; font-family: var(--sic-sans); font-size: 13px; font-weight: 700; color: var(--sic-ink); }
    #sic-root .sic-detail-atc {
      display: block; width: 100%; padding: 12px 0; background: var(--sic-ink);
      color: #fff; border: none; border-radius: 10px; font-family: var(--sic-sans);
      font-size: 13px; font-weight: 700; cursor: pointer; letter-spacing: 0.03em;
      transition: background 0.15s, transform 0.1s;
    }
    #sic-root .sic-detail-atc:hover:not(:disabled) { background: #3a4a3e; }
    #sic-root .sic-detail-atc:active:not(:disabled) { transform: scale(0.98); }
    #sic-root .sic-detail-atc:disabled { background: var(--sic-line); color: var(--sic-muted); cursor: default; }

    /* ── Order review item rows with thumbnail ── */
    #sic-root .sic-co-item-row   { display: flex; align-items: center; gap: 10px; padding: 6px 14px; }
    #sic-root .sic-co-item-thumb { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
    #sic-root .sic-co-item-emoji { width: 40px; height: 40px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; }
    #sic-root .sic-co-item-info  { flex: 1; min-width: 0; }
    #sic-root .sic-co-item-name  { font-family: var(--sic-sans); font-size: 12px; font-weight: 600; color: var(--sic-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #sic-root .sic-co-item-qty-price { font-family: var(--sic-sans); font-size: 11px; color: var(--sic-muted); margin-top: 2px; }

    /* ── Cart card ── */
    .sic-cart-card {
      align-self: flex-start;
      max-width: 95%;
      background: #fff;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .sic-cart-header {
      background: var(--sic-ink);
      color: #fff;
      padding: 10px 14px;
      font-family: var(--sic-serif);
      font-size: 14px;
      font-weight: 600;
    }
    .sic-cart-item {
      display: flex;
      align-items: center;
      padding: 8px 14px;
      border-bottom: 1px solid var(--sic-line);
      gap: 8px;
    }
    .sic-cart-item-thumb {
      width: 50px;
      height: 50px;
      border-radius: 12px;
      object-fit: cover;
      flex-shrink: 0;
      background: var(--sic-bg);
    }
    .sic-cart-item-name {
      flex: 1;
      font-family: var(--sic-sans);
      font-size: 12px;
      color: var(--sic-ink);
    }
    .sic-cart-item-qty {
      font-family: var(--sic-sans);
      font-size: 11px;
      color: var(--sic-muted);
    }
    .sic-cart-item-price {
      font-family: var(--sic-sans);
      font-size: 12.5px;
      font-weight: 600;
      color: var(--sic-ink);
    }
    .sic-cart-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px 4px;
    }
    .sic-cart-total-label {
      font-family: var(--sic-sans);
      font-size: 11.5px;
      color: var(--sic-muted);
    }
    .sic-cart-total-amount {
      font-family: var(--sic-sans);
      font-size: 16px;
      font-weight: 700;
      color: var(--sic-ink);
    }
    .sic-cart-empty {
      padding: 14px;
      font-family: var(--sic-sans);
      font-size: 12.5px;
      color: var(--sic-muted);
    }
    .sic-cart-checkout {
      display: block;
      margin: 8px 14px 12px;
      background: var(--sic-gold);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 11px 0;
      text-align: center;
      width: calc(100% - 28px);
      font-family: var(--sic-sans);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      letter-spacing: 0.03em;
      transition: background 0.15s, transform 0.1s;
    }
    .sic-cart-checkout:hover  { background: #c9a668; }
    .sic-cart-checkout:active { transform: scale(0.98); }
    .sic-cart-qty-ctrl {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
    }
    .sic-cart-qty-btn {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1.5px solid var(--sic-line);
      background: #fff;
      color: var(--sic-ink);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: border-color 0.15s, background 0.15s;
    }
    .sic-cart-qty-btn:hover { border-color: var(--sic-gold); background: #fdf8f0; }
    .sic-cart-qty-num {
      font-family: var(--sic-sans);
      font-size: 12px;
      font-weight: 600;
      min-width: 14px;
      text-align: center;
      color: var(--sic-ink);
    }
    .sic-cart-del {
      background: none;
      border: none;
      color: #ccc;
      font-size: 14px;
      cursor: pointer;
      padding: 0 0 0 4px;
      line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s;
    }
    .sic-cart-del:hover { color: #e05555; }

    /* ── Order status card ── */
    .sic-order-card {
      align-self: flex-start;
      max-width: 95%;
      background: #fff;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      overflow: hidden;
    }
    .sic-order-header {
      background: var(--sic-ink);
      color: #fff;
      padding: 10px 14px;
      font-family: var(--sic-serif);
      font-size: 14px;
      font-weight: 600;
    }
    .sic-order-status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-family: var(--sic-sans);
      font-weight: 600;
      margin: 10px 14px 4px;
    }
    .sic-status-processing { background: #fff3cd; color: #856404; }
    .sic-status-shipped    { background: #cff4fc; color: #0c5460; }
    .sic-status-delivered  { background: #d1e7dd; color: #0a3622; }
    .sic-status-cancelled  { background: #f8d7da; color: #58151c; }
    .sic-status-pending    { background: #e2e3e5; color: #41464b; }
    .sic-order-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 7px 14px;
      border-top: 1px solid var(--sic-line);
    }
    .sic-order-row-label {
      font-family: var(--sic-sans);
      font-size: 11px;
      color: var(--sic-muted);
    }
    .sic-order-row-value {
      font-family: var(--sic-sans);
      font-size: 12px;
      font-weight: 500;
      color: var(--sic-ink);
    }
    .sic-thankyou-card {
      align-self: flex-start;
      max-width: 95%;
      border-radius: 14px;
      border-bottom-left-radius: 4px;
      overflow: hidden;
      box-shadow: 0 2px 16px rgba(184,151,90,0.25);
    }
    .sic-thankyou-header {
      background: var(--sic-ink);
      color: #fff;
      padding: 12px 16px;
      font-family: var(--sic-serif);
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .sic-thankyou-body {
      background: linear-gradient(135deg, #27312a, #1a2820);
      color: rgba(255,255,255,0.9);
      padding: 4px 0 8px;
    }
    .sic-thankyou-body .sic-order-row-label { color: rgba(255,255,255,0.6); }
    .sic-thankyou-body .sic-order-row-value { color: #fff; }
    .sic-thankyou-body .sic-order-row { border-top-color: rgba(255,255,255,0.1); }
    .sic-thankyou-ref {
      font-family: var(--sic-sans);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--sic-gold);
      padding: 10px 14px 4px;
    }
    .sic-thankyou-payment {
      font-family: var(--sic-sans);
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      padding: 6px 14px 2px;
    }
    .sic-thankyou-email {
      font-family: var(--sic-sans);
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      padding: 2px 14px 10px;
    }

    /* ── Checkout step cards ─────────────────────────────────────────────────── */
    #sic-root .sic-co-card {
      align-self: flex-start; width: 96%;
      border-radius: 14px; border-bottom-left-radius: 4px;
      background: #fff; border: 1px solid var(--sic-line);
      overflow: hidden; min-height: fit-content;
      box-shadow: 0 2px 12px rgba(39,49,42,0.07);
      margin-bottom: 6px; display: flex; flex-direction: column;
    }
    #sic-root .sic-co-header {
      background: var(--sic-ink); color: #fff; padding: 10px 14px;
      font-family: var(--sic-sans); font-size: 11px; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    #sic-root .sic-co-body    { padding: 10px 12px 2px; }
    #sic-root .sic-co-field   { margin-bottom: 8px; }
    #sic-root .sic-co-label   {
      display: block; font-family: var(--sic-sans); font-size: 9px;
      font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--sic-gold); margin-bottom: 3px;
    }
    #sic-root .sic-co-input,
    #sic-root .sic-co-select  {
      width: 100%; border: 1.5px solid var(--sic-line); border-radius: 7px;
      padding: 7px 9px; font-family: var(--sic-sans); font-size: 12px;
      color: var(--sic-ink); background: #fff; outline: none;
      transition: border-color 0.15s; box-sizing: border-box;
      -webkit-appearance: none; appearance: none;
    }
    #sic-root .sic-co-input:focus,
    #sic-root .sic-co-select:focus  { border-color: var(--sic-gold); }
    #sic-root .sic-co-input.sic-err,
    #sic-root .sic-co-select.sic-err { border-color: #c0392b; }
    #sic-root .sic-co-field-row { display: flex; gap: 8px; }
    #sic-root .sic-co-field-row .sic-co-field { flex: 1; }
    #sic-root .sic-co-radio-option {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 0; border-bottom: 1px solid var(--sic-line); cursor: pointer;
    }
    #sic-root .sic-co-radio-option:last-child { border-bottom: none; }
    #sic-root .sic-co-radio-dot {
      width: 18px; height: 18px; border-radius: 50%;
      border: 2px solid var(--sic-line); flex-shrink: 0;
      transition: border-color 0.15s, background 0.15s;
      display: flex; align-items: center; justify-content: center;
    }
    #sic-root .sic-co-radio-dot.sic-sel { border-color: var(--sic-gold); background: var(--sic-gold); }
    #sic-root .sic-co-radio-dot.sic-sel::after { content:''; width:6px; height:6px; border-radius:50%; background:#fff; display:block; }
    #sic-root .sic-co-radio-info  { flex: 1; }
    #sic-root .sic-co-radio-name  { font-family: var(--sic-sans); font-size: 12px; font-weight: 600; color: var(--sic-ink); }
    #sic-root .sic-co-radio-desc  { font-family: var(--sic-sans); font-size: 11px; color: var(--sic-muted); margin-top: 2px; }
    #sic-root .sic-co-radio-price { font-family: var(--sic-sans); font-size: 12px; font-weight: 700; color: var(--sic-ink); flex-shrink: 0; }
    #sic-root .sic-co-footer {
      padding: 8px 12px 10px; display: flex; gap: 8px;
      justify-content: flex-end; border-top: 1px solid var(--sic-line);
    }
    #sic-root .sic-co-btn-back {
      background: none; border: 1.5px solid var(--sic-line); border-radius: 8px;
      padding: 8px 14px; font-family: var(--sic-sans); font-size: 12px;
      font-weight: 600; color: var(--sic-muted); cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    #sic-root .sic-co-btn-back:hover { border-color: var(--sic-ink); color: var(--sic-ink); }
    #sic-root .sic-co-btn-next {
      background: var(--sic-gold); border: none; border-radius: 8px;
      padding: 8px 18px; font-family: var(--sic-sans); font-size: 12px;
      font-weight: 700; color: #fff; cursor: pointer; letter-spacing: 0.03em;
      transition: background 0.15s, transform 0.1s;
    }
    #sic-root .sic-co-btn-next:hover  { background: #c9a668; }
    #sic-root .sic-co-btn-next:active { transform: scale(0.97); }
    #sic-root .sic-co-btn-confirm {
      background: var(--sic-ink); border: none; border-radius: 8px;
      padding: 9px 16px; font-family: var(--sic-sans); font-size: 12px;
      font-weight: 700; color: #fff; cursor: pointer; letter-spacing: 0.02em;
      flex: 1; transition: background 0.15s, transform 0.1s;
    }
    #sic-root .sic-co-btn-confirm:disabled { background: var(--sic-line); color: var(--sic-muted); cursor: not-allowed; }
    #sic-root .sic-co-btn-confirm:not(:disabled):hover  { background: #3a4a3e; }
    #sic-root .sic-co-btn-confirm:not(:disabled):active { transform: scale(0.97); }
    #sic-root .sic-co-section-title {
      font-family: var(--sic-sans); font-size: 10px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--sic-gold);
      padding: 10px 14px 4px;
    }
    #sic-root .sic-co-review-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: 4px 14px; font-family: var(--sic-sans); font-size: 12px;
    }
    #sic-root .sic-co-review-label { color: var(--sic-muted); flex-shrink: 0; margin-right: 8px; min-width: 64px; }
    #sic-root .sic-co-review-value { color: var(--sic-ink); font-weight: 500; text-align: right; }
    #sic-root .sic-co-divider { height: 1px; background: var(--sic-line); margin: 6px 14px; }
    #sic-root .sic-co-total-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; border-top: 2px solid var(--sic-ink);
    }
    #sic-root .sic-co-total-label  { font-family: var(--sic-sans); font-size: 13px; font-weight: 700; color: var(--sic-ink); }
    #sic-root .sic-co-total-amount { font-family: var(--sic-serif); font-size: 18px; font-weight: 700; color: var(--sic-ink); }
    #sic-root .sic-co-confirm-row  {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      background: #fdf8f0; border-top: 1px solid var(--sic-line);
    }
    #sic-root .sic-co-confirm-check { width: 18px; height: 18px; accent-color: var(--sic-gold); cursor: pointer; flex-shrink: 0; }
    #sic-root .sic-co-confirm-label { font-family: var(--sic-sans); font-size: 11px; color: var(--sic-ink); cursor: pointer; }
    #sic-root .sic-co-error-msg     { font-family: var(--sic-sans); font-size: 11px; color: #c0392b; padding: 0 14px 8px; display: none; }
    #sic-root .sic-co-error-msg.sic-visible { display: block; }
    #sic-root .sic-co-continue-btn {
      background: none; border: none; padding: 11px 4px;
      font-family: var(--sic-sans); font-size: 12px; font-weight: 500;
      color: var(--sic-muted); cursor: pointer; letter-spacing: 0.01em;
      text-decoration: underline; text-underline-offset: 3px;
      transition: color 0.15s;
    }
    #sic-root .sic-co-continue-btn:hover { color: var(--sic-ink); }
    /* Section header with inline edit link */
    #sic-root .sic-co-section-hdr  {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px 2px;
    }
    #sic-root .sic-co-section-hdr .sic-co-section-title { font-size: 9px; color: var(--sic-muted); padding: 0; }
    #sic-root .sic-co-section-edit  {
      background: none; border: none; cursor: pointer; padding: 0;
      font-family: var(--sic-sans); font-size: 10px; color: var(--sic-gold);
      font-weight: 600; letter-spacing: 0.02em; transition: opacity 0.15s;
    }
    #sic-root .sic-co-section-edit:hover { opacity: 0.7; }
    /* Terms panel */
    #sic-root .sic-co-terms-wrap   { margin: 2px 14px 0; border: 1px solid var(--sic-line); border-radius: 8px; overflow: hidden; }
    #sic-root .sic-co-terms-toggle {
      width: 100%; background: #faf7f2; border: none; cursor: pointer; padding: 9px 12px;
      font-family: var(--sic-sans); font-size: 11px; font-weight: 600; color: var(--sic-ink);
      text-align: left; transition: background 0.15s;
    }
    #sic-root .sic-co-terms-toggle:hover { background: #f3ede4; }
    #sic-root .sic-co-terms-panel  {
      max-height: 0; overflow: hidden; transition: max-height 0.3s ease;
      font-family: var(--sic-sans); font-size: 11px; line-height: 1.6; color: var(--sic-ink);
      padding: 0 12px; background: #fff;
    }
    #sic-root .sic-co-terms-panel.sic-co-terms-open { max-height: 320px; padding: 10px 12px 12px; overflow-y: auto; }
    /* Marketing opt-in row */
    #sic-root .sic-co-mkt-row   { display: flex; align-items: flex-start; gap: 8px; padding: 6px 14px 2px; }
    #sic-root .sic-co-mkt-label { font-family: var(--sic-sans); font-size: 11px; color: var(--sic-muted); cursor: pointer; line-height: 1.4; }
    #sic-root .sic-payment-loader {
      text-align: center; padding: 24px 14px 12px;
      color: var(--sic-muted); font-size: 13px; font-family: var(--sic-sans);
    }
    #sic-root .sic-stripe-container  { padding: 0 14px 8px; min-height: 50px; }
    #sic-root .sic-paypal-container  { padding: 8px 14px 4px; min-height: 50px; }
    #sic-root .sic-cart-checkout-btn {
      display: block; margin: 8px 14px 12px; background: var(--sic-gold);
      color: #fff; border: none; border-radius: 10px; padding: 11px 0;
      text-align: center; width: calc(100% - 28px); font-family: var(--sic-sans);
      font-size: 13px; font-weight: 600; cursor: pointer; letter-spacing: 0.03em;
      transition: background 0.15s, transform 0.1s;
    }
    #sic-root .sic-cart-checkout-btn:hover  { background: #c9a668; }
    #sic-root .sic-cart-checkout-btn:active { transform: scale(0.98); }
    #sic-root .sic-cart-action-row {
      display: flex; gap: 8px; margin: 8px 14px 12px;
    }
  `;

  /* ── State ──────────────────────────────────────────────────────────────── */
  let sessionToken  = localStorage.getItem(STORAGE_TOKEN) || null;
  let consentGiven  = localStorage.getItem(STORAGE_CONSENT) === 'true';
  let clientHistory = []; // in-memory conversation history for DB-unavailable fallback
  let disclosureSeen = localStorage.getItem('siculera_chat_disclosure') === 'true';
  let isOpen        = false;
  let isSending     = false;
  let checkoutState = null; // active checkout flow state

  /* ── Checkout constants ──────────────────────────────────────────────────── */
  const SHIPPING_OPTIONS = [
    { id: 'poste_italiane', label: 'Poste Italiane', price: 4.90, days: '3–5 business days' },
    { id: 'dhl_express',    label: 'DHL Express',    price: 9.90, days: '1–2 business days' },
    { id: 'ups_standard',   label: 'UPS Standard',   price: 7.90, days: '2–3 business days' },
    { id: 'brt_sda',        label: 'BRT / SDA',      price: 6.90, days: '2–4 business days' }
  ];
  const PAYMENT_OPTIONS = [
    { id: 'bank_transfer',    label: 'Bank Transfer',    desc: 'IBAN & reference sent by email' },
    { id: 'cash_on_delivery', label: 'Cash on Delivery', desc: '+€2.00 fee · pay when parcel arrives' },
    { id: 'paypal',           label: 'PayPal',           desc: 'Pay securely via PayPal' },
    { id: 'stripe',           label: 'Credit / Debit Card', desc: 'Visa, Mastercard, Amex — secured by Stripe' }
  ];

  /* ── DOM refs ────────────────────────────────────────────────────────────── */
  let $panel, $messages, $input, $send, $typing, $quickReplies, $disclosure, $consent, $cartBar, $expand;

  /* ── Init ────────────────────────────────────────────────────────────────── */
  function init() {
    injectStyles();
    buildDOM();
    attachEvents();
    initSession();
    // If cart already has items (e.g. page reload), show View Cart pill + sticky bar
    try {
      const existingCart = JSON.parse(localStorage.getItem('siculera_cart') || '[]');
      const totalQty = existingCart.reduce((s, i) => s + (parseInt(i.qty) || 1), 0);
      if (totalQty > 0) showViewCartPill(totalQty); // also calls updateCartBar()
    } catch (_) {}
  }

  function injectStyles() {
    if (document.getElementById('sic-styles')) return;
    const style = document.createElement('style');
    style.id    = 'sic-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildDOM() {
    const root = document.createElement('div');
    root.id    = 'sic-root';
    root.innerHTML = `
      <!-- Bubble -->
      <button id="sic-bubble" aria-label="${chatTranslate('bubbleAria')}" title="${chatTranslate('bubbleTitle')}">
        <div id="sic-badge"></div>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      </button>

      <!-- Panel -->
      <div id="sic-panel" role="dialog" aria-label="Siculera AI Chat" aria-modal="true">

        <!-- Header -->
        <div id="sic-header">
          <div id="sic-header-logo">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
          <div id="sic-header-info">
            <div id="sic-header-title">${chatTranslate('headerTitle')}</div>
            <div id="sic-header-subtitle">${chatTranslate('headerSubtitle')}</div>
          </div>
          <button id="sic-expand" aria-label="${chatTranslate('expandAria')}" title="${chatTranslate('expandTitle')}">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          </button>
          <button id="sic-close" aria-label="Close chat">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <!-- EU AI Act Disclosure -->
        <div id="sic-disclosure">
          <span>🤖 <strong>AI Disclosure:</strong> You are speaking with an AI assistant. Not a human. As required by EU AI Act Article 50.</span>
          <button id="sic-disclosure-dismiss">${chatTranslate('disclosureDismiss')}</button>
        </div>

        <!-- GDPR Consent -->
        <div id="sic-consent">
          <p>${chatTranslate('consentBody')}</p>
          <div id="sic-consent-actions">
            <button class="sic-consent-btn sic-consent-accept" id="sic-consent-accept">${chatTranslate('consentAccept')}</button>
            <button class="sic-consent-btn sic-consent-decline" id="sic-consent-decline">${chatTranslate('consentDecline')}</button>
          </div>
        </div>

        <!-- Messages -->
        <div id="sic-messages" role="log" aria-live="polite">
          <div id="sic-typing">
            <span></span><span></span><span></span>
          </div>
        </div>

        <!-- Quick replies -->
        <div id="sic-quick-replies"></div>

        <!-- Sticky Cart Bar -->
        <div id="sic-cart-bar">
          <div id="sic-cart-bar-info">
            <span id="sic-cart-bar-count"></span>
            <span id="sic-cart-bar-total"></span>
          </div>
          <div id="sic-cart-bar-btns">
            <button class="sic-bar-view-btn" id="sic-bar-view">${chatTranslate('yourCart')}</button>
            <button class="sic-bar-checkout-btn" id="sic-bar-checkout">${chatTranslate('proceedToCheckout')}</button>
          </div>
        </div>

        <!-- Input -->
        <div id="sic-input-row">
          <textarea id="sic-input" rows="1" placeholder="${chatTranslate('inputPlaceholder')}" aria-label="${chatTranslate('inputAria')}" maxlength="1000"></textarea>
          <button id="sic-send" aria-label="${chatTranslate('sendAria')}">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>

        <!-- Footer -->
        <div id="sic-footer">
          <button id="sic-human-link">${chatTranslate('quickReplyTalkToHuman')}</button>
          <span id="sic-footer-label">${chatTranslate('poweredBy')}</span>
        </div>
      </div>
    `;

    // Backdrop for expanded mode
    const backdrop = document.createElement('div');
    backdrop.id = 'sic-backdrop';
    document.body.appendChild(backdrop);
    document.body.appendChild(root);

    // Cache refs
    $panel       = document.getElementById('sic-panel');
    $messages    = document.getElementById('sic-messages');
    $input       = document.getElementById('sic-input');
    $send        = document.getElementById('sic-send');
    $typing      = document.getElementById('sic-typing');
    $quickReplies = document.getElementById('sic-quick-replies');
    $disclosure  = document.getElementById('sic-disclosure');
    $consent     = document.getElementById('sic-consent');
    $cartBar     = document.getElementById('sic-cart-bar');
    $expand      = document.getElementById('sic-expand');
  }

  function attachEvents() {
    document.getElementById('sic-bubble').addEventListener('click', togglePanel);
    document.getElementById('sic-close').addEventListener('click', closePanel);
    document.getElementById('sic-expand').addEventListener('click', toggleExpand);
    document.getElementById('sic-backdrop').addEventListener('click', () => {
      // Clicking backdrop collapses expanded mode (doesn't close panel)
      if ($panel.classList.contains('sic-expanded')) toggleExpand();
    });
    document.getElementById('sic-disclosure-dismiss').addEventListener('click', dismissDisclosure);
    document.getElementById('sic-consent-accept').addEventListener('click', () => handleConsent(true));
    document.getElementById('sic-consent-decline').addEventListener('click', () => handleConsent(false));
    document.getElementById('sic-human-link').addEventListener('click', requestHuman);

    $send.addEventListener('click', sendMessage);
    $input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Sticky cart bar buttons
    document.getElementById('sic-bar-view').addEventListener('click', () => renderCartCard());
    document.getElementById('sic-bar-checkout').addEventListener('click', () => startCheckout());

    // Auto-resize textarea
    $input.addEventListener('input', () => {
      $input.style.height = 'auto';
      $input.style.height = Math.min($input.scrollHeight, 100) + 'px';
    });

    // Listen for cart changes made by the landing page (removeItem, changeQty, addToCart)
    window.addEventListener('siculeraCartUpdate', (e) => {
      if (e.detail && e.detail.source === 'sic-widget') return; // our own event, skip
      try {
        const updatedCart = e.detail && e.detail.cart
          ? e.detail.cart
          : JSON.parse(localStorage.getItem('siculera_cart') || '[]');
        const total = updatedCart.reduce((s, i) => s + (parseInt(i.qty) || 1), 0);
        if (total > 0) {
          showViewCartPill(total); // also calls updateCartBar()
        } else {
          $quickReplies.querySelector('[data-view-cart]')?.remove();
          updateCartBar(); // hide the bar when cart empties
        }
        // Re-render the cart card in-place if it is already visible
        if ($messages.querySelector('.sic-cart-card')) {
          renderCartCard(true); // silent: replace in-place, no scroll
        }
      } catch (_) {}
    });
  }

  /* ── Session ─────────────────────────────────────────────────────────────── */
  async function initSession() {
    try {
      const body = sessionToken ? { session_token: sessionToken } : {};
      const user = getUserContext();
      if (user.id) body.user_id = user.id;

      const data = await api('POST', '/session', body);
      sessionToken = data.session_token;
      localStorage.setItem(STORAGE_TOKEN, sessionToken);

      if (data.consent_given) {
        consentGiven = true;
        localStorage.setItem(STORAGE_CONSENT, 'true');
      }

      // If already dismissed disclosure, hide it
      if (disclosureSeen) $disclosure.style.display = 'none';
      // If already gave consent, hide consent bar
      if (consentGiven || localStorage.getItem(STORAGE_CONSENT) === 'declined') {
        $consent.style.display = 'none';
      }
    } catch (e) {
      console.warn('[Siculera chat] Session init failed:', e);
    }
  }

  function getUserContext() {
    try {
      const u = JSON.parse(localStorage.getItem('siculera_user') || '{}');
      const ctx = { id: u.id || null };
      if (u.first_name) ctx.first_name = u.first_name;
      if (u.last_name)  ctx.last_name  = u.last_name;
      if (u.email)      ctx.email      = u.email;
      if (u.phone)      ctx.phone      = u.phone;
      if (u.address)    ctx.address    = u.address;
      return ctx;
    } catch (err) { return null; }
  }

  function getCartContext() {
    try {
      return JSON.parse(localStorage.getItem('siculera_cart') || 'null');
    } catch (err) { return null; }
  }

  function localProductImage(slug) {
    const map = {
      'traditional-almond-paste': 'assets/images/Traditional Sicilian Almond.png',
      'lemon-almond-paste': 'assets/images/Lemon Almond.png',
      'orange-almond-paste': 'assets/images/Orange Almond.png',
      'pistachio-almond-paste': 'assets/images/Pistachio Almond.png',
      'apricot-jam-almond-paste': 'assets/images/Almond Paste with Apricot Jam.png',
      'caramelized-cherry-almond': 'assets/images/Almond Paste with Caramelized Cherry.png'
    };
    return map[slug] || null;
  }

  /* ── Panel ────────────────────────────────────────────────────────────────── */
  function togglePanel() {
    isOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isOpen = true;
    $panel.classList.add('sic-open');
    $input.focus();

    // Show welcome message on first open
    if ($messages.querySelectorAll('.sic-msg').length === 0) {
      setTimeout(() => {
        appendMessage('assistant', chatTranslate('welcomeMessage'));
        renderQuickReplies([
          chatTranslate('quickReplyBrowseProducts'),
          chatTranslate('quickReplyTrackOrder'),
          chatTranslate('quickReplyGiftIdeas'),
          chatTranslate('quickReplyTalkToHuman')
        ]);
      }, 300);
    }
  }

  function closePanel() {
    isOpen = false;
    $panel.classList.remove('sic-open');
    // Also collapse expanded state on close
    if ($panel.classList.contains('sic-expanded')) {
      $panel.classList.remove('sic-expanded');
      document.getElementById('sic-backdrop').classList.remove('sic-visible');
      _setExpandIcon(false);
    }
  }

  function toggleExpand() {
    const expanded = $panel.classList.toggle('sic-expanded');
    const backdrop = document.getElementById('sic-backdrop');
    backdrop.classList.toggle('sic-visible', expanded);
    _setExpandIcon(expanded);
    // Scroll messages to bottom after resize
    setTimeout(() => { $messages.scrollTop = $messages.scrollHeight; }, 320);
  }

  function _setExpandIcon(expanded) {
    // Expand icon: fullscreen_arrows; Collapse icon: fullscreen_exit
    const expandPath  = 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z';
    const collapsePath = 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z';
    $expand.querySelector('path').setAttribute('d', expanded ? collapsePath : expandPath);
    $expand.setAttribute('aria-label', expanded ? 'Collapse chat' : 'Expand chat');
    $expand.title = expanded ? 'Collapse' : 'Expand';
  }

  /* ── Disclosure + Consent ──────────────────────────────────────────────── */
  function dismissDisclosure() {
    $disclosure.style.display = 'none';
    disclosureSeen = true;
    localStorage.setItem('siculera_chat_disclosure', 'true');
  }

  async function handleConsent(accepted) {
    $consent.style.display = 'none';
    consentGiven = accepted;
    localStorage.setItem(STORAGE_CONSENT, accepted ? 'true' : 'declined');

    if (sessionToken) {
      try {
        await api('POST', '/consent', { session_token: sessionToken, consent_given: accepted });
      } catch (e) {}
    }

    if (!accepted) {
      appendSystemMsg('You\'re chatting anonymously. Your messages won\'t be saved.');
    }
  }

  /* ── Sending ─────────────────────────────────────────────────────────────── */
  async function sendMessage() {
    const text = $input.value.trim();
    if (!text || isSending) return;
    if (!sessionToken) { await initSession(); }

    appendMessage('user', text);
    $input.value = '';
    $input.style.height = 'auto';
    clearQuickReplies();
    showTyping();
    isSending = true;
    $send.disabled = true;

    try {
      const user = getUserContext();
      const body = {
        session_token:  sessionToken,
        message:        text,
        cart_context:   getCartContext(),
        user_context:   user && user.id ? user : null,
        user_token:     localStorage.getItem('siculera_user_token') || null,
        client_history: clientHistory.slice(-20)   // last 20 turns as fallback
      };

      // Optimistically add user message to in-memory history before sending
      clientHistory.push({ role: 'user', content: text });

      const data = await api('POST', '/message', body);

      hideTyping();
      isSending = false;
      $send.disabled = false;

      if (data.reply) {
        appendMessage('assistant', data.reply);
        // Track assistant reply in history for next turn
        clientHistory.push({ role: 'assistant', content: data.reply });
        // Keep history bounded
        if (clientHistory.length > 40) clientHistory = clientHistory.slice(-40);
      }

      if (data.actions && data.actions.length) {
        processActions(data.actions);
      }

      if (data.quick_replies && data.quick_replies.length) {
        renderQuickReplies(data.quick_replies);
      }

    } catch (err) {
      hideTyping();
      isSending = false;
      $send.disabled = false;
      appendMessage('assistant', err && err.userReply ? err.userReply : chatTranslate('errorConnection'));
    }
  }

  function addToLocalCart(slug, name, price, qty, image) {
    try {
      const cart = JSON.parse(localStorage.getItem('siculera_cart') || '[]');
      const existing = cart.find(x => x.id === slug);
      if (existing) {
        existing.qty += qty;
        if (image && !existing.image) existing.image = image;
      } else {
        cart.push({ id: slug, name: name || slug, note: '', price: price || 0, qty: qty, className: '', image: image || null });
      }
      localStorage.setItem('siculera_cart', JSON.stringify(cart));
      const total = cart.reduce((s, x) => s + x.qty, 0);
      // Notify the host page to refresh its cart UI
      window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart, source: 'sic-widget' } }));
      if (typeof updateCartBar === 'function') updateCartBar();
      if (typeof showViewCartPill === 'function') showViewCartPill(total);
      if ($messages && $messages.querySelector('.sic-cart-card')) renderCartCard(true);
      return total;
    } catch (err) { return null; }
  }

  function showViewCartPill(totalQty) {
    // Cart bar is visible — it already shows count+total+actions, no need for a pill
    updateCartBar();
  }

  function updateCartBar() {
    try {
      const cart = JSON.parse(localStorage.getItem('siculera_cart') || '[]');
      const qty   = cart.reduce((s, x) => s + (parseInt(x.qty) || 1), 0);
      const total = cart.reduce((s, x) => s + ((parseFloat(x.price) || 0) * (parseInt(x.qty) || 1)), 0);
      if (qty > 0) {
        document.getElementById('sic-cart-bar-count').textContent = `🛒 ${chatTranslate('itemCount', { count: qty })}`;
        document.getElementById('sic-cart-bar-total').textContent = `· €${total.toFixed(2)}`;
        $cartBar.style.display = 'flex';
        // Cart bar replaces the pill — remove any stale pill
        $quickReplies.querySelector('[data-view-cart]')?.remove();
      } else {
        $cartBar.style.display = 'none';
      }
    } catch (_) {}
  }

  function processActions(actions) {
    for (const action of actions) {
      switch (action.type) {
        case 'add_to_cart': {
          const total = addToLocalCart(action.slug, action.name, action.price, action.quantity || 1, action.image_url || null);
          if (total !== null) showViewCartPill(total);
          break;
        }
        case 'open_drawer':
          if (typeof window.openDrawer === 'function') {
            window.openDrawer();
          }
          break;
        case 'navigate':
          if (action.url) {
            setTimeout(() => { window.location.href = action.url; }, 1500);
          }
          break;
        case 'show_human_contact':
          appendSystemMsg('Our support team has been notified. They will reach out to you shortly via email.');
          break;
        case 'show_products':
          if (action.products && action.products.length) {
            renderProductCards(action.products);
          }
          break;
        case 'show_cart':
          renderCartCard();
          break;
        case 'show_order':
          if (action.order) renderOrderCard(action.order);
          break;
        case 'show_order_confirmation':
          renderThankYouCard(action);
          // Clear cart from localStorage after successful order
          localStorage.removeItem('siculera_cart');
          window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart: [], source: 'sic-widget' } }));
          // Remove the View Cart pill since cart is now empty
          $quickReplies.querySelector('[data-view-cart]')?.remove();
          break;
      }
    }
  }

  /* ── Product card carousel ───────────────────────────────────────────────── */
  const FLAVOUR_STYLES = [
    { keys: ['pistachio','pistacchio'], bg: 'linear-gradient(135deg,#3d7a4a,#1e4a2a)', emoji: '🌿' },
    { keys: ['nougat','torrone'],       bg: 'linear-gradient(135deg,#b8975a,#6a4a10)', emoji: '🍬' },
    { keys: ['almond','mandorla'],      bg: 'linear-gradient(135deg,#c49040,#7a5010)', emoji: '🍯' },
    { keys: ['amaretti'],               bg: 'linear-gradient(135deg,#c07a30,#804010)', emoji: '🍪' },
    { keys: ['hazelnut','nocciola'],    bg: 'linear-gradient(135deg,#9a5a2a,#5a3010)', emoji: '🌰' },
    { keys: ['sesame','brittle','cubbaita'], bg: 'linear-gradient(135deg,#c8a030,#806800)', emoji: '✨' },
    { keys: ['marzipan','martorana','frutta'], bg: 'linear-gradient(135deg,#c85060,#7a2030)', emoji: '🎨' },
    { keys: ['citrus','lemon','orange'], bg: 'linear-gradient(135deg,#e0940a,#a06000)', emoji: '🍋' }
  ];

  function getFlavourStyle(flavour) {
    const f = (flavour || '').toLowerCase();
    for (const style of FLAVOUR_STYLES) {
      if (style.keys.some(k => f.includes(k))) return style;
    }
    return { bg: 'linear-gradient(135deg,#27312a,#1a2220)', emoji: '✨' };
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const PRODUCT_TRANSLATIONS = {
    it: {
      'traditional-almond-paste': {
        name: 'Paste di Mandorla Siciliana Tradizionale',
        description: 'Il classico senza tempo, semplice e inconfondibilmente siciliano.'
      },
      'lemon-almond-paste': {
        name: 'Pasta di Mandorla al Limone',
        description: 'Fresca luminosità agrumata con una delicata base di mandorle.'
      },
      'orange-almond-paste': {
        name: 'Pasta di Mandorla all’Arancia',
        description: 'Calda, fragrante e ricca di carattere mediterraneo.'
      },
      'pistachio-almond-paste': {
        name: 'Pasta di Mandorla al Pistacchio',
        description: 'Liscia, più ricca e naturalmente più golosa.'
      },
      'apricot-jam-almond-paste': {
        name: 'Pasta di Mandorla con Confettura di Albicocca',
        description: 'Dolcezza morbida di frutta con un finale di mandorle raffinato.'
      },
      'caramelized-cherry-almond': {
        name: 'Pasta di Mandorla con Ciliegie Caramellate',
        description: 'Elegante, distintiva e ideale per un regalo memorabile.'
      }
    }
  };

  function getProductKey(p) {
    const source = p.slug || p.id || p.name || p.title || '';
    return String(source).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }

  function getProductTranslation(p) {
    const key = getProductKey(p);
    return PRODUCT_TRANSLATIONS[chatLocale] && PRODUCT_TRANSLATIONS[chatLocale][key] ? PRODUCT_TRANSLATIONS[chatLocale][key] : null;
  }

  function getProductName(p) {
    const translation = getProductTranslation(p);
    if (translation && translation.name) return translation.name;
    return p.name || p.title || p.product_name || p.slug || p.id || 'Product';
  }

  function getProductDescription(p) {
    const translation = getProductTranslation(p);
    if (translation && translation.description) return translation.description;
    return p.description || p.note || p.notes || '';
  }

  function renderProductCards(products) {
    const wrap = document.createElement('div');
    wrap.className = 'sic-products-wrap';

    const label = document.createElement('div');
    label.className = 'sic-products-label';
    label.textContent = chatTranslate('productCollectionLabel', { count: products.length, plural: products.length !== 1 ? 's' : '' });
    wrap.appendChild(label);

    const row = document.createElement('div');
    row.className = 'sic-products-row';

    products.forEach(p => {
      const productName = getProductName(p);
      const style = getFlavourStyle(p.flavour);
      const card  = document.createElement('div');
      card.className = 'sic-product-card';

      // Image area — real photo if available, emoji fallback otherwise
      const imgDiv = document.createElement('div');
      imgDiv.className = 'sic-card-img';
      imgDiv.style.background = style.bg;
      const imageUrl = p.image_url || localProductImage(p.slug);
      if (imageUrl) {
        const img = document.createElement('img');
        img.src = imageUrl; img.alt = productName;
        img.className = 'sic-card-real-img'; img.loading = 'lazy';
        imgDiv.appendChild(img);
      } else {
        const emo = document.createElement('div');
        emo.className = 'sic-card-emoji'; emo.textContent = style.emoji;
        imgDiv.appendChild(emo);
      }
      if (p.giftable) {
        const badge = document.createElement('div');
        badge.className = 'sic-card-gift-badge'; badge.textContent = chatTranslate('giftBadge');
        imgDiv.appendChild(badge);
      }
      card.appendChild(imgDiv);

      // Body
      const body = document.createElement('div');
      body.className = 'sic-card-body';
      body.innerHTML = `
        <div class="sic-card-name">${escHtml(productName)}</div>
        <div class="sic-card-desc">${escHtml(getProductDescription(p))}</div>
        <div class="sic-card-meta">
          <span class="sic-card-price">€${escHtml(String(p.price_eur))}</span>
          <span class="sic-card-weight">${escHtml(String(p.weight_g))}g</span>
        </div>
      `;

      // Add to Cart button
      const btn = document.createElement('button');
      btn.className = 'sic-card-btn';
      btn.textContent = p.in_stock ? `🛒 ${chatTranslate('addToCart')}` : chatTranslate('outOfStock');
      if (!p.in_stock) btn.disabled = true;
      if (p.in_stock) {
        btn.addEventListener('click', () => {
          btn.textContent = chatTranslate('addedToCart');
          btn.classList.add('sic-added');
          btn.disabled = true;
          addToLocalCart(p.slug, productName, parseFloat(p.price_eur), 1, p.image_url || localProductImage(p.slug));
          const total = JSON.parse(localStorage.getItem('siculera_cart') || '[]').reduce((s, x) => s + (x.qty || 1), 0);
          showViewCartPill(total);
          window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart: JSON.parse(localStorage.getItem('siculera_cart')||'[]'), source: 'sic-widget' } }));
          setTimeout(() => { btn.textContent = `🛒 ${chatTranslate('addToCart')}`; btn.classList.remove('sic-added'); btn.disabled = false; }, 2000);
        });
      }
      body.appendChild(btn);

      // View Details link
      const detailsBtn = document.createElement('button');
      detailsBtn.className = 'sic-card-details-btn';
      detailsBtn.textContent = chatTranslate('viewDetails');
      detailsBtn.addEventListener('click', () => renderProductDetailCard(p));
      body.appendChild(detailsBtn);

      card.appendChild(body);
      row.appendChild(card);
    });

    wrap.appendChild(row);
    $messages.insertBefore(wrap, $typing);
    scrollToBottom();
  }

  function guessFlavour(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('pistachio') || n.includes('pistacchio')) return 'pistachio';
    if (n.includes('lemon') || n.includes('citrus')) return 'citrus';
    if (n.includes('orange')) return 'citrus';
    if (n.includes('hazelnut') || n.includes('nocciola')) return 'hazelnut';
    if (n.includes('apricot') || n.includes('cherry') || n.includes('fruit')) return 'marzipan';
    return 'almond';
  }

  function renderProductDetailCard(p) {
    // Remove any existing detail card
    $messages.querySelector('.sic-detail-card')?.remove();

    const card = document.createElement('div');
    card.className = 'sic-detail-card';

    const productName = getProductName(p);
    const style = getFlavourStyle(p.flavour || guessFlavour(productName));

    // ← Back button (full-width bar above image)
    const backBtn = document.createElement('button');
    backBtn.className = 'sic-detail-back';
    backBtn.textContent = chatTranslate('backToProducts');
    backBtn.addEventListener('click', () => card.remove());
    card.appendChild(backBtn);

    // Image / emoji area
    const imgArea = document.createElement('div');
    imgArea.className = 'sic-detail-img';
    imgArea.style.background = style.bg;
    const imageUrl = p.image_url || localProductImage(p.slug);
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl; img.alt = productName;
      img.className = 'sic-detail-real-img';
      imgArea.appendChild(img);
    } else {
      const emo = document.createElement('div');
      emo.className = 'sic-detail-emoji'; emo.textContent = style.emoji;
      imgArea.appendChild(emo);
    }
    card.appendChild(imgArea);

    // Body
    const body = document.createElement('div');
    body.className = 'sic-detail-body';

    const nameRow = document.createElement('div');
    nameRow.className = 'sic-detail-name-row';
    const nameEl = document.createElement('div');
    nameEl.className = 'sic-detail-name'; nameEl.textContent = productName;
    nameRow.appendChild(nameEl);
    if (p.giftable || p.is_giftable) {
      const badge = document.createElement('span');
      badge.className = 'sic-detail-badge'; badge.textContent = chatTranslate('perfectGift');
      nameRow.appendChild(badge);
    }
    body.appendChild(nameRow);

    const price = parseFloat(p.price_eur || (p.price_cents / 100) || 0);
    const weight = p.weight_g || p.weight_grams || 0;
    const metaRow = document.createElement('div');
    metaRow.className = 'sic-detail-meta';
    const priceEl = document.createElement('span'); priceEl.className = 'sic-detail-price'; priceEl.textContent = `€${price.toFixed(2)}`;
    const weightEl = document.createElement('span'); weightEl.className = 'sic-detail-weight'; weightEl.textContent = `${weight}g`;
    metaRow.appendChild(priceEl); metaRow.appendChild(weightEl);
    body.appendChild(metaRow);

    if (p.flavour) {
      const flavourTag = document.createElement('div');
      flavourTag.className = 'sic-detail-flavour';
      flavourTag.textContent = p.flavour.charAt(0).toUpperCase() + p.flavour.slice(1).replace(/_/g, ' ');
      body.appendChild(flavourTag);
    }

    const productDescription = getProductDescription(p);
    if (productDescription) {
      const desc = document.createElement('p');
      desc.className = 'sic-detail-desc'; desc.textContent = productDescription;
      body.appendChild(desc);
    }

    card.appendChild(body);

    // Footer: qty selector + Add to Cart
    const footerDiv = document.createElement('div');
    footerDiv.className = 'sic-detail-footer';

    let qty = 1;
    const qtyRow = document.createElement('div');
    qtyRow.className = 'sic-detail-qty-row';
    const qtyLabel = document.createElement('span');
    qtyLabel.className = 'sic-detail-qty-label'; qtyLabel.textContent = chatTranslate('quantityLabel');

    const qtyCtrl = document.createElement('div');
    qtyCtrl.className = 'sic-detail-qty-ctrl';
    const btnMinus = document.createElement('button'); btnMinus.className = 'sic-detail-qty-btn'; btnMinus.textContent = '−';
    const qtyNum   = document.createElement('span');   qtyNum.className   = 'sic-detail-qty-num'; qtyNum.textContent = '1';
    const btnPlus  = document.createElement('button'); btnPlus.className  = 'sic-detail-qty-btn'; btnPlus.textContent = '+';

    const updateQty = (delta) => {
      qty = Math.max(1, qty + delta);
      qtyNum.textContent = qty;
      if (p.in_stock !== false) atcBtn.textContent = qty > 1 ? `${chatTranslate('addToCart')} ${qty}× →` : `${chatTranslate('addToCart')} →`;
    };
    btnMinus.addEventListener('click', () => updateQty(-1));
    btnPlus.addEventListener('click',  () => updateQty(+1));

    qtyCtrl.appendChild(btnMinus); qtyCtrl.appendChild(qtyNum); qtyCtrl.appendChild(btnPlus);
    qtyRow.appendChild(qtyLabel); qtyRow.appendChild(qtyCtrl);
    footerDiv.appendChild(qtyRow);

    const atcBtn = document.createElement('button');
    atcBtn.className = 'sic-detail-atc';
    const inStock = p.in_stock !== false && (p.stock === undefined || p.stock > 0);
    atcBtn.textContent = inStock ? `${chatTranslate('addToCart')} →` : chatTranslate('outOfStock');
    if (!inStock) atcBtn.disabled = true;

    if (inStock) {
      atcBtn.addEventListener('click', () => {
        const newQty = addToLocalCart(p.slug, productName, price, qty, p.image_url || localProductImage(p.slug));
        if (newQty !== null) {
          window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart: JSON.parse(localStorage.getItem('siculera_cart') || '[]'), source: 'sic-widget' } }));
          atcBtn.textContent = qty > 1 ? chatTranslate('addedQuantityToCart', { count: qty }) : chatTranslate('addedToCart');
          atcBtn.style.background = 'var(--sic-success)';
          setTimeout(() => {
            atcBtn.textContent = qty > 1 ? `${chatTranslate('addToCart')} ${qty}× →` : `${chatTranslate('addToCart')} →`;
            atcBtn.style.background = '';
          }, 2000);
        }
      });
    }

    footerDiv.appendChild(atcBtn);
    card.appendChild(footerDiv);

    $messages.insertBefore(card, $typing);
    requestAnimationFrame(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  /* ── Cart card ───────────────────────────────────────────────────────────── */
  // silent=true: replace card in-place without scrolling (background sync)
  function renderCartCard(silent) {
    const prev = $messages.querySelector('.sic-cart-card');
    // Remember the node after the old card so we can restore its position
    const insertRef = prev ? prev.nextSibling : $typing;
    if (prev) prev.remove();

    const cartRaw = getCartContext();
    let items = [];
    if (Array.isArray(cartRaw)) items = cartRaw;
    else if (cartRaw && Array.isArray(cartRaw.items)) items = cartRaw.items;
    else if (cartRaw && Array.isArray(cartRaw.cart)) items = cartRaw.cart;

    const card = document.createElement('div');
    card.className = 'sic-cart-card';

    const header = document.createElement('div');
    header.className = 'sic-cart-header';

    if (!items.length) {
      header.textContent = `🛒 ${chatTranslate('yourCart')}`;
      card.appendChild(header);
      const empty = document.createElement('div');
      empty.className = 'sic-cart-empty';
      empty.textContent = chatTranslate('yourCartEmpty');
      card.appendChild(empty);
    } else {
      // Helper: save cart back to localStorage and update pill
      function saveCart(newItems) {
        localStorage.setItem('siculera_cart', JSON.stringify(newItems));
        const total = newItems.reduce((s, x) => s + x.qty, 0);
        window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart: newItems, source: 'sic-widget' } }));
        if (total > 0) {
          showViewCartPill(total); // also calls updateCartBar()
        } else {
          $quickReplies.querySelector('[data-view-cart]')?.remove();
          updateCartBar(); // hide bar when cart empties
        }
      }

      function rebuildCard() {
        renderCartCard();
      }

      const totalQty = items.reduce((s, i) => s + (parseInt(i.qty || i.quantity) || 1), 0);
      header.textContent = `🛒 ${chatTranslate('yourCart')} (${chatTranslate('itemCount', { count: totalQty })})`;
      card.appendChild(header);

      items.forEach((item, idx) => {
        const price = parseFloat(item.price || item.price_eur || item.unit_price || 0);
        const qty   = parseInt(item.qty || item.quantity) || 1;
        const image = item.image || item.image_url || localProductImage(item.slug || item.id);

        const row = document.createElement('div');
        row.className = 'sic-cart-item';

        if (image) {
          const thumb = document.createElement('img');
          thumb.className = 'sic-cart-item-thumb';
          thumb.src = image;
          thumb.alt = item.name || item.slug || 'Product image';
          row.appendChild(thumb);
        }

        const name = document.createElement('span');
        name.className = 'sic-cart-item-name';
        name.textContent = item.name || item.slug || 'Item';

        const ctrl = document.createElement('div');
        ctrl.className = 'sic-cart-qty-ctrl';

        const btnMinus = document.createElement('button');
        btnMinus.className = 'sic-cart-qty-btn';
        btnMinus.textContent = '−';
        btnMinus.title = chatTranslate('decrease');
        btnMinus.addEventListener('click', () => {
          const cart = JSON.parse(localStorage.getItem('siculera_cart') || '[]');
          const entry = cart.find(x => x.id === item.id);
          if (!entry) return;
          if (entry.qty <= 1) {
            cart.splice(cart.indexOf(entry), 1);
          } else {
            entry.qty -= 1;
          }
          saveCart(cart);
          rebuildCard();
        });

        const qtyNum = document.createElement('span');
        qtyNum.className = 'sic-cart-qty-num';
        qtyNum.textContent = qty;

        const btnPlus = document.createElement('button');
        btnPlus.className = 'sic-cart-qty-btn';
        btnPlus.textContent = '+';
        btnPlus.title = chatTranslate('increase');
        btnPlus.addEventListener('click', () => {
          const cart = JSON.parse(localStorage.getItem('siculera_cart') || '[]');
          const entry = cart.find(x => x.id === item.id);
          if (entry) entry.qty += 1;
          saveCart(cart);
          rebuildCard();
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'sic-cart-del';
        btnDel.textContent = '×';
        btnDel.title = chatTranslate('remove');
        btnDel.addEventListener('click', () => {
          const cart = JSON.parse(localStorage.getItem('siculera_cart') || '[]');
          const i2 = cart.findIndex(x => x.id === item.id);
          if (i2 !== -1) cart.splice(i2, 1);
          saveCart(cart);
          rebuildCard();
        });

        const priceSpan = document.createElement('span');
        priceSpan.className = 'sic-cart-item-price';
        priceSpan.textContent = `€${(price * qty).toFixed(2)}`;

        ctrl.appendChild(btnMinus);
        ctrl.appendChild(qtyNum);
        ctrl.appendChild(btnPlus);
        ctrl.appendChild(btnDel);

        row.appendChild(name);
        row.appendChild(ctrl);
        row.appendChild(priceSpan);
        card.appendChild(row);
      });

      const cartTotal = items.reduce((sum, i) => {
        const price = parseFloat(i.price || i.price_eur || i.unit_price || 0);
        return sum + price * (parseInt(i.qty || i.quantity) || 1);
      }, 0);

      const footer = document.createElement('div');
      footer.className = 'sic-cart-footer';
      footer.innerHTML = `<span class="sic-cart-total-label">${chatTranslate('cartTotalLabel')}</span><span class="sic-cart-total-amount">€${cartTotal.toFixed(2)}</span>`;
      card.appendChild(footer);

      const actionRow = document.createElement('div');
      actionRow.className = 'sic-cart-action-row';

      const continueBtn = document.createElement('button');
      continueBtn.className = 'sic-co-continue-btn';
      continueBtn.textContent = chatTranslate('continueShopping');
      continueBtn.addEventListener('click', () => closePanel());

      const checkoutBtn = document.createElement('button');
      checkoutBtn.className = 'sic-cart-checkout-btn';
      checkoutBtn.textContent = chatTranslate('proceedToCheckout');
      checkoutBtn.addEventListener('click', () => startCheckout());

      actionRow.appendChild(continueBtn);
      actionRow.appendChild(checkoutBtn);
      card.appendChild(actionRow);
    }

    // Insert at original position (silent/background update) or at bottom (user-initiated)
    $messages.insertBefore(card, silent ? (insertRef || $typing) : $typing);
    if (!silent) scrollToBottom();
  }

  /* ── Checkout flow ───────────────────────────────────────────────────────── */

  function removeCheckoutCards() {
    $messages.querySelectorAll('.sic-co-card').forEach(el => el.remove());
  }

  function makeCoCard(title, bodyEl, footerEl) {
    const card = document.createElement('div');
    card.className = 'sic-co-card';
    const hdr = document.createElement('div');
    hdr.className = 'sic-co-header';
    hdr.textContent = title;
    card.appendChild(hdr);
    card.appendChild(bodyEl);
    if (footerEl) card.appendChild(footerEl);
    $messages.insertBefore(card, $typing);
    // Scroll so the top of the card is visible (not the bottom)
    requestAnimationFrame(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return card;
  }

  function makeCoFooter(onBack, backLabel, onNext, nextLabel) {
    const footer = document.createElement('div');
    footer.className = 'sic-co-footer';
    if (onBack) {
      const btn = document.createElement('button');
      btn.className = 'sic-co-btn-back';
      btn.textContent = backLabel || '← Back';
      btn.addEventListener('click', onBack);
      footer.appendChild(btn);
    }
    const btnNext = document.createElement('button');
    btnNext.className = 'sic-co-btn-next';
    btnNext.textContent = nextLabel || 'Next →';
    btnNext.addEventListener('click', onNext);
    footer.appendChild(btnNext);
    return { footer, btnNext };
  }

  function showCoErr(el, msg) {
    el.textContent = msg;
    el.classList.add('sic-visible');
  }

  function makeCoInput(key, type, placeholder, value, inputs) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'sic-co-field';
    const label = document.createElement('label');
    label.className = 'sic-co-label';
    label.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const inp = document.createElement('input');
    inp.className = 'sic-co-input';
    inp.type = type;
    inp.placeholder = placeholder;
    inp.value = value || '';
    inp.addEventListener('input', () => inp.classList.remove('sic-err'));
    inputs[key] = inp;
    fieldDiv.appendChild(label);
    fieldDiv.appendChild(inp);
    return fieldDiv;
  }

  function startCheckout() {
    const cartRaw = getCartContext();
    let items = [];
    if (Array.isArray(cartRaw)) items = cartRaw;
    else if (cartRaw && Array.isArray(cartRaw.items)) items = cartRaw.items;
    else if (cartRaw && Array.isArray(cartRaw.cart))  items = cartRaw.cart;

    if (!items.length) {
      appendSystemMsg(chatTranslate('emptyCartWarning'));
      return;
    }
    checkoutState = { step: 'details', items };
    renderDetailsCard();
  }

  function renderDetailsCard() {
    removeCheckoutCards();
    const user = getUserContext() || {};
    const inputs = {};
    const body = document.createElement('div');
    body.className = 'sic-co-body';

    // First + Last name on one row
    const nameRow = document.createElement('div');
    nameRow.className = 'sic-co-field-row';
    const fnDiv = makeCoInput('first_name', 'text', 'Giovanni', user.first_name || '', inputs);
    fnDiv.querySelector('label').textContent = 'First Name';
    const lnDiv = makeCoInput('last_name', 'text', 'Russo', user.last_name || '', inputs);
    lnDiv.querySelector('label').textContent = 'Last Name';
    nameRow.appendChild(fnDiv);
    nameRow.appendChild(lnDiv);
    body.appendChild(nameRow);

    body.appendChild(makeCoInput('email', 'email', 'giovanni@example.com', user.email || '', inputs));
    inputs.email.parentElement.querySelector('label').textContent = 'Email';
    body.appendChild(makeCoInput('phone', 'tel', '+39 333 000 0000', user.phone || '', inputs));
    inputs.phone.parentElement.querySelector('label').textContent = 'Phone';

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    body.appendChild(errMsg);

    const { footer } = makeCoFooter(null, null, () => {
      const fn = inputs.first_name.value.trim();
      const ln = inputs.last_name.value.trim();
      const em = inputs.email.value.trim();
      const ph = inputs.phone.value.trim();
      if (!fn) { inputs.first_name.classList.add('sic-err'); showCoErr(errMsg, 'Please enter your first name.'); return; }
      if (!ln) { inputs.last_name.classList.add('sic-err');  showCoErr(errMsg, 'Please enter your last name.'); return; }
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { inputs.email.classList.add('sic-err'); showCoErr(errMsg, 'Please enter a valid email.'); return; }
      if (!ph) { inputs.phone.classList.add('sic-err'); showCoErr(errMsg, 'Please enter your phone number.'); return; }
      checkoutState.details = { first_name: fn, last_name: ln, email: em, phone: ph };
      renderAddressCard();
    }, 'Next →');

    makeCoCard('📋 Your Details', body, footer);
    // Focus first empty field
    setTimeout(() => (inputs.first_name.value ? inputs.email : inputs.first_name).focus(), 80);
  }

  function renderAddressCard() {
    removeCheckoutCards();
    const user = getUserContext() || {};
    const addr = user.address || {};
    const inputs = {};
    const body = document.createElement('div');
    body.className = 'sic-co-body';

    const streetDiv = makeCoInput('street', 'text', 'Via Roma 1', addr.street || addr.address || '', inputs);
    streetDiv.querySelector('label').textContent = 'Street Address';
    body.appendChild(streetDiv);

    const cityDiv = makeCoInput('city', 'text', 'Palermo', addr.city || '', inputs);
    cityDiv.querySelector('label').textContent = 'City';
    body.appendChild(cityDiv);

    // Postal + Country on same row
    const pcRow = document.createElement('div');
    pcRow.className = 'sic-co-field-row';

    const postalDiv = makeCoInput('postal', 'text', '90100', addr.postal || addr.postcode || '', inputs);
    postalDiv.querySelector('label').textContent = 'Postal Code';

    const countryDiv = document.createElement('div');
    countryDiv.className = 'sic-co-field';
    const cLabel = document.createElement('label');
    cLabel.className = 'sic-co-label';
    cLabel.textContent = 'Country';
    const cSelect = document.createElement('select');
    cSelect.className = 'sic-co-select';
    [['IT','Italy'],['FR','France'],['DE','Germany'],['ES','Spain'],['NL','Netherlands'],
     ['BE','Belgium'],['AT','Austria'],['CH','Switzerland'],['GB','United Kingdom'],
     ['US','United States'],['OTHER','Other']
    ].forEach(([code, name]) => {
      const opt = document.createElement('option');
      opt.value = code; opt.textContent = name;
      if (code === 'IT') opt.selected = true;
      cSelect.appendChild(opt);
    });
    inputs.country = cSelect;
    countryDiv.appendChild(cLabel);
    countryDiv.appendChild(cSelect);

    pcRow.appendChild(postalDiv);
    pcRow.appendChild(countryDiv);
    body.appendChild(pcRow);

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    body.appendChild(errMsg);

    const { footer } = makeCoFooter(
      () => renderDetailsCard(), '← Back',
      () => {
        const street  = inputs.street.value.trim();
        const city    = inputs.city.value.trim();
        const postal  = inputs.postal.value.trim();
        const country = inputs.country.value;
        if (!street) { inputs.street.classList.add('sic-err'); showCoErr(errMsg, 'Please enter your street address.'); return; }
        if (!city)   { inputs.city.classList.add('sic-err');   showCoErr(errMsg, 'Please enter your city.'); return; }
        if (!postal) { inputs.postal.classList.add('sic-err'); showCoErr(errMsg, 'Please enter your postal code.'); return; }
        checkoutState.address = { street, city, postal, country };
        renderShippingCard();
      }, 'Next →'
    );

    makeCoCard('📍 Delivery Address', body, footer);
  }

  function renderShippingCard() {
    removeCheckoutCards();
    let selectedId = checkoutState.shipping ? checkoutState.shipping.id : null;
    const dots = [];

    const body = document.createElement('div');
    body.className = 'sic-co-body';
    body.style.cssText = 'padding: 8px 14px 4px';

    SHIPPING_OPTIONS.forEach((opt, i) => {
      const row = document.createElement('div');
      row.className = 'sic-co-radio-option';

      const dot = document.createElement('div');
      dot.className = 'sic-co-radio-dot' + (selectedId === opt.id ? ' sic-sel' : '');
      dots.push(dot);

      const info = document.createElement('div');
      info.className = 'sic-co-radio-info';
      const nm = document.createElement('div'); nm.className = 'sic-co-radio-name'; nm.textContent = opt.label;
      const ds = document.createElement('div'); ds.className = 'sic-co-radio-desc'; ds.textContent = opt.days;
      info.appendChild(nm); info.appendChild(ds);

      const pr = document.createElement('div');
      pr.className = 'sic-co-radio-price';
      pr.textContent = `€${opt.price.toFixed(2)}`;

      row.appendChild(dot); row.appendChild(info); row.appendChild(pr);
      body.appendChild(row);

      row.addEventListener('click', () => {
        selectedId = opt.id;
        dots.forEach((d, j) => d.classList.toggle('sic-sel', SHIPPING_OPTIONS[j].id === selectedId));
      });
    });

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    body.appendChild(errMsg);

    const { footer } = makeCoFooter(
      () => renderAddressCard(), '← Back',
      () => {
        if (!selectedId) { showCoErr(errMsg, 'Please select a shipping method.'); return; }
        checkoutState.shipping = SHIPPING_OPTIONS.find(o => o.id === selectedId);
        renderPaymentCard();
      }, 'Next →'
    );

    makeCoCard('🚚 Shipping Method', body, footer);
  }

  function renderPaymentCard() {
    removeCheckoutCards();
    let selectedId = checkoutState.payment ? checkoutState.payment.id : null;
    const dots = [];

    const body = document.createElement('div');
    body.className = 'sic-co-body';
    body.style.cssText = 'padding: 8px 14px 4px';

    PAYMENT_OPTIONS.forEach((opt, i) => {
      const row = document.createElement('div');
      row.className = 'sic-co-radio-option';

      const dot = document.createElement('div');
      dot.className = 'sic-co-radio-dot' + (selectedId === opt.id ? ' sic-sel' : '');
      dots.push(dot);

      const info = document.createElement('div');
      info.className = 'sic-co-radio-info';
      const nm = document.createElement('div'); nm.className = 'sic-co-radio-name'; nm.textContent = opt.label;
      const ds = document.createElement('div'); ds.className = 'sic-co-radio-desc'; ds.textContent = opt.desc;
      info.appendChild(nm); info.appendChild(ds);

      row.appendChild(dot); row.appendChild(info);
      body.appendChild(row);

      row.addEventListener('click', () => {
        selectedId = opt.id;
        dots.forEach((d, j) => d.classList.toggle('sic-sel', PAYMENT_OPTIONS[j].id === selectedId));
      });
    });

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    body.appendChild(errMsg);

    const { footer } = makeCoFooter(
      () => renderShippingCard(), '← Back',
      () => {
        if (!selectedId) { showCoErr(errMsg, 'Please select a payment method.'); return; }
        checkoutState.payment = PAYMENT_OPTIONS.find(o => o.id === selectedId);
        renderOrderReviewCard();
      }, 'Review Order →'
    );

    makeCoCard('💳 Payment Method', body, footer);
  }

  function renderOrderReviewCard() {
    removeCheckoutCards();
    const s      = checkoutState;
    const cod    = s.payment.id === 'cash_on_delivery' ? 2.00 : 0;
    const subtotal = s.items.reduce((sum, i) => {
      return sum + parseFloat(i.price || 0) * (parseInt(i.qty || i.quantity) || 1);
    }, 0);
    const total  = subtotal + s.shipping.price + cod;

    const card = document.createElement('div');
    card.className = 'sic-co-card';

    const hdr = document.createElement('div');
    hdr.className = 'sic-co-header';
    hdr.textContent = '📋 Review Your Order';
    card.appendChild(hdr);

    // Items — with thumbnails
    const secItems = document.createElement('div');
    secItems.className = 'sic-co-section-title';
    secItems.style.cssText = 'padding: 10px 14px 4px';
    secItems.textContent = 'Items';
    card.appendChild(secItems);
    s.items.forEach(i => card.appendChild(makeReviewItemRow(i)));

    card.appendChild(makeDivider());

    // Delivery — with inline Edit link
    card.appendChild(makeReviewSection('Delivery To', () => renderDetailsCard()));
    card.appendChild(makeReviewRow('Name',    `${s.details.first_name} ${s.details.last_name}`));
    card.appendChild(makeReviewRow('Address', `${s.address.street}, ${s.address.city} ${s.address.postal}, ${s.address.country}`));
    card.appendChild(makeReviewRow('Phone',   s.details.phone));
    card.appendChild(makeReviewRow('Email',   s.details.email));

    card.appendChild(makeDivider());

    // Shipping & Payment — with inline Edit link
    card.appendChild(makeReviewSection('Shipping & Payment', () => renderShippingCard()));
    card.appendChild(makeReviewRow('Courier',  s.shipping.label));
    card.appendChild(makeReviewRow('Delivery', s.shipping.days));
    card.appendChild(makeReviewRow('Shipping', `€${s.shipping.price.toFixed(2)}`));
    card.appendChild(makeReviewRow('Payment',  s.payment.label));
    if (cod > 0) card.appendChild(makeReviewRow('COD fee', `+€${cod.toFixed(2)}`));

    // Total
    const totalRow = document.createElement('div');
    totalRow.className = 'sic-co-total-row';
    const tl = document.createElement('span'); tl.className = 'sic-co-total-label'; tl.textContent = 'Total';
    const ta = document.createElement('span'); ta.className = 'sic-co-total-amount'; ta.textContent = `€${total.toFixed(2)}`;
    totalRow.appendChild(tl); totalRow.appendChild(ta);
    card.appendChild(totalRow);

    card.appendChild(makeDivider());

    // ── Terms & Shipping Policy (expandable) ──
    const termsWrap = document.createElement('div');
    termsWrap.className = 'sic-co-terms-wrap';

    const termsToggle = document.createElement('button');
    termsToggle.className = 'sic-co-terms-toggle';
    termsToggle.textContent = 'View Shipping Policy & Terms ▾';
    termsWrap.appendChild(termsToggle);

    const termsPanel = document.createElement('div');
    termsPanel.className = 'sic-co-terms-panel';
    termsPanel.innerHTML = [
      '<strong>Shipping Policy</strong>',
      'Orders are processed within 1–2 business days. Delivery times vary by courier:',
      '• <strong>Poste Italiane</strong>: 3–5 business days · €4.90',
      '• <strong>BRT / SDA</strong>: 2–4 business days · €6.90',
      '• <strong>UPS Standard</strong>: 2–3 business days · €7.90',
      '• <strong>DHL Express</strong>: 1–2 business days · €9.90',
      '',
      'We ship across Europe. A confirmation email with tracking details will be sent once your order is dispatched.',
      '',
      '<strong>Returns & Refunds</strong>',
      'Due to the perishable nature of our products, returns are not accepted. If your order arrives damaged, please contact us within 48 hours with a photo and we will arrange a replacement.',
      '',
      '<strong>Cash on Delivery</strong>',
      'A €2.00 handling fee applies. Payment is made to the courier upon delivery.',
    ].join('<br>');
    termsWrap.appendChild(termsPanel);

    let termsOpen = false;
    termsToggle.addEventListener('click', () => {
      termsOpen = !termsOpen;
      termsPanel.classList.toggle('sic-co-terms-open', termsOpen);
      termsToggle.textContent = termsOpen ? 'Hide Shipping Policy & Terms ▴' : 'View Shipping Policy & Terms ▾';
    });

    card.appendChild(termsWrap);

    // Terms acceptance checkbox (required)
    const termsRow = document.createElement('div');
    termsRow.className = 'sic-co-confirm-row';
    const chkTerms = document.createElement('input');
    chkTerms.type = 'checkbox'; chkTerms.className = 'sic-co-confirm-check'; chkTerms.id = 'sic-co-chk-terms';
    const chkTermsLabel = document.createElement('label');
    chkTermsLabel.htmlFor = 'sic-co-chk-terms'; chkTermsLabel.className = 'sic-co-confirm-label';
    chkTermsLabel.textContent = 'I have read and agree to the Shipping Policy & Terms above.';
    termsRow.appendChild(chkTerms); termsRow.appendChild(chkTermsLabel);
    card.appendChild(termsRow);

    // Marketing opt-in checkbox (pre-checked, optional)
    const mktRow = document.createElement('div');
    mktRow.className = 'sic-co-mkt-row';
    const chkMkt = document.createElement('input');
    chkMkt.type = 'checkbox'; chkMkt.className = 'sic-co-confirm-check'; chkMkt.id = 'sic-co-chk-mkt';
    chkMkt.checked = true; // opt-in by default
    const chkMktLabel = document.createElement('label');
    chkMktLabel.htmlFor = 'sic-co-chk-mkt'; chkMktLabel.className = 'sic-co-mkt-label';
    chkMktLabel.textContent = 'Keep me updated with Siculera news & special offers.';
    mktRow.appendChild(chkMkt); mktRow.appendChild(chkMktLabel);
    card.appendChild(mktRow);

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    card.appendChild(errMsg);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'sic-co-footer';

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'sic-co-btn-confirm';
    btnConfirm.style.cssText = 'width:100%; flex:1 1 auto';
    const isOnlinePayment = (s.payment.id === 'stripe' || s.payment.id === 'paypal');
    btnConfirm.textContent = isOnlinePayment ? 'Proceed to Payment →' : 'Confirm & Place Order';
    btnConfirm.disabled = true;

    const updateConfirmBtn = () => { btnConfirm.disabled = !chkTerms.checked; };
    chkTerms.addEventListener('change', updateConfirmBtn);

    btnConfirm.addEventListener('click', async () => {
      if (!chkTerms.checked) { showCoErr(errMsg, 'Please accept the Shipping Policy & Terms to continue.'); return; }
      checkoutState.marketing_consent = chkMkt.checked;
      btnConfirm.disabled = true;
      errMsg.classList.remove('sic-visible');
      const pm = s.payment.id;
      if (pm === 'stripe') {
        renderStripePaymentCard(total);
      } else if (pm === 'paypal') {
        renderPayPalPaymentCard(total);
      } else {
        btnConfirm.textContent = 'Placing order…';
        try {
          await submitOrder(total, cod);
        } catch (e) {
          btnConfirm.disabled = false;
          btnConfirm.textContent = 'Confirm & Place Order';
          showCoErr(errMsg, e.message || 'Could not place order. Please try again.');
        }
      }
    });

    footer.appendChild(btnConfirm);
    card.appendChild(footer);

    $messages.insertBefore(card, $typing);
    requestAnimationFrame(() => { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  function makeReviewItemRow(i) {
    const qty = parseInt(i.qty || i.quantity) || 1;
    const row = document.createElement('div');
    row.className = 'sic-co-item-row';

    if (i.image) {
      const img = document.createElement('img');
      img.src = i.image; img.alt = i.name || ''; img.className = 'sic-co-item-thumb';
      row.appendChild(img);
    } else {
      const style = getFlavourStyle(guessFlavour(i.name || i.id));
      const emo = document.createElement('div');
      emo.className = 'sic-co-item-emoji'; emo.textContent = style.emoji;
      emo.style.background = style.bg;
      row.appendChild(emo);
    }

    const info = document.createElement('div');
    info.className = 'sic-co-item-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'sic-co-item-name'; nameEl.textContent = i.name || i.id;
    const qtyPrice = document.createElement('div');
    qtyPrice.className = 'sic-co-item-qty-price';
    qtyPrice.textContent = `×${qty}  ·  €${(parseFloat(i.price || 0) * qty).toFixed(2)}`;
    info.appendChild(nameEl); info.appendChild(qtyPrice);
    row.appendChild(info);
    return row;
  }

  function makeReviewSection(title, onEdit) {
    const row = document.createElement('div');
    row.className = 'sic-co-section-hdr';
    const t = document.createElement('span'); t.className = 'sic-co-section-title'; t.textContent = title;
    const e = document.createElement('button'); e.className = 'sic-co-section-edit'; e.textContent = 'Edit ✎';
    e.addEventListener('click', onEdit);
    row.appendChild(t); row.appendChild(e);
    return row;
  }

  function makeReviewRow(label, value) {
    const row = document.createElement('div');
    row.className = 'sic-co-review-row';
    const l = document.createElement('span'); l.className = 'sic-co-review-label'; l.textContent = label;
    const v = document.createElement('span'); v.className = 'sic-co-review-value'; v.textContent = value;
    row.appendChild(l); row.appendChild(v);
    return row;
  }

  function makeDivider() {
    const d = document.createElement('div'); d.className = 'sic-co-divider'; return d;
  }

  async function submitOrder(totalEur, codFee) {
    const s = checkoutState;
    const payload = {
      session_token: sessionToken,
      checkout_data: {
        first_name:      s.details.first_name,
        last_name:       s.details.last_name,
        email:           s.details.email,
        phone:           s.details.phone,
        street:          s.address.street,
        city:            s.address.city,
        postal:          s.address.postal,
        country:         s.address.country,
        shipping_method: s.shipping.id,
        shipping_label:  s.shipping.label,
        shipping_price:  s.shipping.price,
        payment_method:     s.payment.id,
        marketing_consent:  s.marketing_consent !== false,
        items:              s.items.map(i => ({
          slug:     i.id,
          quantity: parseInt(i.qty || i.quantity) || 1,
          name:     i.name,
          price:    parseFloat(i.price || 0)
        }))
      }
    };

    const data = await api('POST', '/order', payload);

    // Remove checkout + cart cards
    removeCheckoutCards();
    $messages.querySelector('.sic-cart-card')?.remove();

    // Render confirmation
    if (data.actions && data.actions.length) {
      processActions(data.actions);
    } else {
      renderThankYouCard({
        order_number:   data.order_number,
        total_eur:      data.total_eur || totalEur.toFixed(2),
        shipping_eur:   s.shipping.price.toFixed(2),
        payment_method: s.payment.id,
        email:          s.details.email,
        items:          s.items.map(i => ({
          name:       i.name,
          quantity:   parseInt(i.qty || i.quantity) || 1,
          unit_price: parseFloat(i.price || 0).toFixed(2)
        }))
      });
    }

    // Clear cart
    localStorage.removeItem('siculera_cart');
    window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart: [], source: 'sic-widget' } }));
    $quickReplies.querySelector('[data-view-cart]')?.remove();
    checkoutState = null;

    // Follow-up quick replies
    renderQuickReplies([chatTranslate('quickReplyBrowseMoreProducts'), chatTranslate('quickReplyTalkToHuman')]);
  }

  /* ── Payment helpers ─────────────────────────────────────────────────────── */

  /** Shared checkout_data shape for stripe/paypal confirm endpoints */
  function _buildCheckoutData(s) {
    return {
      first_name:      s.details.first_name,
      last_name:       s.details.last_name,
      email:           s.details.email,
      phone:           s.details.phone,
      street:          s.address.street,
      city:            s.address.city,
      postal:          s.address.postal,
      country:         s.address.country,
      shipping_method: s.shipping.id,
      shipping_label:  s.shipping.label,
      shipping_price:  s.shipping.price,
      payment_method:    s.payment.id,
      marketing_consent: s.marketing_consent !== false,
      items:             s.items.map(i => ({
        slug:     i.id,
        quantity: parseInt(i.qty || i.quantity) || 1,
        name:     i.name,
        price:    parseFloat(i.price || 0)
      }))
    };
  }

  /** Shared post-payment cleanup + thank-you */
  function finalizeAfterPayment(data, total) {
    const s = checkoutState;
    removeCheckoutCards();
    $messages.querySelector('.sic-cart-card')?.remove();
    renderThankYouCard({
      order_number:   data.order_number,
      total_eur:      data.total_eur || total.toFixed(2),
      shipping_eur:   s.shipping.price.toFixed(2),
      payment_method: s.payment.id,
      email:          s.details.email,
      items:          s.items.map(i => ({
        name:       i.name,
        quantity:   parseInt(i.qty || i.quantity) || 1,
        unit_price: parseFloat(i.price || 0).toFixed(2)
      }))
    });
    localStorage.removeItem('siculera_cart');
    window.dispatchEvent(new CustomEvent('siculeraCartUpdate', { detail: { cart: [], source: 'sic-widget' } }));
    $quickReplies.querySelector('[data-view-cart]')?.remove();
    checkoutState = null;
    renderQuickReplies([chatTranslate('quickReplyBrowseMoreProducts'), chatTranslate('quickReplyTalkToHuman')]);
  }

  /** Dynamically load Stripe.js and return an initialised Stripe instance */
  function loadStripeJs(publishableKey) {
    return new Promise((resolve, reject) => {
      if (window.Stripe) { resolve(window.Stripe(publishableKey)); return; }
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload  = () => resolve(window.Stripe(publishableKey));
      s.onerror = () => reject(new Error('Could not load Stripe'));
      document.head.appendChild(s);
    });
  }

  /** Dynamically load the PayPal JS SDK */
  function loadPayPalSdk(clientId) {
    return new Promise((resolve, reject) => {
      if (window.paypal) { resolve(); return; }
      const s = document.createElement('script');
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=EUR&intent=capture`;
      s.onload  = () => resolve();
      s.onerror = () => reject(new Error('Could not load PayPal'));
      document.head.appendChild(s);
    });
  }

  async function renderStripePaymentCard(total) {
    removeCheckoutCards();
    const s = checkoutState;
    const amountCents = Math.round(total * 100);

    const card = document.createElement('div');
    card.className = 'sic-co-card sic-payment-flow-card';

    const hdr = document.createElement('div');
    hdr.className = 'sic-co-header';
    hdr.textContent = '💳 Pay with Card';
    card.appendChild(hdr);

    const body = document.createElement('div');
    body.className = 'sic-co-body';

    const loader = document.createElement('div');
    loader.className = 'sic-payment-loader';
    loader.textContent = 'Loading secure payment form…';
    body.appendChild(loader);

    const stripeContainer = document.createElement('div');
    stripeContainer.className = 'sic-stripe-container';
    stripeContainer.style.display = 'none';
    body.appendChild(stripeContainer);

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    body.appendChild(errMsg);

    card.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'sic-co-footer';
    const btnBack = document.createElement('button');
    btnBack.className = 'sic-co-btn-back';
    btnBack.textContent = '← Back';
    btnBack.addEventListener('click', () => renderOrderReviewCard());
    const btnPay = document.createElement('button');
    btnPay.className = 'sic-co-btn-confirm';
    btnPay.textContent = `Pay €${total.toFixed(2)}`;
    btnPay.disabled = true;
    footer.appendChild(btnBack);
    footer.appendChild(btnPay);
    card.appendChild(footer);

    $messages.insertBefore(card, $typing);
    requestAnimationFrame(() => { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

    try {
      const [config, intentData] = await Promise.all([
        api('GET', '/payment/config'),
        api('POST', '/payment/stripe/intent', { amount_cents: amountCents, currency: 'eur' })
      ]);
      if (!config.stripe_publishable_key) throw new Error('Card payment is not configured. Please choose another method.');

      const stripe   = await loadStripeJs(config.stripe_publishable_key);
      const elements = stripe.elements({ clientSecret: intentData.client_secret, appearance: { theme: 'flat', variables: { colorPrimary: '#b8975a' } } });
      const pe       = elements.create('payment');

      loader.style.display = 'none';
      stripeContainer.style.display = 'block';
      pe.mount(stripeContainer);
      pe.on('ready', () => { btnPay.disabled = false; });

      btnPay.addEventListener('click', async () => {
        btnPay.disabled = true;
        btnPay.textContent = 'Processing…';
        errMsg.classList.remove('sic-visible');

        const { error } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required',
          confirmParams: { return_url: window.location.href }
        });

        if (error) {
          btnPay.disabled = false;
          btnPay.textContent = `Pay €${total.toFixed(2)}`;
          showCoErr(errMsg, error.message || 'Payment failed. Please try again.');
          return;
        }

        btnPay.textContent = 'Confirming order…';
        try {
          const result = await api('POST', '/payment/stripe/confirm', {
            intent_id:     intentData.intent_id,
            session_token: sessionToken,
            checkout_data: _buildCheckoutData(s)
          });
          finalizeAfterPayment(result, total);
        } catch (e2) {
          showCoErr(errMsg, e2.message || 'Payment received but order creation failed — please contact support.');
        }
      });

    } catch (err) {
      loader.textContent = '';
      showCoErr(errMsg, err.message || 'Could not load payment form. Please try again.');
    }
  }

  async function renderPayPalPaymentCard(total) {
    removeCheckoutCards();
    const s = checkoutState;

    const card = document.createElement('div');
    card.className = 'sic-co-card sic-payment-flow-card';

    const hdr = document.createElement('div');
    hdr.className = 'sic-co-header';
    hdr.textContent = '🅿 Pay with PayPal';
    card.appendChild(hdr);

    const body = document.createElement('div');
    body.className = 'sic-co-body';

    const loader = document.createElement('div');
    loader.className = 'sic-payment-loader';
    loader.textContent = 'Loading PayPal…';
    body.appendChild(loader);

    const ppContainer = document.createElement('div');
    ppContainer.className = 'sic-paypal-container';
    ppContainer.style.display = 'none';
    body.appendChild(ppContainer);

    const errMsg = document.createElement('div');
    errMsg.className = 'sic-co-error-msg';
    body.appendChild(errMsg);

    card.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'sic-co-footer';
    const btnBack = document.createElement('button');
    btnBack.className = 'sic-co-btn-back';
    btnBack.style.cssText = 'flex: 1 1 auto; width: 100%';
    btnBack.textContent = '← Back to Review';
    btnBack.addEventListener('click', () => renderOrderReviewCard());
    footer.appendChild(btnBack);
    card.appendChild(footer);

    $messages.insertBefore(card, $typing);
    requestAnimationFrame(() => { card.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

    try {
      const config = await api('GET', '/payment/config');
      if (!config.paypal_client_id) throw new Error('PayPal is not configured. Please choose another method.');

      await loadPayPalSdk(config.paypal_client_id);

      loader.style.display = 'none';
      ppContainer.style.display = 'block';

      window.paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal', height: 40 },
        createOrder: async () => {
          const data = await api('POST', '/payment/paypal/order', { amount_eur: total.toFixed(2) });
          return data.paypal_order_id;
        },
        onApprove: async (ppData) => {
          ppContainer.style.display = 'none';
          loader.textContent = 'Completing order…';
          loader.style.display = 'block';
          try {
            const result = await api('POST', '/payment/paypal/capture', {
              paypal_order_id: ppData.orderID,
              session_token:   sessionToken,
              checkout_data:   _buildCheckoutData(s)
            });
            finalizeAfterPayment(result, total);
          } catch (e) {
            loader.style.display = 'none';
            ppContainer.style.display = 'block';
            showCoErr(errMsg, e.message || 'Payment captured but order creation failed — please contact support.');
          }
        },
        onError: () => {
          showCoErr(errMsg, 'PayPal encountered an error. Please try again or choose another payment method.');
        }
      }).render(ppContainer);

    } catch (err) {
      loader.textContent = '';
      showCoErr(errMsg, err.message || 'Could not load PayPal. Please try again.');
    }
  }

  /* ── Order status card ───────────────────────────────────────────────────── */
  function renderOrderCard(order) {
    const STATUS_CLASS = {
      processing: 'sic-status-processing',
      pending:    'sic-status-pending',
      shipped:    'sic-status-shipped',
      delivered:  'sic-status-delivered',
      cancelled:  'sic-status-cancelled'
    };
    const raw     = (order.status || 'pending').toLowerCase();
    const cls     = STATUS_CLASS[raw] || 'sic-status-pending';
    const label   = raw.charAt(0).toUpperCase() + raw.slice(1);
    const placed  = order.placed_at
      ? new Date(order.placed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

    const card = document.createElement('div');
    card.className = 'sic-order-card';
    card.innerHTML = `
      <div class="sic-order-header">📦 Order ${escHtml(order.order_number || '')}</div>
      <div class="sic-order-status-badge ${cls}">● ${escHtml(label)}</div>
      <div class="sic-order-row">
        <span class="sic-order-row-label">Placed</span>
        <span class="sic-order-row-value">${escHtml(placed)}</span>
      </div>
      <div class="sic-order-row">
        <span class="sic-order-row-label">Shipping</span>
        <span class="sic-order-row-value">${escHtml(order.shipping_method || 'Standard delivery')}</span>
      </div>
      ${order.tracking_number ? `<div class="sic-order-row">
        <span class="sic-order-row-label">Tracking</span>
        <span class="sic-order-row-value">${escHtml(order.tracking_number)}</span>
      </div>` : ''}
      <div class="sic-order-row">
        <span class="sic-order-row-label">Total</span>
        <span class="sic-order-row-value">€${escHtml(String(order.total_eur || '—'))}</span>
      </div>
    `;

    $messages.insertBefore(card, $typing);
    scrollToBottom();
  }

  /* ── Thank-you / Order Confirmation card ─────────────────────────────────── */
  function renderThankYouCard(data) {
    const card = document.createElement('div');
    card.className = 'sic-thankyou-card';

    const pmLabel = data.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash on Delivery';
    const itemsHtml = (data.items || []).map(i =>
      `<div class="sic-order-row">
        <span class="sic-order-row-label">${escHtml(i.name)} ×${i.quantity}</span>
        <span class="sic-order-row-value">€${(parseFloat(i.unit_price) * i.quantity).toFixed(2)}</span>
      </div>`
    ).join('');

    card.innerHTML = `
      <div class="sic-thankyou-header">🎉 Order Confirmed!</div>
      <div class="sic-thankyou-body">
        <div class="sic-thankyou-ref">Order #${escHtml(data.order_number)}</div>
        ${itemsHtml}
        <div class="sic-order-row" style="border-top:1px solid rgba(255,255,255,0.15);margin-top:4px;padding-top:8px;">
          <span class="sic-order-row-label">Shipping</span>
          <span class="sic-order-row-value">€${escHtml(String(data.shipping_eur || '6.00'))}</span>
        </div>
        <div class="sic-order-row" style="font-weight:700;">
          <span class="sic-order-row-label">Total</span>
          <span class="sic-order-row-value">€${escHtml(String(data.total_eur))}</span>
        </div>
        <div class="sic-thankyou-payment">Payment: ${pmLabel}</div>
        ${data.email ? `<div class="sic-thankyou-email">Confirmation sent to ${escHtml(data.email)}</div>` : ''}
      </div>
    `;

    $messages.insertBefore(card, $typing);
    scrollToBottom();
  }

  async function requestHuman() {
    if (!sessionToken) return;
    try {
      appendSystemMsg('Connecting you to our support team…');
      await api('POST', '/escalate', {
        session_token: sessionToken,
        reason:        'Customer requested human support via widget'
      });
      appendSystemMsg('✓ Our team has been notified. We\'ll contact you by email.');
    } catch (e) {
      appendSystemMsg('Could not connect. Please email us at support@siculera.it');
    }
  }

  /* ── API ──────────────────────────────────────────────────────────────────── */
  async function api(method, endpoint, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + endpoint, opts);
    const json = await res.json();

    if (!res.ok) {
      const err = new Error(json.error || `HTTP ${res.status}`);
      err.userReply = json.reply || null;
      throw err;
    }
    return json;
  }

  /* ── Rendering ───────────────────────────────────────────────────────────── */
  function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `sic-msg sic-msg-${role}`;
    // Safely render newlines as <br> (escape HTML first to prevent XSS)
    const safe = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
    div.innerHTML = safe;
    $messages.insertBefore(div, $typing);
    scrollToBottom();
  }

  function appendSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'sic-msg sic-msg-system';
    div.textContent = text;
    $messages.insertBefore(div, $typing);
    scrollToBottom();
  }

  function showTyping() {
    $typing.style.display = 'flex';
    scrollToBottom();
  }

  function hideTyping() {
    $typing.style.display = 'none';
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      $messages.scrollTop = $messages.scrollHeight;
    });
  }

  function renderQuickReplies(pills) {
    // Preserve the View Cart pill if present
    const viewCartPill = $quickReplies.querySelector('[data-view-cart]');
    $quickReplies.innerHTML = '';
    if (viewCartPill) $quickReplies.appendChild(viewCartPill);
    pills.forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'sic-qr';
      btn.textContent = translateQuickReply(label);
      btn.addEventListener('click', () => {
        $input.value = label;
        sendMessage();
      });
      $quickReplies.appendChild(btn);
    });
  }

  function clearQuickReplies() {
    $quickReplies.innerHTML = '';
  }

  /* ── Boot ────────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
