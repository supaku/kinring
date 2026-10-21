/**
 * The banner script, kept as a string so the server can serve it at
 * `<ring>/embed.js` without a bundler, and so `dist/embed.js` is a plain file.
 *
 * It upgrades `<kinring-banner ring="..." member="...">` into a small banner
 * that shows the ring name and member count, and keeps the three links. The
 * fallback markup inside the element keeps working if this never loads.
 *
 * Styling is on purpose minimal and lives behind `part` names so hosts can
 * override it with `::part(...)` rules.
 */
export const EMBED_JS = String.raw`(function () {
  if (typeof customElements === 'undefined' || customElements.get('kinring-banner')) return;

  var STYLE = [
    ':host{display:inline-block;font:14px/1.4 system-ui,sans-serif;color:inherit}',
    ':host([hidden]){display:none}',
    '.b{display:inline-flex;align-items:center;gap:.75em;padding:.5em .75em;border:1px solid currentColor;border-radius:4px}',
    '.n{font-weight:600}',
    '.c{opacity:.7}',
    'nav{display:inline-flex;gap:.5em}',
    'a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    'a:hover{text-decoration-thickness:2px}',
    'a:focus-visible{outline:2px solid currentColor;outline-offset:2px}'
  ].join('');

  function join(base, path) {
    return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
  }

  var KinringBanner = function () {
    return Reflect.construct(HTMLElement, [], KinringBanner);
  };
  KinringBanner.prototype = Object.create(HTMLElement.prototype);
  KinringBanner.prototype.constructor = KinringBanner;
  Object.setPrototypeOf(KinringBanner, HTMLElement);

  KinringBanner.prototype.connectedCallback = function () {
    var el = this;
    var ring = el.getAttribute('ring');
    if (!ring) return;
    var member = el.getAttribute('member');
    var q = member ? '?from=' + encodeURIComponent(member) : '';
    var feedUrl = join(ring, 'ring.json');

    fetch(feedUrl, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (feed) {
        if (!feed || feed.kinring !== 1) return;
        var root = el.shadowRoot || el.attachShadow({ mode: 'open' });
        var style = document.createElement('style');
        style.textContent = STYLE;

        var box = document.createElement('span');
        box.className = 'b';
        box.setAttribute('part', 'banner');

        var name = document.createElement('a');
        name.className = 'n';
        name.setAttribute('part', 'name');
        name.href = feed.url;
        name.textContent = feed.name;

        var count = document.createElement('span');
        count.className = 'c';
        count.setAttribute('part', 'count');
        count.textContent = feed.count === 1 ? '1 site' : feed.count + ' sites';

        var nav = document.createElement('nav');
        nav.setAttribute('part', 'nav');
        nav.setAttribute('aria-label', feed.name + ' navigation');
        [['prev', 'Previous'], ['random', 'Random'], ['next', 'Next']].forEach(function (pair) {
          var a = document.createElement('a');
          a.href = join(ring, pair[0] + q);
          a.rel = 'nofollow';
          a.setAttribute('part', 'link ' + pair[0]);
          a.textContent = pair[1];
          nav.appendChild(a);
        });

        box.appendChild(name);
        box.appendChild(count);
        box.appendChild(nav);
        root.replaceChildren(style, box);
      })
      .catch(function () { /* leave the fallback markup alone */ });
  };

  customElements.define('kinring-banner', KinringBanner);
})();
`
