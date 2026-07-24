// ZOEZONE — cart + wishlist engine (localStorage) + API-backed product cache
(function () {
  var CART_KEY = 'zoezone_cart';
  var WISH_KEY = 'zoezone_wishlist';
  var PRODUCTS = [];

  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });

  fetch('/api/products')
    .then(function (r) {
      if (!r.ok) throw new Error('Request failed: ' + r.status);
      return r.json();
    })
    .then(function (data) {
      PRODUCTS = data;
      readyResolve(PRODUCTS);
    })
    .catch(function (err) {
      console.error('ZOEZONE: could not load products from the API.', err);
      readyResolve(PRODUCTS); // resolve (empty) so awaiting pages don't hang forever
    });

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function getCart() { return readJSON(CART_KEY, []); }
  function setCart(cart) { writeJSON(CART_KEY, cart); renderBadges(); }
  function getWishlist() { return readJSON(WISH_KEY, []); }
  function setWishlist(list) { writeJSON(WISH_KEY, list); renderBadges(); }

  function findProduct(id) {
    for (var i = 0; i < PRODUCTS.length; i++) {
      if (PRODUCTS[i].id === id) return PRODUCTS[i];
    }
    return null;
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }

  function addToCart(id, qty, variant) {
    qty = qty || 1;
    variant = variant || {};
    var size = variant.size || null;
    var color = variant.color || null;
    var cart = getCart();
    var line = cart.find(function (l) { return l.id === id && (l.size || null) === size && (l.color || null) === color; });
    if (line) { line.qty += qty; } else { cart.push({ id: id, qty: qty, size: size, color: color }); }
    setCart(cart);

    var p = findProduct(id);
    if (p) {
      trackEvent('add_to_cart', {
        currency: 'USD',
        value: p.price * qty,
        items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: qty }]
      });
    }

    return cart;
  }
  function removeFromCart(id, variant) {
    variant = variant || {};
    var size = variant.size || null;
    var color = variant.color || null;
    setCart(getCart().filter(function (l) {
      return !(l.id === id && (l.size || null) === size && (l.color || null) === color);
    }));
  }
  function setCartQty(id, qty, variant) {
    variant = variant || {};
    var size = variant.size || null;
    var color = variant.color || null;
    var cart = getCart();
    var line = cart.find(function (l) { return l.id === id && (l.size || null) === size && (l.color || null) === color; });
    if (!line) return;
    if (qty <= 0) { removeFromCart(id, variant); return; }
    line.qty = qty;
    setCart(cart);
  }
  function cartCount() {
    return getCart().reduce(function (n, l) { return n + l.qty; }, 0);
  }
  function cartSubtotal() {
    return getCart().reduce(function (sum, l) {
      var p = findProduct(l.id);
      return sum + (p ? p.price * l.qty : 0);
    }, 0);
  }

  function isWished(id) { return getWishlist().indexOf(id) !== -1; }
  function toggleWishlist(id) {
    var list = getWishlist();
    var idx = list.indexOf(id);
    if (idx === -1) { list.push(id); } else { list.splice(idx, 1); }
    setWishlist(list);
    return list.indexOf(id) !== -1;
  }

  function renderBadges() {
    var count = cartCount();
    document.querySelectorAll('.icon-btn[aria-label="Bag"] .cart-count').forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
    var wcount = getWishlist().length;
    document.querySelectorAll('.wishlist-count').forEach(function (el) {
      el.textContent = wcount;
      el.style.display = wcount > 0 ? 'flex' : 'none';
    });
  }

  function markWishedIcons(root) {
    (root || document).querySelectorAll('.card[data-id] .wish').forEach(function (wish) {
      var card = wish.closest('.card');
      wish.classList.toggle('active', isWished(card.getAttribute('data-id')));
    });
  }

  // event delegation so dynamically-rendered cards (search/wishlist/category pages) work without re-binding
  function initDelegatedEvents() {
    document.addEventListener('click', function (e) {
      var wish = e.target.closest('.wish');
      if (wish && wish.closest('.card[data-id]')) {
        e.preventDefault();
        e.stopPropagation();
        var card = wish.closest('.card');
        var id = card.getAttribute('data-id');
        var wished = toggleWishlist(id);
        wish.classList.toggle('active', wished);
        showToast(wished ? 'Added to wishlist' : 'Removed from wishlist');
        return;
      }
      var btn = e.target.closest('.quick-add');
      if (btn && btn.closest('.card[data-id]')) {
        e.preventDefault();
        e.stopPropagation();
        var card2 = btn.closest('.card');
        addToCart(card2.getAttribute('data-id'), 1);
        openCartDrawer();
      }
    });
  }

  // ---------- toast ----------
  var toastTimer = null;
  function showToast(message) {
    var toast = document.getElementById('zzToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'zzToast';
      toast.className = 'zz-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  // ---------- referral popup ----------
  function showReferralPopup(referralCode) {
    if (!referralCode) return;
    var existing = document.getElementById('zzReferralOverlay');
    if (existing) existing.remove();

    var shareMessage = "Hey! I'm shopping at ZOEZONE — use my code " + referralCode +
      ' to get $10 off your first order (I get $10 too!): https://zoezone.co';

    var overlay = document.createElement('div');
    overlay.className = 'zz-referral-overlay';
    overlay.id = 'zzReferralOverlay';
    overlay.innerHTML =
      '<div class="zz-referral-modal">' +
        '<button class="zz-referral-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="zz-referral-icon">🎁</div>' +
        '<h3>Share ZOEZONE, Get $10 Off</h3>' +
        '<p>Give this code to a friend — when they create an account with it, you <strong>both</strong> get $10 off your next order.</p>' +
        '<div class="zz-referral-code-box"><span>' + referralCode + '</span><button type="button" id="zzReferralCopyBtn">Copy</button></div>' +
        '<a class="zz-referral-whatsapp" id="zzReferralWhatsappBtn" href="https://wa.me/?text=' + encodeURIComponent(shareMessage) + '" target="_blank" rel="noopener">Share on WhatsApp &rarr;</a>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('open'); });

    function close() {
      overlay.classList.remove('open');
      setTimeout(function () { overlay.remove(); }, 250);
    }
    overlay.querySelector('.zz-referral-close').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.getElementById('zzReferralCopyBtn').addEventListener('click', function () {
      navigator.clipboard.writeText(referralCode);
      showToast('Referral code copied');
    });
  }

  // ---------- mini cart drawer ----------
  function ensureCartDrawer() {
    if (document.getElementById('zzCartDrawer')) return;

    var backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.id = 'zzCartBackdrop';

    var drawer = document.createElement('div');
    drawer.className = 'filter-drawer cart-drawer';
    drawer.id = 'zzCartDrawer';
    drawer.innerHTML =
      '<div class="filter-drawer-head">' +
        '<h3>Your Bag</h3>' +
        '<button class="filter-close" type="button" aria-label="Close bag" id="zzCartClose">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>' +
        '</button>' +
      '</div>' +
      '<div id="zzCartDrawerBody"></div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    backdrop.addEventListener('click', closeCartDrawer);
    document.getElementById('zzCartClose').addEventListener('click', closeCartDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeCartDrawer();
    });
  }

  function renderCartDrawer() {
    var body = document.getElementById('zzCartDrawerBody');
    if (!body) return;
    var cart = getCart();

    if (!cart.length) {
      body.innerHTML = '<div class="cart-drawer-empty">Your bag is empty.</div>';
      return;
    }

    var rows = cart.map(function (line) {
      var p = findProduct(line.id);
      if (!p) return '';
      var variantBits = [];
      if (line.color) variantBits.push(line.color.charAt(0).toUpperCase() + line.color.slice(1));
      if (line.size) variantBits.push(line.size);
      var variantText = variantBits.length ? (variantBits.join(' / ') + ' &middot; ') : '';
      return (
        '<div class="cart-drawer-row" data-id="' + p.id + '">' +
          '<div class="cart-drawer-thumb"' + (p.mediaStyle ? ' style="' + p.mediaStyle + '"' : '') + '>' +
            '<div class="garment" style="width:74%;height:82%;">' + p.art + '</div>' +
          '</div>' +
          '<div class="cart-drawer-info">' +
            '<div class="cdr-name">' + p.name + '</div>' +
            '<div class="cdr-meta">' + variantText + 'Qty ' + line.qty + ' &middot; $' + p.price.toFixed(2) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var subtotal = cartSubtotal();
    body.innerHTML =
      '<div class="cart-drawer-list">' + rows + '</div>' +
      '<div class="cart-drawer-subtotal"><span>Subtotal</span><span>$' + subtotal.toFixed(2) + '</span></div>' +
      '<a href="cart.html" class="filter-apply cart-drawer-view">View Bag</a>';
  }

  function openCartDrawer() {
    ensureCartDrawer();
    renderCartDrawer();
    document.getElementById('zzCartDrawer').classList.add('open');
    document.getElementById('zzCartBackdrop').classList.add('active');
    showToast('Added to bag');
  }
  function closeCartDrawer() {
    var drawer = document.getElementById('zzCartDrawer');
    var backdrop = document.getElementById('zzCartBackdrop');
    if (drawer) drawer.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  function isComingSoon(p) {
    return (p.categories || []).indexOf('tops') === -1;
  }

  function comingSoonCardHTML(p) {
    var priceHTML = p.was
      ? '<span class="was">$' + p.was.toFixed(2) + '</span><span class="now">$' + p.price.toFixed(2) + '</span>'
      : '<span class="now">$' + p.price.toFixed(2) + '</span>';
    var swatchesHTML = (p.swatchColors || []).map(function (c) {
      return '<div class="swatch" style="background:' + c + ';"></div>';
    }).join('');

    return (
      '<div class="card card-coming-soon" data-id="' + p.id + '">' +
        '<div class="card-blur-wrap">' +
          '<div class="card-media"' + (p.mediaStyle ? ' style="' + p.mediaStyle + '"' : '') + '>' +
            '<div class="garment">' + p.art + '</div>' +
          '</div>' +
          '<div class="card-info">' +
            '<div class="card-collection">' + p.collection + '</div>' +
            '<div class="card-name">' + p.name + '</div>' +
            '<div class="card-price">' + priceHTML + '</div>' +
            '<div class="swatches">' + swatchesHTML + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="coming-soon-badge"><span>Coming Soon</span></div>' +
      '</div>'
    );
  }

  function productCardHTML(p) {
    if (isComingSoon(p)) return comingSoonCardHTML(p);

    var priceHTML = p.was
      ? '<span class="was">$' + p.was.toFixed(2) + '</span><span class="now">$' + p.price.toFixed(2) + '</span>'
      : '<span class="now">$' + p.price.toFixed(2) + '</span>';
    var badgeHTML = p.badge ? '<span class="badge' + (p.isSale ? ' sale' : '') + '">' + p.badge + '</span>' : '';
    var swatchesHTML = (p.swatchColors || []).map(function (c) {
      return '<div class="swatch" style="background:' + c + ';"></div>';
    }).join('');
    var wished = isWished(p.id) ? ' active' : '';

    var pdpUrl = 'product.html?id=' + p.id;

    return (
      '<div class="card" data-id="' + p.id + '"' +
        (p.price !== undefined ? ' data-price="' + p.price.toFixed(2) + '"' : '') +
        (p.colors ? ' data-colors="' + p.colors.join(',') + '"' : '') +
        (p.sizes ? ' data-sizes="' + p.sizes.join(',') + '"' : '') +
        (p.isNew ? ' data-new="true"' : '') + '>' +
        '<a href="' + pdpUrl + '" class="card-media"' + (p.mediaStyle ? ' style="' + p.mediaStyle + '"' : '') + '>' +
          badgeHTML +
          '<div class="wish' + wished + '"><svg viewBox="0 0 24 24" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></div>' +
          '<div class="garment">' + p.art + '</div>' +
          '<div class="quick-add"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4"/><line x1="3" y1="6" x2="21" y2="6"/></svg>Quick Add</div>' +
        '</a>' +
        '<div class="card-info">' +
          '<div class="card-collection">' + p.collection + '</div>' +
          '<a href="' + pdpUrl + '" class="card-name">' + p.name + '</a>' +
          '<div class="card-price">' + priceHTML + '</div>' +
          '<div class="swatches">' + swatchesHTML + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function setHeaderAvatar(avatarUrl) {
    document.querySelectorAll('a.icon-btn[aria-label="Account"]').forEach(function (el) {
      if (avatarUrl) {
        el.innerHTML = '<img src="' + avatarUrl + '" style="width:21px;height:21px;border-radius:50%;object-fit:cover;display:block;">';
      } else {
        el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      }
    });
  }

  function loadHeaderAvatar() {
    fetch('/api/auth/customer/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) { if (me && me.avatarUrl) setHeaderAvatar(me.avatarUrl); })
      .catch(function () {});
  }

  function initNewsletter() {
    var form = document.getElementById('newsletterForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('newsletterEmail');
      var email = input.value.trim();
      if (!email.includes('@')) return;

      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email }),
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) { showToast(res.data.error || 'Something went wrong — try again.'); return; }
          form.style.display = 'none';
          document.getElementById('newsletterSuccess').classList.add('show');
        })
        .catch(function () { showToast('Something went wrong — try again.'); });
    });
  }

  // expose a small shared API for every page (cart/wishlist/search/account/category pages)
  window.ZZShop = {
    ready: ready,
    getProducts: function () { return PRODUCTS; },
    getCart: getCart, setCart: setCart, addToCart: addToCart,
    removeFromCart: removeFromCart, setCartQty: setCartQty,
    cartCount: cartCount, cartSubtotal: cartSubtotal,
    getWishlist: getWishlist, setWishlist: setWishlist,
    isWished: isWished, toggleWishlist: toggleWishlist,
    findProduct: findProduct, renderBadges: renderBadges,
    showToast: showToast, openCartDrawer: openCartDrawer,
    renderCartDrawer: renderCartDrawer, ensureCartDrawer: ensureCartDrawer,
    markWishedIcons: markWishedIcons, productCardHTML: productCardHTML,
    setHeaderAvatar: setHeaderAvatar, isComingSoon: isComingSoon,
    trackEvent: trackEvent, showReferralPopup: showReferralPopup
  };

  document.addEventListener('DOMContentLoaded', function () {
    renderBadges();
    markWishedIcons();
    initDelegatedEvents();
    initNewsletter();
    loadHeaderAvatar();
  });
})();
