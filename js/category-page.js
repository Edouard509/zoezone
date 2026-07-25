// ZOEZONE — dynamic category/collection grid loader.
// Reads filter hints from <body data-category="tops"> / data-tag="new-era" / data-filter-new="true" / data-filter-sale="true">,
// fetches the live product cache from shop.js, renders cards, then wires up collection.js (sort/filter/load-more).
(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var grid = document.querySelector('.grid');
    if (!grid) return;

    var body = document.body;
    var category = body.dataset.category || null;
    var tag = body.dataset.tag || null;
    var wantNew = body.dataset.filterNew === 'true';
    var wantSale = body.dataset.filterSale === 'true';

    // Only Tops has launched so far — New Arrivals and The New Era show Tops items only for now,
    // rather than mixing in blurred "Coming Soon" cards from other categories.
    var topsOnly = wantNew || tag === 'new-era';

    ZZShop.ready.then(function (products) {
      var filtered = products.filter(function (p) {
        if (category && p.categories.indexOf(category) === -1) return false;
        if (tag && p.tags.indexOf(tag) === -1) return false;
        if (wantNew && !p.isNew) return false;
        if (wantSale && !p.isSale) return false;
        if (topsOnly && p.categories.indexOf('tops') === -1) return false;
        return true;
      });

      var toolbarCount = document.querySelector('.toolbar-count');

      if (!filtered.length) {
        grid.innerHTML = '<div class="no-results" style="display:block;">No products in this collection yet — check back soon.</div>';
        if (toolbarCount) toolbarCount.textContent = '0 Items';
        return;
      }

      grid.innerHTML = filtered.map(function (p, i) {
        var html = ZZShop.productCardHTML(p);
        return i >= 8 ? html.replace('class="card"', 'class="card hidden-extra"') : html;
      }).join('') + '<div class="no-results" style="display:none;">No products match your selected filters.</div>';

      ZZShop.markWishedIcons(grid);
      if (window.ZZCollection) ZZCollection.init();
    });
  });
})();
