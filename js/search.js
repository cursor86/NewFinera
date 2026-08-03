(function(){
  var STYLE = '\
.nf-search-btn{background:none;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.5);font-family:inherit;font-size:.78rem;padding:6px 12px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin-left:8px;}\
.nf-search-btn:hover{color:#fff;border-color:rgba(212,168,67,0.4);}\
.nf-search-overlay{position:fixed;inset:0;background:rgba(4,7,15,0.82);backdrop-filter:blur(4px);z-index:1000;display:none;align-items:flex-start;justify-content:center;padding:12vh 20px 20px;}\
.nf-search-overlay.open{display:flex;}\
.nf-search-modal{width:100%;max-width:560px;background:#0D1321;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.5);}\
.nf-search-input{width:100%;background:none;border:none;border-bottom:1px solid rgba(255,255,255,0.08);color:#fff;font-size:1.05rem;padding:18px 20px;outline:none;font-family:inherit;}\
.nf-search-input::placeholder{color:rgba(255,255,255,0.3);}\
.nf-search-results{max-height:50vh;overflow-y:auto;padding:8px;}\
.nf-search-item{display:block;padding:12px 14px;border-radius:10px;text-decoration:none;color:inherit;}\
.nf-search-item:hover,.nf-search-item.active{background:rgba(212,168,67,0.08);}\
.nf-search-item .nfs-t{font-weight:700;font-size:.9rem;color:#fff;}\
.nf-search-item .nfs-c{font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:#D4A843;margin-bottom:3px;display:block;}\
.nf-search-item .nfs-d{font-size:.8rem;color:rgba(255,255,255,0.45);margin-top:2px;}\
.nf-search-empty{padding:24px 20px;text-align:center;color:rgba(255,255,255,0.35);font-size:.85rem;}\
.nf-search-hint{padding:10px 20px;border-top:1px solid rgba(255,255,255,0.06);font-size:.7rem;color:rgba(255,255,255,0.25);}\
';

  function injectStyle(){
    var s = document.createElement('style');
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  function buildButton(){
    var btn = document.createElement('button');
    btn.className = 'nf-search-btn';
    btn.type = 'button';
    btn.innerHTML = '⌕ Search <span style="opacity:.5;font-size:.7rem;">/</span>';
    btn.setAttribute('aria-label', 'Search NewFinera');
    return btn;
  }

  function mountButton(btn){
    var target = document.querySelector('.nav-links') || document.querySelector('.nl');
    if (target) { target.appendChild(btn); return; }
    // fallback: fixed corner button if no nav found
    btn.style.position = 'fixed';
    btn.style.top = '14px';
    btn.style.right = '14px';
    btn.style.zIndex = '999';
    document.body.appendChild(btn);
  }

  function buildOverlay(){
    var overlay = document.createElement('div');
    overlay.className = 'nf-search-overlay';
    overlay.innerHTML =
      '<div class="nf-search-modal">' +
        '<input class="nf-search-input" type="text" placeholder="Search calculators, salary guides, tax articles…" autocomplete="off">' +
        '<div class="nf-search-results"></div>' +
        '<div class="nf-search-hint">↑↓ to navigate · Enter to open · Esc to close</div>' +
      '</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  var INDEX = null;
  function loadIndex(cb){
    if (INDEX) return cb(INDEX);
    fetch('/search-index.json').then(function(r){ return r.json(); }).then(function(data){
      INDEX = data;
      cb(INDEX);
    }).catch(function(){ INDEX = []; cb(INDEX); });
  }

  function render(results, container, input){
    container.innerHTML = '';
    if (!results.length) {
      container.innerHTML = '<div class="nf-search-empty">No matches. Try "tax", "salary", or a country name.</div>';
      return;
    }
    results.slice(0, 8).forEach(function(item, i){
      var a = document.createElement('a');
      a.className = 'nf-search-item' + (i === 0 ? ' active' : '');
      a.href = item.url;
      a.innerHTML = '<span class="nfs-c">' + item.cat + '</span><span class="nfs-t">' + item.title + '</span><div class="nfs-d">' + item.desc + '</div>';
      container.appendChild(a);
    });
  }

  function filterIndex(query){
    var q = query.trim().toLowerCase();
    if (!q) return INDEX.slice(0, 8);
    return INDEX.filter(function(item){
      return (item.title + ' ' + item.desc + ' ' + item.cat).toLowerCase().indexOf(q) !== -1;
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    injectStyle();
    var btn = buildButton();
    mountButton(btn);
    var overlay = buildOverlay();
    var input = overlay.querySelector('.nf-search-input');
    var results = overlay.querySelector('.nf-search-results');

    function open(){
      overlay.classList.add('open');
      loadIndex(function(){
        render(filterIndex(''), results, input);
        input.value = '';
        setTimeout(function(){ input.focus(); }, 30);
      });
    }
    function close(){
      overlay.classList.remove('open');
    }

    btn.addEventListener('click', open);
    overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });

    input.addEventListener('input', function(){
      render(filterIndex(input.value), results, input);
    });

    input.addEventListener('keydown', function(e){
      var items = Array.prototype.slice.call(results.querySelectorAll('.nf-search-item'));
      var activeIdx = items.findIndex(function(el){ return el.classList.contains('active'); });
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activeIdx >= 0) items[activeIdx].classList.remove('active');
        var next = items[Math.min(activeIdx + 1, items.length - 1)];
        if (next) next.classList.add('active');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activeIdx >= 0) items[activeIdx].classList.remove('active');
        var prev = items[Math.max(activeIdx - 1, 0)];
        if (prev) prev.classList.add('active');
      } else if (e.key === 'Enter') {
        var active = results.querySelector('.nf-search-item.active') || items[0];
        if (active) window.location.href = active.getAttribute('href');
      } else if (e.key === 'Escape') {
        close();
      }
    });

    document.addEventListener('keydown', function(e){
      if (overlay.classList.contains('open')) return;
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        open();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  });
})();
