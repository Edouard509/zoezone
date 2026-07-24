// ZOEZONE — Google Sign-In wiring, shared by account.html and checkout.html.
// Set this once you have a real Client ID from Google Cloud Console — until then, the button silently doesn't render.
var GOOGLE_CLIENT_ID = 'REPLACE_WITH_REAL_GOOGLE_CLIENT_ID';

function initGoogleSignIn(buttonElId, onSuccess, getReferralCode) {
  if (GOOGLE_CLIENT_ID.indexOf('REPLACE_WITH') === 0) return;
  if (!window.google || !google.accounts || !google.accounts.id) return;

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: function (response) {
      fetch('/api/auth/customer/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          credential: response.credential,
          referralCode: getReferralCode ? getReferralCode() : undefined
        })
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (!res.ok) {
            if (window.ZZShop) ZZShop.showToast(res.data.error || 'Google Sign-In failed — please try again.');
            return;
          }
          onSuccess(res.data);
        })
        .catch(function () {
          if (window.ZZShop) ZZShop.showToast("Couldn't reach the server — check your connection.");
        });
    }
  });

  var el = document.getElementById(buttonElId);
  if (el) {
    google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' });
  }
}
