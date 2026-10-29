(function () {
  'use strict';

  const QUESTIONS = window.QUESTIONS || [];
  const VIDEO_TIPS = window.VIDEO_TIPS || [];
  const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
  const { RULES } = window.Exams;
  const PRESETS = window.Exams.presetExams(QUESTIONS);

  const CHAPTERS = {
    1: 'Quy định chung và quy tắc giao thông',
    2: 'Văn hóa giao thông, đạo đức và cứu hộ',
    3: 'Kỹ thuật lái xe',
    4: 'Cấu tạo và sửa chữa',
    5: 'Báo hiệu đường bộ',
    6: 'Sa hình và xử lý tình huống',
  };
  const SETS = {
    all: { name: 'Tất cả 600 câu', ids: () => QUESTIONS.map((q) => q.id) },
    crit: { name: '60 câu điểm liệt', ids: () => QUESTIONS.filter((q) => q.crit).map((q) => q.id) },
    marked: { name: 'Câu đã đánh dấu', ids: () => QUESTIONS.filter((q) => state.marks[q.id]).map((q) => q.id) },
  };
  for (const ch of Object.keys(CHAPTERS)) {
    SETS['ch' + ch] = { name: `Chương ${ch}: ${CHAPTERS[ch]}`, ids: () => QUESTIONS.filter((q) => q.ch === +ch).map((q) => q.id) };
  }
  const KEYS = ['1', '2', '3', '4'];

  // ---------- Lưu trữ ----------
  const STORE_KEY = 'gplx-b-2025';
  const state = Object.assign(
    { learn: {}, marks: {}, wrong: {}, exams: {}, results: {}, active: null, review: null, lastResult: null, theme: null },
    load()
  );
  // Bản cũ lưu câu sai dạng true; quy về số lần sai.
  for (const id in state.wrong) state.wrong[id] = +state.wrong[id] || 1;
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* bộ nhớ trình duyệt bị chặn */ }
  }
  // Lưu riêng theo đề, giữ lại 20 lần thi gần nhất cho mỗi đề.
  const RESULT_HISTORY_LIMIT = 20;
  const flatResults = Array.isArray(state.results);
  function groupResults(results) {
    const grouped = {};
    const add = (result, key) => {
      if (!result || typeof result !== 'object') return;
      const examKey = result.key || key;
      if (!examKey) return;
      (grouped[examKey] ||= []).push({ ...result, key: examKey });
    };
    if (Array.isArray(results)) results.forEach((result) => add(result));
    else if (results && typeof results === 'object') {
      Object.entries(results).forEach(([key, attempts]) => {
        if (Array.isArray(attempts)) attempts.forEach((result) => add(result, key));
      });
    }
    Object.keys(grouped).forEach((key) => {
      grouped[key] = grouped[key].sort((a, b) => (+b.at || 0) - (+a.at || 0)).slice(0, RESULT_HISTORY_LIMIT);
    });
    return grouped;
  }
  state.results = groupResults(state.results);
  let historyMigrated = flatResults;
  // Chuyển kết quả cuối cùng từ phiên bản cũ sang lịch sử để không mất dữ liệu đã có.
  if (state.lastResult && state.lastResult.key) {
    const attempts = state.results[state.lastResult.key] || [];
    const previous = attempts.find((r) => r.id != null && state.lastResult.id != null && String(r.id) === String(state.lastResult.id));
    if (previous) state.lastResult = previous;
    else {
      state.lastResult = { ...state.lastResult, id: String(state.lastResult.id || state.lastResult.at || Date.now()) };
      state.results[state.lastResult.key] = [state.lastResult, ...attempts].slice(0, RESULT_HISTORY_LIMIT);
      historyMigrated = true;
    }
  }
  if (historyMigrated) save();
  // state.wrong[id] = số lần trả lời sai; trả lời đúng thì gỡ khỏi danh sách câu sai.
  function recordAnswer(id, picked) {
    const q = BY_ID.get(id);
    if (picked === q.c) delete state.wrong[id];
    else state.wrong[id] = (+state.wrong[id] || 0) + 1;
  }
  const wrongIds = () => QUESTIONS.filter((q) => state.wrong[q.id]).map((q) => q.id);

  // ---------- Tiện ích ----------
  const $app = document.getElementById('app');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtTime = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const presetKey = (n) => 'p' + n;

  function confirmBox(text, okLabel = 'Đồng ý') {
    const modal = document.getElementById('modal');
    modal.querySelector('.modal-text').textContent = text;
    modal.querySelector('[data-modal="ok"]').textContent = okLabel;
    modal.hidden = false;
    return new Promise((resolve) => {
      modal.onclick = (e) => {
        const act = e.target.dataset.modal || (e.target === modal ? 'cancel' : null);
        if (!act) return;
        modal.hidden = true;
        resolve(act === 'ok');
      };
    });
  }

  // ---------- Hiển thị câu hỏi ----------
  function imagesHtml(q) {
    if (!q.img.length) return '';
    return `<div class="q-images">${q.img.map((src) => `<img src="${esc(src)}" alt="Hình minh họa câu ${q.id}" loading="lazy" data-zoom>`).join('')}</div>`;
  }

  // mode: 'learn' (chọn xong khóa và hiện đáp án) | 'exam' (chọn tự do, không hiện đáp án) | 'review'
  function optionsHtml(q, picked, mode) {
    const reveal = mode === 'review' || (mode === 'learn' && picked != null);
    return `<div class="options">${q.a.map((text, i) => {
      let cls = 'option';
      if (reveal) {
        if (i === q.c) cls += ' correct';
        else if (i === picked) cls += ' wrong';
      } else if (i === picked) cls += ' picked';
      const disabled = mode === 'review' || (mode === 'learn' && picked != null);
      return `<button type="button" class="${cls}" data-pick="${i}" ${disabled ? 'disabled' : ''}><span class="key">${i + 1}</span><span>${esc(text)}</span></button>`;
    }).join('')}</div>`;
  }

  function explainHtml(q, picked) {
    const right = picked === q.c;
    const head = picked == null
      ? `<div class="explain-head bad">Chưa trả lời · Đáp án đúng: ${q.c + 1}</div>`
      : right
        ? `<div class="explain-head ok">✓ Chính xác!</div>`
        : `<div class="explain-head bad">✗ Chưa đúng · Đáp án đúng: ${q.c + 1}${q.crit ? ' · Câu điểm liệt' : ''}</div>`;
    const e = q.exp;
    const parts = [];
    if (e && e.why) parts.push(`<p><span class="ex-label">Giải thích</span>${esc(e.why)}</p>`);
    else parts.push(`<p><span class="ex-label">Đáp án đúng</span>${esc(q.a[q.c])}</p>`);
    if (e && e.steps && e.steps.length) {
      parts.push(`<div><span class="ex-label">Phân tích sa hình</span><ol class="ex-steps">${e.steps.map((s) => `<li><b>${esc(s.t.replace(/^Bước \d+:\s*/, ''))}:</b> ${esc(s.c)}</li>`).join('')}</ol></div>`);
    }
    if (e && e.rule) parts.push(`<p><span class="ex-label">Quy tắc</span>${esc(e.rule)}</p>`);
    if (e && e.tip) parts.push(`<p class="ex-tip"><b>Mẹo nhớ:</b> ${esc(e.tip)}</p>`);
    if (q.law.length) {
      parts.push(`<details class="law"><summary>Căn cứ pháp lý (${q.law.length})</summary>${q.law.map((l) =>
        `<div class="law-item"><b>${esc(l.cite)}</b> — ${esc(l.title)}${l.quote ? `<blockquote>${esc(l.quote)}</blockquote>` : ''}</div>`).join('')}</details>`);
    }
    return `<div class="explain">${head}<div class="explain-body">${parts.join('')}</div></div>`;
  }

  function questionCard(q, { label, picked, mode, showCrit = true, extraBadges = '' }) {
    const showExplain = mode === 'review' || (mode === 'learn' && picked != null);
    return `<article class="card question" data-qid="${q.id}">
      <div class="q-head">
        <span class="q-num">${esc(label)}</span>
        ${mode === 'exam' ? '' : `<span class="badge">Câu ${q.id} · Chương ${q.ch}</span>`}
        ${showCrit && q.crit ? '<span class="badge badge-crit">Điểm liệt</span>' : ''}
        ${extraBadges}
      </div>
      <p class="q-text">${esc(q.q)}</p>
      ${imagesHtml(q)}
      ${optionsHtml(q, picked, mode)}
      ${showExplain ? explainHtml(q, picked) : ''}
    </article>`;
  }

  // ---------- Trang chủ ----------
  function viewHome() {
    const learned = Object.keys(state.learn).length;
    const correct = Object.entries(state.learn).filter(([id, p]) => BY_ID.get(+id) && BY_ID.get(+id).c === p).length;
    const wrongCount = Object.keys(state.wrong).length;
    const passed = PRESETS.filter((_, i) => state.exams[presetKey(i + 1)]?.passed).length;

    const topic = (key, desc) => {
      const ids = SETS[key].ids();
      const done = ids.filter((id) => state.learn[id] != null).length;
      return `<a class="card topic" href="#/learn/${key}">
        <h3>${esc(SETS[key].name)}</h3>
        <span class="muted small">${esc(desc)}</span>
        <div class="progress"><span style="width:${ids.length ? (done / ids.length) * 100 : 0}%"></span></div>
        <div class="meta"><span>${done}/${ids.length} câu đã làm</span><span>Học →</span></div>
      </a>`;
    };

    $app.innerHTML = `
      <section class="card hero">
        <div>
          <h1>Ôn thi lý thuyết lái xe hạng B</h1>
          <p>Bộ 600 câu hỏi của Cục CSGT – Bộ Công an, áp dụng từ 01/06/2025. Chế độ học có giải thích ngay khi chọn đáp án; chế độ thi mô phỏng đề thật ${RULES.total} câu / ${RULES.minutes} phút.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/learn/all">Bắt đầu học</a>
            <a class="btn" href="#/exams">Thi thử ${PRESETS.length} đề</a>
            <a class="btn" href="#/exam/random">Đề ngẫu nhiên</a>
            <a class="btn" href="#/tips">Mẹo ghi nhớ</a>
          </div>
        </div>
        <div class="stats">
          <div class="stat"><b>${learned}/600</b><span>Câu đã học</span></div>
          <div class="stat"><b>${learned ? Math.round((correct / learned) * 100) : 0}%</b><span>Tỉ lệ đúng khi học</span></div>
          <div class="stat"><b>${wrongCount}</b><span>Câu sai cần ôn</span></div>
          <div class="stat"><b>${passed}/${PRESETS.length}</b><span>Đề mẫu đã đạt</span></div>
        </div>
      </section>

      <div class="section-title"><h2>Học theo chủ đề</h2></div>
      <div class="grid">
        ${topic('crit', 'Sai 1 câu là trượt — học kỹ trước tiên')}
        ${topic('ch1', 'Khái niệm, quy tắc, tốc độ, dừng đỗ…')}
        ${topic('ch2', 'Đạo đức người lái, PCCC, sơ cứu')}
        ${topic('ch3', 'Thao tác lái an toàn')}
        ${topic('ch4', 'Kết cấu xe, đèn báo, bảo dưỡng')}
        ${topic('ch5', 'Biển báo, vạch kẻ, đèn tín hiệu')}
        ${topic('ch6', 'Thứ tự xe qua giao lộ, tình huống')}
        <a class="card topic" href="#/review">
          <h3>Ôn lại câu sai</h3>
          <span class="muted small">Làm lại các câu từng sai khi học và thi; đúng thì tự gỡ khỏi danh sách</span>
          <div class="meta"><span>${wrongCount} câu cần ôn</span><span>Ôn →</span></div>
        </a>
        ${topic('marked', 'Các câu bạn đánh dấu để xem lại')}
      </div>

      <div class="section-title"><h2>Quy chế thi lý thuyết hạng B</h2></div>
      <div class="card pad">
        <ul class="rules-list">
          <li><b>${RULES.total} câu</b>, thời gian <b>${RULES.minutes} phút</b>, mỗi câu chỉ có một đáp án đúng.</li>
          <li>Đạt khi trả lời đúng <b>từ ${RULES.pass}/${RULES.total} câu</b> và <b>không sai câu điểm liệt</b>.</li>
          <li>Cấu trúc đề: ${RULES.slots.map((s) => `${s.n} câu ${s.label.toLowerCase()}`).join('; ')}.</li>
        </ul>
        <p class="muted small" style="margin:10px 0 0">Theo hướng dẫn sử dụng bộ 600 câu hỏi kèm Công văn 2262/CSGT-P5 ngày 07/05/2025. Hãy đối chiếu với trung tâm sát hạch nơi bạn thi.</p>
      </div>`;
  }

  // ---------- Mẹo ghi nhớ ----------
  function foldText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function viewTips() {
    const topics = [...new Set(VIDEO_TIPS.map((tip) => tip.topic))];
    const options = ['<option value="all">Tất cả chủ đề</option>'].concat(
      topics.map((topic) => '<option value="' + esc(topic) + '">' + esc(topic) + '</option>')
    ).join('');
    const cards = VIDEO_TIPS.map((tip) => {
      const time = videoTimeLabel(tip.time);
      const searchText = foldText([tip.topic, tip.title, ...(tip.tags || []), ...tip.tips].join(' '));
      return '<article class="card tip-card" data-tip-card data-topic="' + esc(tip.topic) + '" data-search="' + esc(searchText) + '">' +
        '<div class="tip-card-head"><span class="badge">' + esc(time) + '</span><span class="badge">' + esc(tip.topic) + '</span></div>' +
        '<h2 class="tip-title">' + esc(tip.title) + '</h2>' +
        '<ul class="tip-points">' + tip.tips.map((point) => '<li>' + esc(point) + '</li>').join('') + '</ul>' +
        '<a class="tip-link" href="https://www.youtube.com/watch?v=eIgT4kjyw2Q&amp;t=' + tip.time + 's" target="_blank" rel="noopener">Xem đoạn ' + esc(time) + ' →</a>' +
        '</article>';
    }).join('');

    $app.innerHTML =
      '<section class="card tip-intro">' +
        '<div><h1>Mẹo trong toàn bộ video</h1><p class="muted">Ghi chú theo các mốc từ đầu đến cuối clip; tìm theo từ khóa hoặc lọc chủ đề, rồi mở đúng đoạn để xem lại.</p></div>' +
        '<a class="btn btn-primary" href="https://www.youtube.com/watch?v=eIgT4kjyw2Q" target="_blank" rel="noopener">▶ Mở toàn bộ video · 3:13:56</a>' +
      '</section>' +
      '<div class="tip-controls">' +
        '<label class="tip-search-label">Tìm trong ghi chú<input type="search" data-tip-search placeholder="Ví dụ: vòng xuyến, biển phụ, sa hình…" autocomplete="off"></label>' +
        '<label class="tip-topic-label">Lọc theo chủ đề<select data-tip-topic>' + options + '</select></label>' +
        '<span class="muted small" data-tip-count>' + VIDEO_TIPS.length + '/' + VIDEO_TIPS.length + ' chủ đề</span>' +
      '</div><p class="tip-source muted small">Ghi chú tóm tắt từ phụ đề tự động của video. Một số mẹo là cách ghi nhớ trong clip, không thay đáp án ngân hàng câu hỏi hoặc quy định hiện hành; hãy đọc kỹ câu và đối chiếu khi ôn.</p>' +
      '<div class="tip-list">' + cards + '</div>' +
      '<div class="card empty tip-empty" data-tip-empty hidden>Không tìm thấy mẹo phù hợp.</div>';
    ctx = { view: 'tips' };
  }

  function videoTimeLabel(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ---------- Chế độ học ----------
  function viewLearn(setKey, qid) {
    if (!SETS[setKey]) setKey = 'all';
    const ids = SETS[setKey].ids();
    if (!ids.length) {
      $app.innerHTML = learnShell(setKey, ids, null,
        '<div class="card empty">Chưa có câu nào được đánh dấu. Bấm ☆ khi học để đánh dấu.</div>');
      return;
    }
    if (!ids.includes(qid)) qid = ids.find((id) => state.learn[id] == null) ?? ids[0];
    const q = BY_ID.get(qid);
    const idx = ids.indexOf(qid);
    const picked = state.learn[qid];
    const main = `
      ${questionCard(q, { label: `Câu ${idx + 1}/${ids.length}`, picked, mode: 'learn' })}
      <div class="q-nav">
        <button class="btn" data-go="${ids[idx - 1] ?? ''}" ${idx === 0 ? 'disabled' : ''}>← Câu trước</button>
        <button class="btn" data-act="mark">${state.marks[qid] ? '★ Bỏ đánh dấu' : '☆ Đánh dấu'}</button>
        ${picked != null ? '<button class="btn" data-act="retry">↺ Làm lại câu này</button>' : ''}
        <span class="spacer"></span>
        <button class="btn btn-primary" data-go="${ids[idx + 1] ?? ''}" ${idx === ids.length - 1 ? 'disabled' : ''}>Câu sau →</button>
      </div>
      <p class="kbd-hint">Phím tắt: 1–4 chọn đáp án · ← → chuyển câu</p>`;
    $app.innerHTML = learnShell(setKey, ids, qid, main);
    ctx = { view: 'learn', setKey, ids, qid };
  }

  function learnShell(setKey, ids, qid, main) {
    const done = ids.filter((id) => state.learn[id] != null);
    const right = done.filter((id) => state.learn[id] === BY_ID.get(id).c).length;
    const opts = Object.entries(SETS).map(([k, s]) => `<option value="${k}" ${k === setKey ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
    const cells = ids.map((id) => {
      const p = state.learn[id];
      let cls = 'qcell';
      if (p != null) cls += p === BY_ID.get(id).c ? ' ok' : ' bad';
      if (id === qid) cls += ' cur';
      if (BY_ID.get(id).crit) cls += ' crit';
      if (state.marks[id]) cls += ' marked';
      return `<button type="button" class="${cls}" data-go="${id}" title="Câu ${id}">${id}</button>`;
    }).join('');
    return `<div class="layout">
      <aside class="card sidebar">
        <select data-set aria-label="Chọn bộ câu hỏi">${opts}</select>
        <div>
          <div class="row small"><span>${done.length}/${ids.length} đã làm</span><span class="spacer"></span><span class="badge badge-ok">${right} đúng</span><span class="badge badge-bad">${done.length - right} sai</span></div>
          <div class="progress" style="margin-top:6px"><span style="width:${ids.length ? (done.length / ids.length) * 100 : 0}%"></span></div>
        </div>
        <form class="row" data-jump><input type="number" min="1" max="600" placeholder="Đến câu số…" aria-label="Đến câu số"></form>
        <div class="qgrid">${cells}</div>
        <div class="legend"><span><i style="background:var(--ok-soft)"></i>Đúng</span><span><i style="background:var(--bad-soft)"></i>Sai</span><span><i style="background:var(--bad);border-radius:50%"></i>Điểm liệt</span><span><i style="background:var(--warn);height:3px"></i>Đánh dấu</span></div>
        ${done.length ? '<button type="button" class="btn btn-sm" data-act="reset-set">Xóa tiến độ bộ này</button>' : ''}
      </aside>
      <section>${main}</section>
    </div>`;
  }

  // ---------- Danh sách đề ----------
  function viewExams() {
    const attemptHistory = (key) => {
      const attempts = state.results[key] || [];
      if (!attempts.length) return '';
      return `<div class="exam-attempts">
        <span class="muted small">Lịch sử ${attempts.length} lần thi</span>
        <div class="attempt-links">${attempts.map((result) => {
          const when = Number.isFinite(+result.at)
            ? new Date(+result.at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'Đã lưu';
          return `<a class="attempt-link" href="#/result/${encodeURIComponent(result.id)}" title="Xem lại câu trả lời lần thi này">
            <b>${result.attempt ? `Lần ${result.attempt}` : 'Lần thi'} · ${result.score}/${RULES.total}</b><small>${esc(when)}</small>
          </a>`;
        }).join('')}</div>
      </div>`;
    };
    const cards = PRESETS.map((ids, i) => {
      const key = presetKey(i + 1);
      const r = state.exams[key];
      const status = !r ? '<span class="badge">Chưa thi</span>'
        : r.passed ? `<span class="badge badge-ok">Đạt · ${r.best}/${RULES.total}</span>`
          : `<span class="badge badge-bad">Chưa đạt · ${r.best}/${RULES.total}</span>`;
      return `<div class="card exam-card">
        <a class="exam-card-main" href="#/exam/${i + 1}">
          <div class="row"><h3>Đề số ${i + 1}</h3>${status}</div>
          <span class="muted small">${RULES.total} câu · ${RULES.minutes} phút${r ? ` · đã thi ${r.attempts} lần` : ''}</span>
        </a>
        ${attemptHistory(key)}
      </div>`;
    }).join('');
    const active = state.active;
    $app.innerHTML = `
      <h1>Thi thử</h1>
      <p class="muted">Mỗi đề gồm ${RULES.total} câu, ${RULES.minutes} phút, đúng từ ${RULES.pass} câu và không sai câu điểm liệt thì đạt. Có giải thích chi tiết khi xem kết quả.</p>
      ${active ? `<div class="card pad row" style="margin-bottom:14px;border-color:var(--warn)"><span>Bạn đang làm dở <b>${esc(examTitle(active.key))}</b>.</span><span class="spacer"></span><a class="btn btn-primary" href="#/exam/${active.key === 'random' ? 'random' : active.key.slice(1)}">Làm tiếp</a></div>` : ''}
      <div class="section-title"><h2>Danh sách đề</h2></div>
      <div class="grid">
        <div class="card exam-card random-card">
          <a class="exam-card-main" href="#/exam/random">
            <div class="row"><h3>🎲 Đề ngẫu nhiên</h3><span class="badge">Trộn mới</span></div>
            <span class="muted small">Trộn ngẫu nhiên từ 600 câu theo đúng cấu trúc đề thi thật</span>
          </a>
          ${attemptHistory('random')}
        </div>
        ${cards}
      </div>`;
    ctx = { view: 'exams' };
  }

  // ---------- Làm bài thi ----------
  function examTitle(key) { return key === 'random' ? 'Đề ngẫu nhiên' : `Đề số ${key.slice(1)}`; }

  async function startExam(param) {
    const key = param === 'random' ? 'random' : presetKey(+param);
    if (key !== 'random' && !PRESETS[+param - 1]) return go('#/exams');
    if (state.active && state.active.key !== key) {
      const ok = await confirmBox(`Bạn đang làm dở ${examTitle(state.active.key)}. Bỏ bài đó để bắt đầu ${examTitle(key)}?`, 'Bỏ và thi đề mới');
      if (!ok) return go('#/exams');
      state.active = null;
    }
    if (!state.active) {
      const ids = key === 'random' ? window.Exams.randomExam(QUESTIONS) : PRESETS[+param - 1];
      state.active = { key, ids, answers: {}, cur: 0, deadline: Date.now() + RULES.minutes * 60000, startedAt: Date.now() };
      save();
    }
    viewExam();
  }

  function viewExam() {
    const ex = state.active;
    const q = BY_ID.get(ex.ids[ex.cur]);
    const answered = Object.keys(ex.answers).length;
    const cells = ex.ids.map((id, i) => {
      let cls = 'qcell';
      if (ex.answers[id] != null) cls += ' answered';
      if (i === ex.cur) cls += ' cur';
      return `<button type="button" class="${cls}" data-idx="${i}">${i + 1}</button>`;
    }).join('');
    $app.innerHTML = `
      <div class="card exam-bar">
        <b>${esc(examTitle(ex.key))}</b>
        <span class="muted small" data-answered>Đã làm ${answered}/${ex.ids.length}</span>
        <span class="spacer"></span>
        <span class="timer" data-timer>--:--</span>
        <button class="btn btn-primary" data-act="submit">Nộp bài</button>
      </div>
      <div class="layout">
        <aside class="card sidebar">
          <div class="qgrid">${cells}</div>
          <div class="legend"><span><i style="background:var(--primary-soft)"></i>Đã trả lời</span><span><i style="border:1px solid var(--border)"></i>Chưa trả lời</span></div>
          <button class="btn btn-sm" data-act="quit">Hủy bài thi</button>
        </aside>
        <section>
          ${questionCard(q, { label: `Câu ${ex.cur + 1}/${ex.ids.length}`, picked: ex.answers[q.id], mode: 'exam', showCrit: false })}
          <div class="q-nav">
            <button class="btn" data-idx="${ex.cur - 1}" ${ex.cur === 0 ? 'disabled' : ''}>← Câu trước</button>
            <span class="spacer"></span>
            <button class="btn btn-primary" data-idx="${ex.cur + 1}" ${ex.cur === ex.ids.length - 1 ? 'disabled' : ''}>Câu sau →</button>
          </div>
          <p class="kbd-hint">Phím tắt: 1–4 chọn đáp án · ← → chuyển câu. Có thể đổi đáp án trước khi nộp.</p>
        </section>
      </div>`;
    ctx = { view: 'exam' };
    tick();
  }

  let timerId = null;
  function tick() {
    clearInterval(timerId);
    const update = () => {
      const ex = state.active;
      const el = document.querySelector('[data-timer]');
      if (!ex || !el) return clearInterval(timerId);
      const left = Math.max(0, Math.round((ex.deadline - Date.now()) / 1000));
      el.textContent = fmtTime(left);
      el.classList.toggle('low', left <= 120);
      if (left === 0) { clearInterval(timerId); submitExam(true); }
    };
    update();
    timerId = setInterval(update, 1000);
  }

  function submitExam(timeout) {
    const ex = state.active;
    if (!ex) return;
    const items = ex.ids.map((id) => {
      const q = BY_ID.get(id);
      const p = ex.answers[id];
      return { id, picked: p ?? null, ok: p === q.c, crit: q.crit };
    });
    const score = items.filter((i) => i.ok).length;
    const critFail = items.some((i) => i.crit && !i.ok);
    const passed = score >= RULES.pass && !critFail;
    const used = Math.min(RULES.minutes * 60, Math.round((Date.now() - ex.startedAt) / 1000));
    items.forEach((i) => { if (i.picked != null) recordAnswer(i.id, i.picked); });

    const r = state.exams[ex.key] || { attempts: 0, best: 0, passed: false };
    r.attempts++; r.best = Math.max(r.best, score); r.passed = r.passed || passed;
    state.exams[ex.key] = r;
    const at = Date.now();
    let id = String(at);
    while (Object.values(state.results).some((attempts) => attempts.some((item) => String(item.id) === id))) id = String(+id + 1);
    const result = { id, key: ex.key, attempt: r.attempts, items, score, critFail, passed, used, timeout: !!timeout, at };
    state.results[ex.key] = [result, ...(state.results[ex.key] || [])].slice(0, RESULT_HISTORY_LIMIT);
    state.lastResult = result;
    state.active = null;
    save();
    go('#/result');
  }

  // ---------- Kết quả ----------
  function viewResult(attemptId, filter = 'all') {
    const r = attemptId
      ? Object.values(state.results).flat().find((item) => String(item.id) === String(attemptId))
      : state.lastResult;
    if (!r) return go('#/exams');
    const pct = Math.round((r.score / RULES.total) * 100);
    const wrong = r.items.filter((i) => i.picked != null && !i.ok).length;
    const blank = r.items.filter((i) => i.picked == null).length;
    const list = r.items.map((it, n) => ({ ...it, n })).filter((it) =>
      filter === 'wrong' ? it.picked != null && !it.ok : filter === 'blank' ? it.picked == null : filter === 'crit' ? it.crit : true);
    const tab = (k, label) => `<button type="button" class="tab ${filter === k ? 'active' : ''}" data-filter="${k}">${label}</button>`;
    const again = r.key === 'random' ? 'random' : r.key.slice(1);

    $app.innerHTML = `
      <section class="card result-hero">
        <div class="score-ring" style="--p:${pct};--ring:${r.passed ? 'var(--ok)' : 'var(--bad)'}"><div><span><b>${r.score}</b><br><span class="small muted">/${RULES.total}</span></span></div></div>
        <div style="flex:1;min-width:220px">
          <div class="verdict ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</div>
          <div class="muted">${esc(examTitle(r.key))}${r.timeout ? ' · Hết giờ, hệ thống tự nộp bài' : ''}</div>
          <div class="checks" style="margin-top:10px">
            <div>${r.score >= RULES.pass ? '✅' : '❌'} Đúng ${r.score}/${RULES.total} câu (yêu cầu ≥ ${RULES.pass})</div>
            <div>${r.critFail ? '❌ Sai câu điểm liệt' : '✅ Không sai câu điểm liệt'}</div>
            <div>⏱ Thời gian làm bài: ${fmtTime(r.used)} / ${fmtTime(RULES.minutes * 60)}</div>
          </div>
        </div>
        <div class="row">
          <a class="btn btn-primary" href="#/exam/${again}">${r.key === 'random' ? 'Thi đề ngẫu nhiên khác' : 'Thi lại đề này'}</a>
          ${wrong + blank ? `<button class="btn" data-act="review-exam">Ôn lại ${wrong + blank} câu sai/chưa làm</button>` : ''}
          <a class="btn" href="#/exams">Danh sách đề</a>
        </div>
      </section>
      <div class="tabs">
        ${tab('all', `Tất cả (${r.items.length})`)}
        ${tab('wrong', `Sai (${wrong})`)}
        ${tab('blank', `Chưa làm (${blank})`)}
        ${tab('crit', 'Câu điểm liệt')}
      </div>
      <div class="review">
        ${list.length ? list.map((it) => questionCard(BY_ID.get(it.id), {
          label: `Câu ${it.n + 1}`, picked: it.picked, mode: 'review',
          extraBadges: it.ok ? '<span class="badge badge-ok">Đúng</span>' : it.picked == null ? '<span class="badge badge-warn">Chưa làm</span>' : '<span class="badge badge-bad">Sai</span>',
        })).join('') : '<div class="card empty">Không có câu nào.</div>'}
      </div>`;
    ctx = { view: 'result', filter, resultId: r.id == null ? null : String(r.id), key: r.key, missed: r.items.filter((i) => !i.ok).map((i) => i.id) };
  }

  // ---------- Ôn lại câu sai ----------
  // Mỗi lượt ôn chốt sẵn danh sách câu, nên câu vừa trả lời đúng (và bị gỡ khỏi danh sách sai) không làm nhảy thứ tự.
  function startReview(ids, label, mix) {
    if (!ids.length) return;
    const list = mix ? ids.slice().sort(() => Math.random() - 0.5) : ids.slice();
    state.review = { ids: list, answers: {}, cur: 0, done: false, label };
    save();
    go('#/review');
  }

  function viewReviewStart() {
    const ids = wrongIds();
    if (!ids.length) {
      $app.innerHTML = `<h1>Ôn lại câu sai</h1>
        <div class="card empty">Không còn câu nào làm sai. Tuyệt vời!<br><br>
          <a class="btn btn-primary" href="#/learn/all">Học tiếp</a> <a class="btn" href="#/exams">Thi thử</a></div>`;
      ctx = { view: 'review-start' };
      return;
    }
    const groups = [['crit', 'Câu điểm liệt', ids.filter((id) => BY_ID.get(id).crit)]];
    for (const ch of Object.keys(CHAPTERS)) groups.push(['ch' + ch, `Chương ${ch}: ${CHAPTERS[ch]}`, ids.filter((id) => BY_ID.get(id).ch === +ch)]);
    const most = ids.slice().sort((a, b) => state.wrong[b] - state.wrong[a]).filter((id) => state.wrong[id] > 1);
    $app.innerHTML = `
      <h1>Ôn lại câu sai</h1>
      <p class="muted">Các câu bạn từng trả lời sai khi học hoặc thi. Câu sẽ hiện như chưa làm; trả lời đúng thì câu được gỡ khỏi danh sách, sai thì giữ lại để ôn tiếp.</p>
      <section class="card pad review-start">
        <div class="row"><b style="font-size:1.4rem">${ids.length}</b><span class="muted">câu cần ôn</span><span class="spacer"></span>
          <label class="row small"><input type="checkbox" data-mix checked> Trộn thứ tự</label></div>
        <div class="row">
          <button class="btn btn-primary" data-review="all">Ôn tất cả ${ids.length} câu</button>
          ${most.length ? `<button class="btn" data-review="most">Câu sai từ 2 lần trở lên (${most.length})</button>` : ''}
        </div>
        <div class="chips">${groups.filter((g) => g[2].length).map(([k, name, list]) =>
          `<button class="btn btn-sm${k === 'crit' ? ' chip-crit' : ''}" data-review="${k}">${esc(name)} <span class="badge">${list.length}</span></button>`).join('')}</div>
        <div class="row"><span class="spacer"></span><button class="btn btn-sm" data-act="clear-wrong">Xóa danh sách câu sai</button></div>
      </section>`;
    ctx = { view: 'review-start', groups: Object.fromEntries(groups.map((g) => [g[0], g[2]])), all: ids, most };
  }

  function viewReview() {
    const s = state.review;
    if (!s) return viewReviewStart();
    if (s.done) return viewReviewSummary();
    const q = BY_ID.get(s.ids[s.cur]);
    const picked = s.answers[q.id];
    const answered = Object.keys(s.answers).length;
    const right = s.ids.filter((id) => s.answers[id] === BY_ID.get(id).c).length;
    const cells = s.ids.map((id, i) => {
      const p = s.answers[id];
      let cls = 'qcell';
      if (p != null) cls += p === BY_ID.get(id).c ? ' ok' : ' bad';
      if (i === s.cur) cls += ' cur';
      if (BY_ID.get(id).crit) cls += ' crit';
      return `<button type="button" class="${cls}" data-idx="${i}" title="Câu ${id}">${i + 1}</button>`;
    }).join('');
    const times = state.wrong[q.id];
    const badge = picked == null
      ? (times ? `<span class="badge badge-warn">Đã sai ${times} lần</span>` : '')
      : picked === q.c ? '<span class="badge badge-ok">Đã gỡ khỏi danh sách sai</span>' : `<span class="badge badge-bad">Vẫn sai · ${times} lần</span>`;
    const last = s.cur === s.ids.length - 1;
    $app.innerHTML = `
      <div class="card exam-bar">
        <b>${esc(s.label)}</b>
        <span class="muted small">Đã ôn ${answered}/${s.ids.length}</span>
        <span class="badge badge-ok">${right} đúng</span><span class="badge badge-bad">${answered - right} sai</span>
        <span class="spacer"></span>
        <button class="btn btn-primary" data-act="review-finish">Kết thúc</button>
      </div>
      <div class="layout">
        <aside class="card sidebar">
          <div class="progress"><span style="width:${(answered / s.ids.length) * 100}%"></span></div>
          <div class="qgrid">${cells}</div>
          <div class="legend"><span><i style="background:var(--ok-soft)"></i>Đã đúng</span><span><i style="background:var(--bad-soft)"></i>Vẫn sai</span><span><i style="background:var(--bad);border-radius:50%"></i>Điểm liệt</span></div>
        </aside>
        <section>
          ${questionCard(q, { label: `Câu ${s.cur + 1}/${s.ids.length}`, picked, mode: 'learn', extraBadges: badge })}
          <div class="q-nav">
            <button class="btn" data-idx="${s.cur - 1}" ${s.cur === 0 ? 'disabled' : ''}>← Câu trước</button>
            <span class="spacer"></span>
            ${last && answered === s.ids.length
              ? '<button class="btn btn-primary" data-act="review-finish">Xem kết quả</button>'
              : `<button class="btn btn-primary" data-idx="${s.cur + 1}" ${last ? 'disabled' : ''}>Câu sau →</button>`}
          </div>
          <p class="kbd-hint">Phím tắt: 1–4 chọn đáp án · ← → chuyển câu</p>
        </section>
      </div>`;
    ctx = { view: 'review' };
  }

  function viewReviewSummary() {
    const s = state.review;
    const right = s.ids.filter((id) => s.answers[id] === BY_ID.get(id).c);
    const still = s.ids.filter((id) => s.answers[id] != null && s.answers[id] !== BY_ID.get(id).c);
    const skipped = s.ids.filter((id) => s.answers[id] == null);
    const again = [...still, ...skipped];
    $app.innerHTML = `
      <section class="card result-hero">
        <div class="score-ring" style="--p:${Math.round((right.length / s.ids.length) * 100)};--ring:var(--ok)"><div><span><b>${right.length}</b><br><span class="small muted">/${s.ids.length}</span></span></div></div>
        <div style="flex:1;min-width:220px">
          <div class="verdict ${still.length ? 'fail' : 'pass'}">${still.length ? 'Cần ôn thêm' : 'Hoàn thành!'}</div>
          <div class="muted">${esc(s.label)}</div>
          <div class="checks" style="margin-top:10px">
            <div>✅ ${right.length} câu trả lời đúng, đã gỡ khỏi danh sách câu sai</div>
            <div>❌ ${still.length} câu vẫn sai</div>
            ${skipped.length ? `<div>⏭ ${skipped.length} câu chưa làm</div>` : ''}
            <div>📋 Còn ${wrongIds().length} câu trong danh sách câu sai</div>
          </div>
        </div>
        <div class="row">
          ${again.length ? `<button class="btn btn-primary" data-act="review-again">Ôn lại ${again.length} câu ${skipped.length ? 'chưa thuộc' : 'còn sai'}</button>` : ''}
          <button class="btn" data-act="review-close">Danh sách câu sai</button>
        </div>
      </section>
      ${still.length ? `<div class="section-title"><h2>Các câu vẫn sai</h2></div>
        <div class="review">${still.map((id) => questionCard(BY_ID.get(id), { label: `Câu ${s.ids.indexOf(id) + 1}`, picked: s.answers[id], mode: 'review' })).join('')}</div>` : ''}`;
    ctx = { view: 'review-summary', again };
  }

  // ---------- Điều hướng ----------
  let ctx = {};
  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  function route() {
    clearInterval(timerId);
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const [page, a, b] = parts;
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === (page === 'exam' || page === 'result' ? 'exams' : page || 'home'));
    });
    updateWrongBadge();
    if (page === 'learn') viewLearn(a || 'all', b ? +b : null);
    else if (page === 'tips') viewTips();
    else if (page === 'review') viewReview();
    else if (page === 'exams') viewExams();
    else if (page === 'exam') startExam(a);
    else if (page === 'result') viewResult(a);
    else viewHome();
    window.scrollTo(0, 0);
  }

  function updateWrongBadge() {
    const el = document.querySelector('[data-wrong-count]');
    const n = wrongIds().length;
    el.textContent = n;
    el.hidden = !n;
  }

  // ---------- Sự kiện ----------
  function currentQuestion() {
    if (ctx.view === 'learn') return BY_ID.get(ctx.qid);
    if (ctx.view === 'exam') return BY_ID.get(state.active.ids[state.active.cur]);
    if (ctx.view === 'review') return BY_ID.get(state.review.ids[state.review.cur]);
    return null;
  }

  function pickAnswer(i) {
    if (ctx.view === 'review') {
      const s = state.review;
      const id = s.ids[s.cur];
      if (s.answers[id] != null) return;
      s.answers[id] = i;
      state.learn[id] = i;
      recordAnswer(id, i);
      save();
      updateWrongBadge();
      const y = window.scrollY;
      viewReview();
      window.scrollTo(0, y);
      return;
    }
    if (ctx.view === 'learn') {
      if (state.learn[ctx.qid] != null) return;
      state.learn[ctx.qid] = i;
      recordAnswer(ctx.qid, i);
      save();
      updateWrongBadge();
      const y = window.scrollY;
      viewLearn(ctx.setKey, ctx.qid);
      window.scrollTo(0, y);
    } else if (ctx.view === 'exam') {
      const ex = state.active;
      ex.answers[ex.ids[ex.cur]] = i;
      save();
      const y = window.scrollY;
      viewExam();
      window.scrollTo(0, y);
    }
  }

  // Chuyển câu trong bài thi hoặc lượt ôn câu sai.
  function moveTo(idx) {
    const s = ctx.view === 'review' ? state.review : ctx.view === 'exam' ? state.active : null;
    if (!s || idx < 0 || idx >= s.ids.length) return;
    s.cur = idx;
    save();
    if (ctx.view === 'review') viewReview(); else viewExam();
    window.scrollTo(0, 0);
  }

  $app.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-pick],[data-go],[data-idx],[data-act],[data-filter],[data-zoom],[data-review]');
    if (!t || t.disabled) return;
    if (t.dataset.zoom !== undefined) {
      const lb = document.getElementById('lightbox');
      lb.querySelector('img').src = t.src;
      lb.hidden = false;
    } else if (t.dataset.pick !== undefined) pickAnswer(+t.dataset.pick);
    else if (t.dataset.go !== undefined && t.dataset.go !== '') go(`#/learn/${ctx.setKey}/${t.dataset.go}`);
    else if (t.dataset.idx !== undefined) moveTo(+t.dataset.idx);
    else if (t.dataset.filter) viewResult(ctx.resultId, t.dataset.filter);
    else if (t.dataset.review) {
      const k = t.dataset.review;
      const ids = k === 'all' ? ctx.all : k === 'most' ? ctx.most : ctx.groups[k];
      const label = k === 'all' ? 'Ôn tất cả câu sai' : k === 'most' ? 'Câu sai nhiều lần' : k === 'crit' ? 'Ôn câu điểm liệt đã sai' : `Ôn câu sai chương ${k.slice(2)}`;
      startReview(ids, label, $app.querySelector('[data-mix]').checked);
    } else if (t.dataset.act === 'review-exam') {
      startReview(ctx.missed, `Câu sai/chưa làm trong ${examTitle(ctx.key)}`, false);
    } else if (t.dataset.act === 'review-again') {
      startReview(ctx.again, 'Ôn lại câu còn sai', true);
    } else if (t.dataset.act === 'review-close') {
      state.review = null; save(); viewReviewStart();
    } else if (t.dataset.act === 'review-finish') {
      const s = state.review;
      const left = s.ids.length - Object.keys(s.answers).length;
      if (!left || await confirmBox(`Còn ${left} câu chưa ôn. Kết thúc lượt ôn này?`, 'Kết thúc')) {
        s.done = true; save(); viewReviewSummary(); window.scrollTo(0, 0);
      }
    } else if (t.dataset.act === 'clear-wrong') {
      if (await confirmBox('Xóa toàn bộ danh sách câu sai? Tiến độ học vẫn được giữ.', 'Xóa')) {
        state.wrong = {}; save(); updateWrongBadge(); viewReviewStart();
      }
    }
    else if (t.dataset.act === 'mark') {
      if (state.marks[ctx.qid]) delete state.marks[ctx.qid]; else state.marks[ctx.qid] = true;
      save(); viewLearn(ctx.setKey, ctx.qid);
    } else if (t.dataset.act === 'retry') {
      delete state.learn[ctx.qid]; save(); viewLearn(ctx.setKey, ctx.qid);
    } else if (t.dataset.act === 'reset-set') {
      if (await confirmBox(`Xóa toàn bộ câu trả lời đã học trong "${SETS[ctx.setKey].name}"?`, 'Xóa')) {
        ctx.ids.forEach((id) => delete state.learn[id]);
        save(); viewLearn(ctx.setKey, null);
      }
    } else if (t.dataset.act === 'submit') {
      const ex = state.active;
      const left = ex.ids.length - Object.keys(ex.answers).length;
      if (await confirmBox(left ? `Bạn còn ${left} câu chưa trả lời. Vẫn nộp bài?` : 'Nộp bài và xem kết quả?', 'Nộp bài')) submitExam(false);
    } else if (t.dataset.act === 'quit') {
      if (await confirmBox('Hủy bài thi đang làm? Kết quả sẽ không được lưu.', 'Hủy bài')) {
        state.active = null; save(); go('#/exams');
      }
    }
  });

  $app.addEventListener('change', (e) => {
    if (e.target.matches('[data-set]')) go(`#/learn/${e.target.value}`);
  });
  $app.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-jump]')) return;
    e.preventDefault();
    const n = +e.target.querySelector('input').value;
    if (!BY_ID.has(n)) return;
    const setKey = SETS[ctx.setKey].ids().includes(n) ? ctx.setKey : 'all';
    go(`#/learn/${setKey}/${n}`);
  });

  $app.addEventListener('change', (e) => {
    if (e.target.matches('[data-tip-topic]')) filterTips();
  });
  $app.addEventListener('input', (e) => {
    if (e.target.matches('[data-tip-search]')) filterTips();
  });

  function filterTips() {
    const search = foldText($app.querySelector('[data-tip-search]')?.value || '');
    const topic = $app.querySelector('[data-tip-topic]')?.value || 'all';
    const cards = [...$app.querySelectorAll('[data-tip-card]')];
    let visible = 0;
    cards.forEach((card) => {
      const show = (topic === 'all' || card.dataset.topic === topic) && card.dataset.search.includes(search);
      card.hidden = !show;
      if (show) visible++;
    });
    const count = $app.querySelector('[data-tip-count]');
    if (count) count.textContent = visible + '/' + cards.length + ' chủ đề';
    const empty = $app.querySelector('[data-tip-empty]');
    if (empty) empty.hidden = visible > 0;
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!document.getElementById('modal').hidden) return;
    const lb = document.getElementById('lightbox');
    if (!lb.hidden) { if (e.key === 'Escape') lb.hidden = true; return; }
    const k = KEYS.indexOf(e.key);
    if (k >= 0) {
      const q = currentQuestion();
      if (q && k < q.a.length) pickAnswer(k);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const d = e.key === 'ArrowRight' ? 1 : -1;
      if (ctx.view === 'learn') {
        const next = ctx.ids[ctx.ids.indexOf(ctx.qid) + d];
        if (next) go(`#/learn/${ctx.setKey}/${next}`);
      } else if (ctx.view === 'exam') moveTo(state.active.cur + d);
      else if (ctx.view === 'review') moveTo(state.review.cur + d);
    }
  });

  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.tagName !== 'IMG') e.currentTarget.hidden = true;
  });

  // ---------- Giao diện sáng/tối ----------
  function applyTheme() {
    if (state.theme) document.documentElement.dataset.theme = state.theme;
    else delete document.documentElement.dataset.theme;
  }
  document.getElementById('themeToggle').addEventListener('click', () => {
    const dark = state.theme ? state.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    state.theme = dark ? 'light' : 'dark';
    save(); applyTheme();
  });
  applyTheme();

  window.addEventListener('hashchange', route);
  route();
})();
