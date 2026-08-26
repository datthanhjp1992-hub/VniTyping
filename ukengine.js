/*!
 * ukengine.js — Bộ gõ tiếng Việt cho trình duyệt
 *
 * Cài đặt lại thuật toán của UniKey 3.62 (keyhook/vietkey.cpp, newkey/encode.cpp)
 * bằng JavaScript thuần, làm việc trực tiếp trên Unicode dựng sẵn (precomposed)
 * thay vì bảng mã TCVN3 + bảng ánh xạ ToUniL/ToUniH như bản gốc.
 *
 * Thuật toán gốc: UniKey — Copyright (C) 1998-2002 Pham Kim Long, GPL v2.
 * Bản port này là tác phẩm phái sinh, vì vậy cũng phát hành theo GPL v2.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UkEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ===================================================================
  // 1. HẰNG SỐ  (keycons.h)
  // ===================================================================
  var TELEX = 0, VNI = 1, VIQR = 2, VIQR_STAR = 3;

  // keyCategory() trả về một trong các loại phím sau (vietkey.cpp)
  var BREVE_MARK = 1,           // w  (telex) → dấu trăng/móc
      TONE_MARK = 2,            // s f r x j z
      DOUBLE_KEY = 3,           // a e o d (telex) → dấu mũ / đ
      SHORT_KEY = 4,            // [ ] w { }
      SEPARATOR_KEY = 6,        // ngắt cứng → xoá buffer
      VNI_DOUBLE_CHAR_MARK = 7, // 6 7 8 9 (vni) / ^ + ( d (viqr)
      ESCAPE_KEY = 8,           // \  (viqr)
      SOFT_SEPARATOR_KEY = 9;   // ngắt mềm → giữ buffer

  var VNI_CIRCUMFLEX = 1, VNI_HORN = 2, VNI_BREVE = 3, VNI_D = 4;

  var KEY_BUFSIZE = 40,          // sức chứa buffer
      KEYS_MAINTAIN = 20,        // số ký tự giữ lại khi buffer đầy
      MAX_AFTER_VOWEL = 2,       // số phụ âm cuối tối đa khi dò nguyên âm
      MAX_VOWEL_SEQUENCE = 3,    // độ dài cụm nguyên âm tối đa
      MAX_MODIFY_LENGTH = 6;     // tầm với tối đa của dấu mũ/trăng/móc

  // ===================================================================
  // 2. BẢNG KÝ TỰ  (encode.cpp — MapBD / MapBK / MapBW / MapBT)
  // ===================================================================
  // 12 bộ nguyên âm × 6 cột. Cột: 0=sắc 1=huyền 2=hỏi 3=ngã 4=nặng 5=không dấu
  // Thứ tự bộ phải giữ nguyên: a, â, ă, e, ê, i, o, ô, ơ, u, ư, y
  var BD = [
    'áàảãạa', 'ấầẩẫậâ', 'ắằẳẵặă',
    'éèẻẽẹe', 'ếềểễệê',
    'íìỉĩịi',
    'óòỏõọo', 'ốồổỗộô', 'ớờởỡợơ',
    'úùủũụu', 'ứừửữựư',
    'ýỳỷỹỵy'
  ].map(function (s) { return s.split(''); });

  var NO_TONE = 5; // chỉ số cột "không dấu" trong BD

  // Ký tự đích của phím "nhân đôi" (dấu mũ + đ), tra bằng dbIndex-1.
  // Bản gốc là 8 phần tử d/D/e/E/a/A/o/O; ta chuẩn hoá về chữ thường nên
  // chỉ các vị trí chẵn được dùng tới.
  var BK = ['đ', 'đ', 'ê', 'ê', 'â', 'â', 'ô', 'ô'];
  var DOUBLE_REVERSE = ['d', 'd', 'e', 'e', 'a', 'a', 'o', 'o'];

  // Ký tự đích của dấu trăng/móc, tra bằng dbIndex-5
  var BW = ['ă', 'ă', 'ơ', 'ơ', 'ư', 'ư'];
  var W_REVERSE = ['a', 'a', 'o', 'o', 'u', 'u'];

  // Phím tắt TELEX: [ ] w W { }
  var BT = ['ơ', 'ư', 'ư', 'ư', 'ơ', 'ư'];

  var DOUBLE_CHARS = ['d', 'e', 'a', 'o', 'u'];      // dbIndex = 1,3,5,7,9
  var TELEX_TONES = ['s', 'f', 'r', 'x', 'j', 'z'];  // toneIndex = 1..6
  var TELEX_BREVES = ['w'];
  var TELEX_SHORTCUTS = ['[', ']', 'w', 'W', '{', '}'];

  var VNI_TONE_KEYS = ['1', '2', '3', '4', '5', '0'];
  var VNI_DOUBLE_KEYS = ['6', '7', '8', '9'];
  var VIQR_TONE_KEYS = ["'", '`', '?', '~', '.', '0'];
  var VIQR_DOUBLE_KEYS = ['^', '+', '(', 'd'];
  var VIQR_STAR_DOUBLE_KEYS = ['^', '*', '(', 'd'];

  // Ngắt mềm: ký tự không thể là nguyên âm — dừng việc đặt dấu nhưng
  // KHÔNG xoá buffer (nhờ vậy macro và backspace vẫn hoạt động qua khoảng trắng)
  var TONE_LIMITS = ('bdfjklqrsvwxz' + ',;:.:"\'!? ' + '0123456789' +
                     '<>=+-*/\\' + '_~`@#$%^&()' + '{}[]').split('');

  // Ranh giới từ, dùng cho macro (bit 29)
  var WORD_STOPS = (',;:."\'!? ' + '<>=+-*/\\' + '_~`@#$%^&()' + '{}[]').split('');

  // ===================================================================
  // 3. BẢNG THUỘC TÍNH DT  (encode.cpp — BuildTelexMethod / BuildVniLikeMethod)
  // ===================================================================
  //  bit  0- 4 : chỉ số bộ nguyên âm (1..12)
  //  bit  5- 8 : chỉ số phím tắt macro
  //  bit  9-13 : chỉ số ký tự "nhân đôi" (d/e/a/o/u và đ/ê/â/ô/ă/ơ/ư)
  //  bit 14-17 : chỉ số phím dấu thanh
  //  bit 18-21 : dấu thanh mà bản thân ký tự đang mang (1..5, 6 = không dấu)
  //  bit 22    : phím tạo dấu trăng/móc (telex: w)
  //  bit 24    : ngắt mềm
  //  bit 25    : ngắt cứng — xoá buffer
  //  bit 26-28 : chỉ số phím nhân đôi kiểu VNI/VIQR
  //  bit 29    : ranh giới từ
  var HARD_SEP = 0x2000000;

  function A_VOWEL(x)      { return x & 0x1F; }
  function A_MACRO(x)      { return (x >>> 5) & 0xF; }
  function A_DBCHAR(x)     { return (x >>> 9) & 0x1F; }
  function A_TONEKEY(x)    { return (x >>> 14) & 0xF; }
  function A_CURTONE(x)    { return (x >>> 18) & 0xF; }
  function A_IS_BREVE(x)   { return (x >>> 22) & 1; }
  function A_SOFT_SEP(x)   { return (x >>> 24) & 1; }
  function A_HARD_SEP(x)   { return (x & HARD_SEP) ? 1 : 0; }
  function A_VNI_DOUBLE(x) { return (x >>> 26) & 7; }
  function A_WORD_STOP(x)  { return (x >>> 29) & 1; }

  function buildDT(method) {
    var dt = Object.create(null), i, j, ch;

    function or(c, v) { dt[c] = (dt[c] || 0) | v; }

    // 1. mặc định: ngắt cứng (áp dụng cho mọi ký tự không có trong bảng)
    // 2. chữ cái ASCII → 0
    for (i = 97; i <= 122; i++) dt[String.fromCharCode(i)] = 0;
    // 3. các ký tự "giới hạn dấu" → 0
    for (i = 0; i < TONE_LIMITS.length; i++) dt[TONE_LIMITS[i]] = 0;
    // 4. ký tự đích của dấu mũ / trăng / móc → 0
    for (i = 0; i < BK.length; i++) dt[BK[i]] = 0;
    for (i = 0; i < BW.length; i++) dt[BW[i]] = 0;

    // 5. 12 bộ nguyên âm (gán đè, không OR — giống bản gốc)
    for (i = 0; i < 12; i++)
      for (j = 0; j < 6; j++)
        dt[BD[i][j]] = (i + 1) | ((j + 1) << 18);

    // 6. chỉ số ký tự nhân đôi: d=1 e=3 a=5 o=7 u=9, kèm biến thể có dấu phụ
    for (i = 0; i < DOUBLE_CHARS.length; i++) {
      var idx = i * 2 + 1;               // 1,3,5,7,9
      or(DOUBLE_CHARS[i], idx << 9);
      if (idx <= 8) or(BK[idx - 1], idx << 9);   // đ ê â ô
      if (idx >= 5) or(BW[idx - 5], idx << 9);   // ă ơ ư
    }

    // 7. ngắt mềm + ranh giới từ
    for (i = 0; i < TONE_LIMITS.length; i++) or(TONE_LIMITS[i], 1 << 24);
    for (i = 0; i < WORD_STOPS.length; i++)  or(WORD_STOPS[i], 0x20000000);

    // 8. phần riêng của từng kiểu gõ
    if (method === TELEX) {
      for (i = 0; i < TELEX_TONES.length; i++) or(TELEX_TONES[i], (i + 1) << 14);
      for (i = 0; i < TELEX_BREVES.length; i++) or(TELEX_BREVES[i], 0x400000);
      for (i = 0; i < TELEX_SHORTCUTS.length; i++) {
        ch = TELEX_SHORTCUTS[i].toLowerCase();
        if (A_MACRO(dt[ch] || 0) === 0) or(ch, (i + 1) << 5);
      }
    } else {
      var toneKeys = method === VNI ? VNI_TONE_KEYS : VIQR_TONE_KEYS;
      var dblKeys = method === VNI ? VNI_DOUBLE_KEYS
                  : method === VIQR ? VIQR_DOUBLE_KEYS : VIQR_STAR_DOUBLE_KEYS;
      for (j = 0; j < dblKeys.length; j++) or(dblKeys[j], (j + 1) << 26);
      for (i = 0; i < toneKeys.length; i++) or(toneKeys[i], (i + 1) << 14);
    }
    return dt;
  }

  // ===================================================================
  // 4. ENGINE
  // ===================================================================
  function UkEngine(opts) {
    opts = opts || {};
    this.options = {
      freeMarking:     opts.freeMarking     !== false, // bỏ dấu tự do
      toneNextToVowel: opts.toneNextToVowel === true,  // dấu phải sát nguyên âm
      modernStyle:     opts.modernStyle     === true,  // hoà → hòa
      macroEnabled:    opts.macroEnabled    === true
    };
    this.macros = new Map();
    this.enabled = true;  // false = tắt bộ gõ, phím đi thẳng vào ô nhập
    this.buf = [];        // ký tự đã chuẩn hoá về chữ thường
    this.lower = [];      // cờ hoa/thường tương ứng
    this.lastWConverted = false;
    this.lastIsEscape = false;
    this.tempVietOff = false;
    this.setMethod(opts.method === undefined ? TELEX : opts.method);
  }

  UkEngine.TELEX = TELEX;
  UkEngine.VNI = VNI;
  UkEngine.VIQR = VIQR;
  UkEngine.VIQR_STAR = VIQR_STAR;

  var P = UkEngine.prototype;

  P.setMethod = function (m) {
    this.method = m;
    this.DT = buildDT(m);
    this.clearBuf();
  };

  P.setOption = function (k, v) { this.options[k] = v; };

  P.setEnabled = function (on) {
    this.enabled = !!on;
    this.clearBuf();
  };

  P.setMacros = function (map) {
    this.macros = new Map();
    var self = this;
    (map instanceof Map ? Array.from(map) : Object.keys(map).map(function (k) {
      return [k, map[k]];
    })).forEach(function (p) { self.macros.set(String(p[0]).toLowerCase(), p[1]); });
  };

  P.clearBuf = function () {
    this.buf = [];
    this.lower = [];
    this.lastWConverted = false;
    this.lastIsEscape = false;
    this.tempVietOff = false;
  };

  P.attr = function (c) {
    var v = this.DT[c];
    return v === undefined ? HARD_SEP : v;
  };

  /** Nạp lại buffer từ văn bản đứng trước con trỏ (sau khi click chuột / di chuyển caret) */
  P.syncFrom = function (textBeforeCaret) {
    this.clearBuf();
    var i = textBeforeCaret.length - 1, start = i + 1;
    while (i >= 0) {
      var c = textBeforeCaret[i];
      var a = this.attr(c.toLowerCase());
      if (A_HARD_SEP(a) || A_SOFT_SEP(a)) break;
      start = i; i--;
    }
    for (i = start; i < textBeforeCaret.length; i++) this._putChar(textBeforeCaret[i]);
  };

  /** Xử lý phím Backspace: chỉ cần bỏ 1 ký tự khỏi buffer */
  P.backspace = function () {
    if (this.buf.length > 0) { this.buf.pop(); this.lower.pop(); }
    this.lastIsEscape = false;
  };

  // ---- các hàm nội bộ thao tác buffer ----------------------------------
  P._throwBuf = function () {
    this.buf = this.buf.slice(this.buf.length - KEYS_MAINTAIN);
    this.lower = this.lower.slice(this.lower.length - KEYS_MAINTAIN);
  };

  P._putChar = function (ch, isLower) {
    if (this.buf.length === KEY_BUFSIZE) this._throwBuf();
    if (isLower === undefined) isLower = (ch === ch.toLowerCase());
    this.buf.push(ch.toLowerCase());
    this.lower.push(!!isLower);
  };

  /** Trả về chuỗi kết quả: ghép ký tự đã push với cờ hoa/thường tương ứng */
  P._render = function () {
    var keys = this.buf.length, n = this.push.length, out = '', i;
    for (i = 0; i < n; i++) {
      var isLower = this.lower[keys - n + i];
      out += isLower === false ? this.push[i].toUpperCase() : this.push[i];
    }
    return out;
  };

  // ---- phân loại phím (keyCategory) ------------------------------------
  P._keyCategory = function (c) {
    var a = this.attr(c), idx;
    if (A_IS_BREVE(a) > 0) return BREVE_MARK;
    if (A_TONEKEY(a) > 0) return TONE_MARK;
    idx = A_DBCHAR(a);
    if (this.method === TELEX && idx > 0 && idx < 9) return DOUBLE_KEY;
    if (this.method !== TELEX && A_VNI_DOUBLE(a) > 0) return VNI_DOUBLE_CHAR_MARK;
    if (A_MACRO(a) > 0) return SHORT_KEY;
    if (A_HARD_SEP(a) > 0) return SEPARATOR_KEY;
    if ((this.method === VIQR || this.method === VIQR_STAR) && c === '\\') return ESCAPE_KEY;
    if (A_SOFT_SEP(a)) return SOFT_SEPARATOR_KEY;
    return 0;
  };

  // ===================================================================
  // 5. process() — trái tim của engine
  //    Trả về { backs, text }: xoá `backs` ký tự trước con trỏ rồi chèn `text`
  // ===================================================================
  P.process = function (rawChar) {
    var orig = rawChar;
    var c = rawChar.toLowerCase();
    var isLower = orig === orig.toLowerCase();

    this.push = [];      // tương ứng ansiPush[]
    this.backs = 0;
    this.origChar = orig;
    this.isLower = isLower;
    var thisWConverted = false;

    var kieu = this._keyCategory(c);

    // --- macro: kích hoạt tại ranh giới từ ---
    if (this.options.macroEnabled && this.macros.size &&
        ((kieu === SOFT_SEPARATOR_KEY && A_WORD_STOP(this.attr(c))) || c === '\n')) {
      if (this._checkMacro(orig)) return { backs: this.backs, text: this._macroText };
    }

    // --- ký tự ngay sau dấu escape "\" của VIQR ---
    if (this.lastIsEscape && this.buf.length > 0 &&
        kieu !== SEPARATOR_KEY && kieu !== SOFT_SEPARATOR_KEY) {
      this.backs = 1;
      this.buf[this.buf.length - 1] = c;
      this.lower[this.buf.length - 1] = isLower;
      this.push.push(c);
      this.lastIsEscape = false;
      this.lastWConverted = false;
      return { backs: this.backs, text: this._render() };
    }
    this.lastIsEscape = false;

    // --- tạm tắt tiếng Việt (sau khi người dùng "gõ lại" để huỷ dấu) ---
    if (this.tempVietOff) {
      if (!/[a-z]/.test(c)) this.tempVietOff = false;
      if (kieu === SEPARATOR_KEY) { this.clearBuf(); }
      else this._putChar(c, isLower);
      this.lastWConverted = false;
      return { backs: 0, text: orig };
    }

    switch (kieu) {
      case BREVE_MARK:
        if (this.method === TELEX && this.lastWConverted && c === 'w') {
          this._shortKey(c);
        } else {
          this._putBreveMark(c);
          if (this.method === TELEX && this.push.length === 0 && this.backs === 0 && c === 'w') {
            this._shortKey(c);          // "w" đứng một mình → ư
            thisWConverted = true;
          }
        }
        break;
      case DOUBLE_KEY:            this._doubleChar(c); break;
      case TONE_MARK:             this._putToneMark(c); break;
      case SHORT_KEY:             this._shortKey(c); break;
      case VNI_DOUBLE_CHAR_MARK:  this._vniDoubleCharMark(c); break;
      case ESCAPE_KEY:            this.lastIsEscape = true; break;
      case SEPARATOR_KEY:
        this.clearBuf();
        return { backs: 0, text: orig };
    }
    this.lastWConverted = thisWConverted;

    if (this.push.length === 0 && this.backs === 0) {
      this._putChar(c, isLower);
      return { backs: 0, text: orig };   // phím thường, chèn nguyên văn
    }
    return { backs: this.backs, text: this._render() };
  };

  // ===================================================================
  // 6. Đặt dấu thanh  (putToneMark) — phần "thông minh" nhất
  // ===================================================================
  P._putToneMark = function (c) {
    var buf = this.buf, keys = buf.length;
    var i, k, l, cuoi, index, vowel, duplicate, leftMost, newChar, t, a = 0;

    // (1) Dò ngược tìm nguyên âm gần nhất, tối đa MAX_AFTER_VOWEL phụ âm cuối
    i = keys - 1;
    leftMost = this.options.toneNextToVowel ? i : 0;
    leftMost = Math.max(keys - 1 - MAX_AFTER_VOWEL, leftMost);
    while (i >= leftMost) {
      a = this.attr(buf[i]);
      if (A_HARD_SEP(a) || A_SOFT_SEP(a) || A_VOWEL(a)) break;
      i--;
    }
    if (i < leftMost || A_VOWEL(a) === 0) return;

    // (2) Gom cụm nguyên âm liên tiếp (chỉ chữ ASCII — nguyên âm đã mang dấu
    //     phụ như "ê" sẽ chặn vòng lặp, vì vị trí dấu khi đó đã xác định)
    cuoi = i;
    leftMost = this.options.toneNextToVowel ? i : 0;
    leftMost = Math.max(cuoi - MAX_VOWEL_SEQUENCE + 1, leftMost);
    while (i >= leftMost && A_VOWEL(this.attr(buf[i])) && /[a-z]/.test(buf[i])) i--;

    // (3) Quy tắc chọn vị trí trong cụm nguyên âm
    if (i < leftMost || A_VOWEL(this.attr(buf[i])) === 0) {
      l = cuoi - i;                       // độ dài cụm nguyên âm
      switch (l) {
        case 2:
          if (this.options.modernStyle &&
              ((buf[cuoi - 1] === 'o' && buf[cuoi] === 'a') ||
               (buf[cuoi - 1] === 'o' && buf[cuoi] === 'e') ||
               (buf[cuoi - 1] === 'u' && buf[cuoi] === 'y'))) {
            i = cuoi;                     // kiểu mới: hòa, khỏe, thủy
          } else {
            t = buf[i];
            if (i >= 0 && (t === 'q' || (t === 'g' && buf[i + 1] === 'i'))) i = cuoi;
            else if (keys > cuoi + 1) i = cuoi;   // có phụ âm cuối → dấu ở nguyên âm sau
            else i = cuoi - 1;                    // âm mở → dấu ở nguyên âm trước
          }
          break;
        case 3: i = cuoi - 1; break;      // 3 nguyên âm → dấu vào giữa
        default: i = cuoi;
      }
    }

    vowel = A_VOWEL(this.attr(buf[i])) - 1;
    index = A_TONEKEY(this.attr(c)) - 1;

    newChar = BD[vowel][index];
    duplicate = (newChar === buf[i]);
    if (duplicate) newChar = BD[vowel][NO_TONE];
    if (duplicate && index === NO_TONE) return;   // đã không dấu, gõ z/0 nữa → bỏ qua

    this.backs = keys - i;
    buf[i] = newChar;
    this.push.push(newChar);
    for (k = 1; k < keys - i; k++) this.push.push(buf[i + k]);
    if (duplicate) {                     // gõ lại phím dấu → trả về chữ không dấu + phím đó
      this.push.push(c);
      this._putChar(c, this.isLower);
      this.tempVietOff = true;
    }
  };

  // ===================================================================
  // 7. Dấu mũ / đ  (doubleChar)
  // ===================================================================
  P._doubleChar = function (c) {
    var buf = this.buf, keys = buf.length;
    var i, k, a, newChar, index = 0, index_c, toneIndex = 0, leftMost;

    i = keys - 1;
    index_c = this.method !== TELEX ? A_VNI_DOUBLE(this.attr(c)) : A_DBCHAR(this.attr(c));
    leftMost = this.options.freeMarking ? 0 : keys - 1;
    leftMost = Math.max(leftMost, keys - MAX_MODIFY_LENGTH);

    while (i >= leftMost) {
      a = this.attr(buf[i]);
      toneIndex = A_CURTONE(a);
      if (toneIndex === 0 || toneIndex === 6) index = A_DBCHAR(a);
      else index = A_DBCHAR(this.attr(BD[A_VOWEL(a) - 1][NO_TONE]));
      if (index > 0 && index < 9) {
        if (this.method !== TELEX) {
          if ((index_c === VNI_CIRCUMFLEX && index > 2) ||
              (index_c === VNI_D && index <= 2)) break;
        } else if (index === index_c) break;
      } else if (A_HARD_SEP(a) || A_SOFT_SEP(a)) break;
      i--;
    }
    if (i < leftMost || index === 0 || index >= 9) return;

    // "oeo": chữ o đứng trước e thì không được hiểu là ký tự nhân đôi
    if (this.method === TELEX && c === 'o' && i < keys - 1) {
      var v = A_VOWEL(this.attr(buf[i + 1]));
      if (v > 0 && BD[v - 1][NO_TONE] === 'e') return;
    }

    if (toneIndex === 0 || toneIndex === 6) newChar = BK[index - 1];
    else newChar = BD[A_VOWEL(this.attr(BK[index - 1])) - 1][toneIndex - 1];

    if (newChar !== buf[i]) {
      this.backs = keys - i;
      buf[i] = newChar;
      this.push.push(newChar);
      for (k = i + 1; k < keys; k++) this.push.push(buf[k]);
    } else {
      // gõ lại → trả về chữ không dấu (aa → â, aaa → aa)
      this.backs = keys - i;
      if (toneIndex === 0 || toneIndex === 6) newChar = DOUBLE_REVERSE[index - 1];
      else newChar = BD[A_VOWEL(this.attr(DOUBLE_REVERSE[index - 1])) - 1][toneIndex - 1];
      buf[i] = newChar;
      this.push.push(newChar);
      for (k = i + 1; k < keys; k++) this.push.push(buf[k]);
      this._putChar(c, this.isLower);
      this.push.push(c);
      this.tempVietOff = true;
    }
  };

  // ===================================================================
  // 8. Dấu trăng / móc  (putBreveMark)
  // ===================================================================
  P._putBreveMark = function (c) {
    var buf = this.buf, keys = buf.length;
    var i, k, a, newChar, index = 0, index_c, toneIndex = 0, leftMost, t, tmpIdx, prevChar;

    i = keys - 1;
    if (this.method !== TELEX) index_c = A_VNI_DOUBLE(this.attr(c));
    leftMost = this.options.freeMarking ? 0 : keys - 1;
    leftMost = Math.max(leftMost, keys - MAX_MODIFY_LENGTH);

    while (i >= leftMost) {
      a = this.attr(buf[i]);
      toneIndex = A_CURTONE(a);
      if (toneIndex === 0 || toneIndex === 6) index = A_DBCHAR(a);
      else index = A_DBCHAR(this.attr(BD[A_VOWEL(a) - 1][NO_TONE]));
      if (index > 4) {
        if (this.method !== TELEX) {
          if ((index_c === VNI_HORN && index > 6) ||
              (index_c === VNI_BREVE && index <= 6)) break;
        } else break;
      } else if (A_HARD_SEP(a) || A_SOFT_SEP(a)) break;
      i--;
    }
    if (i < leftMost || index <= 4) return;

    // --- "bỏ dấu tự do": ưu tiên đưa móc về nguyên âm đầu của cụm ươ, uơ, ưa...
    if (this.options.freeMarking && i > 0) {
      prevChar = buf[i - 1];
      if (A_VOWEL(this.attr(prevChar)) > 0)
        prevChar = BD[A_VOWEL(this.attr(prevChar)) - 1][NO_TONE];
      tmpIdx = A_DBCHAR(this.attr(prevChar));
      if (tmpIdx > 4) prevChar = W_REVERSE[tmpIdx - 5];
      if ((prevChar === 'o' || prevChar === 'u') && buf[i] === 'u') {
        i--;
        toneIndex = A_CURTONE(this.attr(buf[i]));
      }
      if (i > 0) {
        prevChar = buf[i - 1];
        if (A_VOWEL(this.attr(prevChar)) > 0)
          prevChar = BD[A_VOWEL(this.attr(prevChar)) - 1][NO_TONE];
        if (prevChar === 'u' && (i === 1 || (i > 1 && buf[i - 2] !== 'q'))) {
          t = buf[i];
          if (A_VOWEL(this.attr(t)) > 0) t = BD[A_VOWEL(this.attr(t)) - 1][NO_TONE];
          tmpIdx = A_DBCHAR(this.attr(t)) - 4;
          var base = tmpIdx >= 1 ? W_REVERSE[tmpIdx - 1] : '';
          if ((t === 'a' && this.method === TELEX) ||
              ((t === 'o' || base === 'o') && i !== keys - 1)) {
            i--;
            toneIndex = A_CURTONE(this.attr(buf[i]));
          }
        }
      }
    }

    if (toneIndex === 0 || toneIndex === 6) {
      index = A_DBCHAR(this.attr(buf[i])) - 4;
      newChar = BW[index - 1];
    } else {
      index = A_DBCHAR(this.attr(BD[A_VOWEL(this.attr(buf[i])) - 1][NO_TONE])) - 4;
      newChar = BD[A_VOWEL(this.attr(BW[index - 1])) - 1][toneIndex - 1];
    }
    if (!newChar) return;

    if (newChar !== buf[i]) {
      this.backs = keys - i;
      buf[i] = newChar;
      this.push.push(newChar);
      for (k = i + 1; k < keys; k++) this.push.push(buf[k]);
    } else {
      this.backs = keys - i;
      if (toneIndex === 0 || toneIndex === 6) newChar = W_REVERSE[index - 1];
      else newChar = BD[A_VOWEL(this.attr(W_REVERSE[index - 1])) - 1][toneIndex - 1];
      buf[i] = newChar;
      this.push.push(newChar);
      for (k = i + 1; k < keys; k++) this.push.push(buf[k]);
      this._putChar(c, this.isLower);
      this.push.push(c);
      this.tempVietOff = true;
    }
  };

  // ===================================================================
  // 9. Phím tắt TELEX  [ ] w { }  (shortKey)
  // ===================================================================
  P._shortKey = function (c) {
    var buf = this.buf, keys = buf.length;
    var index = A_MACRO(this.attr(c));
    var newChar = BT[index - 1];
    if (c === '{') newChar = BT[0];
    else if (c === '}') newChar = BT[1];
    if (!newChar) return;

    // xác định hoa/thường: [ ] → thường, { } → hoa, w → theo phím gốc
    var isLower = (c === '{' || c === '}') ? false
                : (c === '[' || c === ']') ? true
                : this.isLower;

    this.push = [];
    if (keys > 0 && buf[keys - 1] === newChar) {   // gõ lại → huỷ
      buf[keys - 1] = c;
      this.lower[keys - 1] = this.isLower;
      this.push.push(c);
      this.backs = 1;
      this.tempVietOff = true;
      return;
    }
    this.backs = 0;
    this.push.push(newChar);
    this._putChar(newChar, isLower);
  };

  // ===================================================================
  // 10. Phím nhân đôi kiểu VNI / VIQR
  // ===================================================================
  P._vniDoubleCharMark = function (c) {
    if (this.buf.length === 0) return;
    switch (A_VNI_DOUBLE(this.attr(c))) {
      case VNI_CIRCUMFLEX:
      case VNI_D:     this._doubleChar(c); break;
      case VNI_HORN:
      case VNI_BREVE: this._putBreveMark(c); break;
    }
  };

  // ===================================================================
  // 11. Macro (gõ tắt) — bản rút gọn của checkMacro()
  // ===================================================================
  P._checkMacro = function (lastChar) {
    var buf = this.buf, keys = buf.length, i = keys - 1;
    while (i >= 0 && !A_WORD_STOP(this.attr(buf[i]))) i--;
    var start = i + 1;
    if (start >= keys) return false;
    var key = buf.slice(start).join('');
    if (!this.macros.has(key)) return false;
    this.backs = keys - start;
    this._macroText = this.macros.get(key) + lastChar;
    this.clearBuf();
    return true;
  };

  // ===================================================================
  // 12. Gắn vào <textarea> / <input>
  // ===================================================================
  UkEngine.attach = function (el, engine) {
    var isPrintable = function (e) {
      return e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    };

    function insert(backs, text) {
      var s = el.selectionStart, e = el.selectionEnd;
      var from = Math.max(0, s - backs);
      var top = el.scrollTop;
      el.setRangeText(text, from, e, 'end');
      el.scrollTop = top;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function onKeyDown(ev) {
      if (!engine.enabled) return;       // bộ gõ đang tắt → để trình duyệt tự xử lý
      if (ev.key === 'Backspace' && ev.target === el) {
        if (el.selectionStart !== el.selectionEnd) engine.clearBuf();
        else engine.backspace();
        return;                          // để trình duyệt tự xoá
      }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
           'Home', 'End', 'Delete', 'PageUp', 'PageDown'].indexOf(ev.key) >= 0) {
        engine.dirty = true;
        return;
      }
      if (ev.key === 'Enter' || ev.key === 'Tab') { engine.clearBuf(); return; }
      if (!isPrintable(ev)) return;
      if (el.selectionStart !== el.selectionEnd) engine.clearBuf();

      if (engine.dirty) {                // caret vừa bị di chuyển → nạp lại buffer
        engine.syncFrom(el.value.slice(0, el.selectionStart));
        engine.dirty = false;
      }

      var r = engine.process(ev.key);
      ev.preventDefault();
      insert(r.backs, r.text);
    }

    function onDirty() { engine.dirty = true; }
    function onBlur() { engine.clearBuf(); }

    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('mousedown', onDirty);
    el.addEventListener('focus', onDirty);
    el.addEventListener('blur', onBlur);

    return function detach() {
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('mousedown', onDirty);
      el.removeEventListener('focus', onDirty);
      el.removeEventListener('blur', onBlur);
    };
  };

  return UkEngine;
}));
