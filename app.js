(function () {
  'use strict';

  var editor = document.getElementById('editor');

  // ---------------------------------------------------------------
  // BUG FIX for the vntyping.js engine:
  // Its Freeze() function only allows typing on elements whose id is
  // listed in VNTYPING.VNID. Left empty (the default), it freezes
  // (blocks) every field, so nothing ever gets accented. Whitelisting
  // our textarea's id here is what actually turns typing on.
  // ---------------------------------------------------------------
  VNTYPING.VNID = ['editor'];

  // =================================================================
  // THEMES
  // =================================================================
  var THEMES = [
    { id: 'sen',  name: 'Sen',       sample: 'Aa', dots: ['#1f7a6c', '#f5f7f6', '#c65b4e'] },
    { id: 'giay', name: 'Giấy Dó',   sample: 'Aa', dots: ['#9c3b2e', '#eee5d2', '#2b2620'] },
    { id: 'dem',  name: 'Mực Đêm',   sample: 'Aa', dots: ['#c9a24b', '#12161a', '#e7e4dc'] },
    { id: 'neon', name: 'Phố Neon',  sample: 'Aa', dots: ['#ff3d81', '#1c1030', '#f4eefc'] }
  ];
  var THEME_STORAGE_KEY = 'dtv_theme';

  var themeGrid = document.getElementById('themeGrid');
  var btnSettings = document.getElementById('btnSettings');
  var themePanel = document.getElementById('themePanel');

  function buildThemeGrid() {
    themeGrid.innerHTML = '';
    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-swatch';
      btn.dataset.theme = t.id;
      btn.innerHTML =
        '<span class="swatch-colors">' +
          t.dots.map(function (c) { return '<span class="swatch-dot" style="background:' + c + '"></span>'; }).join('') +
        '</span>' +
        '<span class="swatch-name">' + t.name + '</span>' +
        '<span class="swatch-sample" style="color:' + t.dots[0] + '">' + t.sample + '</span>';
      btn.addEventListener('click', function () { setTheme(t.id); });
      themeGrid.appendChild(btn);
    });
  }

  function setTheme(id) {
    document.documentElement.setAttribute('data-theme', id);
    try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch (e) { /* ignore */ }
    themeGrid.querySelectorAll('.theme-swatch').forEach(function (el) {
      el.classList.toggle('active', el.dataset.theme === id);
    });
  }

  function openPanel(open) {
    themePanel.hidden = !open;
    btnSettings.classList.toggle('spin', open);
  }

  btnSettings.addEventListener('click', function (e) {
    e.stopPropagation();
    openPanel(themePanel.hidden);
  });
  document.addEventListener('click', function (e) {
    if (!themePanel.hidden && !themePanel.contains(e.target) && e.target !== btnSettings) {
      openPanel(false);
    }
  });

  buildThemeGrid();
  var savedTheme = 'sen';
  try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'sen'; } catch (e) { /* ignore */ }
  setTheme(savedTheme);

  // =================================================================
  // TYPING MODE (OFF / VNI / TELEX / VIQR) + matching guide
  // engine's internal method values: 0=OFF, 1=VNI, 2=TELEX, 3=VIQR
  // =================================================================
  var modeButtons = {
    0: document.getElementById('modeOff'),
    2: document.getElementById('modeTelex'),
    3: document.getElementById('modeViqr'),
    1: document.getElementById('modeVni')
  };
  var modeNames = { 0: 'OFF', 1: 'VNI', 2: 'TELEX', 3: 'VIQR' };
  var guideByMode = {
    0: document.getElementById('guideOff'),
    2: document.getElementById('guideTelex'),
    3: document.getElementById('guideViqr'),
    1: document.getElementById('guideVni')
  };

  function setMode(n) {
    VNTYPING.SetMethod(n);
    Object.keys(modeButtons).forEach(function (k) {
      modeButtons[k].classList.remove('active', 'is-off');
    });
    modeButtons[n].classList.add('active');
    if (n === 0) modeButtons[n].classList.add('is-off');
    document.getElementById('modeLabel').textContent = 'Chế độ: ' + modeNames[n];

    Object.keys(guideByMode).forEach(function (k) {
      guideByMode[k].hidden = (parseInt(k, 10) !== n);
    });
  }

  Object.keys(modeButtons).forEach(function (k) {
    modeButtons[k].addEventListener('click', function () {
      setMode(parseInt(k, 10));
    });
  });

  setMode(2); // default: Telex, matching the reference tool
  // the engine auto-attaches to the document ~1s after load (see VNTYPING.Activate in vntyping.js)

  // =================================================================
  // TOOLBAR
  // =================================================================
  function updateCount() {
    document.getElementById('charCount').textContent = editor.value.length + ' ký tự';
  }
  editor.addEventListener('input', updateCount);
  updateCount();

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._h);
    toast._h = setTimeout(function () { t.classList.remove('show'); }, 1400);
  }

  document.getElementById('btnSelectAll').addEventListener('click', function () {
    editor.focus();
    editor.select();
  });

  document.getElementById('btnClear').addEventListener('click', function () {
    editor.value = '';
    VNTYPING.ClearBuffer();
    updateCount();
    editor.focus();
  });

  document.getElementById('btnCopy').addEventListener('click', function () {
    editor.select();
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(editor.value);
        ok = true;
      } else {
        ok = document.execCommand('copy');
      }
    } catch (e) { ok = false; }
    toast(ok ? 'Đã sao chép' : 'Không thể sao chép');
  });
})();
