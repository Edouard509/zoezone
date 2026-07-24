// ZOEZONE Admin — shared helpers (auth guard, toast, sidebar wiring)
var ZZAdmin = (function () {
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
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2400);
  }

  function api(path, options) {
    options = options || {};
    options.credentials = 'same-origin';
    options.headers = options.headers || {};
    if (options.body && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    return fetch(path, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    });
  }

  // Redirects to login.html if not authenticated. Resolves with the admin {id,email,name} otherwise.
  function requireAuth() {
    return api('/api/auth/admin/me').then(function (res) {
      if (!res.ok) {
        window.location.href = 'login.html';
        return null;
      }
      var whoEl = document.getElementById('adminWho');
      if (whoEl) whoEl.textContent = res.data.name + ' · ' + res.data.email;
      return res.data;
    });
  }

  function wireSignOut() {
    var btn = document.getElementById('adminSignOut');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      api('/api/auth/admin/logout', { method: 'POST' }).then(function () {
        window.location.href = 'login.html';
      });
    });
  }

  function markActiveNav() {
    var page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.admin-sidebar nav a[data-page]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.page === page);
    });
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function init() {
    markActiveNav();
    wireSignOut();
    return requireAuth();
  }

  return { showToast: showToast, api: api, requireAuth: requireAuth, init: init, escapeHTML: escapeHTML };
})();
