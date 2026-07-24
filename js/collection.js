// ZOEZONE — category/collection pages: sort, filter drawer, load more
// Call ZZCollection.init() once the page's .grid has been populated with cards.
(function () {
  function initCollectionPage() {
    var grid = document.querySelector('.grid');
    if (!grid) return;

    var originalOrder = Array.prototype.slice.call(grid.querySelectorAll('.card'));
    var originallyHidden = Array.prototype.slice.call(grid.querySelectorAll('.card.hidden-extra'));
    var loadMoreBtn = document.querySelector('.load-more-btn');
    var noResults = document.querySelector('.no-results');

    function updateCount() {
      var countEl = document.querySelector('.toolbar-count');
      if (!countEl) return;
      var total = grid.querySelectorAll('.card').length;
      var visible = grid.querySelectorAll('.card:not(.hidden-extra):not(.filtered-out)').length;
      countEl.textContent = visible + (visible === total ? ' Items' : ' of ' + total + ' Items');
    }

    // ---- Load more ----
    if (loadMoreBtn) {
      if (!originallyHidden.length) {
        loadMoreBtn.classList.add('done');
        loadMoreBtn.style.display = 'none';
      }
      loadMoreBtn.addEventListener('click', function () {
        originallyHidden.forEach(function (card) { card.classList.remove('hidden-extra'); });
        loadMoreBtn.classList.add('done');
        updateCount();
      });
    }

    // ---- Sort ----
    var sortSelect = document.querySelector('.toolbar-sort select');
    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        var cards;
        if (sortSelect.value === 'price-asc') {
          cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
          cards.sort(function (a, b) { return parseFloat(a.dataset.price || 0) - parseFloat(b.dataset.price || 0); });
        } else if (sortSelect.value === 'price-desc') {
          cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
          cards.sort(function (a, b) { return parseFloat(b.dataset.price || 0) - parseFloat(a.dataset.price || 0); });
        } else if (sortSelect.value === 'newest') {
          cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));
          cards.sort(function (a, b) {
            return (a.dataset.new === 'true' ? 0 : 1) - (b.dataset.new === 'true' ? 0 : 1);
          });
        } else {
          cards = originalOrder.slice();
        }
        cards.forEach(function (card) { grid.appendChild(card); });
      });
    }

    // ---- Filter drawer open/close ----
    var filterBtn = document.querySelector('.filter-btn');
    var drawer = document.querySelector('.filter-drawer');
    var backdrop = document.querySelector('.drawer-backdrop');
    var closeBtn = document.querySelector('.filter-close');

    function openDrawer() {
      if (drawer) drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('active');
    }
    function closeDrawer() {
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    }
    if (filterBtn) filterBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // ---- Filter option toggles ----
    var swatches = document.querySelectorAll('.filter-swatch');
    swatches.forEach(function (sw) {
      sw.addEventListener('click', function () { sw.classList.toggle('selected'); });
    });
    var sizes = document.querySelectorAll('.filter-size');
    sizes.forEach(function (sz) {
      sz.addEventListener('click', function () { sz.classList.toggle('selected'); });
    });

    function updateFilterCount() {
      var badge = document.querySelector('.filter-count');
      if (!badge) return;
      var n = document.querySelectorAll('.filter-swatch.selected, .filter-size.selected').length;
      badge.textContent = n;
      badge.style.display = n > 0 ? 'flex' : 'none';
    }

    // ---- Apply / clear filters ----
    var applyBtn = document.querySelector('.filter-apply');
    var clearBtn = document.querySelector('.filter-clear');

    if (applyBtn) {
      applyBtn.addEventListener('click', function () {
        var selectedColors = Array.prototype.map.call(document.querySelectorAll('.filter-swatch.selected'), function (el) { return el.dataset.color; });
        var selectedSizes = Array.prototype.map.call(document.querySelectorAll('.filter-size.selected'), function (el) { return el.dataset.size; });
        var anyFilter = selectedColors.length || selectedSizes.length;

        grid.querySelectorAll('.card').forEach(function (card) {
          if (anyFilter) card.classList.remove('hidden-extra');
          var colors = (card.dataset.colors || '').split(',');
          var cardSizes = (card.dataset.sizes || '').split(',');
          var colorMatch = !selectedColors.length || selectedColors.some(function (c) { return colors.indexOf(c) !== -1; });
          var sizeMatch = !selectedSizes.length || selectedSizes.some(function (s) { return cardSizes.indexOf(s) !== -1; });
          card.classList.toggle('filtered-out', !(colorMatch && sizeMatch));
        });

        if (loadMoreBtn) loadMoreBtn.style.display = anyFilter ? 'none' : '';
        if (noResults) {
          var visibleCount = grid.querySelectorAll('.card:not(.filtered-out)').length;
          noResults.style.display = visibleCount === 0 ? 'block' : 'none';
        }

        updateFilterCount();
        updateCount();
        closeDrawer();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        swatches.forEach(function (sw) { sw.classList.remove('selected'); });
        sizes.forEach(function (sz) { sz.classList.remove('selected'); });
        grid.querySelectorAll('.card').forEach(function (card) { card.classList.remove('filtered-out'); });

        if (loadMoreBtn) {
          loadMoreBtn.style.display = '';
          if (!loadMoreBtn.classList.contains('done')) {
            originallyHidden.forEach(function (card) { card.classList.add('hidden-extra'); });
          }
        }
        if (noResults) noResults.style.display = 'none';

        updateFilterCount();
        updateCount();
      });
    }

    updateCount();
  }

  window.ZZCollection = { init: initCollectionPage };
})();
