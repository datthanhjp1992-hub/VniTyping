# tech.md — Ghi chép mổ xẻ source code `Uk362`

> Ghi chép trong quá trình đọc source, phục vụ việc viết lại engine bằng JavaScript.
> Ngày: 2026-08-26
>
> **Cập nhật 2026-10:** mục 0–13 ghi lại cách UniKey hoạt động và bản port v1 bám theo nó. `ukengine.js` hiện tại là **v2**, thiết kế lại theo hướng lấy âm tiết làm trung tâm — xem [mục 14](#14-engine-v2--lấy-âm-tiết-làm-trung-tâm).

---

## 0. Đính chính: đây là UniKey, không phải VietKey

Thư mục `./Uk362` **không phải** source của VietKey. Đây là **UniKey 3.62**:

| Mục | Giá trị |
|---|---|
| Tác giả | Phạm Kim Long |
| Bản quyền | 1998–2002 |
| Giấy phép | **GNU GPL v2** (`gpl.txt`) |
| Website (thời điểm đó) | unikey.org |
| Build | Visual C++ .NET, mở `newkey/newkey.sln` |

Nguyên nhân nhầm lẫn: file engine chính lại tên là **`keyhook/vietkey.cpp`**, class tên là `VietKey`. Đó là tên cũ từ những phiên bản đầu, tác giả không đổi lại. Nội dung file ghi rõ "UniKey - Vietnamese Keyboard for Windows".

`readme.txt` cũng nói rõ dự án gồm 3 thành phần: UniKey (bộ gõ Windows), UVConverter (chuyển mã), và thư viện `vnconv`. Riêng `rtfio` chỉ có binary `.dll`, tác giả không release source phần này.

**Ý nghĩa về pháp lý:** GPL v2 cho phép đọc, học, sửa và phân phối lại. Nếu tái sử dụng thuật toán một cách trực tiếp thì sản phẩm phái sinh cũng phải là GPL v2. Bản JS đi kèm ghi chép này vì thế cũng để GPL v2.

---

## 1. Bản đồ thư mục

```
Uk362/
├── newkey/      # Ứng dụng Windows: dialog, tray icon, tuỳ chọn, bảng mã
│   ├── encode.cpp/h     ★ dựng bảng mã + bảng thuộc tính DT  (quan trọng nhất)
│   ├── mainwnd, keydlg, macrodlg, tooldlg, expdlg, about, odmenu, button, label
│   ├── userpref.cpp     # lưu/đọc cấu hình
│   └── res/
├── keyhook/     # DLL hook bàn phím toàn hệ thống  ★ chứa engine
│   ├── vietkey.cpp/h    ★★★ TOÀN BỘ THUẬT TOÁN GÕ TIẾNG VIỆT
│   ├── keyhook.cpp/h    # WH_KEYBOARD hook, SharedMem, bơm phím trở lại app
│   └── keycons.h        ★ định nghĩa layout bit của bảng DT
├── vnconv/      # Thư viện chuyển mã độc lập (charset.cpp, data.cpp, convert.cpp)
├── byteio/      # I/O buffer
├── rtfio/       # chỉ có .dll + .h (không có source)
├── uvconvert/   # UVConverter, build được cả trên Linux (Makefile)
├── release/, urelease/
├── readme.txt, license.txt, gpl.txt
```

**Kết luận:** muốn hiểu "cơ chế gõ", chỉ cần đọc kỹ 3 file:
`keyhook/keycons.h` → `newkey/encode.cpp` → `keyhook/vietkey.cpp`.

---

## 2. Kiến trúc tổng thể

```
   Phím bấm (WH_KEYBOARD hook, toàn hệ thống)
            │
            ▼
   ┌──────────────────┐
   │  keyhook.cpp     │  lọc phím, đọc cấu hình từ SharedMem
   └────────┬─────────┘
            ▼
   ┌──────────────────┐   buf[40]     : ký tự đang gõ (mã 1 byte TCVN3)
   │  VietKey::process│   lowerCase[] : cờ hoa/thường song song với buf
   │  (vietkey.cpp)   │   → sinh ra: backs (số Backspace) + ansiPush/uniPush
   └────────┬─────────┘
            ▼
   ┌──────────────────┐
   │  postProcess()   │  đổi buf (TCVN3) sang bảng mã đích qua ToUniL/ToUniH
   └────────┬─────────┘
            ▼
   Bơm `backs` phím Backspace + chuỗi ký tự mới vào ứng dụng đang focus
```

### Ý tưởng cốt lõi — cũng là điều đáng học nhất

UniKey **không** dùng bảng tra "chuỗi phím → chuỗi kết quả". Nó giữ một **buffer từ đang gõ dở** và mỗi lần nhận phím thì:

1. Phân loại phím (`keyCategory`).
2. Dò ngược trong buffer để tìm **đúng một ký tự cần sửa**.
3. Thay ký tự đó bằng ký tự mới.
4. Báo cho tầng trên: "xoá lùi `backs` ký tự, rồi chèn chuỗi này".

Vì chỉ sửa **một ký tự trong buffer** nên engine cực nhẹ và tự nhiên hỗ trợ "bỏ dấu tự do" (gõ dấu ở cuối từ vẫn nhảy đúng vị trí).

Một chi tiết thiết kế thông minh nữa: **chữ hoa/thường được tách khỏi ký tự**. Buffer chỉ lưu dạng chữ thường (`c = tolower(c)`), còn `lowerCase[i]` lưu cờ hoa/thường. Nhờ vậy bảng nguyên âm chỉ cần 12×6 = 72 ô thay vì 144, và mọi logic so sánh không phải quan tâm tới case.

---

## 3. Bảng thuộc tính `DT[256]` — linh hồn của engine

Mỗi ký tự ASCII được gán một `DWORD` 32-bit đóng gói nhiều thuộc tính (`keycons.h`):

| Bit | Ý nghĩa | Macro |
|---|---|---|
| 0–4 | chỉ số bộ nguyên âm (1..12) | `ATTR_VOWEL_INDEX` |
| 5–8 | chỉ số phím tắt macro (`[ ] w W { }`) | `ATTR_MACRO_INDEX` |
| 9–13 | chỉ số ký tự "nhân đôi" (d, e, a, o, u và đ, ê, â, ô, ă, ơ, ư) | `ATTR_DBCHAR_INDEX` |
| 14–17 | chỉ số phím dấu thanh (s f r x j z / 1 2 3 4 5 0 / ' ` ? ~ . 0) | `ATTR_TONE_INDEX` |
| 18–21 | dấu thanh mà **bản thân** ký tự đang mang (1..5, 6 = không dấu) | `ATTR_CURRENT_TONE` |
| 22 | phím tạo dấu trăng/móc (TELEX: `w`) | `ATTR_IS_BREVE` |
| 24 | **ngắt mềm** — không xoá buffer | `ATTR_IS_SOFT_SEPARATOR` |
| 25 | **ngắt cứng** — xoá buffer | `ATTR_IS_SEPARATOR` |
| 26–28 | chỉ số phím nhân đôi kiểu VNI/VIQR (`6 7 8 9` / `^ + ( d`) | `ATTR_VNI_DOUBLE_INDEX` |
| 29 | ranh giới từ (dùng cho macro gõ tắt) | `ATTR_IS_WORD_STOP` |

### Ngắt mềm vs ngắt cứng — điểm dễ bỏ sót

`TONE_LIMITS` (b d f j k l q r s v w x z, dấu câu, chữ số, ký hiệu) và **cả dấu cách** đều là **ngắt MỀM**. Nghĩa là gõ dấu cách **không** xoá buffer! Buffer vẫn giữ cả câu (tối đa 40 ký tự, khi đầy thì `throwBuf()` giữ lại 20 ký tự cuối).

Việc dò dấu chỉ *dừng lại* ở ngắt mềm chứ buffer không bị xoá — nhờ vậy macro gõ tắt và Backspace vẫn hoạt động xuyên qua khoảng trắng. Chỉ ký tự **không nằm trong bảng nào** mới là ngắt cứng và mới thực sự gọi `clearBuf()`.

### Cách dựng bảng (`encode.cpp` → `BuildTelexMethod`)

Thứ tự rất quan trọng vì có bước gán đè (`=`) xen giữa các bước OR (`|=`):

```
1. DT[0..255] = 0x2000000              // mặc định: ngắt cứng
2. DT['a'..'z'], DT['A'..'Z'] = 0
3. DT[TONE_LIMITS] = 0
4. DT[BK], DT[BW] = 0
5. DT[BD[i][j]] = (i+1) | ((j+1)<<18)  // ← GÁN ĐÈ, xoá sạch cờ ở bước trên
6. |= chỉ số ký tự nhân đôi (bit 9)
7. |= ngắt mềm (bit 24) cho TONE_LIMITS
8. |= ranh giới từ (bit 29) cho WORD_STOPS
9. |= chỉ số phím dấu / breve / macro tuỳ kiểu gõ
```

### Bốn bảng ký tự

| Bảng | Kích thước | Nội dung (Unicode hoá) |
|---|---|---|
| `BD[12][6]` | 12 bộ nguyên âm × 6 cột | cột 0..4 = sắc, huyền, hỏi, ngã, nặng; **cột 5 = không dấu**. Thứ tự bộ: `a â ă e ê i o ô ơ u ư y` |
| `BK[8]` | đích của dấu mũ + đ | `đ đ ê ê â â ô ô` |
| `BW[6]` | đích của dấu trăng/móc | `ă ă ơ ơ ư ư` |
| `BT[6]` | đích của phím tắt TELEX `[ ] w W { }` | `ơ ư ư Ư Ơ Ư` |

**Mẹo đánh chỉ số dùng chung** — chỗ này rất tinh tế:

```
DoubleChars = { d, D, e, E, a, A, o, O, u, U }   → dbIndex = 1..10
BK[i]       nhận dbIndex = i+1   (i < 8)          → đ=1  ê=3  â=5  ô=7
BW[i-4]     nhận dbIndex = i+1   (i+1 > 4)        → ă=5  ơ=7  ư=9
```

Nghĩa là `a` và `ă` **cùng có dbIndex = 5**, `o` và `ơ` cùng = 7, `u` và `ư` cùng = 9. Nhờ trùng chỉ số này mà:

* `doubleChar()` (dấu mũ) lọc `1 ≤ index ≤ 8` → chỉ bắt `d e a o` và `đ ê â ô`. `u`/`ư` (index 9) bị loại → đúng, vì TELEX không có `uu`.
* `putBreveMark()` (dấu trăng/móc) lọc `index > 4` → chỉ bắt `a o u` và `ă ơ ư`.

Hai hàm dùng chung một trường bit mà không đụng nhau. Rất gọn.

---

## 4. `keyCategory()` — phân loại phím

Thứ tự kiểm tra **có ý nghĩa**, ai đến trước thắng:

```
1. bit BREVE       → BREVE_MARK            (chỉ TELEX: w)
2. TONE_INDEX > 0  → TONE_MARK
3. TELEX && 1≤dbIndex≤8       → DOUBLE_KEY
4. !TELEX && VNI_DOUBLE_INDEX → VNI_DOUBLE_CHAR_MARK
5. MACRO_INDEX > 0 → SHORT_KEY
6. bit SEPARATOR   → SEPARATOR_KEY         (xoá buffer)
7. VIQR && c=='\\' → ESCAPE_KEY
8. bit SOFT_SEP    → SOFT_SEPARATOR_KEY
```

Ví dụ vì sao thứ tự quan trọng: `w` trong TELEX vừa có bit breve (22), vừa có macro index (phím tắt `w` → `ư`), vừa nằm trong TONE_LIMITS (ngắt mềm). Bước 1 thắng → luôn được coi là phím breve trước; chỉ khi `putBreveMark()` không tìm được nguyên âm nào thì `process()` mới gọi tiếp `shortKey()` để cho ra `ư`.

Tương tự, trong VIQR phím `d` vừa là dbIndex 1 vừa là `VIQR_DOUBLE_KEYS[3]`. Vì kiểu gõ không phải TELEX nên bước 3 bị bỏ, bước 4 thắng → `dd` cho ra `đ`.

---

## 5. `putToneMark()` — thuật toán đặt dấu thanh

Đây là phần "thông minh" nhất, quyết định `hoà` hay `hòa`. Ba bước:

### Bước 1 — tìm nguyên âm cuối cùng
Dò ngược tối đa `MAX_AFTER_VOWEL = 2` ký tự (tức bỏ qua tối đa 2 phụ âm cuối như `ng`, `ch`). Dừng khi gặp nguyên âm hoặc ngắt. Vị trí tìm được gọi là `cuoi`.

> Nếu bật tuỳ chọn `toneNextToVowel` thì phạm vi thu về 0 → dấu bắt buộc phải gõ ngay sau nguyên âm.

### Bước 2 — gom cụm nguyên âm
Lùi tiếp trong khi ký tự là nguyên âm, tối đa `MAX_VOWEL_SEQUENCE = 3`.

**Điều kiện lùi có thêm ràng buộc `buf[i]` phải là chữ ASCII `a-z`.** Đây là chi tiết cực kỳ quan trọng: nguyên âm đã mang dấu phụ (`ê`, `ơ`, `â`, `ư`…) có mã > 127 nên **chặn vòng lặp**. Ý nghĩa: khi trong cụm đã có một nguyên âm mang dấu mũ/móc thì dấu thanh chắc chắn rơi vào nó, không cần xét luật gì thêm.

Ví dụ `tieengs` → buffer `t i ê n g`, bước 2 dừng ngay tại `ê` → `tiếng`. Không cần luật nào cả.

### Bước 3 — luật chọn vị trí trong cụm
Chỉ chạy khi bước 2 lùi được ra khỏi cụm (tức cụm toàn nguyên âm trần). Gọi `l` = độ dài cụm:

| `l` | Luật |
|---|---|
| 1 | dấu vào chính nó |
| 2 | • nếu bật `modernStyle` và cụm là `oa`/`oe`/`uy` → dấu vào chữ **thứ hai**<br>• ngược lại, nếu chữ đứng trước cụm là `q`, hoặc là `g` + cụm bắt đầu bằng `i` → dấu vào chữ **thứ hai** (`quá`, `giá`)<br>• ngược lại, nếu **có phụ âm cuối** → dấu vào chữ **thứ hai** (`hoàng`)<br>• ngược lại (âm mở) → dấu vào chữ **thứ nhất** (`hòa`) |
| 3 | dấu vào chữ **giữa** (`nguyễn`, `khuỷu`) |

> ⚠️ Cảnh báo về tên gọi: tuỳ chọn `modernStyle` trong UniKey ứng với checkbox **"Bỏ dấu kiểu mới (oà, uý)"**. Bật lên cho ra `hoà / khoẻ / thuỷ`; **tắt** (mặc định) cho ra `hòa / khỏe / thủy`. Nhiều người hiểu ngược tên biến này.

### Bước 4 — áp dấu, và luật "gõ lại để huỷ"
```
newChar = BD[vowelIndex][toneKeyIndex]
duplicate = (newChar == ký tự hiện tại)
if duplicate: newChar = BD[vowelIndex][5]      // trả về không dấu
              đồng thời chèn luôn phím vừa gõ, bật cờ tempVietOff
```
Đây là lý do `as` → `á` nhưng `ass` → `as`, và `asz` → `a` (phím `z` là cột 5 = xoá dấu).

Cờ `tempVietOff` tạm tắt tiếng Việt cho tới khi gặp ký tự không phải chữ cái — để gõ được từ tiếng Anh xen kẽ mà không bị bộ gõ can thiệp.

---

## 6. `doubleChar()` và `putBreveMark()` — dấu mũ, trăng, móc

Cùng khuôn: dò ngược tối đa `MAX_MODIFY_LENGTH = 6` ký tự tìm ký tự "nhân đôi" phù hợp, thay thế, và cũng có luật gõ-lại-để-huỷ.

* `leftMost = freeMarking ? 0 : keys-1`. Tắt "bỏ dấu tự do" thì dấu chỉ tác động lên đúng ký tự liền trước.
* Nếu ký tự đích **đang mang dấu thanh** thì phải: lột dấu về ký tự gốc → tra bảng đích → gắn lại dấu thanh cũ. Đó là ý nghĩa của mấy dòng `BD[VOWEL(BD[...][5])][toneIndex-1]` trông rất rối.
* Với VNI/VIQR có thêm bộ lọc: `6`/`^` chỉ nhận index > 2 (a e o), `9`/`d` chỉ nhận index ≤ 2 (d), `7`/`+` chỉ nhận index > 6 (o u), `8`/`(` chỉ nhận index ≤ 6 (a).
* Trường hợp riêng của TELEX: chuỗi `oeo` — chữ `o` đứng ngay trước `e` không được hiểu là phím nhân đôi (nếu không thì `khoeo` sẽ ra `khôeo`).

### Khối `freeMarking` trong `putBreveMark()` — dài và khó, nhưng có lý do

Khối này xử lý việc dời dấu móc sang **nguyên âm bên trái** trong các cụm `ưu`, `ưa`, `ươ`:

1. Nếu ký tự trước là `o`/`u` và ký tự hiện tại là `u` → dời trái. (Cho `ưu`: `cuuw` → `cưu`)
2. Nếu ký tự trước là `u` (và không phải sau `q`) và ký tự hiện tại là:
   * `a` (chỉ TELEX) → dời trái. (`muaw` → `mưa`)
   * `o`, **và `i != keys-1`** → dời trái. (`cuongw` → `cưong`)

Chú ý điều kiện `i != keys-1`: dấu móc **chỉ** nhảy về `u` khi nó không phải ký tự cuối buffer. Hệ quả thực tế rất quan trọng:

> **`huowng` KHÔNG cho ra `hương` mà cho ra `huơng`.**
> Cách gõ đúng trong UniKey là `huwowng` (mỗi `w` sửa một ký tự) hoặc `huongww` (bỏ dấu tự do, hai `w` ở cuối).

Vì `putBreveMark()` **chỉ sửa đúng một ký tự mỗi lần gọi**, không có cách nào một phím `w` biến `uo` thành `ươ`. Đây là điểm khác biệt hành vi so với một số bộ gõ đời sau (chúng thêm luật "uo + w → ươ").

---

## 7. `shortKey()` — phím tắt TELEX

`TelexShortcuts = { [ , ] , w , W , { , } }` → macro index 1..6, tra `BT[]`:

| Phím | Kết quả |
|---|---|
| `[` | ơ |
| `]` | ư |
| `w` (đứng một mình) | ư |
| `W` | Ư |
| `{` | Ơ |
| `}` | Ư |

Hàm này lấy trạng thái hoa/thường từ `GetKeyState(VK_SHIFT)` + `VK_CAPITAL` chứ không lấy từ ký tự — vì `[` và `{` là cùng một phím vật lý.

Cũng có luật gõ-lại-để-huỷ: gõ `w` lần nữa ngay sau khi vừa ra `ư` thì trả về chữ `w`. Cờ `lastWConverted` trong `process()` phục vụ đúng việc này.

---

## 8. Macro gõ tắt (`checkMacro`)

Kích hoạt khi gặp **ranh giới từ** (bit 29) hoặc Enter. Cắt ngược buffer tới ranh giới từ gần nhất (tối đa 16 ký tự), `bsearch` trong bảng macro đã sắp xếp, nếu trúng thì thay cả từ. Bảng macro nằm trong shared memory, tối đa 1024 mục / 64 KB.

Tuỳ chọn `alwaysMacro` cho phép macro chạy ngay cả khi đã tắt chế độ tiếng Việt.

---

## 9. Phần bảng mã (`vnconv`, `postProcess`) — vì sao bản JS bỏ qua được

UniKey lưu buffer bằng **TCVN3 1 byte** rồi mới đổi sang bảng mã đích qua hai bảng `ToUniL[256]` (chữ thường) / `ToUniH[256]` (chữ hoa) trong `postProcess()`. Nó hỗ trợ 17 bảng mã: Unicode UCS-2, TCVN3, VNI-Windows, VIQR, CP1258, UTF-8, NCR thập phân/hex, Unicode tổ hợp, VISCII, VPS, BK HCM 1/2, Vietware X/F, C-String…

Đây cũng là lý do `backs` (số phím Backspace phải bơm) phức tạp: với bảng mã 2 byte hoặc NCR (`&#7879;` dài 8 ký tự!) thì một ký tự tiếng Việt chiếm nhiều ký tự trên màn hình, phải cộng dồn thêm.

**Trên trình duyệt, toàn bộ tầng này là không cần thiết**: JavaScript làm việc với Unicode dựng sẵn, mỗi ký tự tiếng Việt = đúng 1 mã BMP. Nên bản JS:

* Dùng thẳng bảng `BD/BK/BW/BT` bằng ký tự Unicode.
* `backs` luôn = số ký tự buffer, không phải nhân hệ số.
* Bỏ hoàn toàn `ToUniL/ToUniH`, `encodeUnicode()`, `uniCharLen()`.

Nếu sau này cần xuất TCVN3 / VNI / NCR thì chỉ cần thêm một hàm map ở đầu ra, không đụng vào engine.

---

## 10. Bảng đối chiếu C++ → JavaScript

| UniKey (C++) | `ukengine.js` | Ghi chú |
|---|---|---|
| `DT[256]` (DWORD) | `this.DT` (object) | giữ nguyên layout bit, key là ký tự chữ thường |
| `buf[40]`, `lowerCase[40]` | `this.buf[]`, `this.lower[]` | y hệt |
| `VietKey::process()` | `P.process()` | trả `{ backs, text }` |
| `keyCategory()` | `P._keyCategory()` | y hệt |
| `putToneMark()` | `P._putToneMark()` | y hệt |
| `doubleChar()` | `P._doubleChar()` | y hệt |
| `putBreveMark()` | `P._putBreveMark()` | y hệt |
| `shortKey()` | `P._shortKey()` | hoa/thường suy từ ký tự thay vì `GetKeyState` |
| `checkMacro()` | `P._checkMacro()` | rút gọn: dùng `Map`, không phân biệt hoa thường |
| `postProcess()`, `encodeUnicode()` | `P._render()` | rút gọn còn việc áp hoa/thường |
| `processBackspace()` | `P.backspace()` | luôn 1 ký tự |
| `UpdateBuffer()` khi `dirty` | `P.syncFrom()` | nạp lại buffer sau khi di chuyển caret |
| hook `WH_KEYBOARD` | `UkEngine.attach()` | `keydown` + `preventDefault` + `setRangeText` |

**Những thứ cố ý bỏ:** hook toàn hệ thống, shared memory, tray icon, chuyển mã 17 bảng, RTF, clipboard Unicode, chế độ VIQR làm bảng mã đầu ra (khác với VIQR làm kiểu gõ).

---

## 11. Kiểm chứng

Bộ test của v1 (`test.js`, 64 ca, nay đã thay bằng `tests/`) đối chiếu hành vi mong đợi của UniKey. Vài ca đáng chú ý của v1:

| Kiểu | Gõ | Ra |
|---|---|---|
| TELEX | `chaof` | chào |
| TELEX | `tieengs` | tiếng |
| TELEX | `hoaf` | hòa (mặc định) / hoà (bật `modernStyle`) |
| TELEX | `quaf` · `giaf` | quà · già |
| TELEX | `nguyeexn` | nguyễn |
| TELEX | `cuwowfng` | cường |
| TELEX | `cuongww` | cương (bỏ dấu tự do) |
| TELEX | `muaw` | mưa |
| TELEX | `cuuws` | cứu |
| TELEX | `ruwowuj` · `ruouwwj` | rượu |
| TELEX | `ass` · `asz` | as · a |
| TELEX | `DDATJ` | ĐẠT |
| VNI | `vie65t` · `ngu7o7i2` | việt · người |
| VIQR | `tie^'ng` · `ngu+o+\`i` | tiếng · người |

---

## 12. Nhận xét kỹ thuật

**Điểm hay đáng học:**
* Đóng gói 10 thuộc tính vào 1 DWORD — tra cứu O(1), không nhánh điều kiện.
* Cho `a`/`ă`, `o`/`ơ`, `u`/`ư` dùng chung chỉ số rồi lọc bằng khoảng giá trị — một trường bit gánh hai chức năng.
* Tách case ra khỏi ký tự → giảm một nửa bảng và toàn bộ so sánh.
* Chỉ sửa một ký tự mỗi phím → engine không trạng thái phức tạp, dễ undo.
* Giao diện "backs + push" trung lập với môi trường: chạy được cả trên Win32 hook lẫn trong `<textarea>`.

**Điểm nay đã lỗi thời:**
* Buffer 1 byte + 17 bảng mã: 2002 thì thiết yếu, giờ chỉ cần Unicode.
* Tính `backs` phụ thuộc bảng mã, rất dễ sai.
* Biến một chữ (`N`, `e`, `V`, `T`, `I`, `P`, `G`, `Y`, `r`, `o`, `l`, `a`) — file `vietkey.cpp` khá khó đọc.
* Khối `freeMarking` với các điều kiện `i != keys-1`, `buf[i-2] != 'q'` là luật ngôn ngữ hard-code, không có bảng luật tách riêng.

**Nếu viết lại từ đầu hôm nay** thì nên: tách luật đặt dấu thành bảng dữ liệu (không hard-code), làm việc thuần Unicode, và tách "vị trí dấu thanh" thành một hàm thuần khiết `(cụm nguyên âm, phụ âm cuối, tuỳ chọn) → chỉ số`, dễ test hơn nhiều.

---

## 13. Việc có thể làm tiếp

* [ ] Bổ sung kiểu gõ **VIQR\*** (giống VIQR nhưng dùng `*` thay `+`) — đã có sẵn hằng số, chỉ cần bật.
* [ ] Thêm tầng xuất bảng mã TCVN3 / VNI / NCR ở đầu ra (đọc `vnconv/data.cpp` để lấy bảng).
* [ ] Hỗ trợ `contenteditable` bên cạnh `<textarea>`/`<input>`.
* [ ] Kiểm tra chính tả kiểu `Speller` (bộ gõ trong `vntyping.js` của dự án hiện tại có, UniKey 3.62 thì không).
* [ ] Thêm luật `uo + w → ươ` như các bộ gõ hiện đại (đây là **cải tiến**, không còn giống UniKey gốc nữa — nên để sau một tuỳ chọn).

---

## 14. Engine v2 — lấy âm tiết làm trung tâm

### Vì sao viết lại

Chạy bộ test mới trên v1 thì chỉ 166/224 ca đạt. Các lỗi đều có chung một gốc: v1 **sửa tại chỗ từng ký tự** trong buffer và không biết đâu là vần, đâu là phụ âm cuối.

| Gõ | v1 | v2 | Nguyên nhân ở v1 |
|---|---|---|---|
| `hoafn` | hòan | hoàn | dấu đã đặt thì không dời khi gõ thêm phụ âm cuối |
| `nguyenxe` | nguỹên | nguyễn | dấu không dời khi thêm dấu mũ sau |
| `huowng` | huơng | hương | một phím `w` chỉ sửa một ký tự |
| `nguoi72` (VNI) | ngừoi | người | như trên |
| `google` | gôgle | google | không có kiểm tra chính tả |
| `windows` | ưindớ | windows | như trên |
| Ctrl+Z rồi gõ dấu | xoá nhầm chữ | đúng | buffer riêng bị lệch với ô nhập |

### Mô hình dữ liệu

Từ đang gõ là một mảng **chữ**, mỗi chữ gồm `{ b: chữ gốc a–z, m: dấu phụ, up: hoa/thường }`, cộng **một** dấu thanh cho cả từ. Dấu phụ là một trong `NONE, HAT (â ê ô), BREVE (ă), HORN (ơ ư), STROKE (đ)`.

Dấu thanh không gắn vào ký tự nào. Mỗi lần hiển thị, `tonePosition()` tính lại vị trí:

1. Cụm nguyên âm có chữ mang dấu phụ → dấu vào chữ đó (`ươ` → vào `ơ`).
2. Một nguyên âm → vào chính nó. Ba nguyên âm → vào chữ giữa.
3. Hai nguyên âm: có phụ âm cuối → chữ thứ hai (`hoàn`); `oa/oe/uy` ở kiểu mới → chữ thứ hai (`hoà`); còn lại → chữ thứ nhất (`mùa`).
4. `qu` và `gi` được tách vào phụ âm đầu trước khi xét (`quà`, `già`), nhưng `gì`, `gìn` vẫn đúng vì engine thử cả hai cách tách.

### Mỗi phím: tính lại cả từ rồi so chuỗi

```
phím → actionOf(kiểu gõ, phím) → { tone | hat | horn | breve | w | stroke | short | escape } hoặc null
     → _apply(): thử áp lên mảng chữ; nếu kết quả không còn là âm tiết hợp lệ thì bỏ, coi phím là chữ thường
     → _render(): dựng lại chuỗi hiển thị
     → diff(chuỗi cũ, chuỗi mới) → { backs, text }
```

Kiểu gõ chỉ là bảng ánh xạ "phím → hành động", lõi engine không biết đang là TELEX hay VNI. Bảng thuộc tính đóng gói bit `DT[]` của v1 không còn cần nữa.

### Kiểm tra chính tả

`validParse()` tách từ thành phụ âm đầu + vần + phụ âm cuối rồi đối chiếu:

- 27 phụ âm đầu (`b c ch d đ g gh gi h k kh l m n ng ngh nh p ph qu r s t th tr v x`);
- khoảng 160 vần hợp lệ (mảng `RIMES`);
- luật `c/k`, `gh/ngh` chỉ đứng trước `e ê i (y)`;
- phụ âm cuối `c ch p t` chỉ đi với sắc, nặng hoặc không dấu.

Có hai mức: **đang gõ dở** (chữ chưa có dấu phụ được coi là còn có thể thêm, ví dụ `tie` còn có thể thành `tiê`) và **hoàn chỉnh** (khi gõ dấu cách, dấu câu hoặc Enter).

- Khi gõ một chữ làm từ không còn hợp lệ, nếu từ đã từng được biến đổi thì trả lại nguyên văn các phím: `goog` → `gôg` không hợp lệ → hiện `goog`.
- Khi kết thúc từ mà từ không hoàn chỉnh thì cũng trả lại nguyên văn: `user` → `ủe` → gõ dấu cách → `user`.
- Trước khi kiểm tra hoàn chỉnh, `ươ` đứng cuối từ được chuẩn hoá thành `uơ` (`thuowr` → thuở).

### `ươ` với một phím

- Phím `w` (hoặc `7`, `+`) thử lần lượt các ứng viên: cặp `uo` (trừ sau `q`) → `ươ`; sau đó từng nguyên âm `u o a` từ phải sang trái. Ứng viên đầu tiên cho ra âm tiết hợp lệ được chọn, vì vậy `muaw` → mưa (không phải muă), `cuuw` → cưu.
- Nếu `u` đã có móc rồi mới gõ `o` (`nguwo`), engine tự nâng thành `ươ`, vì `ưo` không phải vần tiếng Việt. Phím `w` gõ sau đó chỉ xác nhận, nên cách gõ cũ `nguwowif` vẫn ra người.

### Đồng bộ với ô nhập

v2 không giữ buffer riêng làm nguồn sự thật. Trước mỗi phím, `ensureSync(văn bản trước con trỏ)` so từ đứng trước con trỏ với chuỗi engine đang hiển thị. Nếu khác (do Undo, dán, click chuột, Backspace...) thì nạp lại từ văn bản. Văn bản nạp lại được giữ làm "nguyên văn" khi cần trả lại: dán `việt` rồi gõ `x` cho ra `việtx`, không bị đổi thành phím Telex.

`attach()` dùng `document.execCommand('insertText')` nên lịch sử Ctrl+Z của trình duyệt vẫn hoạt động. Trình duyệt nào không hỗ trợ thì engine quay về `setRangeText`.

### Bộ test dùng chung

`tests/cases.json` chứa 224 ca, chia nhóm theo kiểu gõ và tuỳ chọn. `tests/run.js` mô phỏng một ô nhập: gõ từng phím, áp `{ backs, text }`, hỗ trợ `{BS}`, `{ENTER}`, `{PASTE:...}`. Bản C# sau này sẽ đọc cùng file này để chắc chắn hai bản cho kết quả giống hệt nhau.

### Giới hạn còn lại

- Từ tiếng Anh trùng âm tiết tiếng Việt (`see` → sê, `box` → bõ) không phân biệt được.
- VIQR: `.` `?` `'` vừa là dấu thanh vừa là dấu câu; dùng `\` để gõ dấu câu ngay sau chữ.
- Danh sách vần là dữ liệu, không phải luật. Nếu gặp một từ hợp lệ bị trả lại nguyên văn, chỉ cần thêm vần đó vào `RIMES` và thêm một ca vào `tests/cases.json`.
