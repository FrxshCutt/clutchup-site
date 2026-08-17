/* ==========================================================================
   ClutchUp — site behaviour. ~4KB, no dependencies, deferred.
   Every effect is progressive: with JS off the page is fully readable, and
   with prefers-reduced-motion the motion paths are skipped entirely.
   ========================================================================== */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersReduced = function () { return reduceMotion.matches; };

  /* --- Nav: condense on scroll + mobile drawer -------------------------- */

  var nav = document.querySelector('.nav');
  if (nav) {
    var toggle = nav.querySelector('.nav__toggle');
    var setScrolled = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 12);
    };
    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });

    if (toggle) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      // Close the drawer on navigation or Escape
      nav.querySelectorAll('.nav__links a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('is-open')) {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.focus();
        }
      });
    }
  }

  /* --- Scroll reveals ---------------------------------------------------- */
  /* Elements marked .reveal fade/slide in once. Children of a [data-stagger]
     container get an --i index so they cascade instead of arriving together. */

  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    var kids = group.querySelectorAll(':scope > .reveal');
    for (var i = 0; i < kids.length; i++) {
      kids[i].style.setProperty('--i', String(i));
    }
  });

  var revealables = document.querySelectorAll('.reveal, .steps');

  if (!('IntersectionObserver' in window)) {
    // No observer (very old browser): show everything immediately.
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
  }

  /* --- Card cursor spotlight (pointer devices only) ---------------------- */

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReduced()) {
    document.querySelectorAll('.card, .plan').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* --- Hero parallax ----------------------------------------------------- */
  /* transform-only, rAF-throttled, and only while the hero is on screen. */

  var parallaxEls = document.querySelectorAll('[data-parallax]');
  if (parallaxEls.length && !prefersReduced() && window.matchMedia('(min-width: 981px)').matches) {
    var ticking = false;
    var apply = function () {
      var y = window.scrollY;
      parallaxEls.forEach(function (el) {
        var speed = parseFloat(el.getAttribute('data-parallax')) || 0.06;
        el.style.transform = 'translate3d(0,' + (-y * speed).toFixed(2) + 'px,0)';
      });
      ticking = false;
    };
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(apply);
    }, { passive: true });
    apply();
  }

  /* --- FAQ accordion ----------------------------------------------------- */

  document.querySelectorAll('.faq__item').forEach(function (item) {
    var btn = item.querySelector('.faq__q');
    var panel = item.querySelector('.faq__a');
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = false; // height is driven by CSS grid, not [hidden]
    });
  });

  /* --- Reading progress (legal pages) ------------------------------------ */

  var bar = document.querySelector('.progress');
  if (bar) {
    var barTicking = false;
    var updateBar = function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      bar.style.transform = 'scaleX(' + pct.toFixed(4) + ')';
      barTicking = false;
    };
    window.addEventListener('scroll', function () {
      if (barTicking) return;
      barTicking = true;
      window.requestAnimationFrame(updateBar);
    }, { passive: true });
    window.addEventListener('resize', updateBar, { passive: true });
    updateBar();
  }

  /* --- Table-of-contents scroll spy -------------------------------------- */

  var toc = document.querySelector('.toc');
  if (toc && 'IntersectionObserver' in window) {
    var links = {};
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    var headings = document.querySelectorAll('.prose h2[id]');
    var visible = new Set();

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible.add(e.target.id);
        else visible.delete(e.target.id);
      });
      // Highlight the topmost heading currently in the reading band.
      var current = null;
      headings.forEach(function (h) {
        if (visible.has(h.id) && current === null) current = h.id;
      });
      if (current) {
        Object.keys(links).forEach(function (id) {
          links[id].classList.toggle('is-active', id === current);
        });
      }
    }, { rootMargin: '-15% 0px -70% 0px', threshold: 0 });

    headings.forEach(function (h) { spy.observe(h); });
  }

  /* --- Current year in the footer ---------------------------------------- */

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
