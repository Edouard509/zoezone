// ZOEZONE — product detail page
(function () {
  var COLOR_HEX = {
    black: '#1a1a1a', gray: '#8d8f92', cream: '#ece7de',
    denim: '#a9bccf', gold: '#c9a860'
  };
  var CATEGORY_PAGE = { tops: 'tops.html', bottoms: 'bottoms.html', outerwear: 'outerwear.html', accessories: 'accessories.html' };
  var CATEGORY_LABEL = { tops: 'Tops', bottoms: 'Bottoms', outerwear: 'Outerwear', accessories: 'Accessories' };

  function starsHTML(rating) {
    var pct = Math.max(0, Math.min(100, (rating / 5) * 100));
    return (
      '<span class="stars-wrap">' +
        '<span class="stars-base">★★★★★</span>' +
        '<span class="stars-fill" style="width:' + pct + '%">★★★★★</span>' +
      '</span>'
    );
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function showNotFound() {
    document.querySelector('.pdp-grid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:80px 24px;">' +
        '<p style="color:#888;font-size:14px;margin-bottom:20px;">We couldn\'t find that product.</p>' +
        '<a href="index.html" class="hero-cta">Continue Shopping</a>' +
      '</div>';
    document.querySelector('.reviews-section').style.display = 'none';
    document.querySelector('.related-section').style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    if (!id) { showNotFound(); return; }

    fetch('/api/products/' + encodeURIComponent(id))
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) { showNotFound(); return; }
        renderProduct(res.data);
      })
      .catch(function () { showNotFound(); });
  });

  function renderProduct(product) {
    document.title = product.name + ' — ZOEZONE';
    var pageDesc = (product.description || (product.name + ' — shop premium streetwear at ZOEZONE, made in Haiti.')).slice(0, 160);
    var pageUrl = 'https://zoezone.co/product.html?id=' + encodeURIComponent(product.id);
    var descTag = document.querySelector('meta[name="description"]');
    if (descTag) descTag.setAttribute('content', pageDesc);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', product.name + ' — ZOEZONE');
    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', pageDesc);
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);
    var canonicalTag = document.querySelector('link[rel="canonical"]');
    if (canonicalTag) canonicalTag.setAttribute('href', pageUrl);

    // ---------- breadcrumb ----------
    var primaryCat = (product.categories || [])[0];
    var catPage = CATEGORY_PAGE[primaryCat] || 'index.html';
    var catLabel = CATEGORY_LABEL[primaryCat] || 'Shop';
    document.getElementById('pdpBreadcrumb').innerHTML =
      '<a href="index.html">Home</a><span class="sep">/</span>' +
      '<a href="' + catPage + '">' + catLabel + '</a><span class="sep">/</span>' +
      '<span class="current">' + product.name + '</span>';

    // ---------- gallery ----------
    var gallery = document.getElementById('pdpGallery');
    if (product.mediaStyle) gallery.setAttribute('style', product.mediaStyle);
    var badgeHTML = product.badge ? '<span class="badge' + (product.isSale ? ' sale' : '') + '">' + product.badge + '</span>' : '';
    gallery.innerHTML = badgeHTML + product.art;

    // ---------- basics ----------
    document.getElementById('pdpCollection').textContent = product.collection;
    document.getElementById('pdpName').textContent = product.name;
    document.getElementById('pdpStars').innerHTML = starsHTML(product.rating);
    document.getElementById('pdpReviewCount').textContent = product.reviewCount + ' review' + (product.reviewCount === 1 ? '' : 's');

    var priceEl = document.getElementById('pdpPrice');
    if (product.was) {
      priceEl.className = 'pdp-price on-sale';
      priceEl.innerHTML = '<span class="was">$' + product.was.toFixed(2) + '</span><span class="now">$' + product.price.toFixed(2) + '</span>';
    } else {
      priceEl.innerHTML = '<span class="now">$' + product.price.toFixed(2) + '</span>';
    }

    // ---------- color swatches ----------
    var selectedColor = product.colors.length === 1 ? product.colors[0] : null;
    var swatchRow = document.getElementById('pdpSwatchRow');
    var colorVal = document.getElementById('pdpColorVal');
    function paintColorVal() { colorVal.textContent = selectedColor ? selectedColor.charAt(0).toUpperCase() + selectedColor.slice(1) : ''; }
    if (product.colors.length <= 1) {
      document.getElementById('pdpColorSection').style.display = product.colors.length ? '' : 'none';
    }
    swatchRow.innerHTML = product.colors.map(function (c) {
      var hex = COLOR_HEX[c] || '#ccc';
      var border = (c === 'cream' || c === 'gold') ? 'border-color:#ccc;' : '';
      return '<div class="pdp-swatch' + (c === selectedColor ? ' selected' : '') + '" data-color="' + c + '" style="background:' + hex + ';' + border + '" title="' + c + '"></div>';
    }).join('');
    paintColorVal();
    swatchRow.querySelectorAll('.pdp-swatch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        swatchRow.querySelectorAll('.pdp-swatch').forEach(function (s) { s.classList.remove('selected'); });
        sw.classList.add('selected');
        selectedColor = sw.dataset.color;
        paintColorVal();
      });
    });

    // ---------- size buttons ----------
    var selectedSize = product.sizes.length === 1 ? product.sizes[0] : null;
    var sizeRow = document.getElementById('pdpSizeRow');
    var sizeVal = document.getElementById('pdpSizeVal');
    function paintSizeVal() { sizeVal.textContent = selectedSize || ''; }
    sizeRow.innerHTML = product.sizes.map(function (s) {
      return '<div class="pdp-size' + (s === selectedSize ? ' selected' : '') + '" data-size="' + s + '">' + s + '</div>';
    }).join('');
    paintSizeVal();
    sizeRow.querySelectorAll('.pdp-size').forEach(function (sz) {
      sz.addEventListener('click', function () {
        sizeRow.querySelectorAll('.pdp-size').forEach(function (s) { s.classList.remove('selected'); });
        sz.classList.add('selected');
        selectedSize = sz.dataset.size;
        paintSizeVal();
      });
    });

    // ---------- stock status ----------
    var LOW_STOCK_THRESHOLD = 5;
    var stockQuantity = product.stockQuantity != null ? product.stockQuantity : 999;
    var stockStatusEl = document.getElementById('pdpStockStatus');
    var addBtn = document.getElementById('pdpAddBtn');
    if (stockQuantity <= 0) {
      stockStatusEl.textContent = 'Out of Stock';
      stockStatusEl.style.color = '#b3261e';
      stockStatusEl.style.display = 'block';
      addBtn.disabled = true;
      addBtn.textContent = 'Out of Stock';
    } else if (stockQuantity <= LOW_STOCK_THRESHOLD) {
      stockStatusEl.textContent = 'Only ' + stockQuantity + ' left in stock!';
      stockStatusEl.style.color = '#b3261e';
      stockStatusEl.style.display = 'block';
    }

    // ---------- quantity ----------
    var qty = 1;
    var qtyVal = document.getElementById('pdpQtyVal');
    document.getElementById('pdpQtyDec').addEventListener('click', function () { if (qty > 1) { qty--; qtyVal.textContent = qty; } });
    document.getElementById('pdpQtyInc').addEventListener('click', function () {
      if (qty >= stockQuantity) return;
      qty++;
      qtyVal.textContent = qty;
    });

    // ---------- wishlist ----------
    var wishBtn = document.getElementById('pdpWishBtn');
    wishBtn.classList.toggle('active', ZZShop.isWished(product.id));
    wishBtn.addEventListener('click', function () {
      var wished = ZZShop.toggleWishlist(product.id);
      wishBtn.classList.toggle('active', wished);
      ZZShop.showToast(wished ? 'Added to wishlist' : 'Removed from wishlist');
    });

    // ---------- add to bag ----------
    var errorEl = document.getElementById('pdpError');
    document.getElementById('pdpAddBtn').addEventListener('click', function () {
      var errs = [];
      if (product.colors.length > 1 && !selectedColor) errs.push('a color');
      if (product.sizes.length > 1 && !selectedSize) errs.push('a size');
      if (errs.length) {
        errorEl.textContent = 'Please select ' + errs.join(' and ') + '.';
        errorEl.classList.add('show');
        return;
      }
      errorEl.classList.remove('show');
      ZZShop.addToCart(product.id, qty, { size: selectedSize, color: selectedColor });
      ZZShop.openCartDrawer();
    });

    // ---------- details accordion ----------
    document.getElementById('pdpDetailsList').innerHTML = product.details.map(function (d) { return '<li>' + d + '</li>'; }).join('');
    document.querySelectorAll('.pdp-accordion-head').forEach(function (head) {
      head.addEventListener('click', function () {
        head.parentElement.classList.toggle('open');
      });
    });

    document.getElementById('pdpDescription').textContent = product.description;

    // ---------- reviews ----------
    var reviews = product.reviews || [];

    function renderReviews() {
      var avg = reviews.length ? reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length : 0;
      document.getElementById('reviewsAvgNum').textContent = avg.toFixed(1);
      document.getElementById('reviewsAvgStars').innerHTML = starsHTML(avg);
      document.getElementById('reviewsAvgCount').textContent = 'Based on ' + reviews.length + ' review' + (reviews.length === 1 ? '' : 's');

      var counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach(function (r) { counts[r.rating] = (counts[r.rating] || 0) + 1; });
      var total = reviews.length || 1;
      document.getElementById('ratingBars').innerHTML = [5, 4, 3, 2, 1].map(function (n) {
        var pct = Math.round((counts[n] / total) * 100);
        return (
          '<div class="rating-bar-row">' +
            '<span>' + n + ' star</span>' +
            '<div class="rating-bar-track"><div class="rating-bar-fill" style="width:' + pct + '%;"></div></div>' +
            '<span>' + counts[n] + '</span>' +
          '</div>'
        );
      }).join('');

      document.getElementById('reviewCards').innerHTML = reviews.map(function (r) {
        var mediaHTML = '';
        if (r.mediaUrl) {
          mediaHTML = r.mediaType === 'video'
            ? '<video src="' + r.mediaUrl + '" controls style="max-width:220px;border-radius:6px;margin-top:10px;display:block;"></video>'
            : '<img src="' + r.mediaUrl + '" style="max-width:220px;border-radius:6px;margin-top:10px;display:block;">';
        }
        var replyHTML = r.adminReply
          ? '<div style="margin-top:12px;padding:12px 14px;background:var(--cream);border-radius:4px;font-size:13px;"><strong>Response from ZOEZONE:</strong> ' + r.adminReply + '</div>'
          : '';
        return (
          '<div class="review-card">' +
            '<div class="review-head">' +
              '<div class="review-avatar">' + r.name.charAt(0) + '</div>' +
              '<div>' +
                '<div class="review-name">' + r.name + '</div>' +
                '<div class="review-date">' + formatDate(r.createdAt) + '</div>' +
              '</div>' +
            '</div>' +
            starsHTML(r.rating) +
            '<div class="review-title">' + r.title + '</div>' +
            '<div class="review-body">' + r.body + '</div>' +
            mediaHTML +
            replyHTML +
          '</div>'
        );
      }).join('');
    }
    renderReviews();

    // ---------- write a review (verified purchasers only) ----------
    var selectedRating = 0;
    var uploadedMediaUrl = null;
    var uploadedMediaType = null;
    var starPicks = document.querySelectorAll('.review-star-pick');
    var reviewForm = document.getElementById('reviewForm');
    var gateMessage = document.getElementById('reviewGateMessage');

    function showGate(message) {
      gateMessage.innerHTML = message;
      gateMessage.style.display = 'block';
      reviewForm.style.display = 'none';
    }

    fetch('/api/auth/customer/me', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) {
        if (!me) {
          showGate('<a href="account.html" style="text-decoration:underline;">Sign in</a> to leave a review.');
          return;
        }
        var alreadyReviewed = reviews.some(function (r) { return r.customerId === me.id; });
        if (alreadyReviewed) {
          showGate("You've already reviewed this product. Thanks for the feedback!");
          return;
        }
        var purchased = (me.orders || []).some(function (o) {
          return o.status !== 'cancelled' && o.items.some(function (it) { return it.id === product.id; });
        });
        if (!purchased) {
          showGate("You can review this product after you've purchased it.");
          return;
        }
        gateMessage.style.display = 'none';
        reviewForm.style.display = 'block';
      })
      .catch(function () {
        showGate('<a href="account.html" style="text-decoration:underline;">Sign in</a> to leave a review.');
      });

    starPicks.forEach(function (star) {
      star.addEventListener('click', function () {
        selectedRating = parseInt(star.dataset.value, 10);
        starPicks.forEach(function (s) {
          s.style.color = parseInt(s.dataset.value, 10) <= selectedRating ? '#1a1a1a' : '#ccc';
        });
      });
    });

    document.getElementById('reviewMediaField').addEventListener('change', function () {
      var file = this.files[0];
      if (!file) return;
      var hint = document.getElementById('reviewMediaHint');
      hint.textContent = 'Uploading…';
      var formData = new FormData();
      formData.append('file', file);
      fetch('/api/reviews/upload', { method: 'POST', body: formData, credentials: 'same-origin' })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) {
            hint.textContent = res.data.error || 'Upload failed — please try again.';
            return;
          }
          uploadedMediaUrl = res.data.url;
          uploadedMediaType = res.data.mediaType;
          hint.textContent = 'Attached!';
        })
        .catch(function () {
          hint.textContent = 'Upload failed — check your connection and try again.';
        });
    });

    reviewForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('reviewTitleField').value.trim();
      var body = document.getElementById('reviewBodyField').value.trim();
      var errorEl = document.getElementById('reviewError');
      var btn = document.getElementById('reviewSubmitBtn');

      var errs = [];
      if (!selectedRating) errs.push('a star rating');
      if (!body) errs.push('a review');
      if (errs.length) {
        errorEl.textContent = 'Please add: ' + errs.join(', ') + '.';
        errorEl.classList.add('show');
        return;
      }
      errorEl.classList.remove('show');
      btn.disabled = true;
      btn.textContent = 'Submitting…';

      fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          productId: product.id, rating: selectedRating, title: title, body: body,
          mediaUrl: uploadedMediaUrl, mediaType: uploadedMediaType
        }),
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          btn.disabled = false;
          btn.textContent = 'Submit Review';
          if (!res.ok) {
            errorEl.textContent = res.data.error || 'Something went wrong — please try again.';
            errorEl.classList.add('show');
            return;
          }
          reviews.unshift(res.data);
          renderReviews();
          reviewForm.reset();
          selectedRating = 0;
          uploadedMediaUrl = null;
          uploadedMediaType = null;
          document.getElementById('reviewMediaHint').textContent = '';
          starPicks.forEach(function (s) { s.style.color = '#ccc'; });
          showGate("You've already reviewed this product. Thanks for the feedback!");
          ZZShop.showToast('Thanks for your review!');
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Submit Review';
          errorEl.textContent = "Couldn't reach the server — check your connection and try again.";
          errorEl.classList.add('show');
        });
    });

    // ---------- related products ----------
    ZZShop.ready.then(function (allProducts) {
      var pool = allProducts.filter(function (p) { return p.id !== product.id; });
      var sameCollection = pool.filter(function (p) { return p.collection === product.collection; });
      var sameCategory = pool.filter(function (p) {
        return p.collection !== product.collection && p.categories.some(function (c) { return product.categories.indexOf(c) !== -1; });
      });
      var related = sameCollection.concat(sameCategory).slice(0, 4);
      if (related.length < 4) {
        pool.forEach(function (p) {
          if (related.length < 4 && related.indexOf(p) === -1) related.push(p);
        });
      }
      document.getElementById('relatedGrid').innerHTML = related.map(ZZShop.productCardHTML).join('');
      ZZShop.markWishedIcons(document.getElementById('relatedGrid'));
    });
  }
})();
