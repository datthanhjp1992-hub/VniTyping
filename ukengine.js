/*!
 * ukengine.js v2 — Bộ gõ tiếng Việt cho trình duyệt
 *
 * Engine lấy ÂM TIẾT làm trung tâm: mỗi phím gõ, từ đang gõ được tính lại
 * từ đầu (phụ âm đầu + vần + dấu thanh) rồi so với chuỗi cũ để ra
 * { backs, text }. Nhờ vậy dấu thanh luôn nằm đúng chỗ dù gõ theo thứ tự nào,
 * và từ không phải tiếng Việt được trả lại nguyên văn.
 *
 * Kế thừa ý tưởng và bảng dữ liệu từ UniKey 3.62 —
 * Copyright (C) 1998-2002 Pham Kim Long, GPL v2.
 * Bản JavaScript: Copyright (C) 2026 Nguyễn Thành Đạt, GPL v2 hoặc mới hơn.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UkEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===================================================================
  // 1. HẰNG SỐ
  // ===================================================================
  var TELEX = 0, VNI = 1, VIQR = 2, VIQR_STAR = 3;

  // Dấu phụ gắn vào chữ gốc
  var NONE = 0, HAT = 1, BREVE = 2, HORN = 3, STROKE = 4;

  // Dấu thanh: 0 = không dấu, 1 sắc, 2 huyền, 3 hỏi, 4 ngã, 5 nặng
  var SAC = 1, HUYEN = 2, HOI = 3, NGA = 4, NANG = 5;

  // ===================================================================
  // 2. BẢNG KÝ TỰ
  // ===================================================================
  // 12 nguyên âm × 6 cột: sắc, huyền, hỏi, ngã, nặng, không dấu
  var BD = [
    'áàảãạa', 'ấầẩẫậâ', 'ắằẳẵặă',
    'éèẻẽẹe', 'ếềểễệê',
    'íìỉĩịi',
    'óòỏõọo', 'ốồổỗộô', 'ớờởỡợơ',
    'úùủũụu', 'ứừửữựư',
    'ýỳỷỹỵy'
  ];
  var ROW_BASE = 'aaaeeiooouuy';
  var ROW_MARK = [NONE, HAT, BREVE, NONE, HAT, NONE, NONE, HAT, HORN, NONE, HORN, NONE];

  function isVowel(b) { return b.length === 1 && 'aeiouy'.indexOf(b) >= 0; }

  function rowOf(b, m) {
    for (var r = 0; r < 12; r++) if (ROW_BASE[r] === b && ROW_MARK[r] === m) return r;
    return -1;
  }

  // Phân rã một ký tự (chữ thường) thành { b: chữ gốc, m: dấu phụ, t: dấu thanh }
  var DECOMP = Object.create(null);
  (function () {
    for (var r = 0; r < 12; r++)
      for (var c = 0; c < 6; c++)
        DECOMP[BD[r][c]] = { b: ROW_BASE[r], m: ROW_MARK[r], t: c === 5 ? 0 : c + 1 };
    DECOMP['đ'] = { b: 'd', m: STROKE, t: 0 };
    for (var i = 97; i <= 122; i++) {
      var ch = String.fromCharCode(i);
      if (!DECOMP[ch]) DECOMP[ch] = { b: ch, m: NONE, t: 0 };
    }
  }());

  function isWordChar(c) { return !!DECOMP[c.toLowerCase()]; }

  /** Ký tự hiển thị của một chữ (có thể kèm dấu thanh) */
  function charOf(L, tone) {
    var ch;
    if (isVowel(L.b)) ch = BD[rowOf(L.b, L.m)][tone ? tone - 1 : 5];
    else ch = L.m === STROKE ? 'đ' : L.b;
    return L.up ? ch.toUpperCase() : ch;
  }

  function keyOf(Ls, from, to) {
    var s = '';
    for (var i = from; i < to; i++) s += charOf({ b: Ls[i].b, m: Ls[i].m, up: false }, 0);
    return s;
  }

  // ===================================================================
  // 3. LUẬT CHÍNH TẢ
  // ===================================================================
  var ONSETS = ('b c ch d đ g gh gi h k kh l m n ng ngh nh p ph qu r s t th tr v x').split(' ');
  var ONSET_SET = Object.create(null), ONSET_PREFIX = Object.create(null);
  ONSET_SET[''] = ONSET_PREFIX[''] = true;
  ONSETS.forEach(function (o) {
    ONSET_SET[o] = true;
    for (var i = 1; i <= o.length; i++) ONSET_PREFIX[o.slice(0, i)] = true;
  });

  // Toàn bộ vần hợp lệ (nguyên âm + phụ âm cuối), không kể dấu thanh
  var RIMES = (
    'a ai ao au ay ac ach am an ang anh ap at ' +
    'ăc ăm ăn ăng ăp ăt ' +
    'âc âm ân âng âp ât âu ây ' +
    'e eo ec em en eng ep et ' +
    'ê êu êch êm ên ênh êp êt ' +
    'i ia iu ich im in inh ip it ' +
    'iêc iêm iên iêng iêp iêt iêu ' +
    'o oi oc om on ong op ot oong ooc ' +
    'oa oai oao oay oac oach oam oan oang oanh oap oat ' +
    'oăc oăm oăn oăng oăt ' +
    'oe oeo oen oet ' +
    'ô ôi ôc ôm ôn ông ôp ôt ' +
    'ơ ơi ơm ơn ơp ơt ' +
    'u ua ui uc um un ung up ut ' +
    'uân uâng uât uây ' +
    'uê uêch uênh ' +
    'uy uya uyu uych uynh uyt uyên uyêt ' +
    'uơ ' +
    'uôc uôi uôm uôn uông uôt ' +
    'ư ưa ưi ưu ưc ưm ưng ưt ' +
    'ươc ươi ươm ươn ương ươp ươt ươu ' +
    'y yêm yên yêt yêu ych ynh yt'
  ).split(' ').map(function (r) {
    return r.split('').map(function (c) { return DECOMP[c]; });
  });

  var STOP_FINALS = { c: 1, ch: 1, p: 1, t: 1 };

  /**
   * Các cách tách từ thành phụ âm đầu + vần. Trả về mảng { vs, ve }:
   * phụ âm đầu = [0, vs), cụm nguyên âm = [vs, ve), phụ âm cuối = [ve, hết).
   * "qu" và "gi" có thể nuốt chữ u / i vào phụ âm đầu.
   */
  function parses(Ls) {
    var n = Ls.length, i = 0;
    while (i < n && !isVowel(Ls[i].b)) i++;
    function mk(vs) {
      var ve = vs;
      while (ve < n && isVowel(Ls[ve].b)) ve++;
      return { vs: vs, ve: ve };
    }
    var on = keyOf(Ls, 0, i);
    if (on === 'q' && i < n && Ls[i].b === 'u' && Ls[i].m === NONE) return [mk(i + 1)];
    if (on === 'g' && i + 1 < n && Ls[i].b === 'i' && Ls[i].m === NONE && isVowel(Ls[i + 1].b))
      return [mk(i + 1), mk(i)];
    return [mk(i)];
  }

  function rimeMatch(rime, complete) {
    for (var k = 0; k < RIMES.length; k++) {
      var r = RIMES[k];
      if (complete ? r.length !== rime.length : r.length < rime.length) continue;
      var ok = true;
      for (var j = 0; j < rime.length && ok; j++) {
        if (r[j].b !== rime[j].b) ok = false;
        else if (r[j].m !== rime[j].m && (complete || rime[j].m !== NONE)) ok = false;
      }
      if (ok) return true;
    }
    return false;
  }

  /**
   * Kiểm tra từ có phải âm tiết tiếng Việt hợp lệ không.
   * complete = false: chấp nhận cả "đang gõ dở" (còn có thể thêm chữ / dấu phụ).
   * Trả về cách tách hợp lệ, hoặc null.
   */
  function validParse(Ls, tone, complete) {
    var ps = parses(Ls), n = Ls.length;
    for (var k = 0; k < ps.length; k++) {
      var p = ps[k], on = keyOf(Ls, 0, p.vs), rime = Ls.slice(p.vs);
      if (!rime.length) {
        if (!complete && ONSET_PREFIX[on]) return p;
        continue;
      }
      if (!ONSET_SET[on]) continue;
      var fb = rime[0].b;
      if (on === 'c' && 'eiy'.indexOf(fb) >= 0) continue;
      if (on === 'k' && 'eiy'.indexOf(fb) < 0) continue;
      if ((on === 'gh' || on === 'ngh') && 'ei'.indexOf(fb) < 0) continue;
      if (!rimeMatch(rime, complete)) continue;
      if ((tone === HUYEN || tone === HOI || tone === NGA) && STOP_FINALS[keyOf(Ls, p.ve, n)]) continue;
      return p;
    }
    return null;
  }

  /** Vị trí đặt dấu thanh trong từ (chỉ số chữ), -1 nếu không có nguyên âm */
  function tonePosition(Ls, modernStyle) {
    var ps = parses(Ls);
    var p = validParse(Ls, 0, false) || ps[ps.length - 1];
    var idx = [], marked = [], i;
    for (i = p.vs; i < p.ve; i++) {
      idx.push(i);
      if (Ls[i].m !== NONE) marked.push(i);
    }
    if (!idx.length) return -1;
    if (marked.length) return marked[marked.length - 1];   // ê, ơ, ư... (ươ → ơ)
    if (idx.length === 1) return idx[0];
    if (idx.length >= 3) return idx[1];                      // oai, uya → chữ giữa
    if (p.ve < Ls.length) return idx[1];                     // có phụ âm cuối: hoàn
    var pair = Ls[idx[0]].b + Ls[idx[1]].b;
    if (modernStyle && (pair === 'oa' || pair === 'oe' || pair === 'uy')) return idx[1];
    return idx[0];                                           // âm mở: mùa, hòa
  }

  // ===================================================================
  // 4. KIỂU GÕ → HÀNH ĐỘNG
  // ===================================================================
  var TELEX_TONES = { s: SAC, f: HUYEN, r: HOI, x: NGA, j: NANG, z: 0 };
  var VNI_TONES = { '1': SAC, '2': HUYEN, '3': HOI, '4': NGA, '5': NANG, '0': 0 };
  var VIQR_TONES = { "'": SAC, '`': HUYEN, '?': HOI, '~': NGA, '.': NANG, '0': 0, '=': 0 };
  var SHORTCUTS = { '[': ['o', false], ']': ['u', false], '{': ['o', true], '}': ['u', true] };

  function actionOf(method, key) {
    var k = key.toLowerCase();
    if (method === TELEX) {
      if (k in TELEX_TONES) return { type: 'tone', t: TELEX_TONES[k] };
      if (k === 'a' || k === 'e' || k === 'o') return { type: 'hat', targets: k };
      if (k === 'w') return { type: 'w' };
      if (k === 'd') return { type: 'stroke', adjacent: true };
      if (key in SHORTCUTS) return { type: 'short', b: SHORTCUTS[key][0], up: SHORTCUTS[key][1] };
      return null;
    }
    if (method === VNI) {
      if (k in VNI_TONES) return { type: 'tone', t: VNI_TONES[k] };
      if (k === '6') return { type: 'hat', targets: 'aeo' };
      if (k === '7') return { type: 'horn' };
      if (k === '8') return { type: 'breve' };
      if (k === '9') return { type: 'stroke', adjacent: false };
      return null;
    }
    // VIQR / VIQR*
    if (k in VIQR_TONES) return { type: 'tone', t: VIQR_TONES[k] };
    if (k === '^') return { type: 'hat', targets: 'aeo' };
    if (k === (method === VIQR_STAR ? '*' : '+')) return { type: 'horn' };
    if (k === '(') return { type: 'breve' };
    if (k === 'd') return { type: 'stroke', adjacent: true };
    if (k === '\\') return { type: 'escape' };
    return null;
  }

  // ===================================================================
  // 5. ENGINE
  // ===================================================================
  function UkEngine(opts) {
    opts = opts || {};
    this.options = {
      freeMarking: opts.freeMarking !== false && opts.toneNextToVowel !== true,
      modernStyle: opts.modernStyle !== false,   // hoà, khoẻ, thuỷ
      autoRestore: opts.autoRestore !== false,   // trả lại từ không phải tiếng Việt
      hornUO:      opts.hornUO !== false,        // uo + w → ươ
      macroEnabled: opts.macroEnabled === true
    };
    this.macros = new Map();
    this.enabled = true;
    this.method = opts.method === undefined ? TELEX : opts.method;
    this.reset();
  }

  UkEngine.TELEX = TELEX;
  UkEngine.VNI = VNI;
  UkEngine.VIQR = VIQR;
  UkEngine.VIQR_STAR = VIQR_STAR;
  // lộ ra để kiểm thử / dùng lại
  UkEngine.tonePosition = tonePosition;
  UkEngine.isValidSyllable = function (word) {
    var w = wordFromText(word);
    return !!(w && validParse(w.Ls, w.tone, true));
  };

  var P = UkEngine.prototype;

  P.setMethod = function (m) { this.method = m; this.reset(); };
  P.setOption = function (k, v) {
    if (k === 'toneNextToVowel') { k = 'freeMarking'; v = !v; }
    this.options[k] = v;
  };
  P.setEnabled = function (on) { this.enabled = !!on; this.reset(); };
  P.setMacros = function (map) {
    var self = this;
    this.macros = new Map();
    (map instanceof Map ? Array.from(map) : Object.keys(map).map(function (k) { return [k, map[k]]; }))
      .forEach(function (p) { self.macros.set(String(p[0]).toLowerCase(), p[1]); });
  };

  /** Xoá trạng thái từ đang gõ */
  P.reset = function () {
    this.w = {
      Ls: [],        // các chữ: { b, m, up, sk }  (sk = sinh ra từ phím tắt w [ ])
      tone: 0,
      raw: '',       // văn bản gốc + phím đã gõ, dùng khi trả lại nguyên văn
      out: '',       // chuỗi đang hiển thị
      locked: false, // không biến đổi gì thêm cho tới hết từ
      rawMode: false,// đang hiển thị nguyên văn
      tf: false,     // đã có biến đổi dấu
      esc: false     // VIQR: phím kế tiếp là ký tự thường
    };
  };
  P.clearBuf = P.reset;

  function wordFromText(text) {
    var Ls = [], tone = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i], d = DECOMP[c.toLowerCase()];
      if (!d) return null;
      if (d.t) { if (tone) return null; tone = d.t; }
      Ls.push({ b: d.b, m: d.m, up: c !== c.toLowerCase(), sk: false });
    }
    return { Ls: Ls, tone: tone };
  }

  function trailingWord(text) {
    var i = text.length;
    while (i > 0 && isWordChar(text[i - 1])) i--;
    return text.slice(i);
  }

  /** Nạp lại trạng thái từ văn bản đứng trước con trỏ */
  P.syncFrom = function (textBeforeCaret) {
    this.reset();
    var word = trailingWord(textBeforeCaret);
    if (!word) return;
    var w = this.w, parsed = wordFromText(word);
    w.raw = w.out = word;
    w.Ls = parsed ? parsed.Ls : [];
    w.tone = parsed ? parsed.tone : 0;
    w.tf = !!parsed && (w.tone > 0 || w.Ls.some(function (L) { return L.m !== NONE; }));
    if (!parsed || !this._ok(w.Ls, w.tone)) { w.locked = true; w.rawMode = true; }
  };

  /** Chỉ nạp lại khi văn bản trước con trỏ không khớp từ đang gõ (Undo, Paste, click...) */
  P.ensureSync = function (textBeforeCaret) {
    var out = this.w.out, n = textBeforeCaret.length - out.length;
    var same = n >= 0 && textBeforeCaret.slice(n) === out &&
               !(n > 0 && isWordChar(textBeforeCaret[n - 1]));
    if (!same || (!out && trailingWord(textBeforeCaret))) this.syncFrom(textBeforeCaret);
  };

  /** Backspace khi dùng engine độc lập (không qua attach) */
  P.backspace = function () { this.syncFrom(this.w.out.slice(0, -1)); };

  P._ok = function (Ls, tone) {
    return !this.options.autoRestore || !!validParse(Ls, tone, false);
  };

  P._render = function () {
    var w = this.w;
    if (w.rawMode) { w.out = w.raw; return; }
    var tp = w.tone ? tonePosition(w.Ls, this.options.modernStyle) : -1, s = '';
    for (var i = 0; i < w.Ls.length; i++) s += charOf(w.Ls[i], i === tp ? w.tone : 0);
    w.out = s;
  };

  function letterOf(key) {
    var lower = key.toLowerCase();
    return { b: lower, m: NONE, up: key !== lower, sk: false };
  }

  function diff(a, b) {
    var p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    return { backs: a.length - p, text: b.slice(p) };
  }

  P._isWordKey = function (key) {
    if (/^[a-zA-Z]$/.test(key)) return true;
    if (this.method === TELEX && key in SHORTCUTS) return true;
    var w = this.w;
    return w.Ls.length > 0 && !w.locked && !!actionOf(this.method, key);
  };

  /**
   * Xử lý một phím. Trả về { backs, text }:
   * xoá `backs` ký tự trước con trỏ rồi chèn `text`.
   */
  P.process = function (key) {
    if (!this.enabled) return { backs: 0, text: key };
    var old = this.w.out;
    if (this._isWordKey(key)) {
      this._wordKey(key);
      return diff(old, this.w.out);
    }
    var d = diff(old, this._finish());
    d.text += key;
    this.reset();
    return d;
  };

  /** Kết thúc từ (Enter, Tab, mất focus...). Trả về chỉnh sửa cần áp dụng. */
  P.endWord = function () {
    var d = diff(this.w.out, this._finish());
    this.reset();
    return d;
  };

  P._wordKey = function (key) {
    var w = this.w;
    w.raw += key;
    if (w.esc) {                                   // VIQR: "\" + phím → phím thường
      w.esc = false;
      w.Ls.pop();
      w.raw = w.raw.slice(0, -2) + key;
      this._literal(key);
    } else {
      var act = w.locked ? null : actionOf(this.method, key);
      if (!(act && this._apply(act, key))) this._literal(key);
    }
    // "ưo" không phải vần tiếng Việt: gõ móc cho u trước rồi mới gõ o → tự thành "ươ"
    if (this.options.hornUO && !w.locked) {
      for (var j = 0; j + 1 < w.Ls.length; j++)
        if (w.Ls[j].b === 'u' && w.Ls[j].m === HORN && w.Ls[j + 1].b === 'o' && w.Ls[j + 1].m === NONE)
          { w.Ls[j + 1].m = HORN; w.Ls[j + 1].auto = true; }
    }
    this._render();
  };

  /** Thêm phím như một chữ thường; nếu từ không còn là tiếng Việt thì trả lại nguyên văn */
  P._literal = function (key) {
    var w = this.w;
    w.Ls.push(letterOf(key));
    if (w.locked) return;
    if (!this._ok(w.Ls, w.tone)) {
      if (w.tf) w.rawMode = true;
      w.locked = true;
    }
  };

  /** Gõ lại cùng phím dấu: bỏ dấu, chèn phím đó, khoá từ */
  P._undo = function (key) {
    this.w.Ls.push(letterOf(key));
    this.w.locked = true;
    return true;
  };

  P._apply = function (act, key) {
    var w = this.w, Ls = w.Ls, n = Ls.length, free = this.options.freeMarking, i, L;

    switch (act.type) {
      case 'tone': {
        var hasVowel = Ls.some(function (x) { return isVowel(x.b); });
        if (!hasVowel || (!free && !isVowel(Ls[n - 1].b))) return false;
        if (act.t === 0) {
          if (!w.tone) return false;
          w.tone = 0; w.tf = true; return true;
        }
        if (w.tone === act.t) { w.tone = 0; return this._undo(key); }
        if (!this._ok(Ls, act.t)) return false;
        w.tone = act.t; w.tf = true; return true;
      }

      case 'hat': {
        for (i = n - 1; i >= 0; i--) {
          L = Ls[i];
          if (!isVowel(L.b)) continue;
          if (act.targets.indexOf(L.b) < 0) continue;
          if (L.m === HAT) { L.m = NONE; return this._undo(key); }
          if (!free && i !== n - 1) return false;
          var oldM = L.m;
          L.m = HAT;
          if (this._ok(Ls, w.tone)) { w.tf = true; return true; }
          L.m = oldM;
          return false;
        }
        return false;
      }

      case 'w': case 'horn': case 'breve': {
        var cands = [], j;
        if (act.type !== 'breve' && this.options.hornUO) {
          for (j = 0; j + 1 < n; j++)
            if (Ls[j].b === 'u' && Ls[j + 1].b === 'o' && !(j > 0 && Ls[j - 1].b === 'q')) cands.push([j, j + 1]);
        }
        for (j = n - 1; j >= 0; j--) {
          var b = Ls[j].b;
          if ((act.type !== 'breve' && (b === 'u' || b === 'o')) || (act.type !== 'horn' && b === 'a'))
            cands.push([j]);
        }
        for (var c = 0; c < cands.length; c++) {
          var ids = cands[c];
          var target = function (k) { return Ls[k].b === 'a' ? BREVE : HORN; };
          if (ids.every(function (k) { return Ls[k].m === target(k); })) {
            if (ids.some(function (k) { return Ls[k].auto; })) {   // ơ đã tự thêm: phím móc chỉ xác nhận
              ids.forEach(function (k) { Ls[k].auto = false; });
              return true;
            }
            if (ids.length === 1 && Ls[ids[0]].sk) {            // "ww" → "w"
              Ls[ids[0]] = letterOf(key);
              w.locked = true;
              return true;
            }
            ids.forEach(function (k) { Ls[k].m = NONE; });
            return this._undo(key);
          }
          if (!free && ids[ids.length - 1] !== n - 1) continue;
          var saved = ids.map(function (k) { return Ls[k].m; });
          ids.forEach(function (k) { Ls[k].m = target(k); });
          if (this._ok(Ls, w.tone)) { w.tf = true; return true; }
          ids.forEach(function (k, x) { Ls[k].m = saved[x]; });
        }
        if (act.type === 'w') {                                 // "w" đứng riêng → ư
          Ls.push({ b: 'u', m: HORN, up: key === 'W', sk: true });
          if (this._ok(Ls, w.tone)) { w.tf = true; return true; }
          Ls.pop();
        }
        return false;
      }

      case 'stroke': {
        if (!n || Ls[0].b !== 'd' || (act.adjacent && n !== 1)) return false;
        if (Ls[0].m === STROKE) { Ls[0].m = NONE; return this._undo(key); }
        Ls[0].m = STROKE;
        if (this._ok(Ls, w.tone)) { w.tf = true; return true; }
        Ls[0].m = NONE;
        return false;
      }

      case 'short': {                                           // [ ] { } → ơ ư Ơ Ư
        L = Ls[n - 1];
        if (L && L.sk && L.b === act.b) { Ls[n - 1] = letterOf(key); w.locked = true; return true; }
        Ls.push({ b: act.b, m: HORN, up: act.up, sk: true });
        if (this._ok(Ls, w.tone)) { w.tf = true; return true; }
        Ls.pop();
        return false;
      }

      case 'escape':
        Ls.push(letterOf(key));
        w.esc = true;
        return true;
    }
    return false;
  };

  /** Chuỗi cuối cùng của từ khi gõ xong: chuẩn hoá ươ → uơ, trả lại nguyên văn, gõ tắt */
  P._finish = function () {
    var w = this.w;
    if (!w.Ls.length && !w.rawMode) return w.out;
    var out = w.out;
    if (!w.rawMode && w.tf && !w.locked && this.options.autoRestore) {
      var Ls = w.Ls, n = Ls.length;
      // "thưở" → "thuở": ươ không có phụ âm cuối chỉ đúng khi là uơ
      if (n >= 2 && Ls[n - 2].b === 'u' && Ls[n - 2].m === HORN && Ls[n - 1].b === 'o' && Ls[n - 1].m === HORN &&
          !(n >= 3 && isVowel(Ls[n - 3].b))) {
        Ls[n - 2].m = NONE;
        this._render();
        out = w.out;
      }
      if (!validParse(Ls, w.tone, true)) out = w.raw;
    }
    if (this.options.macroEnabled && this.macros.size) {
      var key = out.toLowerCase();
      if (this.macros.has(key)) out = this.macros.get(key);
    }
    return out;
  };

  // ===================================================================
  // 6. Gắn vào <textarea> / <input>
  // ===================================================================
  UkEngine.attach = function (el, engine) {
    function apply(r, s, e) {
      var from = Math.max(0, s - r.backs), top = el.scrollTop;
      el.setSelectionRange(from, e);
      var done = false;
      try {
        // execCommand giữ được lịch sử Undo (Ctrl+Z) của trình duyệt
        done = from === e && !r.text ? true
             : r.text ? document.execCommand('insertText', false, r.text)
             : document.execCommand('delete', false);
      } catch (err) { done = false; }
      if (!done) {
        el.setRangeText(r.text, from, e, 'end');
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.scrollTop = top;
    }

    function onKeyDown(ev) {
      if (!engine.enabled || ev.isComposing || ev.keyCode === 229) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      var s = el.selectionStart, e = el.selectionEnd;
      var before = el.value.slice(0, s);
      if (ev.key === 'Enter' || ev.key === 'Tab') {
        engine.ensureSync(before);
        var end = engine.endWord();
        if (s === e && (end.backs || end.text)) apply(end, s, s);
        return;                                // để trình duyệt tự xuống dòng
      }
      if (!ev.key || ev.key.length !== 1) return; // phím điều hướng, Backspace...: lần gõ sau tự đồng bộ
      engine.ensureSync(before);
      var r = engine.process(ev.key);
      ev.preventDefault();
      apply(r, s, e);
    }

    function onBlur() { engine.reset(); }

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('blur', onBlur);
    return function detach() {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('blur', onBlur);
    };
  };

  return UkEngine;
}));
