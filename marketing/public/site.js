// Motion and small touches for every page. Each page also works without this file: everything
// here only adds to markup that already reads fine (no content is created in JavaScript).
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const header = document.querySelector('.site-header');
const menu = document.querySelector('details.menu');

// A shadow under the top bar once the page has scrolled.
function onScroll() {
  header?.classList.toggle('is-scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// The phone menu closes after a tap on one of its links, and on Escape.
menu?.addEventListener('click', (e) => {
  if (e.target instanceof Element && e.target.closest('a')) menu.open = false;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && menu?.open) menu.open = false;
});

// Reveal on scroll: [data-reveal] blocks fade and rise as they enter the screen; the children of
// a [data-reveal="stagger"] block come in one after another. Without IntersectionObserver (or
// with reduced motion) everything just stays visible.
const revealTargets = [...document.querySelectorAll('[data-reveal]')];
if (!reduceMotion && 'IntersectionObserver' in window && revealTargets.length) {
  for (const el of revealTargets) {
    const items = el.dataset.reveal === 'stagger' ? [...el.children] : [el];
    items.forEach((item, i) => {
      item.classList.add('reveal');
      item.style.setProperty('--delay', `${Math.min(i, 8) * 90}ms`);
    });
  }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const el = entry.target;
      const items = el.dataset.reveal === 'stagger' ? [...el.children] : [el];
      for (const item of items) item.classList.add('is-in');
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  for (const el of revealTargets) io.observe(el);
}

// Counting numbers: [data-count="412"] counts up from 0 when it comes into view.
const counters = [...document.querySelectorAll('[data-count]')];
if (!reduceMotion && 'IntersectionObserver' in window && counters.length) {
  const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
  const run = (el) => {
    const target = Number(el.dataset.count);
    const decimals = el.dataset.decimals ? Number(el.dataset.decimals) : 0;
    const prefix = el.dataset.prefix ?? '';
    const suffix = el.dataset.suffix ?? '';
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const value = target * eased;
      el.textContent = `${prefix}${decimals ? value.toFixed(decimals) : fmt.format(Math.round(value))}${suffix}`;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      run(entry.target);
      io.unobserve(entry.target);
    }
  }, { threshold: 0.4 });
  for (const el of counters) io.observe(el);
}

// Sliders: a scroll-snapping track, dots and arrows. Swiping works on its own; this keeps the dots
// in step with the track and makes the arrows and dots move it.
for (const slider of document.querySelectorAll('[data-slider]')) {
  const track = slider.querySelector('.slider-track');
  const slides = track ? [...track.children] : [];
  const dots = slider.querySelector('.slider-dots');
  if (!track || slides.length < 2) continue;
  if (dots) {
    dots.replaceChildren(...slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Slide ${i + 1} of ${slides.length}`);
      b.addEventListener('click', () => slides[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'start' }));
      return b;
    }));
  }
  // The current slide is the one snapped to the track's left edge.
  const current = () => {
    const x = track.scrollLeft;
    let best = 0;
    let bestDistance = Infinity;
    slides.forEach((s, i) => {
      const d = Math.abs(s.offsetLeft - track.offsetLeft - x);
      if (d < bestDistance) { bestDistance = d; best = i; }
    });
    return best;
  };
  const paint = () => {
    const i = current();
    dots?.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-current', j === i ? 'true' : 'false'));
    slider.querySelector('[data-prev]')?.toggleAttribute('disabled', i === 0);
    slider.querySelector('[data-next]')?.toggleAttribute('disabled', i === slides.length - 1);
  };
  const go = (step) => {
    const i = Math.max(0, Math.min(slides.length - 1, current() + step));
    slides[i].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'start' });
  };
  slider.querySelector('[data-prev]')?.addEventListener('click', () => go(-1));
  slider.querySelector('[data-next]')?.addEventListener('click', () => go(1));
  track.addEventListener('scroll', paint, { passive: true });
  window.addEventListener('resize', paint);
  paint();
}

// The hero's dashboard preview comes alive: the timer on each running machine ticks, and every
// few seconds the stopped machine's alert comes back in.
const live = document.querySelector('[data-live-panel]');
if (live && !reduceMotion) {
  const timers = [...live.querySelectorAll('[data-minutes]')];
  let minutes = 0;
  const tickClock = () => {
    minutes += 1;
    for (const el of timers) {
      const total = Number(el.dataset.minutes) + minutes;
      el.textContent = `${el.dataset.label} · ${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
    }
  };
  window.setInterval(tickClock, 15000);
  const toast = live.querySelector('.toast');
  if (toast) {
    window.setInterval(() => {
      toast.classList.remove('toast-in');
      void toast.offsetWidth;   // restart the animation
      toast.classList.add('toast-in');
    }, 6000);
    toast.classList.add('toast-in');
  }
}
