# Ôn thi lý thuyết lái xe hạng B — 600 câu (2025)

Web tĩnh để học và thi thử lý thuyết sát hạch lái xe hạng B theo bộ 600 câu hỏi của Cục CSGT – Bộ Công an, áp dụng từ 01/06/2025 (Công văn 2262/CSGT-P5 ngày 07/05/2025).

## Tính năng

- **Ôn câu sai:** gom mọi câu từng trả lời sai khi học và thi, kèm số lần sai. Ôn tất cả, theo chương, riêng câu điểm liệt hoặc câu sai từ 2 lần; câu hiện như chưa làm, trả lời đúng thì tự gỡ khỏi danh sách. Từ kết quả thi có thể ôn ngay các câu sai/bỏ trống của đề đó.
- **Chế độ học:** học theo chương, theo 60 câu điểm liệt hoặc câu đã đánh dấu. Chọn đáp án là thấy ngay đúng/sai kèm giải thích, quy tắc, mẹo nhớ và căn cứ pháp lý. Câu sa hình có thêm phân tích 5 bước.
- **Chế độ thi:** mô phỏng đề thật 30 câu / 20 phút, đổi đáp án được trước khi nộp, hết giờ tự nộp. Kết quả có đạt/không đạt, cảnh báo sai câu điểm liệt, và xem lại từng câu kèm giải thích.
- **60 đề mẫu cố định + đề ngẫu nhiên:** mỗi đề đúng cấu trúc hạng B: 8 câu quy tắc, 1 câu điểm liệt, 1 văn hóa – đạo đức, 1 kỹ thuật lái, 1 cấu tạo – sửa chữa, 9 biển báo, 9 sa hình. 60 đề dùng đủ 60 câu điểm liệt, không đề nào trùng câu liệt, và phủ cả 600 câu.
- Tiến độ học, câu sai, câu đánh dấu và bài thi đang làm dở được lưu trong trình duyệt (localStorage).
- Giao diện sáng/tối, dùng được trên điện thoại, có phím tắt 1–4 và ← →.

## Chạy

Mở trực tiếp `index.html` bằng trình duyệt là dùng được, không cần cài đặt.

Muốn chạy qua `http://localhost:5600` (không cần Node/Python):

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1
```

Để đưa lên mạng, chép cả thư mục lên bất kỳ hosting tĩnh nào (GitHub Pages, Netlify…).

## Cấu trúc

| Đường dẫn | Nội dung |
|---|---|
| `index.html`, `css/`, `js/app.js` | Giao diện, chế độ học/thi |
| `js/exams.js` | Quy chế thi hạng B, sinh 60 đề mẫu (seed cố định) và đề ngẫu nhiên |
| `data/questions.js` | 600 câu đã gộp (sinh tự động, không sửa tay) |
| `data/explanations/*.json` | Lời giải thích bổ sung cho câu 1–485 |
| `assets/questions/` | 319 ảnh minh họa |
| `tools/build-data.ps1` | Script gộp dữ liệu |

## Nguồn dữ liệu

- Nội dung câu hỏi: *Bộ 600 câu hỏi dùng cho sát hạch lái xe cơ giới đường bộ*, Cục CSGT – Bộ Công an, 2025.
- Câu hỏi, đáp án, cờ 60 câu điểm liệt và trích dẫn văn bản pháp luật lấy từ [lttkiet/gplx-vietnam](https://github.com/lttkiet/gplx-vietnam).
- Ảnh minh họa và lời giải thích 115 câu sa hình (486–600) lấy từ [tducn110/laixe](https://github.com/tducn110/laixe).
- Lời giải thích câu 1–485 do Claude viết, bám theo trích dẫn luật của từng câu. Nội dung chưa được người có chuyên môn rà soát.

Hai nguồn trên khớp nhau ở cả 600 câu về nội dung câu hỏi, đáp án và việc câu nào có ảnh. Chỉ lệch ở 2 câu về cờ điểm liệt: gplx-vietnam đánh dấu câu 107, laixe đánh dấu câu 167. Dự án theo gplx-vietnam vì repo này đối chiếu từng câu với PDF. Chưa đối chiếu được với Phụ lục III của CV 2262.

Cả hai repo nguồn không ghi giấy phép. Nếu định công khai trang web, nên xin phép tác giả hoặc tự trích xuất lại từ PDF gốc.

## Cập nhật dữ liệu

```bash
git clone --depth 1 https://github.com/lttkiet/gplx-vietnam ../src-gplx
```

```bash
git clone --depth 1 https://github.com/tducn110/laixe ../src-laixe
```

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-data.ps1 -GplxRepo ../src-gplx -LaixeRepo ../src-laixe
```
