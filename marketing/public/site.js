// Small touches for every page; each page also works without them.
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
