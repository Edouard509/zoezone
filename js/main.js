// ZOEZONE — mobile hamburger menu
document.addEventListener('DOMContentLoaded', function () {
  var menuToggle = document.getElementById('menuToggle');
  var navBottom = document.getElementById('navBottom');
  var backdrop = document.getElementById('navBackdrop');

  if (!menuToggle || !navBottom) return;

  function openMenu() {
    navBottom.classList.add('open');
    menuToggle.classList.add('active');
    menuToggle.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.classList.add('active');
  }

  function closeMenu() {
    navBottom.classList.remove('open');
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.classList.remove('active');
  }

  menuToggle.addEventListener('click', function () {
    if (navBottom.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close menu when a nav link is tapped
  navBottom.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Close menu when tapping the backdrop
  if (backdrop) backdrop.addEventListener('click', closeMenu);

  // Close menu if the viewport is resized back to desktop
  window.addEventListener('resize', function () {
    if (window.innerWidth > 1024) closeMenu();
  });

  // Close on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });
});

// ZOEZONE — homepage hero background slideshow
document.addEventListener('DOMContentLoaded', function () {
  var slides = document.querySelectorAll('.hero-slide');
  if (slides.length < 2) return;

  var current = 0;
  setInterval(function () {
    slides[current].classList.remove('active');
    current = (current + 1) % slides.length;
    slides[current].classList.add('active');
  }, 4500);
});
