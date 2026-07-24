// ZOEZONE — checkout: shipping/location form, payment method selection, order placement
var BUSINESS_WHATSAPP_NUMBER = '50937893926'; // country code + number, digits only, no + or spaces
var PAY_INFO = {
  moncash: { label: 'MonCash', number: '+509 3789 3926', qr: true },
  paypal: { label: 'PayPal', number: 'paypal.me/LakouLakayLLC', qr: false },
  zelle: { label: 'Zelle', number: 'claudyedouard6@gmail.com', qr: false }
};

document.addEventListener('DOMContentLoaded', function () {
  var cart = ZZShop.getCart();
  var formSection = document.getElementById('checkoutFormSection');
  var emptySection = document.getElementById('checkoutEmpty');
  var confirmPanel = document.getElementById('confirmPanel');

  if (!cart.length) {
    formSection.style.display = 'none';
    emptySection.style.display = 'block';
    return;
  }

  var pendingDiscountPercent = 0;
  var discountReady = fetch('/api/auth/customer/me', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (me) {
      pendingDiscountPercent = (me && me.pendingDiscountPercent) || 0;
    })
    .catch(function () {});

  ZZShop.ready.then(function () {
    discountReady.then(function () { renderSummary(); });
  });

  // ---------- order summary ----------
  function renderSummary() {
    var currentCart = ZZShop.getCart();
    var rows = currentCart.map(function (line) {
      var p = ZZShop.findProduct(line.id);
      if (!p) return '';
      return (
        '<div class="cart-drawer-row">' +
          '<div class="cart-drawer-thumb"' + (p.mediaStyle ? ' style="' + p.mediaStyle + '"' : '') + '>' +
            '<div class="garment" style="width:74%;height:82%;">' + p.art + '</div>' +
          '</div>' +
          '<div class="cart-drawer-info">' +
            '<div class="cdr-name">' + p.name + '</div>' +
            '<div class="cdr-meta">Qty ' + line.qty + ' &middot; $' + p.price.toFixed(2) + '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    document.getElementById('summaryItems').innerHTML = rows;

    var subtotal = ZZShop.cartSubtotal();
    var shipping = subtotal >= 75 ? 0 : 6.95;
    var discountAmount = Math.round(subtotal * (pendingDiscountPercent / 100) * 100) / 100;
    var discountedSubtotal = subtotal - discountAmount;

    document.getElementById('summarySubtotal').textContent = '$' + subtotal.toFixed(2);
    var discountRow = document.getElementById('summaryDiscountRow');
    if (pendingDiscountPercent > 0) {
      discountRow.style.display = '';
      document.getElementById('summaryDiscount').textContent = '-$' + discountAmount.toFixed(2);
    } else {
      discountRow.style.display = 'none';
    }
    document.getElementById('summaryShipping').textContent = shipping === 0 ? 'Free' : '$' + shipping.toFixed(2);
    document.getElementById('summaryTotal').textContent = '$' + (discountedSubtotal + shipping).toFixed(2);
    return { subtotal: subtotal, shipping: shipping, total: discountedSubtotal + shipping };
  }

  // ---------- map ----------
  var map = L.map('checkoutMap').setView([18.5944, -72.3074], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
  }).addTo(map);
  var marker = L.marker([18.5944, -72.3074], { draggable: true }).addTo(map);
  var coords = null;

  function updateCoordsReadout(latlng) {
    coords = { lat: latlng.lat, lng: latlng.lng };
    document.getElementById('coordsReadout').textContent =
      'Pinned at ' + latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5);
  }
  marker.on('dragend', function () { updateCoordsReadout(marker.getLatLng()); });
  map.on('click', function (e) { marker.setLatLng(e.latlng); updateCoordsReadout(e.latlng); });

  document.getElementById('locateMeBtn').addEventListener('click', function () {
    if (!navigator.geolocation) { ZZShop.showToast('Location not supported on this device'); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView([ll.lat, ll.lng], 16);
      marker.setLatLng(ll);
      updateCoordsReadout(ll);
    }, function () {
      ZZShop.showToast("Couldn't get your location — try dragging the pin instead");
    });
  });

  document.getElementById('findAddressBtn').addEventListener('click', function () {
    var q = document.getElementById('addressField').value.trim();
    if (!q) { ZZShop.showToast('Enter your address first'); return; }
    fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (results) {
        if (!results.length) { ZZShop.showToast("Couldn't find that address — drag the pin instead"); return; }
        var ll = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        map.setView([ll.lat, ll.lng], 16);
        marker.setLatLng(ll);
        updateCoordsReadout(ll);
      })
      .catch(function () { ZZShop.showToast('Search failed — drag the pin to your location instead'); });
  });

  // ---------- payment method selection ----------
  var selectedMethod = null;
  var payInfoArea = document.getElementById('payInfoArea');
  var manualPayDetail = document.getElementById('manualPayDetail');
  var cardPayDetail = document.getElementById('cardPayDetail');

  document.querySelectorAll('.pay-tile').forEach(function (tile) {
    tile.addEventListener('click', function () {
      document.querySelectorAll('.pay-tile').forEach(function (t) { t.classList.remove('selected'); });
      tile.classList.add('selected');
      selectedMethod = tile.dataset.method;

      if (selectedMethod === 'card') {
        manualPayDetail.classList.remove('active');
        cardPayDetail.classList.add('active');
        return;
      }

      cardPayDetail.classList.remove('active');
      manualPayDetail.classList.add('active');

      var info = PAY_INFO[selectedMethod];
      var html =
        '<h4>Send payment to:</h4>' +
        '<div class="pay-number-box"><span id="payNumberText">' + info.number + '</span><button type="button" id="copyPayNumberBtn">Copy</button></div>';
      if (info.qr) {
        html +=
          '<div class="qr-wrap">' +
            '<img src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=' + encodeURIComponent(info.label + ': ' + info.number) + '" alt="' + info.label + ' QR code">' +
            '<div class="qr-note">Scan this QR code in your ' + info.label + ' app, or send manually to the number above. Then upload your payment screenshot below.</div>' +
          '</div>';
      } else {
        html += '<div class="qr-note">Send the total shown in your order summary to the ' + info.label + ' account above, then upload your payment screenshot below.</div>';
      }
      payInfoArea.innerHTML = html;

      document.getElementById('copyPayNumberBtn').addEventListener('click', function () {
        navigator.clipboard.writeText(info.number);
        ZZShop.showToast('Copied to clipboard');
      });
    });
  });

  // ---------- screenshot upload preview ----------
  var uploadBox = document.getElementById('uploadBox');
  var uploadInput = document.getElementById('uploadInput');
  var uploadPreview = document.getElementById('uploadPreview');
  var hasScreenshot = false;

  uploadBox.addEventListener('click', function () { uploadInput.click(); });
  uploadInput.addEventListener('change', function () {
    var file = uploadInput.files[0];
    if (!file) return;
    hasScreenshot = true;
    uploadBox.classList.add('has-file');
    var reader = new FileReader();
    reader.onload = function (e) {
      uploadPreview.src = e.target.result;
      uploadPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  // ---------- place order ----------
  document.getElementById('placeOrderBtn').addEventListener('click', function () {
    var firstName = document.getElementById('firstNameField').value.trim();
    var lastName = document.getElementById('lastNameField').value.trim();
    var email = document.getElementById('emailField').value.trim();
    var whatsapp = document.getElementById('whatsappField').value.trim();
    var address = document.getElementById('addressField').value.trim();
    var notes = document.getElementById('notesField').value.trim();
    var errorEl = document.getElementById('checkoutError');

    var errors = [];
    if (!firstName) errors.push('first name');
    if (!lastName) errors.push('last name');
    if (!email || email.indexOf('@') === -1) errors.push('a valid email address');
    if (!whatsapp) errors.push('WhatsApp number');
    if (!address) errors.push('address');
    if (!coords) errors.push('a pinned location on the map (drag the pin, or use Find My Address / Use My Current Location)');
    if (!selectedMethod) errors.push('a payment method');
    if (selectedMethod && selectedMethod !== 'card' && !hasScreenshot) errors.push('a payment screenshot');

    if (errors.length) {
      errorEl.textContent = 'Please add: ' + errors.join(', ') + '.';
      errorEl.classList.add('show');
      errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    errorEl.classList.remove('show');

    var totals = renderSummary();
    var cartSnapshot = ZZShop.getCart().map(function (line) {
      var p = ZZShop.findProduct(line.id);
      return { id: line.id, name: p ? p.name : line.id, price: p ? p.price : 0, qty: line.qty, size: line.size, color: line.color };
    });

    var order = {
      firstName: firstName, lastName: lastName, email: email, whatsapp: whatsapp, address: address, notes: notes,
      location: coords,
      payment: { method: selectedMethod },
      items: cartSnapshot,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      total: totals.total
    };

    var placeBtn = document.getElementById('placeOrderBtn');
    placeBtn.disabled = true;
    placeBtn.textContent = 'Placing Order…';

    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (!res.ok) {
          errorEl.textContent = res.data.error || 'Something went wrong placing your order — please try again.';
          errorEl.classList.add('show');
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          placeBtn.disabled = false;
          placeBtn.textContent = 'Place Order';
          return;
        }
        order.id = res.data.id;
        if (res.data.total !== undefined) order.total = res.data.total;
        order.customer = { firstName: firstName, lastName: lastName, email: email, whatsapp: whatsapp, address: address, notes: notes };
        ZZShop.setCart([]);
        showConfirmation(order);
      })
      .catch(function () {
        errorEl.textContent = "Couldn't reach the server — check your connection and try again.";
        errorEl.classList.add('show');
        placeBtn.disabled = false;
        placeBtn.textContent = 'Place Order';
      });
  });

  function showConfirmation(order) {
    formSection.style.display = 'none';
    confirmPanel.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    document.getElementById('confirmCode').textContent = order.id;

    var mapsLink = order.location ? ('https://www.google.com/maps?q=' + order.location.lat + ',' + order.location.lng) : '';
    var itemsList = order.items.map(function (it) {
      var bits = [];
      if (it.color) bits.push(it.color);
      if (it.size) bits.push(it.size);
      var variant = bits.length ? ' (' + bits.join('/') + ')' : '';
      return it.qty + 'x ' + it.name + variant;
    }).join(', ');
    var methodLabel = order.payment.method === 'card'
      ? 'Credit / Debit Card'
      : (PAY_INFO[order.payment.method] ? PAY_INFO[order.payment.method].label : order.payment.method);

    var message =
      'Hi ZOEZONE! I just placed an order.\n' +
      'Confirmation #: ' + order.id + '\n' +
      'Name: ' + order.customer.firstName + ' ' + order.customer.lastName + '\n' +
      'WhatsApp: ' + order.customer.whatsapp + '\n' +
      'Address: ' + order.customer.address +
      (mapsLink ? ('\nLocation: ' + mapsLink) : '') +
      (order.customer.notes ? ('\nNotes: ' + order.customer.notes) : '') +
      '\nItems: ' + itemsList +
      '\nTotal: $' + order.total.toFixed(2) +
      '\nPayment Method: ' + methodLabel +
      (order.payment.method !== 'card' ? '\n(Payment screenshot attached below)' : '') +
      '\n\nPlease confirm my order and let me know the ETA. Thank you!';

    document.getElementById('whatsappShareBtn').href =
      'https://wa.me/' + BUSINESS_WHATSAPP_NUMBER + '?text=' + encodeURIComponent(message);

    document.getElementById('copyConfirmCodeBtn').addEventListener('click', function () {
      navigator.clipboard.writeText(order.id);
      ZZShop.showToast('Confirmation number copied');
    });

    document.getElementById('confirmRecap').innerHTML =
      '<div class="confirm-recap-row"><span>Name</span><span>' + order.customer.firstName + ' ' + order.customer.lastName + '</span></div>' +
      '<div class="confirm-recap-row"><span>Payment</span><span>' + methodLabel + '</span></div>' +
      '<div class="confirm-recap-row"><span>Items</span><span>' + itemsList + '</span></div>' +
      '<div class="confirm-recap-row"><span>Total</span><span>$' + order.total.toFixed(2) + '</span></div>';
  }
});
