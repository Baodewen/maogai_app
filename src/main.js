import bank from './data/bank.json';
import './styles/main.css';
import { AUTH_CONFIG, clearSession, getSession, setSession, verifyPassword, verifyUsername } from './core/auth.js';
import { clearState, loadState, normalizeState, saveState } from './core/storage.js';
import { arrEq, downloadBlob, escapeHtml, shuffleArray, unique } from './core/utils.js';

const app = document.getElementById('app');
const QUESTIONS = bank.questions;
const TYPE_NAME = { single: '单选题', multi: '多选题', short: '简答题' };
const MODES = [
  ['normal', '顺序刷题'],
  ['random', '随机刷题'],
  ['initialWrong', '原始错题'],
  ['papers', '历年试卷'],
  ['wrong', '我的错题本'],
  ['favorite', '收藏夹'],
  ['hard', '重点题'],
  ['recite', '背诵模式'],
  ['exam', '考试模拟']
];

let session = getSession();
let state = session ? loadState(session.username) : normalizeState();
let mode = 'normal';
let quizList = [];
let current = 0;
let selected = new Set();
let examAnswers = {};
let examSubmitted = false;
let activeChapters = new Set(bank.stats.chapters.map((chapter) => chapter.code));

function boot() {
  if (session?.username === AUTH_CONFIG.username) {
    renderShell();
    return;
  }
  renderLogin();
}

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="login-screen">
      <section class="login-panel">
        <div class="brand-mark">毛</div>
        <h1>毛概刷题系统</h1>
        <p class="subtitle">马克思主义中国化时代化题库 · 本地学习记录 · 安卓适配</p>
        <form id="loginForm" class="login-form">
          <label>账号<input id="loginUser" autocomplete="username" value="admin" /></label>
          <label>密码<input id="loginPassword" type="password" autocomplete="current-password" /></label>
          ${message ? `<div class="form-error">${escapeHtml(message)}</div>` : ''}
          <button class="btn primary wide" type="submit">登录</button>
        </form>
      </section>
    </main>`;

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (verifyUsername(username) && await verifyPassword(password)) {
      session = { username, displayName: AUTH_CONFIG.displayName, loginAt: new Date().toISOString() };
      setSession(session);
      state = loadState(session.username);
      renderShell();
      return;
    }
    renderLogin('账号或密码不正确。');
  });
}

function renderShell() {
  app.innerHTML = `
    <div class="app">
      <header class="hero">
        <div>
          <h1>${escapeHtml(bank.title)}</h1>
          <p>${escapeHtml(session.displayName)} · 版本 ${escapeHtml(bank.version)} · 生成于 ${escapeHtml(bank.generatedAt)}</p>
          <div class="pills" id="topPills"></div>
        </div>
        <div class="hero-actions">
          <button class="btn" id="exportBtn">导出进度</button>
          <button class="btn" id="importBtn">导入进度</button>
          <button class="btn bad" id="resetBtn">清空记录</button>
          <button class="btn ghost" id="logoutBtn">退出登录</button>
        </div>
      </header>

      <section class="toolbar card">
        <input id="searchInput" type="search" placeholder="搜索题干 / 选项 / 解析 / 标签" />
        <select id="typeFilter">
          <option value="all">全部题型</option>
          <option value="single">单选题</option>
          <option value="multi">多选题</option>
          <option value="short">简答题</option>
        </select>
        <select id="tagFilter"><option value="all">全部标签</option></select>
        <button class="btn primary" id="applyBtn">应用筛选</button>
      </section>

      <section class="modebar card">
        ${MODES.map(([value, label]) => `<button class="btn ${value === mode ? 'active' : ''}" data-mode="${value}">${label}</button>`).join('')}
      </section>

      <section class="exam-panel card" id="examPanel">
        <div class="exam-grid">
          <label>单选数量<input id="examSingle" type="number" min="0" value="10" /></label>
          <label>多选数量<input id="examMulti" type="number" min="0" value="5" /></label>
          <label>简答数量<input id="examShort" type="number" min="0" value="0" /></label>
          <button class="btn primary" id="startExamBtn">重新组卷</button>
        </div>
      </section>

      <main class="layout">
        <aside class="sidebar card">
          <div class="side-title">章节范围 <button class="btn small" id="toggleChapters">全选/反选</button></div>
          <div class="chapter-list" id="chapterList"></div>
          <div class="side-title q-title">当前题单 <span id="sessionCount" class="badge">0</span></div>
          <div class="q-list" id="questionList"></div>
        </aside>

        <section class="main">
          <section class="stats-grid" id="statsGrid"></section>
          <section class="quiz card" id="quizCard">
            <div class="progress"><div id="progressBar"></div></div>
            <div class="meta" id="meta"></div>
            <div class="question" id="questionText"></div>
            <div class="options" id="options"></div>
            <div class="short-area" id="shortArea">
              <textarea id="shortInput" placeholder="这里手写/默写你的答案，显示参考答案后自行对照。"></textarea>
            </div>
            <div class="actions">
              <div class="action-group">
                <button class="btn" id="prevBtn">上一题</button>
                <button class="btn primary" id="submitBtn">提交</button>
                <button class="btn" id="showAnswerBtn">显示参考答案</button>
                <button class="btn" id="nextBtn">下一题</button>
              </div>
              <div class="action-group">
                <button class="btn warn" id="favBtn">收藏</button>
                <button class="btn warn" id="hardBtn">标重点</button>
                <button class="btn good" id="masterBtn">已掌握/移出错题</button>
              </div>
            </div>
            <section class="answer-panel" id="answerPanel"></section>
            <section class="exam-result" id="examResult"></section>
            <div class="note-box">
              <textarea id="noteInput" placeholder="给这道题写自己的记忆口诀或错因，会自动保存在本地。"></textarea>
            </div>
          </section>
          <section class="card empty" id="emptyState">当前筛选条件下没有题目。</section>
        </section>
      </main>
    </div>

    <dialog class="dialog" id="dataDialog">
      <div class="dialog-body">
        <h3 id="dialogTitle">数据</h3>
        <p id="dialogHint"></p>
        <textarea id="dialogText"></textarea>
        <div class="actions dialog-actions">
          <button class="btn" id="dialogClose">关闭</button>
          <button class="btn primary" id="dialogApply">应用</button>
        </div>
      </div>
    </dialog>
    <div class="toast" id="toast"></div>`;

  renderTop();
  renderChapters();
  renderTags();
  bindEvents();
  rebuildSession();
}

function renderTop() {
  document.getElementById('topPills').innerHTML = `
    <span class="pill">总题量 ${bank.stats.total}</span>
    <span class="pill">单选 ${bank.stats.single}</span>
    <span class="pill">多选 ${bank.stats.multi}</span>
    <span class="pill">简答 ${bank.stats.short}</span>
    <span class="pill">原始错题 ${bank.stats.initialWrong}</span>
    <span class="pill">已校正 ${bank.stats.corrected} 处</span>`;
}

function renderChapters() {
  document.getElementById('chapterList').innerHTML = bank.stats.chapters.map((chapter) => `
    <label class="chapter-item">
      <span><input type="checkbox" class="chapterCheck" value="${chapter.code}" checked /> ${escapeHtml(chapter.name)}</span>
      <small>${chapter.total}题 · 错 ${chapter.initialWrong}</small>
    </label>`).join('');
}

function renderTags() {
  const tags = unique(QUESTIONS.flatMap((question) => question.tags || [])).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  document.getElementById('tagFilter').innerHTML = '<option value="all">全部标签</option>' + tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
}

function collectFilters() {
  activeChapters = new Set(Array.from(document.querySelectorAll('.chapterCheck:checked')).map((input) => input.value));
  return {
    query: document.getElementById('searchInput').value.trim().toLowerCase(),
    type: document.getElementById('typeFilter').value,
    tag: document.getElementById('tagFilter').value
  };
}

function baseFilteredQuestions() {
  const filters = collectFilters();
  return QUESTIONS.filter((question) => {
    if (!activeChapters.has(question.chapterCode)) return false;
    if (filters.type !== 'all' && question.type !== filters.type) return false;
    if (filters.tag !== 'all' && !(question.tags || []).includes(filters.tag)) return false;
    if (filters.query) {
      const text = [
        question.question,
        ...(question.options || []).map((option) => option.text),
        question.explanation,
        question.answerText,
        (question.tags || []).join(' ')
      ].join('\n').toLowerCase();
      if (!text.includes(filters.query)) return false;
    }
    return true;
  });
}

function rebuildSession(keepIndex = false) {
  document.getElementById('examPanel').classList.toggle('show', mode === 'exam');
  let list = baseFilteredQuestions();
  if (mode === 'random') list = shuffleArray(list);
  if (mode === 'initialWrong') list = list.filter((question) => question.initialWrong);
  if (mode === 'papers') list = list.filter((question) => question.id.startsWith('paper-'));
  if (mode === 'wrong') list = list.filter((question) => state.wrong.includes(question.id));
  if (mode === 'favorite') list = list.filter((question) => state.favorite.includes(question.id));
  if (mode === 'hard') list = list.filter((question) => state.hard.includes(question.id));
  if (mode === 'recite') list = list.filter((question) => question.type === 'short' || question.tags?.includes('核心概念'));
  if (mode === 'exam') list = buildExam(list);
  quizList = list;
  if (!keepIndex || current >= quizList.length) current = 0;
  selected = new Set();
  examSubmitted = false;
  examAnswers = {};
  renderAll();
}

function buildExam(list) {
  const singleCount = Number(document.getElementById('examSingle').value || 0);
  const multiCount = Number(document.getElementById('examMulti').value || 0);
  const shortCount = Number(document.getElementById('examShort').value || 0);
  const singles = shuffleArray(list.filter((question) => question.type === 'single')).slice(0, singleCount);
  const multis = shuffleArray(list.filter((question) => question.type === 'multi')).slice(0, multiCount);
  const shorts = shuffleArray(list.filter((question) => question.type === 'short')).slice(0, shortCount);
  return shuffleArray([...singles, ...multis, ...shorts]);
}

function renderAll() {
  renderStats();
  renderQuestionList();
  renderQuestion();
}

function renderStats() {
  const answeredIds = Object.keys(state.answered || {});
  const correctCount = answeredIds.filter((id) => state.answered[id]?.correct).length;
  const accuracy = answeredIds.length ? Math.round((correctCount / answeredIds.length) * 100) : 0;
  document.getElementById('statsGrid').innerHTML = `
    ${statCard(quizList.length, '当前题单')}
    ${statCard(answeredIds.length, '本地已答')}
    ${statCard(`${accuracy}%`, '本地正确率')}
    ${statCard(state.wrong.length, '我的错题')}`;
}

function statCard(value, label) {
  return `<article class="stat card"><b>${value}</b><span>${label}</span></article>`;
}

function renderQuestionList() {
  document.getElementById('sessionCount').textContent = quizList.length;
  const box = document.getElementById('questionList');
  box.innerHTML = quizList.map((question, index) => {
    const rec = state.answered[question.id];
    const dot = rec ? (rec.correct ? 'ok' : 'no') : (question.initialWrong ? 'seen' : '');
    const title = `${index + 1}. ${TYPE_NAME[question.type]} · ${question.question}`;
    return `<button class="q-jump ${index === current ? 'active' : ''}" data-i="${index}" title="${escapeHtml(title)}"><span class="dot ${dot}"></span><span>${index + 1}. ${TYPE_NAME[question.type]} · ${escapeHtml(question.question).slice(0, 34)}${question.question.length > 34 ? '...' : ''}</span><small>${question.chapterCode.toUpperCase()}</small></button>`;
  }).join('');
  box.querySelectorAll('.q-jump').forEach((button) => button.addEventListener('click', () => {
    current = Number(button.dataset.i);
    selected = new Set();
    renderQuestion();
    renderQuestionList();
  }));
}

function renderQuestion() {
  const empty = document.getElementById('emptyState');
  const card = document.getElementById('quizCard');
  if (!quizList.length) {
    empty.style.display = 'block';
    card.style.display = 'none';
    return;
  }
  empty.style.display = 'none';
  card.style.display = 'block';
  const question = quizList[current];
  const rec = state.answered[question.id];
  const examRec = examAnswers[question.id];
  selected = new Set(mode === 'exam' && examRec ? (examRec.answer || []) : []);
  document.getElementById('progressBar').style.width = `${Math.round(((current + 1) / quizList.length) * 100)}%`;
  const tags = (question.tags || []).slice(0, 8).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('');
  document.getElementById('meta').innerHTML = `<span class="badge green">${current + 1} / ${quizList.length}</span><span class="badge">${escapeHtml(question.chapter)}</span><span class="badge">${TYPE_NAME[question.type]}</span>${question.initialWrong ? '<span class="badge red">原始错题</span>' : ''}${question.correctionNote ? '<span class="badge gold">已校正</span>' : ''}${tags}`;
  document.getElementById('questionText').textContent = question.question;
  document.getElementById('noteInput').value = state.notes[question.id] || '';
  document.getElementById('shortInput').value = state.shortDrafts[question.id] || '';
  document.getElementById('favBtn').textContent = state.favorite.includes(question.id) ? '取消收藏' : '收藏';
  document.getElementById('hardBtn').textContent = state.hard.includes(question.id) ? '取消重点' : '标重点';
  document.getElementById('answerPanel').classList.remove('show');
  document.getElementById('examResult').classList.remove('show');

  const opts = document.getElementById('options');
  const shortArea = document.getElementById('shortArea');
  const submitBtn = document.getElementById('submitBtn');
  const showBtn = document.getElementById('showAnswerBtn');
  if (question.type === 'short') {
    opts.innerHTML = '';
    shortArea.classList.add('show');
    submitBtn.style.display = 'none';
    showBtn.style.display = '';
  } else {
    shortArea.classList.remove('show');
    submitBtn.style.display = question.type === 'multi' ? '' : 'none';
    showBtn.style.display = mode === 'exam' && !examSubmitted ? 'none' : '';
    const reveal = mode !== 'exam' && Boolean(rec);
    opts.innerHTML = question.options.map((option) => {
      let cls = 'option';
      if (selected.has(option.key) || (rec && rec.answer?.includes(option.key))) cls += ' selected';
      if (reveal) {
        if (question.answer.includes(option.key)) cls += ' correct';
        else if (rec.answer?.includes(option.key)) cls += ' wrong';
        cls += ' disabled';
      }
      return `<button class="${cls}" data-key="${option.key}"><span class="letter">${option.key}</span><span>${escapeHtml(option.text)}</span></button>`;
    }).join('');
    opts.querySelectorAll('.option').forEach((button) => button.addEventListener('click', () => optionClick(button.dataset.key)));
    if (reveal) showAnswer(false);
  }
  document.getElementById('prevBtn').disabled = current === 0;
  document.getElementById('nextBtn').textContent = current === quizList.length - 1 ? (mode === 'exam' ? '交卷/查看结果' : '完成') : '下一题';
}

function optionClick(key) {
  const question = quizList[current];
  if (question.type === 'short') return;
  if (mode !== 'exam' && state.answered[question.id]) return;
  if (question.type === 'single') {
    selected = new Set([key]);
    if (mode === 'exam') {
      examAnswers[question.id] = { answer: [key] };
      renderQuestion();
    } else {
      submitAnswer();
    }
    return;
  }
  if (selected.has(key)) selected.delete(key);
  else selected.add(key);
  if (mode === 'exam') examAnswers[question.id] = { answer: [...selected] };
  renderOptionsSelection();
}

function renderOptionsSelection() {
  document.querySelectorAll('.option').forEach((button) => button.classList.toggle('selected', selected.has(button.dataset.key)));
}

function submitAnswer() {
  const question = quizList[current];
  if (question.type === 'short') return;
  if (!selected.size) {
    toast('先选择答案');
    return;
  }
  if (mode === 'exam') {
    examAnswers[question.id] = { answer: [...selected] };
    toast('已记录');
    return;
  }
  const answer = [...selected];
  const correct = arrEq(answer, question.answer);
  state.answered[question.id] = { answer, correct, at: Date.now() };
  if (correct) state.wrong = state.wrong.filter((id) => id !== question.id);
  else state.wrong = unique([...state.wrong, question.id]);
  persistState();
  renderQuestion();
  showAnswer(true);
}

function showAnswer(scroll = false) {
  const question = quizList[current];
  const rec = mode === 'exam' ? examAnswers[question.id] : state.answered[question.id];
  const panel = document.getElementById('answerPanel');
  let html = '';
  if (question.type === 'short') {
    html = `<div class="answer-line"><strong>参考答案：</strong></div><div class="expl">${escapeHtml(question.answerText || question.explanation || '暂无参考答案')}</div>`;
  } else {
    const your = rec?.answer?.length ? formatAnswer(question, rec.answer) : '未作答';
    const ok = rec?.answer ? arrEq(rec.answer, question.answer) : false;
    html = `<div class="answer-line"><strong>正确答案：</strong><span>${escapeHtml(formatAnswer(question, question.answer))}</span></div>
      <div class="answer-line"><strong>你的答案：</strong><span class="${ok ? 'badge green' : 'badge red'}">${escapeHtml(your)}</span></div>
      <div class="expl">${escapeHtml(question.explanation || '')}</div>`;
  }
  if (question.correctionNote) html += `<details open><summary>校正说明</summary><div class="expl">${escapeHtml(question.correctionNote)}</div></details>`;
  if (question.duplicateOf) html += `<details><summary>重复题提示</summary><div>这道题与 ${escapeHtml(question.duplicateOf)} 完全重复，系统保留章节来源。</div></details>`;
  panel.innerHTML = html;
  panel.classList.add('show');
  if (scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function formatAnswer(question, answer) {
  return (answer || []).map((key) => key + (question.optionText?.[key] ? `：${question.optionText[key]}` : '')).join('；');
}

function nextQuestion() {
  if (mode === 'exam' && current === quizList.length - 1) {
    finishExam();
    return;
  }
  if (current < quizList.length - 1) {
    current += 1;
    selected = new Set();
    renderQuestion();
    renderQuestionList();
  } else {
    toast('这一组已经刷完');
  }
}

function prevQuestion() {
  if (current > 0) {
    current -= 1;
    selected = new Set();
    renderQuestion();
    renderQuestionList();
  }
}

function finishExam() {
  const objective = quizList.filter((question) => question.type !== 'short');
  const correct = objective.filter((question) => arrEq((examAnswers[question.id] || {}).answer || [], question.answer)).length;
  const unanswered = objective.filter((question) => !examAnswers[question.id]).length;
  examSubmitted = true;
  objective.forEach((question) => {
    const answer = (examAnswers[question.id] || {}).answer || [];
    const isCorrect = arrEq(answer, question.answer);
    state.answered[question.id] = { answer, correct: isCorrect, at: Date.now(), exam: true };
    if (isCorrect) state.wrong = state.wrong.filter((id) => id !== question.id);
    else state.wrong = unique([...state.wrong, question.id]);
  });
  persistState();
  const rate = objective.length ? Math.round((correct / objective.length) * 100) : 0;
  const result = document.getElementById('examResult');
  result.innerHTML = `<h3>考试结果</h3><p>客观题 ${correct} / ${objective.length}，正确率 ${rate}%。未答 ${unanswered} 题。</p><p>交卷后可逐题点“显示参考答案”查看解析。</p>`;
  result.classList.add('show');
  toast('已交卷');
}

function markList(name) {
  const question = quizList[current];
  const list = state[name];
  state[name] = list.includes(question.id) ? list.filter((id) => id !== question.id) : unique([...list, question.id]);
  persistState();
  renderQuestion();
  toast(name === 'favorite' ? '收藏状态已更新' : '重点状态已更新');
}

function masterCurrent() {
  const question = quizList[current];
  state.wrong = state.wrong.filter((id) => id !== question.id);
  if (state.answered[question.id]) state.answered[question.id].correct = true;
  persistState();
  renderQuestion();
  toast('已从错题本移出');
}

function persistState() {
  saveState(session.username, state);
  renderStats();
  renderQuestionList();
}

function bindEvents() {
  document.getElementById('applyBtn').addEventListener('click', () => rebuildSession());
  document.getElementById('searchInput').addEventListener('keydown', (event) => { if (event.key === 'Enter') rebuildSession(); });
  document.getElementById('typeFilter').addEventListener('change', () => rebuildSession());
  document.getElementById('tagFilter').addEventListener('change', () => rebuildSession());
  document.querySelectorAll('.modebar .btn').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.modebar .btn').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    mode = button.dataset.mode;
    rebuildSession();
  }));
  document.getElementById('toggleChapters').addEventListener('click', () => {
    const checks = Array.from(document.querySelectorAll('.chapterCheck'));
    const all = checks.every((check) => check.checked);
    checks.forEach((check) => { check.checked = !all; });
    rebuildSession();
  });
  document.getElementById('chapterList').addEventListener('change', (event) => { if (event.target.classList.contains('chapterCheck')) rebuildSession(); });
  document.getElementById('submitBtn').addEventListener('click', submitAnswer);
  document.getElementById('showAnswerBtn').addEventListener('click', () => showAnswer(true));
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
  document.getElementById('prevBtn').addEventListener('click', prevQuestion);
  document.getElementById('favBtn').addEventListener('click', () => markList('favorite'));
  document.getElementById('hardBtn').addEventListener('click', () => markList('hard'));
  document.getElementById('masterBtn').addEventListener('click', masterCurrent);
  document.getElementById('startExamBtn').addEventListener('click', () => {
    mode = 'exam';
    document.querySelectorAll('.modebar .btn').forEach((button) => button.classList.toggle('active', button.dataset.mode === 'exam'));
    rebuildSession();
  });
  document.getElementById('noteInput').addEventListener('input', (event) => {
    const question = quizList[current];
    if (!question) return;
    state.notes[question.id] = event.target.value;
    saveState(session.username, state);
  });
  document.getElementById('shortInput').addEventListener('input', (event) => {
    const question = quizList[current];
    if (!question) return;
    state.shortDrafts[question.id] = event.target.value;
    saveState(session.username, state);
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('确定清空本地作答、错题、收藏、重点和笔记吗？题库不会删除。')) return;
    clearState(session.username);
    state = loadState(session.username);
    rebuildSession(true);
    toast('已清空');
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearSession();
    session = null;
    renderLogin();
  });
  document.getElementById('exportBtn').addEventListener('click', exportProgress);
  document.getElementById('importBtn').addEventListener('click', importProgress);
  document.getElementById('dialogClose').addEventListener('click', () => document.getElementById('dataDialog').close());
  document.addEventListener('keydown', handleKeyboard);
}

function handleKeyboard(event) {
  if (!quizList.length) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  const key = event.key.toUpperCase();
  if (['A', 'B', 'C', 'D', 'E'].includes(key)) optionClick(key);
  if (event.key === 'Enter') nextQuestion();
  if (event.key === ' ') {
    event.preventDefault();
    showAnswer(true);
  }
  if (event.key === 'ArrowRight') nextQuestion();
  if (event.key === 'ArrowLeft') prevQuestion();
}

function exportProgress() {
  const payload = JSON.stringify(normalizeState(state), null, 2);
  const dialog = document.getElementById('dataDialog');
  document.getElementById('dialogTitle').textContent = '导出进度';
  document.getElementById('dialogHint').textContent = '复制下面 JSON，或下载为文件后在另一台设备导入。';
  document.getElementById('dialogText').value = payload;
  const apply = document.getElementById('dialogApply');
  apply.textContent = '下载 JSON';
  apply.style.display = '';
  apply.onclick = () => downloadBlob(new Blob([payload], { type: 'application/json;charset=utf-8' }), '毛概刷题进度.json');
  dialog.showModal();
}

function importProgress() {
  const dialog = document.getElementById('dataDialog');
  document.getElementById('dialogTitle').textContent = '导入进度';
  document.getElementById('dialogHint').textContent = '粘贴之前导出的 JSON，点击应用。';
  document.getElementById('dialogText').value = '';
  const apply = document.getElementById('dialogApply');
  apply.textContent = '应用';
  apply.style.display = '';
  apply.onclick = () => {
    try {
      state = normalizeState(JSON.parse(document.getElementById('dialogText').value));
      saveState(session.username, state);
      dialog.close();
      rebuildSession(true);
      toast('导入成功');
    } catch {
      alert('JSON 格式不正确');
    }
  };
  dialog.showModal();
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

boot();
