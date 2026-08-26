# Gõ tiếng Việt

Bộ gõ tiếng Việt chạy hoàn toàn trong trình duyệt. Hỗ trợ ba kiểu gõ **Telex**, **VNI**, **VIQR**, không cần cài đặt, không cần máy chủ, không gửi dữ liệu đi đâu cả.

Engine được **Nguyễn Thành Đạt** viết lại bằng JavaScript thuần, dựa trên việc tham khảo mã nguồn của **UniKey 3.62** — bộ gõ tiếng Việt kinh điển trên Windows của tác giả **Phạm Kim Long**.

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

Engine không tra bảng "chuỗi phím → kết quả" mà giữ một buffer từ đang gõ dở, rồi tự tìm đúng ký tự cần sửa. Nhờ vậy:

- **Bỏ dấu tự do** — gõ dấu ở cuối từ vẫn nhảy đúng chỗ: `chaof` → chào, `chaifo`... đều ra kết quả đúng.
- **Đúng luật tiếng Việt** — `quaf` → quà, `giaf` → già, `nguyeexn` → nguyễn, `hoangf` → hoàng.
- **Gõ lại để huỷ** — `as` → á, gõ thêm `s` nữa thành `as`; `asz` → a.
- **Tự động tắt cho từ tiếng Anh** — gõ xen kẽ tiếng Anh không bị bộ gõ can thiệp.
- **Giữ nguyên chữ hoa** — `DDATJ` → ĐẠT, `Vieetj Nam` → Việt Nam.

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
  method: UkEngine.TELEX,   // TELEX | VNI | VIQR
  freeMarking: true,        // bỏ dấu tự do (mặc định bật)
  modernStyle: false,       // true → hoà, thuỷ | false → hòa, thủy
  toneNextToVowel: false,   // buộc gõ dấu ngay sau nguyên âm
  macroEnabled: false       // bật gõ tắt
});
```

Gõ tắt:

```js
engine.setMacros({ vn: 'Việt Nam', hn: 'Hà Nội' });
engine.setOption('macroEnabled', true);
```

Nếu cần dùng ở môi trường khác (Node, React, Vue…), engine cũng có API cấp thấp trả về `{ backs, text }`: xoá lùi `backs` ký tự rồi chèn `text`.

---

## Cấu trúc file

```
├── index.html      # giao diện
├── style.css       # design tokens + 4 bộ theme
├── app.js          # gắn kết UI: đổi theme, đổi kiểu gõ, toolbar
├── ukengine.js     # ★ engine bộ gõ (độc lập, không phụ thuộc gì)
├── test.js         # 64 test cho engine  (node test.js)
├── tech.md         # ghi chép mổ xẻ source UniKey 3.62
└── README.md
```

---

## Kiểm thử

```bash
node test.js
```

64 trường hợp cho cả ba kiểu gõ: đặt dấu thanh, dấu mũ/trăng/móc, gõ lại để huỷ, chữ hoa, Backspace, gõ tắt.

---

## Vài lưu ý về hành vi

Engine bám sát UniKey gốc, nên có hai điểm khác với một số bộ gõ đời sau:

- **`hoaf` → hòa** (mặc định). Muốn ra `hoà` thì bật `modernStyle: true` — tương ứng tuỳ chọn "Bỏ dấu kiểu mới (oà, uý)" trong UniKey.
- **Cụm `ươ` cần hai lần `w`**: gõ `cuwowngf` → cường, hoặc bỏ dấu ở cuối `cuongwwf`. Một phím `w` chỉ sửa được một ký tự — đúng như thiết kế gốc.

Chi tiết vì sao, xem [`tech.md`](tech.md).

---

## Bản quyền và giấy phép

### Thuật toán gốc

Thuật toán bộ gõ trong `ukengine.js` được viết lại từ **UniKey 3.62**:

> **UniKey — Vietnamese Keyboard for Windows**
> Copyright © 1998–2002 **Phạm Kim Long**
> Phát hành theo GNU General Public License version 2

Cụ thể là từ các file `keyhook/vietkey.cpp`, `keyhook/keycons.h` và `newkey/encode.cpp` trong bộ source UniKey 3.62.

Xin gửi lời cảm ơn chân thành tới tác giả Phạm Kim Long. UniKey là công cụ đã phục vụ hàng triệu người Việt suốt hơn hai thập kỷ, và việc anh mở mã nguồn theo GPL chính là điều làm cho dự án này tồn tại được.

### Dự án này

`ukengine.js` là **bản viết lại bằng JavaScript** do **Nguyễn Thành Đạt** thực hiện, sau khi tham khảo và nghiên cứu mã nguồn UniKey 3.62 của anh Phạm Kim Long. Toàn bộ cấu trúc bảng dữ liệu, cách đóng gói thuộc tính vào bit, và các quy tắc đặt dấu đều bám sát bản gốc; phần viết mới là việc chuyển từ C++/TCVN3 sang JavaScript/Unicode và phần gắn kết với trình duyệt.

Vì bản JS bám sát mã nguồn gốc như vậy, dự án này được phát hành theo cùng giấy phép mà anh Long đã chọn cho UniKey: **GNU General Public License version 2, hoặc (tuỳ người dùng chọn) bất kỳ phiên bản nào mới hơn**.

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

- [ ] Bổ sung kiểu gõ **VIQR\*** (dùng `*` thay `+`)
- [ ] Xuất ra các bảng mã khác: TCVN3, VNI-Windows, NCR
- [ ] Hỗ trợ `contenteditable` bên cạnh `<textarea>` / `<input>`
- [ ] Bảng gõ tắt cho người dùng tự cấu hình, lưu trong `localStorage`
- [ ] Tuỳ chọn luật hiện đại `uo` + `w` → `ươ`
- [ ] Kiểm tra chính tả tiếng Việt khi gõ
