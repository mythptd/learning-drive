// Cấu trúc đề thi lý thuyết hạng B và bộ sinh đề.
// Căn cứ: Hướng dẫn sử dụng bộ 600 câu hỏi (CV 2262/CSGT-P5 ngày 07/05/2025, Cục CSGT - Bộ Công an).
(function () {
  const RULES = {
    license: 'B',
    total: 30,
    minutes: 20,
    pass: 27,
    // Mỗi đề: 8 câu quy tắc + 1 câu điểm liệt + 1 văn hóa + 1 kỹ thuật + 1 cấu tạo + 9 biển báo + 9 sa hình.
    slots: [
      { label: 'Quy định chung và quy tắc giao thông', ch: 1, n: 8 },
      { label: 'Tình huống mất an toàn giao thông nghiêm trọng (điểm liệt)', crit: true, n: 1 },
      { label: 'Văn hóa giao thông, đạo đức, PCCC và cứu hộ', ch: 2, n: 1 },
      { label: 'Kỹ thuật lái xe', ch: 3, n: 1 },
      { label: 'Cấu tạo và sửa chữa', ch: 4, n: 1 },
      { label: 'Báo hiệu đường bộ', ch: 5, n: 9 },
      { label: 'Sa hình và xử lý tình huống', ch: 6, n: 9 },
    ],
  };

  // 60 đề = đúng 60 câu điểm liệt, mỗi đề một câu, không đề nào trùng câu liệt.
  // Thêm đề chỉ nối tiếp dãy sinh, các đề cũ giữ nguyên.
  const PRESET_COUNT = 60;
  const PRESET_SEED = 20250601;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rand) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Câu điểm liệt chỉ rơi vào ô điểm liệt; các ô theo chương lấy câu không điểm liệt của chương đó.
  function pools(questions) {
    return RULES.slots.map((s) =>
      questions.filter((q) => (s.crit ? q.crit : q.ch === s.ch && !q.crit)).map((q) => q.id)
    );
  }

  // Lấy câu theo hàng đợi xáo trộn: hết hàng đợi mới xáo lại, nên các đề phủ được nhiều câu nhất có thể
  // và chưa dùng hết một vòng thì không lặp câu.
  function makeDrawer(pool, rand) {
    let queue = [];
    return function draw(n) {
      const picked = [];
      let guard = 0;
      while (picked.length < n && guard++ < pool.length * 4) {
        if (!queue.length) queue = shuffle(pool, rand);
        const id = queue.shift();
        if (picked.includes(id)) queue.push(id);
        else picked.push(id);
      }
      return picked;
    };
  }

  function buildExam(drawers) {
    return RULES.slots.flatMap((s, i) => drawers[i](s.n)).sort((a, b) => a - b);
  }

  function presetExams(questions) {
    const rand = mulberry32(PRESET_SEED);
    const ps = pools(questions);
    const crit = ps[RULES.slots.findIndex((s) => s.crit)];
    if (crit.length < PRESET_COUNT) console.warn(`Chỉ có ${crit.length} câu điểm liệt cho ${PRESET_COUNT} đề: sẽ có đề trùng câu liệt.`);
    const drawers = ps.map((p) => makeDrawer(p, rand));
    return Array.from({ length: PRESET_COUNT }, () => buildExam(drawers));
  }

  function randomExam(questions) {
    const drawers = pools(questions).map((p) => makeDrawer(p, Math.random));
    return buildExam(drawers);
  }

  window.Exams = { RULES, presetExams, randomExam };
})();
