(function () {
  'use strict';

  var editor = document.getElementById('editor');

  // ---------------------------------------------------------------
  // Bộ gõ: ukengine.js — viết lại thuật toán của UniKey 3.62.
  // Engine chỉ làm việc thuần Unicode và trả về { backs, text };
  // UkEngine.attach() lo phần gắn vào <textarea> (keydown + setRangeText).
  // ---------------------------------------------------------------
  var engine = new UkEngine({ method: UkEngine.TELEX });
  UkEngine.attach(editor, engine);

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
  // TYPING MODE (OFF / TELEX / VNI / VIQR) + matching guide
  // UkEngine method values: 0=TELEX, 1=VNI, 2=VIQR. We use -1 for OFF.
  // =================================================================
  var MODE_OFF = -1;
  var modeButtons = {
    '-1': document.getElementById('modeOff'),
    '0': document.getElementById('modeTelex'),
    '2': document.getElementById('modeViqr'),
    '1': document.getElementById('modeVni')
  };
  var modeNames = { '-1': 'OFF', '0': 'TELEX', '1': 'VNI', '2': 'VIQR' };
  var guideByMode = {
    '-1': document.getElementById('guideOff'),
    '0': document.getElementById('guideTelex'),
    '2': document.getElementById('guideViqr'),
    '1': document.getElementById('guideVni')
  };
  var MODE_STORAGE_KEY = 'dtv_mode';

  function setMode(n) {
    if (n === MODE_OFF) {
      engine.setEnabled(false);
    } else {
      engine.setMethod(n);
      engine.setEnabled(true);
    }

    Object.keys(modeButtons).forEach(function (k) {
      modeButtons[k].classList.remove('active', 'is-off');
    });
    modeButtons[String(n)].classList.add('active');
    if (n === MODE_OFF) modeButtons[String(n)].classList.add('is-off');
    document.getElementById('modeLabel').textContent = 'Chế độ: ' + modeNames[String(n)];

    Object.keys(guideByMode).forEach(function (k) {
      guideByMode[k].hidden = (parseInt(k, 10) !== n);
    });

    try { localStorage.setItem(MODE_STORAGE_KEY, String(n)); } catch (e) { /* ignore */ }
  }

  Object.keys(modeButtons).forEach(function (k) {
    modeButtons[k].addEventListener('click', function () {
      setMode(parseInt(k, 10));
      editor.focus();
    });
  });

  var savedMode = 0; // mặc định: Telex
  try {
    var m = localStorage.getItem(MODE_STORAGE_KEY);
    if (m !== null && modeButtons[m]) savedMode = parseInt(m, 10);
  } catch (e) { /* ignore */ }
  setMode(savedMode);

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
    engine.clearBuf();
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
