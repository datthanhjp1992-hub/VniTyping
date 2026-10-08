# Gõ tiếng Việt

Bộ gõ tiếng Việt chạy hoàn toàn trong trình duyệt. Hỗ trợ ba kiểu gõ **Telex**, **VNI**, **VIQR**, không cần cài đặt, không cần máy chủ, không gửi dữ liệu đi đâu cả.

Engine được **Nguyễn Thành Đạt** viết bằng JavaScript thuần. Bản đầu tiên là bản port từ mã nguồn **UniKey 3.62** (bộ gõ tiếng Việt kinh điển trên Windows của tác giả **Phạm Kim Long**). Bản hiện tại (v2) được thiết kế lại theo hướng lấy âm tiết làm trung tâm, vẫn kế thừa bảng dữ liệu và ý tưởng của UniKey.

---

## Vì sao có dự án này

Khi làm việc trên máy công ty, máy dùng chung hay máy ở nước ngoài, không phải lúc nào cũng cài được bộ gõ tiếng Việt. Trang này giải quyết đúng vấn đề đó: mở lên, gõ, bấm Copy, dán đi đâu tuỳ ý.

Ngoài ra đây cũng là một bài học kỹ thuật: toàn bộ cơ chế đặt dấu thanh, dấu mũ, dấu móc của UniKey được mổ xẻ và ghi lại trong [`tech.md`](tech.md).

---

## Tính năng

### Ba kiểu gõ

| Kiểu | Cách gõ dấu thanh | Ví dụ |
|---|---|---|
| **Telex** | `s` `f` `r` `x` `j` `z` | `tieengs Vieetj` → tiếng Việt |
| **VNI** | `1` `2` `3` `4` `5` `0` | `tie61ng Vie65t` → tiếng Việt |
| **VIQR** | `'` `` ` `` `?` `~` `.` `0` | `tie^'ng Vie^.t` → tiếng Việt |

Có thêm chế độ **OFF** để tắt bộ gõ, phím đi thẳng vào ô nhập như bình thường.

### Đặt dấu thông minh

Engine giữ chuỗi phím của từ đang gõ. Mỗi lần có phím mới, cả từ được tính lại từ đầu: phụ âm đầu, vần, dấu phụ, dấu thanh. Nhờ vậy:

- **Bỏ dấu ở đâu cũng được, dấu luôn nằm đúng chỗ** — `chaof`, `chafo` → chào; `hoafn` → hoàn; `nguyenxe` → nguyễn.
- **Đúng luật tiếng Việt** — `quaf` → quà, `giaf` → già, `gif` → gì, `ngoaif` → ngoài.
- **`ươ` chỉ cần một phím** — `huowng` → hương, `nguoiwf` → người (VNI: `nguoi72`).
- **Tự giữ nguyên từ tiếng Anh** — `google`, `address`, `windows`, `user`, `text` không bị bộ gõ phá. Engine kiểm tra từ có phải âm tiết tiếng Việt hợp lệ không, nếu không thì trả lại đúng các phím đã gõ.
- **Gõ lại để huỷ** — `as` → á, gõ thêm `s` thành `as`; `asz` → a; `ww` → w.
- **Giữ nguyên chữ hoa** — `DDATJ` → ĐẠT, `Vieetj Nam` → Việt Nam.
- **Không bao giờ lệch với ô nhập** — trước mỗi phím, engine đọc lại từ đứng trước con trỏ. Ctrl+Z, dán văn bản, click chuột hay Backspace đều không làm xoá nhầm chữ.

### Giao diện

- **4 bộ giao diện**: Sen, Giấy Dó, Mực Đêm, Phố Neon. Mỗi bộ là một hệ thiết kế riêng — đổi cả màu, font chữ, bo góc và đổ bóng, không chỉ đổi màu.
- **Bảng hướng dẫn** tự đổi theo kiểu gõ đang chọn.
- **Nút Select All / Copy / Clear**, bộ đếm ký tự.
- **Ghi nhớ** giao diện và kiểu gõ đã chọn qua `localStorage`.
- **Responsive**, dùng được trên điện thoại.

### Riêng tư

Không backend, không analytics, không gọi mạng. Văn bản của bạn không rời khỏi trình duyệt.

---

## Cách dùng

Chỉ là một trang tĩnh, không cần build:

```bash
git clone <repo-url>
cd <repo>
python3 -m http.server 8000   # hoặc mở thẳng index.html
```

Rồi mở http://localhost:8000

### Nhúng engine vào dự án khác

`ukengine.js` là một module độc lập, không phụ thuộc thư viện nào:

```html
<script src="ukengine.js"></script>
<script>
  var engine = new UkEngine({ method: UkEngine.TELEX });
  UkEngine.attach(document.getElementById('myTextarea'), engine);
</script>
```

Các tuỳ chọn:

```js
new UkEngine({
  method: UkEngine.TELEX,   // TELEX | VNI | VIQR | VIQR_STAR
  freeMarking: true,        // bỏ dấu tự do; false = dấu phải gõ ngay sau nguyên âm
  modernStyle: true,        // true → hoà, khoẻ, thuỷ | false → hòa, khỏe, thủy
  autoRestore: true,        // giữ nguyên từ không phải tiếng Việt (google, address…)
  hornUO: true,             // uo + w → ươ
  macroEnabled: false       // bật gõ tắt
});
```

Gõ tắt:

```js
engine.setMacros({ vn: 'Việt Nam', hn: 'Hà Nội' });
engine.setOption('macroEnabled', true);
```

Nếu cần dùng ở môi trường khác (Node, React, Vue…), engine có API cấp thấp:

```js
engine.ensureSync(textBeforeCaret); // đồng bộ với văn bản trước con trỏ (nên gọi trước mỗi phím)
var r = engine.process('s');        // → { backs, text }: xoá lùi `backs` ký tự rồi chèn `text`
var end = engine.endWord();         // gọi khi Enter / Tab: chốt từ (trả lại tiếng Anh, gõ tắt)
```

---

## Cấu trúc file

```
├── index.html      # giao diện
├── style.css       # design tokens + 4 bộ theme
├── app.js          # gắn kết UI: đổi theme, đổi kiểu gõ, toolbar
├── ukengine.js     # ★ engine bộ gõ (độc lập, không phụ thuộc gì)
├── tests/
│   ├── cases.json  # bộ test dùng chung (cũng dùng cho bản C# sau này)
│   └── run.js      # chạy test: node tests/run.js
├── tech.md         # ghi chép mổ xẻ UniKey 3.62 và thiết kế engine v2
├── COPYING         # toàn văn GPL v2
└── README.md
```

---

## Kiểm thử

```bash
node tests/run.js
```

224 trường hợp cho TELEX, VNI, VIQR, VIQR\*: đặt và dời dấu thanh, dấu mũ/trăng/móc, `ươ`, giữ nguyên tiếng Anh, gõ lại để huỷ, chữ hoa, Backspace, dán văn bản, Enter, gõ tắt và các tuỳ chọn.

Mỗi ca mô phỏng đúng một ô nhập: gõ từng phím, áp `{ backs, text }`, và có thể chèn `{BS}`, `{ENTER}`, `{PASTE:...}` vào giữa.

---

## Vài lưu ý về hành vi

- **Kiểu dấu mặc định là kiểu mới**: `hoaf` → hoà, `thuyr` → thuỷ. Muốn ra `hòa`, `thủy` thì đặt `modernStyle: false`.
- **Từ tiếng Anh trùng âm tiết tiếng Việt** vẫn bị gõ thành tiếng Việt, ví dụ `see` → sê, `box` → bõ. Đây là giới hạn chung của mọi bộ gõ Telex; khi cần gõ nhiều tiếng Anh thì chuyển sang OFF.
- **VIQR** dùng `.` `?` `'` làm dấu thanh nên `chao.` sẽ thành `chạo`. Gõ `chao\.` để ra `chao.`.
- **Khác với UniKey gốc**: dấu thanh tự dời chỗ, `ươ` chỉ cần một `w`, có kiểm tra chính tả. Không còn chế độ "UniKey cổ điển".

Chi tiết thiết kế, xem [`tech.md`](tech.md).

---

## Bản quyền và giấy phép

### Thuật toán gốc

Bản đầu tiên của `ukengine.js` được viết lại từ **UniKey 3.62**. Bản v2 thiết kế lại thuật toán nhưng vẫn kế thừa bảng dữ liệu và ý tưởng từ đó:

> **UniKey — Vietnamese Keyboard for Windows**
> Copyright © 1998–2002 **Phạm Kim Long**
> Phát hành theo GNU General Public License version 2

Cụ thể là từ các file `keyhook/vietkey.cpp`, `keyhook/keycons.h` và `newkey/encode.cpp` trong bộ source UniKey 3.62.

Xin gửi lời cảm ơn chân thành tới tác giả Phạm Kim Long. UniKey là công cụ đã phục vụ hàng triệu người Việt suốt hơn hai thập kỷ, và việc anh mở mã nguồn theo GPL chính là điều làm cho dự án này tồn tại được.

### Dự án này

`ukengine.js` do **Nguyễn Thành Đạt** viết bằng JavaScript, sau khi tham khảo và nghiên cứu mã nguồn UniKey 3.62 của anh Phạm Kim Long. Bản v1 bám sát cấu trúc của bản gốc. Bản v2 thiết kế lại theo hướng lấy âm tiết làm trung tâm, nhưng vẫn dùng bảng nguyên âm và các quy tắc đặt dấu kế thừa từ UniKey.

Vì vậy dự án này được phát hành theo cùng giấy phép mà anh Long đã chọn cho UniKey: **GNU General Public License version 2, hoặc (tuỳ người dùng chọn) bất kỳ phiên bản nào mới hơn**.

> *Ghi chú:* cụm "hoặc bất kỳ phiên bản nào mới hơn" kế thừa từ chính header mã nguồn UniKey. Nó cho phép người dùng lại dự án này được tự chọn tuân theo GPL v2, v3 hay các phiên bản sau, thay vì bị bó buộc vào đúng v2.

```
Copyright © 2026 Nguyễn Thành Đạt   (bản JavaScript — ukengine.js và trang web)
Copyright © 1998–2002 Phạm Kim Long  (thuật toán gốc — UniKey)

Chương trình này là phần mềm tự do; bạn có thể phân phối lại và/hoặc
sửa đổi nó theo các điều khoản của GNU General Public License do
Free Software Foundation công bố, phiên bản 2 hoặc (tuỳ bạn chọn)
bất kỳ phiên bản nào mới hơn.

Chương trình được phân phối với hy vọng nó sẽ hữu ích, nhưng KHÔNG CÓ
BẤT KỲ BẢO ĐẢM NÀO; kể cả bảo đảm ngầm định về KHẢ NĂNG THƯƠNG MẠI hay
SỰ PHÙ HỢP CHO MỘT MỤC ĐÍCH CỤ THỂ. Xem GNU General Public License để
biết thêm chi tiết.
```

Toàn văn giấy phép: [COPYING](COPYING) hoặc https://www.gnu.org/licenses/old-licenses/gpl-2.0.html

---

## Tác giả

**Nguyễn Thành Đạt** — kỹ sư CNTT người Việt Nam, hiện làm việc tại Nhật Bản.

Người tham khảo mã nguồn UniKey 3.62 của anh Phạm Kim Long, phân tích cơ chế hoạt động (xem [`tech.md`](tech.md)) và xây dựng phiên bản JavaScript chạy trên trình duyệt.

Thuật toán gốc thuộc về anh **Phạm Kim Long** — xem phần [Bản quyền và giấy phép](#bản-quyền-và-giấy-phép).

---

## Hướng phát triển

- [x] Engine v2: dời dấu thanh, `ươ` một phím, giữ nguyên tiếng Anh, đồng bộ với ô nhập
- [x] Kiểu gõ **VIQR\*** (dùng `*` thay `+`) trong engine
- [ ] Ứng dụng Windows portable (C# WinForms) dùng chung bộ test
- [ ] Xuất ra các bảng mã khác: TCVN3, VNI-Windows, NCR
- [ ] Hỗ trợ `contenteditable` bên cạnh `<textarea>` / `<input>`
- [ ] Bảng gõ tắt cho người dùng tự cấu hình, lưu trong `localStorage`
