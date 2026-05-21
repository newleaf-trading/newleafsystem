/**
 * Runtime interactivity for the workbench static nav.
 * Injected into the generated nav-component.html by the build script.
 * Uses class-based selectors (no IDs) to match BrandBar's DOM.
 */
(function () {
  // ── Active page detection ──
  var currentPage = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  document.querySelectorAll('.nl-nav-links a[data-page]').forEach(function (link) {
    if (link.dataset.page === currentPage) link.classList.add('active');
  });
  document.querySelectorAll('.nl-dd-item[data-page]').forEach(function (link) {
    if (link.dataset.page === currentPage) {
      link.style.color = '#C9A96E';
      link.style.fontWeight = '600';
      var trigger = document.querySelector('.nl-dd-trigger');
      if (trigger) trigger.classList.add('active');
    }
  });

  // ── ET clock ──
  function updateClock() {
    var et = new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false
    });
    var el = document.querySelector('.nl-live-time');
    if (el) el.textContent = et + ' ET';
  }
  updateClock();
  setInterval(updateClock, 1000);

  // ── Product switcher ──
  var switcherBtn = document.querySelector('.nl-switcher-btn');
  var switcherPanel = document.querySelector('.nl-switcher-panel');
  var switcherWrap = document.querySelector('.nl-switcher-wrap');

  if (switcherBtn && switcherPanel) {
    switcherBtn.addEventListener('click', function () {
      var open = !switcherPanel.hidden;
      switcherPanel.hidden = !switcherPanel.hidden;
      switcherBtn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('mousedown', function (e) {
      if (switcherWrap && !switcherWrap.contains(e.target)) {
        switcherPanel.hidden = true;
        switcherBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !switcherPanel.hidden) {
        switcherPanel.hidden = true;
        switcherBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ── Strategies dropdown (desktop: hover + click) ──
  var ddWrap = document.querySelector('.nl-dd-wrap');
  var ddTrigger = document.querySelector('.nl-dd-trigger');
  var ddPanel = document.querySelector('.nl-dd-panel');
  var hoverTimeout;

  if (ddWrap && ddTrigger && ddPanel) {
    function showDD() { ddPanel.hidden = false; ddTrigger.setAttribute('aria-expanded', 'true'); }
    function hideDD() { ddPanel.hidden = true; ddTrigger.setAttribute('aria-expanded', 'false'); }

    ddTrigger.addEventListener('click', function () { ddPanel.hidden ? showDD() : hideDD(); });
    ddWrap.addEventListener('mouseenter', function () {
      if (window.innerWidth > 860) { clearTimeout(hoverTimeout); showDD(); }
    });
    ddWrap.addEventListener('mouseleave', function () {
      if (window.innerWidth > 860) { hoverTimeout = setTimeout(hideDD, 150); }
    });
    document.addEventListener('mousedown', function (e) {
      if (!ddWrap.contains(e.target)) hideDD();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !ddPanel.hidden) hideDD();
    });
  }

  // ── Mobile menu ──
  var hamburger = document.querySelector('.nl-hamburger');
  var overlay = document.querySelector('.nl-mobile-overlay');
  var panel = document.querySelector('.nl-mobile-panel');
  var closeBtn = panel && panel.querySelector('.nl-mobile-close');

  function openMobile() {
    if (overlay) overlay.hidden = false;
    if (panel) panel.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeMobile() {
    if (overlay) overlay.hidden = true;
    if (panel) panel.hidden = true;
    document.body.style.overflow = '';
  }

  if (hamburger) hamburger.addEventListener('click', openMobile);
  if (closeBtn) closeBtn.addEventListener('click', closeMobile);
  if (overlay) overlay.addEventListener('click', closeMobile);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel && !panel.hidden) closeMobile();
  });

  // Close on link click
  if (panel) {
    panel.querySelectorAll('a[href]').forEach(function (link) {
      link.addEventListener('click', closeMobile);
    });
  }

  // Mobile strategies accordion
  var mobileTrigger = panel && panel.querySelector('.nl-mobile-dd-trigger');
  var mobileItems = panel && panel.querySelector('.nl-mobile-dd-items');
  if (mobileTrigger && mobileItems) {
    mobileTrigger.addEventListener('click', function () {
      var expanded = !mobileItems.hidden;
      mobileItems.hidden = !mobileItems.hidden;
      mobileTrigger.setAttribute('aria-expanded', String(!expanded));
      var arrow = mobileTrigger.querySelector('.nl-dd-arrow');
      if (arrow) arrow.style.transform = expanded ? 'none' : 'rotate(180deg)';
    });
  }
})();
