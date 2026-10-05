// ===== CET-4 AI Coach 前端应用 =====
const API = '/api';
let state = {
  user: null,
  profile: null,
  diagnostic: { currentPart: 0, answers: [], results: {} },
  currentTaskIndex: 0,
  vocabMode: 'learn',
  vocabWords: [],
  vocabIndex: 0,
  chatHistory: []
};

// ===== 工具函数 =====
function $(id) { return document.getElementById(id); }
function showToast(msg, duration = 2000) {
  const t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', duration);
}
async function api(url, options = {}) {
  try {
    const res = await fetch(API + url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    return await res.json();
  } catch (e) {
    showToast('网络错误，请检查服务是否启动');
    throw e;
  }
}
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = $('page-' + page);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');
  window.scrollTo(0, 0);
  // 触发页面加载
  onPageLoad(page);
}

// ===== 初始化 =====
async function init() {
  // 检查AI状态
  const aiStatus = await api('/ai-status');
  const badge = $('ai-status');
  if (aiStatus.enabled) {
    badge.textContent = 'AI已连接';
    badge.classList.add('enabled');
  } else {
    badge.textContent = '内置题库模式';
  }
  
  // 检查用户状态
  const data = await api('/user/profile');
  state.user = data.user;
  state.profile = data.profile;
  
  if (!state.user.exam_date) {
    // 首次使用，显示设置页
    navigateTo('setup');
    initSetupPage();
  } else if (!state.user.diagnostic_completed) {
    // 已设置但未诊断
    $('bottom-nav').style.display = 'flex';
    navigateTo('diagnostic');
    startDiagnostic();
  } else {
    // 已完成诊断，显示首页
    $('bottom-nav').style.display = 'flex';
    navigateTo('home');
    loadHomeData();
  }
}

// ===== 设置页面 =====
let selectedMinutes = 60, selectedDays = 6;
function initSetupPage() {
  // 设置默认考试日期为今年12月第三个周六（CET-4通常在12月第三个周六）
  const now = new Date();
  const year = now.getMonth() >= 10 ? now.getFullYear() : now.getFullYear();
  const dec = new Date(year, 11, 1);
  let saturdayCount = 0;
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, 11, d);
    if (date.getDay() === 6) {
      saturdayCount++;
      if (saturdayCount === 3) {
        $('input-exam-date').value = date.toISOString().split('T')[0];
        break;
      }
    }
  }
  
  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedMinutes = parseInt(btn.dataset.minutes);
      $('input-custom-minutes').value = '';
    };
  });
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDays = parseInt(btn.dataset.days);
    };
  });
  
  $('btn-save-profile').onclick = saveProfile;
}

async function saveProfile() {
  const examDate = $('input-exam-date').value;
  if (!examDate) { showToast('请选择考试日期'); return; }
  
  const customMinutes = parseInt($('input-custom-minutes').value);
  const minutes = customMinutes > 0 ? customMinutes : selectedMinutes;
  
  const morningStart = $('input-morning-start').value;
  const morningEnd = $('input-morning-end').value;
  const eveningStart = $('input-evening-start').value;
  const eveningEnd = $('input-evening-end').value;
  
  await api('/user/profile', {
    method: 'PUT',
    body: {
      exam_date: examDate,
      target_score: parseInt($('input-target-score').value),
      daily_study_minutes: minutes,
      weekly_days: selectedDays,
      available_morning: morningStart && morningEnd ? `${morningStart}-${morningEnd}` : null,
      available_evening: eveningStart && eveningEnd ? `${eveningStart}-${eveningEnd}` : null
    }
  });
  
  showToast('档案已保存');
  $('bottom-nav').style.display = 'flex';
  navigateTo('diagnostic');
  startDiagnostic();
}

// ===== 诊断测试 =====
const diagnosticParts = ['vocabulary', 'grammar', 'reading', 'listening', 'translation', 'writing'];
const partNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', translation: '翻译', writing: '写作' };
let diagnosticQuestions = {};
let diagnosticCurrentQuestion = 0;

async function startDiagnostic() {
  diagnosticCurrentQuestion = 0;
  state.diagnostic.answers = [];
  state.diagnostic.results = {};
  
  // 获取所有诊断题
  diagnosticQuestions = await api('/diagnostic/questions?module=all');
  renderDiagnosticPart();
}

function renderDiagnosticPart() {
  const part = diagnosticParts[diagnosticCurrentQuestion];
  const progress = ((diagnosticCurrentQuestion + 1) / diagnosticParts.length) * 100;
  $('diagnostic-progress').style.width = progress + '%';
  $('diagnostic-progress-text').textContent = `第 ${diagnosticCurrentQuestion + 1} / ${diagnosticParts.length} 部分 - ${partNames[part]}`;
  
  const content = $('diagnostic-content');
  const questions = diagnosticQuestions[part];
  
  if (part === 'translation') {
    content.innerHTML = `
      <div class="question-text">${questions[0].source}</div>
      <textarea id="diag-translation" class="form-input" style="min-height:100px" placeholder="请输入你的英文翻译..."></textarea>
    `;
    $('btn-diagnostic-prev').style.display = diagnosticCurrentQuestion > 0 ? 'block' : 'none';
    $('btn-diagnostic-next').textContent = diagnosticCurrentQuestion === diagnosticParts.length - 1 ? '完成诊断' : '下一部分';
    return;
  }
  
  if (part === 'writing') {
    content.innerHTML = `
      <div class="question-text">${questions[0].topic}</div>
      <textarea id="diag-writing" class="form-input" style="min-height:150px" placeholder="请输入你的作文（建议120-180词）..."></textarea>
    `;
    $('btn-diagnostic-prev').style.display = 'block';
    $('btn-diagnostic-next').textContent = '完成诊断';
    return;
  }
  
  // 选择题部分
  let html = '';
  if (part === 'reading') {
    const passage = questions[0];
    html += `<div class="question-passage">${passage.passage}</div>`;
    html += `<div id="diag-questions">`;
    passage.questions.forEach((q, i) => {
      html += `<div class="diag-q" data-qindex="${i}">
        <div class="question-text">${i+1}. ${q.question}</div>
        <div class="options-list">
          ${q.options.map((opt, oi) => `<div class="option-item" data-answer="${opt[0]}" data-q="${i}">${opt}</div>`).join('')}
        </div>
      </div>`;
    });
    html += `</div>`;
  } else {
    html += `<div id="diag-questions">`;
    questions.forEach((q, i) => {
      html += `<div class="diag-q" data-qindex="${i}">
        <div class="question-text">${i+1}. ${q.question}</div>
        <div class="options-list">
          ${q.options.map((opt, oi) => `<div class="option-item" data-answer="${opt[0]}" data-q="${i}">${opt}</div>`).join('')}
        </div>
      </div>`;
    });
    html += `</div>`;
  }
  
  content.innerHTML = html;
  
  // 绑定选项点击
  content.querySelectorAll('.option-item').forEach(item => {
    item.onclick = () => {
      const qIndex = item.dataset.q;
      const parent = item.closest('.diag-q');
      parent.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
      item.classList.add('selected');
    };
  });
  
  $('btn-diagnostic-prev').style.display = diagnosticCurrentQuestion > 0 ? 'block' : 'none';
  $('btn-diagnostic-next').textContent = diagnosticCurrentQuestion === diagnosticParts.length - 1 ? '完成诊断' : '下一部分';
}

$('btn-diagnostic-prev').onclick = () => {
  if (diagnosticCurrentQuestion > 0) {
    diagnosticCurrentQuestion--;
    renderDiagnosticPart();
  }
};

$('btn-diagnostic-next').onclick = async () => {
  const part = diagnosticParts[diagnosticCurrentQuestion];
  const questions = diagnosticQuestions[part];
  
  if (part === 'translation') {
    const text = $('diag-translation')?.value || '';
    state.diagnostic.results.translation = { score: text.length > 20 ? 10 : 6 };
    state.diagnostic.answers.push({ module: 'translation', user_answer: text, content: questions[0].source, correct_answer: questions[0].reference });
  } else if (part === 'writing') {
    const text = $('diag-writing')?.value || '';
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    state.diagnostic.results.writing = { score: words >= 120 ? 11 : words >= 80 ? 8 : 5 };
    state.diagnostic.answers.push({ module: 'writing', user_answer: text, content: questions[0].topic });
  } else {
    // 选择题
    let correct = 0, total = 0;
    const qElements = document.querySelectorAll('.diag-q');
    qElements.forEach((qe, i) => {
      total++;
      const selected = qe.querySelector('.option-item.selected');
      const q = part === 'reading' ? questions[0].questions[i] : questions[i];
      if (selected) {
        const userAns = selected.dataset.answer;
        const isCorrect = userAns === q.answer;
        if (isCorrect) correct++;
        state.diagnostic.answers.push({
          module: part,
          question_id: null,
          user_answer: userAns,
          correct: isCorrect,
          content: q.question,
          options: q.options,
          correct_answer: q.answer,
          error_type: q.error_type,
          knowledge_point: q.knowledge_point,
          question_type: part
        });
      } else {
        state.diagnostic.answers.push({
          module: part, user_answer: '', correct: false,
          content: q.question, options: q.options, correct_answer: q.answer,
          knowledge_point: q.knowledge_point, question_type: part
        });
      }
    });
    state.diagnostic.results[part] = { correct, total };
  }
  
  if (diagnosticCurrentQuestion < diagnosticParts.length - 1) {
    diagnosticCurrentQuestion++;
    renderDiagnosticPart();
  } else {
    // 完成诊断，提交
    await submitDiagnostic();
  }
};

async function submitDiagnostic() {
  $('diagnostic-content').innerHTML = '<div class="loading"><div class="loading-spinner"></div><p style="margin-top:12px">正在分析你的能力画像...</p></div>';
  
  const result = await api('/diagnostic/submit', {
    method: 'POST',
    body: { results: state.diagnostic.results, answers: state.diagnostic.answers }
  });
  
  if (result.success) {
    renderDiagnosticReport(result.report);
    navigateTo('diagnostic-report');
  }
}

function renderDiagnosticReport(report) {
  const moduleColors = { vocabulary: '#4F46E5', grammar: '#0EA5E9', reading: '#10B981', listening: '#F59E0B', writing: '#EF4444', translation: '#8B5CF6' };
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  
  let html = `
    <div class="report-score-card">
      <div class="report-score">${report.overallScore}</div>
      <div class="report-score-label">综合能力评估（满分100）</div>
      <div style="margin-top:8px;font-size:14px;opacity:0.9">当前阶段：${report.stage}</div>
    </div>
    
    <div class="report-section">
      <h3>📊 CET-4 综合能力画像</h3>
      ${Object.entries(report.abilities).map(([k, v]) => `
        <div class="ability-bar">
          <span class="ability-name">${moduleNames[k]}</span>
          <div class="ability-track"><div class="ability-fill" style="width:${v}%;background:${moduleColors[k]}"></div></div>
          <span class="ability-score">${v}</span>
        </div>
      `).join('')}
    </div>
    
    <div class="report-section">
      <h3>✅ 目前主要优势</h3>
      ${report.strengths.map((s, i) => `<div class="strength-item"><span class="tag tag-success">TOP${i+1}</span><span>${s.name}（${s.score}分）</span></div>`).join('')}
    </div>
    
    <div class="report-section">
      <h3>⚠️ 目前主要薄弱点</h3>
      ${report.weaknesses.map((w, i) => `<div class="weakness-item"><span class="tag tag-danger">薄弱${i+1}</span><span>${w.name}（${w.score}分）</span></div>`).join('')}
    </div>
    
    <div class="report-section">
      <h3>🎯 最需要优先解决</h3>
      <p style="font-size:15px;line-height:1.7"><strong>${report.topPriority?.name}</strong>是当前最薄弱的模块，建议每天优先安排该模块训练。</p>
    </div>
    
    <div class="report-section">
      <h3>📋 学习建议</h3>
      ${report.recommendations.map(r => `
        <div style="margin-bottom:12px">
          <div style="font-weight:600;color:var(--primary);margin-bottom:4px">${r.name}</div>
          <div style="font-size:14px;color:var(--text-secondary)">${r.advice}</div>
        </div>
      `).join('')}
    </div>
    
    <div class="report-section" style="text-align:center">
      <p style="margin-bottom:12px">${report.daysLeft ? `距离考试还有 <strong style="color:var(--primary);font-size:20px">${report.daysLeft}</strong> 天` : '请设置考试日期以生成倒计时'}</p>
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">${report.stageDesc}</p>
      <button class="btn-primary btn-large" onclick="startUsingApp()">开始使用，生成今日学习计划</button>
    </div>
  `;
  
  $('diagnostic-report-content').innerHTML = html;
}

function startUsingApp() {
  navigateTo('home');
  loadHomeData();
}

// ===== 首页 =====
async function loadHomeData() {
  const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const [plan, stats, todayClasses] = await Promise.all([
    api('/study/today'),
    api('/user/stats'),
    api(`/schedule/day/${dayOfWeek}`)
  ]);
  
  state.todayPlan = plan;
  
  // 倒计时
  $('countdown-days').textContent = plan.daysLeft ?? '--';
  $('today-minutes').textContent = plan.todayRecord?.study_minutes || 0;
  $('today-completion').textContent = plan.completionRate + '%';
  $('weakest-module').textContent = plan.weakestModule?.name || '--';
  
  // 今日课程
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const classesContainer = $('today-classes-home');
  if (todayClasses.classes && todayClasses.classes.length > 0) {
    classesContainer.style.display = 'block';
    classesContainer.innerHTML = `
      <div class="today-classes-card">
        <div class="today-classes-title">📚 今日课程（${dayNames[dayOfWeek]}）</div>
        <div class="today-classes-list">
          ${todayClasses.classes.map(c => `
            <div class="today-class-item">
              <span class="today-class-time">${c.start_time}-${c.end_time}</span>
              <span class="today-class-name">${c.course_name}</span>
              <span class="today-class-loc">${c.location || ''}</span>
            </div>
          `).join('')}
        </div>
        <div class="today-classes-hint">学习计划已自动避开上课时间</div>
      </div>
    `;
  } else {
    classesContainer.style.display = 'none';
  }
  
  // 概览
  $('overview-days').textContent = stats.totalDays;
  $('overview-minutes').textContent = stats.totalMinutes;
  $('overview-questions').textContent = stats.totalQuestions;
  $('overview-accuracy').textContent = stats.overallAccuracy + '%';
  
  // 今日任务
  renderTodayTasks(plan.tasks);
  
  $('btn-start-today').onclick = () => startTodayLearning();
  $('btn-refresh-plan').onclick = async () => {
    const today = new Date().toISOString().split('T')[0];
    // 删除今天的计划重新生成
    await fetch(API + '/study/today/refresh', { method: 'POST' }).catch(() => {});
    loadHomeData();
    showToast('计划已重新生成');
  };
}

function renderTodayTasks(tasks) {
  const moduleIcons = { review: '🔄', vocabulary: '📚', reading: '📖', listening: '🎧', grammar: '✏️', writing: '✍️', translation: '🔄' };
  const container = $('today-tasks');
  
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px">暂无任务</p>';
    return;
  }
  
  container.innerHTML = tasks.map((t, i) => `
    <div class="task-item ${t.module === 'review' ? 'review' : ''}" data-index="${i}">
      <div class="task-time">${t.startTime || ''}-${t.endTime || ''}</div>
      <div class="task-info">
        <div class="task-title">${moduleIcons[t.module] || '📝'} ${t.title}</div>
        <div class="task-desc">${t.content}</div>
      </div>
      <div class="task-duration">${t.duration}分钟</div>
    </div>
  `).join('');
  
  // 绑定任务点击
  container.querySelectorAll('.task-item').forEach(item => {
    item.onclick = () => {
      const idx = parseInt(item.dataset.index);
      startTask(idx);
    };
  });
}

function startTodayLearning() {
  if (state.todayPlan?.tasks?.length > 0) {
    startTask(0);
  }
}

function startTask(index) {
  const task = state.todayPlan.tasks[index];
  if (!task) return;
  
  state.currentTaskIndex = index;
  
  if (task.module === 'vocabulary') {
    navigateTo('vocabulary');
    loadVocabulary();
  } else if (task.module === 'reading') {
    navigateTo('reading');
    startReadingPractice();
  } else if (task.module === 'listening') {
    navigateTo('listening');
    startListeningPractice();
  } else if (task.module === 'grammar') {
    startPracticeModal('grammar', '语法专项');
  } else if (task.module === 'writing') {
    navigateTo('writing');
    getNewWritingTopic();
  } else if (task.module === 'translation') {
    navigateTo('translation');
    getNewTranslationTopic();
  } else if (task.module === 'review') {
    navigateTo('wrong');
    loadWrongQuestions('all');
  }
  
  // 标记任务完成
  api('/study/complete-task', { method: 'POST', body: { taskIndex: index, studyMinutes: task.duration } });
}

// ===== 词汇模块 =====
async function loadVocabulary() {
  const stats = await api('/vocabulary/stats');
  $('vocab-learned').textContent = stats.learned;
  $('vocab-mastered').textContent = stats.mastered;
  $('vocab-weak').textContent = stats.weak;
  $('vocab-today').textContent = stats.todayReview;
  
  document.querySelectorAll('.vocab-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.vocab-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.vocabMode = tab.dataset.mode;
      renderVocabContent();
    };
  });
  
  renderVocabContent();
}

async function renderVocabContent() {
  const container = $('vocab-content');
  
  if (state.vocabMode === 'learn') {
    const data = await api('/vocabulary/daily?count=20');
    state.vocabWords = data.words;
    state.vocabIndex = 0;
    renderVocabCard();
  } else if (state.vocabMode === 'quiz') {
    const data = await api('/vocabulary/daily?count=10');
    state.vocabWords = data.words;
    state.vocabIndex = 0;
    renderVocabQuiz();
  } else if (state.vocabMode === 'wrong') {
    const data = await api('/vocabulary/wrong');
    if (data.words.length === 0) {
      container.innerHTML = '<div class="vocab-card"><p style="color:var(--text-secondary)">暂无错词，继续保持！</p></div>';
    } else {
      container.innerHTML = data.words.map(w => `
        <div class="vocab-card" style="margin-bottom:12px;text-align:left;min-height:auto;padding:16px">
          <div style="font-size:20px;font-weight:700">${w.word}</div>
          <div style="color:var(--text-secondary);font-size:13px">${w.phonetic || ''}</div>
          <div style="color:var(--primary);margin:8px 0">${w.meaning}</div>
          <div style="font-size:13px;color:var(--text-secondary)">掌握度: ${w.mastery_level}% | 错误${w.error_count}次</div>
        </div>
      `).join('');
    }
  }
}

function renderVocabCard() {
  const container = $('vocab-content');
  const word = state.vocabWords[state.vocabIndex];
  if (!word) {
    container.innerHTML = '<div class="vocab-card"><p style="font-size:18px;font-weight:600">🎉 今日词汇学习完成！</p><p style="color:var(--text-secondary);margin-top:8px">明天继续加油</p></div>';
    return;
  }
  
  container.innerHTML = `
    <div class="vocab-card">
      <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">${state.vocabIndex + 1} / ${state.vocabWords.length}</div>
      <div class="vocab-word">${word.word}</div>
      <div class="vocab-phonetic">${word.phonetic || ''}</div>
      <div class="vocab-meaning">${word.meaning}</div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">${word.part_of_speech || ''}</div>
      ${word.example ? `<div class="vocab-example">${word.example}<br><span style="color:var(--text-light)">${word.example_translation || ''}</span></div>` : ''}
      <div class="vocab-actions">
        <button class="vocab-unknown" onclick="answerVocab(false)">不认识</button>
        <button class="vocab-known" onclick="answerVocab(true)">认识</button>
      </div>
    </div>
  `;
}

async function answerVocab(correct) {
  const word = state.vocabWords[state.vocabIndex];
  await api('/vocabulary/answer', { method: 'POST', body: { word: word.word, correct } });
  state.vocabIndex++;
  renderVocabCard();
}

function renderVocabQuiz() {
  const container = $('vocab-content');
  const word = state.vocabWords[state.vocabIndex];
  if (!word) {
    container.innerHTML = '<div class="vocab-card"><p style="font-size:18px;font-weight:600">🎉 测试完成！</p></div>';
    return;
  }
  
  // 生成干扰项
  const otherWords = state.vocabWords.filter(w => w.word !== word.word);
  const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [word, ...shuffled].sort(() => Math.random() - 0.5);
  
  container.innerHTML = `
    <div class="vocab-card">
      <div style="font-size:13px;color:var(--text-light);margin-bottom:8px">${state.vocabIndex + 1} / ${state.vocabWords.length}</div>
      <div class="vocab-word">${word.word}</div>
      <div class="vocab-phonetic">${word.phonetic || ''}</div>
      <p style="margin:16px 0;font-weight:600">请选择正确的中文意思：</p>
      <div id="quiz-options">
        ${options.map((opt, i) => `<button class="vocab-quiz-option" data-correct="${opt.word === word.word}" onclick="answerVocabQuiz(this)">${opt.meaning}</button>`).join('')}
      </div>
    </div>
  `;
}

async function answerVocabQuiz(btn) {
  const correct = btn.dataset.correct === 'true';
  const word = state.vocabWords[state.vocabIndex];
  
  document.querySelectorAll('.vocab-quiz-option').forEach(o => {
    o.style.pointerEvents = 'none';
    if (o.dataset.correct === 'true') o.style.background = '#D1FAE5';
  });
  if (!correct) btn.style.background = '#FEE2E2';
  
  await api('/vocabulary/answer', { method: 'POST', body: { word: word.word, correct, review_type: 'quiz' } });
  
  setTimeout(() => {
    state.vocabIndex++;
    renderVocabQuiz();
  }, 800);
}

// ===== 阅读训练 =====
async function startReadingPractice() {
  const data = await api('/practice/reading-set');
  state.currentReading = data;
  state.readingAnswers = {};
  
  const container = $('reading-content');
  container.style.display = 'block';
  container.innerHTML = `
    <div class="practice-passage">${data.passage}</div>
    <div id="reading-questions">
      ${data.questions.map((q, i) => `
        <div style="margin-bottom:20px">
          <div class="question-text">${i+1}. ${q.question}</div>
          <div class="options-list">
            ${q.options.map(opt => `<div class="option-item" data-q="${i}" data-answer="${opt[0]}">${opt}</div>`).join('')}
          </div>
          <div id="reading-explain-${i}" style="display:none"></div>
        </div>
      `).join('')}
    </div>
    <button class="btn-primary btn-large" onclick="submitReadingAnswers()">提交答案</button>
  `;
  
  container.querySelectorAll('.option-item').forEach(item => {
    item.onclick = () => {
      const qIdx = item.dataset.q;
      container.querySelectorAll(`.option-item[data-q="${qIdx}"]`).forEach(o => o.classList.remove('selected'));
      item.classList.add('selected');
      state.readingAnswers[qIdx] = item.dataset.answer;
    };
  });
}

async function submitReadingAnswers() {
  const data = state.currentReading;
  let allCorrect = true;
  
  data.questions.forEach((q, i) => {
    const userAns = state.readingAnswers[i];
    const correct = userAns === q.answer;
    if (!correct) allCorrect = false;
    
    // 显示结果
    const explainDiv = $(`reading-explain-${i}`);
    explainDiv.style.display = 'block';
    explainDiv.innerHTML = `
      <div class="explanation-box">
        <h4>解析</h4>
        <p>正确答案：<strong style="color:var(--success)">${q.answer}</strong>${userAns ? `，你的答案：<strong style="color:${correct ? 'var(--success)' : 'var(--danger)'}">${userAns}</strong>` : '（未作答）'}</p>
        <p>${q.explanation}</p>
        ${!correct ? `<div class="error-reason">错误类型：${q.error_type || '未分类'} | 知识点：${q.knowledge_point || ''}</div>` : ''}
      </div>
    `;
    
    // 高亮选项
    document.querySelectorAll(`.option-item[data-q="${i}"]`).forEach(o => {
      o.style.pointerEvents = 'none';
      if (o.dataset.answer === q.answer) o.classList.add('correct');
      if (o.dataset.answer === userAns && !correct) o.classList.add('wrong');
    });
    
    // 提交到后端
    api('/practice/answer', {
      method: 'POST',
      body: {
        module: 'reading', question: q.question, options: q.options,
        user_answer: userAns || '', correct_answer: q.answer, is_correct: correct,
        explanation: q.explanation, knowledge_point: q.knowledge_point,
        error_type: q.error_type, difficulty: q.difficulty, source: 'builtin'
      }
    });
  });
  
  showToast(allCorrect ? '全部正确！太棒了！' : '已提交，查看解析');
}

// ===== 听力训练 =====
async function startListeningPractice() {
  const data = await api('/practice/question?module=listening');
  state.currentListening = data;
  
  const container = $('listening-content');
  container.style.display = 'block';
  container.innerHTML = `
    <div style="width:100%">
      <div class="info-banner" style="margin-bottom:16px">
        <strong>听力原文：</strong>（当前为文本模式，可对照原文训练）
      </div>
      <div class="practice-passage" style="white-space:pre-line">${data.transcript}</div>
      <div class="question-text" style="margin:16px 0">${data.question}</div>
      <div class="options-list" id="listening-options">
        ${data.options.map(opt => `<div class="option-item" data-answer="${opt[0]}">${opt}</div>`).join('')}
      </div>
      <div id="listening-explain" style="display:none"></div>
      <button class="btn-primary btn-large" onclick="submitListeningAnswer()">提交答案</button>
    </div>
  `;
  
  container.querySelectorAll('.option-item').forEach(item => {
    item.onclick = () => {
      container.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
      item.classList.add('selected');
      state.listeningAnswer = item.dataset.answer;
    };
  });
}

async function submitListeningAnswer() {
  const data = state.currentListening;
  const userAns = state.listeningAnswer;
  const correct = userAns === data.answer;
  
  document.querySelectorAll('#listening-options .option-item').forEach(o => {
    o.style.pointerEvents = 'none';
    if (o.dataset.answer === data.answer) o.classList.add('correct');
    if (o.dataset.answer === userAns && !correct) o.classList.add('wrong');
  });
  
  $('listening-explain').style.display = 'block';
  $('listening-explain').innerHTML = `
    <div class="explanation-box">
      <h4>解析</h4>
      <p>正确答案：<strong style="color:var(--success)">${data.answer}</strong>${userAns ? `，你的答案：<strong style="color:${correct ? 'var(--success)' : 'var(--danger)'}">${userAns}</strong>` : ''}</p>
      <p>${data.explanation}</p>
      <p><strong>关键词分析：</strong>注意听力中的转折词和时间、数字等关键信息</p>
    </div>
  `;
  
  await api('/practice/answer', {
    method: 'POST',
    body: {
      module: 'listening', question: data.question, options: data.options,
      user_answer: userAns || '', correct_answer: data.answer, is_correct: correct,
      explanation: data.explanation, knowledge_point: data.knowledge_point, difficulty: data.difficulty
    }
  });
  
  showToast(correct ? '回答正确！' : '已提交，查看解析');
}

// ===== 通用练习弹窗（语法等） =====
async function startPracticeModal(module, title) {
  $('practice-modal-title').textContent = title;
  $('practice-modal').style.display = 'flex';
  const body = $('practice-modal-body');
  body.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
  
  const data = await api(`/practice/question?module=${module}`);
  state.practiceData = data;
  
  body.innerHTML = `
    ${data.passage ? `<div class="practice-passage">${data.passage}</div>` : ''}
    <div class="question-text" style="margin:16px 0">${data.question}</div>
    <div class="options-list" id="practice-options">
      ${data.options.map(opt => `<div class="option-item" data-answer="${opt[0]}">${opt}</div>`).join('')}
    </div>
    <div id="practice-explain" style="display:none"></div>
    <button class="btn-primary btn-large" onclick="submitPracticeAnswer()">提交答案</button>
    <button class="btn-secondary btn-large" style="margin-top:8px" onclick="nextPracticeQuestion()">下一题</button>
  `;
  
  body.querySelectorAll('.option-item').forEach(item => {
    item.onclick = () => {
      body.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
      item.classList.add('selected');
      state.practiceAnswer = item.dataset.answer;
    };
  });
}

async function submitPracticeAnswer() {
  const data = state.practiceData;
  const userAns = state.practiceAnswer;
  const correct = userAns === data.answer;
  
  document.querySelectorAll('#practice-options .option-item').forEach(o => {
    o.style.pointerEvents = 'none';
    if (o.dataset.answer === data.answer) o.classList.add('correct');
    if (o.dataset.answer === userAns && !correct) o.classList.add('wrong');
  });
  
  $('practice-explain').style.display = 'block';
  $('practice-explain').innerHTML = `
    <div class="explanation-box">
      <h4>解析</h4>
      <p>正确答案：<strong style="color:var(--success)">${data.answer}</strong></p>
      <p>${data.explanation}</p>
      <p><strong>知识点：</strong>${data.knowledge_point || ''}</p>
    </div>
  `;
  
  await api('/practice/answer', {
    method: 'POST',
    body: {
      module: data.module, question: data.question, options: data.options,
      user_answer: userAns || '', correct_answer: data.answer, is_correct: correct,
      explanation: data.explanation, knowledge_point: data.knowledge_point, difficulty: data.difficulty
    }
  });
}

async function nextPracticeQuestion() {
  const module = state.practiceData?.module || 'grammar';
  const title = $('practice-modal-title').textContent;
  startPracticeModal(module, title);
}

function closePracticeModal() {
  $('practice-modal').style.display = 'none';
  loadHomeData();
}

// ===== 写作 =====
async function getNewWritingTopic() {
  const data = await api('/writing/topic');
  state.writingTopic = data;
  $('writing-topic').innerHTML = `<strong>写作题目：</strong><br>${data.topic}`;
  $('writing-input').value = '';
  $('writing-feedback').innerHTML = '';
}

async function submitWriting() {
  const essay = $('writing-input').value;
  if (essay.length < 20) { showToast('作文内容太短'); return; }
  
  $('writing-feedback').innerHTML = '<div class="loading"><div class="loading-spinner"></div><p style="margin-top:12px">AI正在批改...</p></div>';
  
  const result = await api('/writing/submit', {
    method: 'POST',
    body: { topic: state.writingTopic.topic, essay }
  });
  
  if (result.error) {
    $('writing-feedback').innerHTML = `<p style="color:var(--danger)">${result.error}</p>`;
    return;
  }
  
  renderWritingFeedback(result.feedback);
}

function renderWritingFeedback(fb) {
  let html = `
    <div class="feedback-score">
      <div class="feedback-score-num">${fb.score}</div>
      <div style="opacity:0.9">/ 15分</div>
    </div>
    <div class="feedback-section">
      <h4>📝 总体评价</h4>
      <p style="font-size:14px;line-height:1.7">${fb.overall_feedback}</p>
    </div>
    <div class="feedback-section">
      <h4>📋 各维度分析</h4>
      <p style="font-size:14px"><strong>切题度：</strong>${fb.task_response}</p>
      <p style="font-size:14px"><strong>结构：</strong>${fb.structure}</p>
      ${fb.grammar?.length ? `<p style="font-size:14px"><strong>语法问题：</strong>${fb.grammar.join('；')}</p>` : ''}
      ${fb.vocabulary?.length ? `<p style="font-size:14px"><strong>词汇问题：</strong>${fb.vocabulary.join('；')}</p>` : ''}
    </div>
  `;
  
  if (fb.sentence_by_sentence?.length > 0) {
    html += `<div class="feedback-section"><h4>✏️ 逐句分析</h4>`;
    fb.sentence_by_sentence.forEach(s => {
      html += `<div class="sentence-issue">
        <div class="original">${s.original}</div>
        <div style="margin:4px 0;color:var(--text-secondary)">${s.issue}</div>
        <div class="suggestion">→ ${s.suggestion}</div>
      </div>`;
    });
    html += `</div>`;
  }
  
  if (fb.good_expressions?.length > 0) {
    html += `<div class="feedback-section"><h4>✨ 优秀表达</h4><ul style="padding-left:20px;font-size:14px">${fb.good_expressions.map(e => `<li>${e}</li>`).join('')}</ul></div>`;
  }
  
  if (fb.revised_version && fb.revised_version !== 'AI服务未配置，无法生成修改版本') {
    html += `<div class="feedback-section"><h4>📖 修改版本</h4><p style="font-size:14px;line-height:1.8">${fb.revised_version}</p></div>`;
  }
  
  $('writing-feedback').innerHTML = html;
}

// ===== 翻译 =====
async function getNewTranslationTopic() {
  const data = await api('/translation/topic');
  state.translationTopic = data;
  $('translation-source').innerHTML = data.source;
  $('translation-input').value = '';
  $('translation-feedback').innerHTML = '';
}

async function submitTranslation() {
  const text = $('translation-input').value;
  if (text.length < 10) { showToast('翻译内容太短'); return; }
  
  $('translation-feedback').innerHTML = '<div class="loading"><div class="loading-spinner"></div><p style="margin-top:12px">AI正在批改...</p></div>';
  
  const result = await api('/translation/submit', {
    method: 'POST',
    body: { source_text: state.translationTopic.source, user_translation: text }
  });
  
  if (result.error) {
    $('translation-feedback').innerHTML = `<p style="color:var(--danger)">${result.error}</p>`;
    return;
  }
  
  renderTranslationFeedback(result.feedback);
}

function renderTranslationFeedback(fb) {
  let html = `
    <div class="feedback-score">
      <div class="feedback-score-num">${fb.score}</div>
      <div style="opacity:0.9">/ 15分</div>
    </div>
    <div class="feedback-section">
      <h4>📖 参考译文</h4>
      <div class="reference-translation">${fb.reference_translation}</div>
    </div>
    <div class="feedback-section">
      <h4>📝 总体评价</h4>
      <p style="font-size:14px;line-height:1.7">${fb.overall_feedback}</p>
    </div>
  `;
  
  if (fb.error_pairs?.length > 0) {
    html += `<div class="feedback-section"><h4>❌ 错误表达 → 推荐表达</h4>`;
    fb.error_pairs.forEach(p => {
      html += `<div class="error-pair">
        <span class="wrong">❌ ${p.wrong}</span> → <span class="correct">✅ ${p.correct}</span>
        <div style="color:var(--text-secondary);font-size:12px;margin-top:4px">${p.reason || ''}</div>
      </div>`;
    });
    html += `</div>`;
  }
  
  if (fb.vocabulary_issues?.length > 0) {
    html += `<div class="feedback-section"><h4>📚 词汇问题</h4><ul style="padding-left:20px;font-size:14px">${fb.vocabulary_issues.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  }
  if (fb.grammar_issues?.length > 0) {
    html += `<div class="feedback-section"><h4>✏️ 语法问题</h4><ul style="padding-left:20px;font-size:14px">${fb.grammar_issues.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
  }
  
  $('translation-feedback').innerHTML = html;
}

// ===== 错题本 =====
async function loadWrongQuestions(module = 'all') {
  const [data, stats] = await Promise.all([
    api(`/wrong/list?module=${module}&limit=50`),
    api('/wrong/stats')
  ]);
  
  // 统计
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  $('wrong-stats').innerHTML = `
    <div class="wrong-stat-item">总计: <strong>${stats.total}</strong>道</div>
    <div class="wrong-stat-item">待复习: <strong>${stats.dueCount}</strong>道</div>
    ${stats.topErrorTypes?.slice(0, 3).map(e => `<div class="wrong-stat-item">${e.error_type}: ${e.count}次</div>`).join('')}
  `;
  
  const list = $('wrong-list');
  if (data.questions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:30px">暂无错题</p>';
    return;
  }
  
  list.innerHTML = data.questions.map(q => `
    <div class="wrong-item">
      <div class="wrong-question">${q.content}</div>
      <div class="wrong-answers">
        <span class="wrong-user">你的答案: ${q.user_answer || '未作答'}</span>
        <span class="wrong-correct">正确答案: ${q.correct_answer}</span>
      </div>
      <div class="wrong-meta">
        <span class="tag tag-info">${moduleNames[q.module] || q.module}</span>
        ${q.knowledge_point ? `<span class="tag tag-warning">${q.knowledge_point}</span>` : ''}
        <span class="tag" style="background:var(--bg);color:var(--text-secondary)">错误${q.error_count}次</span>
        <span class="tag" style="background:var(--bg);color:var(--text-secondary)">掌握度${q.mastery_level}%</span>
      </div>
      <div class="wrong-actions">
        <button class="btn-primary" style="padding:6px 12px;font-size:12px" onclick="reviewWrongQuestion(${q.id}, true)">已掌握</button>
        <button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="reviewWrongQuestion(${q.id}, false)">再练一次</button>
      </div>
    </div>
  `).join('');
  
  // 绑定筛选
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadWrongQuestions(btn.dataset.module);
    };
  });
}

async function reviewWrongQuestion(id, correct) {
  await api('/wrong/master', { method: 'POST', body: { id, correct } });
  showToast(correct ? '已标记为掌握' : '已安排再次复习');
  loadWrongQuestions('all');
}

// ===== 模拟考试 =====
let mockExamData = null;
let mockTimer = null;
let mockTimeLeft = 0;

async function startMockExam() {
  const result = await api('/mock/start', { method: 'POST' });
  mockExamData = result;
  mockTimeLeft = result.exam.total_time * 60;
  
  const container = $('mock-content');
  container.innerHTML = `
    <div class="mock-timer" id="mock-timer">${formatTime(mockTimeLeft)}</div>
    <div id="mock-sections">
      ${renderMockSection('writing', '写作', result.exam.sections.writing)}
      ${renderMockSection('listening', '听力', result.exam.sections.listening)}
      ${renderMockSection('reading', '阅读', result.exam.sections.reading)}
      ${renderMockSection('vocabulary_grammar', '词汇与语法', result.exam.sections.vocabulary_grammar)}
      ${renderMockSection('translation', '翻译', result.exam.sections.translation)}
    </div>
    <button class="btn-primary btn-large" onclick="submitMockExam()">交卷</button>
  `;
  
  mockTimer = setInterval(() => {
    mockTimeLeft--;
    $('mock-timer').textContent = formatTime(mockTimeLeft);
    if (mockTimeLeft <= 0) {
      clearInterval(mockTimer);
      submitMockExam();
    }
  }, 1000);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderMockSection(key, name, section) {
  let html = `<div class="mock-section"><h3>${name}（${section.time}分钟）</h3>`;
  
  if (key === 'writing') {
    html += `<div class="question-text">${section.questions[0].topic}</div><textarea class="form-input" id="mock-writing" style="min-height:120px" placeholder="在此写作文..."></textarea>`;
  } else if (key === 'translation') {
    html += `<div class="question-text">${section.questions[0].source}</div><textarea class="form-input" id="mock-translation" style="min-height:80px" placeholder="在此输入翻译..."></textarea>`;
  } else if (key === 'reading') {
    section.questions.forEach(passage => {
      html += `<div class="practice-passage" style="margin-bottom:12px">${passage.passage}</div>`;
      passage.questions.forEach((q, i) => {
        html += `<div class="question-text" style="font-size:14px">${q.question}</div>`;
        html += `<div class="options-list" style="margin-bottom:16px">${q.options.map(opt => `<div class="option-item" data-mock-q="${key}-${i}" data-answer="${opt[0]}">${opt}</div>`).join('')}</div>`;
      });
    });
  } else {
    section.questions.forEach((q, i) => {
      html += `<div class="question-text" style="font-size:14px">${i+1}. ${q.question}</div>`;
      html += `<div class="options-list" style="margin-bottom:12px">${q.options.map(opt => `<div class="option-item" data-mock-q="${key}-${i}" data-answer="${opt[0]}">${opt}</div>`).join('')}</div>`;
    });
  }
  
  html += `</div>`;
  return html;
}

async function submitMockExam() {
  clearInterval(mockTimer);
  
  // 收集答案
  const answers = [];
  document.querySelectorAll('.option-item.selected[data-mock-q]').forEach(item => {
    answers.push({ question: item.closest('.mock-section').querySelector('.question-text')?.textContent || '', user_answer: item.dataset.answer, module: item.dataset.mockQ.split('-')[0] });
  });
  
  const writingEssay = $('mock-writing')?.value || '';
  const translationText = $('mock-translation')?.value || '';
  
  $('mock-content').innerHTML = '<div class="loading"><div class="loading-spinner"></div><p style="margin-top:12px">正在生成考试报告...</p></div>';
  
  const result = await api('/mock/submit', {
    method: 'POST',
    body: {
      exam_id: mockExamData.exam_id,
      answers,
      duration: mockExamData.exam.total_time * 60 - mockTimeLeft,
      writing_essay: writingEssay,
      translation_text: translationText
    }
  });
  
  renderMockReport(result.report);
}

function renderMockReport(report) {
  const container = $('mock-content');
  container.innerHTML = `
    <div class="report-score-card">
      <div class="report-score">${report.total_score}</div>
      <div class="report-score-label">AI训练估算分（满分710）</div>
      <div style="font-size:12px;opacity:0.8;margin-top:8px">${report.note}</div>
    </div>
    <div class="report-section">
      <h3>各模块得分</h3>
      <div class="ability-bar"><span class="ability-name">写作</span><div class="ability-track"><div class="ability-fill" style="width:${(report.section_scores.writing/106.5)*100}%;background:var(--danger)"></div></div><span class="ability-score">${report.section_scores.writing}</span></div>
      <div class="ability-bar"><span class="ability-name">听力</span><div class="ability-track"><div class="ability-fill" style="width:${(report.section_scores.listening/248.5)*100}%;background:var(--warning)"></div></div><span class="ability-score">${report.section_scores.listening}</span></div>
      <div class="ability-bar"><span class="ability-name">阅读</span><div class="ability-track"><div class="ability-fill" style="width:${(report.section_scores.reading/248.5)*100}%;background:var(--success)"></div></div><span class="ability-score">${report.section_scores.reading}</span></div>
      <div class="ability-bar"><span class="ability-name">翻译</span><div class="ability-track"><div class="ability-fill" style="width:${(report.section_scores.translation/106.5)*100}%;background:var(--secondary)"></div></div><span class="ability-score">${report.section_scores.translation}</span></div>
    </div>
    ${report.comparison ? `<div class="report-section"><h3>与上次对比</h3><p>上次：${report.comparison.previous_score}分，本次：${report.total_score}分，<strong style="color:${report.comparison.change >= 0 ? 'var(--success)' : 'var(--danger)'}">${report.comparison.change >= 0 ? '+' : ''}${report.comparison.change}分</strong></p></div>` : ''}
    <div class="report-section">
      <h3>下一阶段建议</h3>
      <ul style="padding-left:20px;font-size:14px;line-height:1.8">${report.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
    </div>
    <button class="btn-primary btn-large" onclick="loadMockHistory()">查看历史记录</button>
  `;
}

async function loadMockHistory() {
  const data = await api('/mock/history');
  const container = $('mock-history');
  if (data.exams.length === 0) {
    container.innerHTML = '<h3>历史记录</h3><p style="color:var(--text-secondary)">暂无历史记录</p>';
    return;
  }
  container.innerHTML = '<h3>历史记录</h3>' + data.exams.map(e => `
    <div class="mock-history-item">
      <div>
        <div style="font-weight:600">${e.created_at?.split(' ')[0] || ''}</div>
        <div style="font-size:12px;color:var(--text-secondary)">用时${Math.round((e.duration || 0)/60)}分钟</div>
      </div>
      <div class="mock-score">${e.total_score}</div>
    </div>
  `).join('');
}

// ===== 学习报告 =====
async function loadReport(tab = 'weekly') {
  document.querySelectorAll('.report-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
    t.onclick = () => loadReport(t.dataset.tab);
  });
  
  const container = $('report-content');
  
  if (tab === 'weekly') {
    const data = await api('/report/weekly');
    container.innerHTML = `
      <div class="weekly-summary">
        <div class="weekly-summary-item"><div class="weekly-summary-num">${data.totalMinutes}</div><div class="weekly-summary-label">学习时长(分)</div></div>
        <div class="weekly-summary-item"><div class="weekly-summary-num">${data.totalQuestions}</div><div class="weekly-summary-label">做题数</div></div>
        <div class="weekly-summary-item"><div class="weekly-summary-num">${data.overallAccuracy}%</div><div class="weekly-summary-label">正确率</div></div>
      </div>
      <div class="report-section">
        <h3>各模块正确率</h3>
        ${data.moduleAccuracy.map(m => `
          <div class="ability-bar">
            <span class="ability-name">${m.name}</span>
            <div class="ability-track"><div class="ability-fill" style="width:${m.accuracy}%;background:var(--primary)"></div></div>
            <span class="ability-score">${m.accuracy}%</span>
          </div>
        `).join('')}
      </div>
      <div class="report-section">
        <h3>🏆 本周进步最大</h3>
        <p>${data.bestModule ? `${data.bestModule.name}（正确率${data.bestModule.accuracy}%）` : '数据不足'}</p>
      </div>
      <div class="report-section">
        <h3>⚠️ 本周最严重问题</h3>
        <p>${data.worstModule ? `${data.worstModule.name}（正确率${data.worstModule.accuracy}%）` : '数据不足'}</p>
      </div>
      ${data.topErrors?.length > 0 ? `<div class="report-section"><h3>高频错误 TOP 5</h3>${data.topErrors.map((e, i) => `<div class="strength-item"><span class="tag tag-danger">TOP${i+1}</span><span>${e.error_type}（${e.count}次）</span></div>`).join('')}</div>` : ''}
      <div class="report-section">
        <h3>📋 下周重点</h3>
        <p>${data.nextWeekFocus}</p>
        <p style="margin-top:8px;color:var(--text-secondary);font-size:13px">建议每日学习时间：${data.suggestedDailyMinutes}分钟</p>
      </div>
    `;
  } else if (tab === 'ability') {
    const data = await api('/report/radar');
    container.innerHTML = `
      <div class="radar-container">
        <canvas id="radar-canvas" width="350" height="350"></canvas>
      </div>
      <div class="report-section">
        <h3>能力详情</h3>
        ${data.indicators.map(i => `
          <div class="ability-bar">
            <span class="ability-name">${i.name}</span>
            <div class="ability-track"><div class="ability-fill" style="width:${i.value}%;background:var(--primary)"></div></div>
            <span class="ability-score">${i.value}</span>
          </div>
        `).join('')}
      </div>
    `;
    drawRadar(data.indicators);
  } else if (tab === 'trend') {
    const data = await api('/report/trend');
    container.innerHTML = `
      <div class="report-section">
        <h3>最近学习记录</h3>
        ${data.studyTrend?.length > 0 ? data.studyTrend.map(r => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:14px">
            <span>${r.date}</span>
            <span>${r.study_minutes}分钟</span>
            <span style="color:${r.accuracy >= 60 ? 'var(--success)' : 'var(--danger)'}">${r.accuracy ? r.accuracy + '%' : '-'}</span>
          </div>
        `).join('') : '<p style="color:var(--text-secondary)">暂无数据</p>'}
      </div>
    `;
  }
}

// 绘制雷达图
function drawRadar(indicators) {
  const canvas = $('radar-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 175, cy = 175, radius = 120;
  const n = indicators.length;
  
  ctx.clearRect(0, 0, 350, 350);
  
  // 绘制网格
  for (let level = 1; level <= 5; level++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
      const r = radius * level / 5;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
  }
  
  // 绘制轴线
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    ctx.strokeStyle = '#E2E8F0';
    ctx.stroke();
  }
  
  // 绘制数据
  ctx.beginPath();
  indicators.forEach((ind, i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const r = radius * ind.value / 100;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(79, 70, 229, 0.2)';
  ctx.fill();
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // 绘制数据点
  indicators.forEach((ind, i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const r = radius * ind.value / 100;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#4F46E5';
    ctx.fill();
  });
  
  // 绘制标签
  ctx.fillStyle = '#1E293B';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  indicators.forEach((ind, i) => {
    const angle = (Math.PI * 2 * i / n) - Math.PI / 2;
    const x = cx + (radius + 25) * Math.cos(angle);
    const y = cy + (radius + 20) * Math.sin(angle);
    ctx.fillText(`${ind.name} ${ind.value}`, x, y);
  });
}

// ===== AI教练 =====
function initCoach() {
  loadChatHistory();
  $('btn-chat-send').onclick = sendChatMessage;
  $('chat-input').onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };
}

async function loadChatHistory() {
  const data = await api('/coach/history');
  const container = $('chat-messages');
  container.innerHTML = '';
  if (data.history.length === 0) {
    container.innerHTML = `<div class="chat-msg ai">你好！我是你的CET-4 AI教练。我会结合你的学习数据，给你最个性化的备考建议。有什么想问的吗？</div>`;
  } else {
    data.history.forEach(msg => {
      container.innerHTML += `<div class="chat-msg ${msg.role}">${msg.content.replace(/\n/g, '<br>')}</div>`;
    });
  }
  container.scrollTop = container.scrollHeight;
}

function sendQuickMessage(msg) {
  $('chat-input').value = msg;
  sendChatMessage();
}

async function sendChatMessage() {
  const input = $('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  
  const container = $('chat-messages');
  container.innerHTML += `<div class="chat-msg user">${msg}</div>`;
  input.value = '';
  container.scrollTop = container.scrollHeight;
  
  // AI正在输入
  container.innerHTML += `<div class="chat-msg ai" id="ai-typing"><div class="loading-spinner" style="width:16px;height:16px;border-width:2px"></div></div>`;
  container.scrollTop = container.scrollHeight;
  
  const result = await api('/coach/chat', { method: 'POST', body: { message: msg } });
  
  $('ai-typing')?.remove();
  container.innerHTML += `<div class="chat-msg ai">${result.reply.replace(/\n/g, '<br>')}</div>`;
  container.scrollTop = container.scrollHeight;
}

// ===== 学习计划 =====
async function loadPlan() {
  const data = await api('/study/timeline');
  const container = $('timeline-container');
  
  if (data.error) {
    container.innerHTML = `<div class="advice-card"><p style="color:var(--warning)">${data.error}</p><button class="btn-primary" style="margin-top:12px" onclick="navigateTo('profile')">去设置考试日期</button></div>`;
    return;
  }
  
  container.innerHTML = `
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:36px;font-weight:800;color:var(--primary)">${data.daysLeft}</div>
      <div style="color:var(--text-secondary)">距离考试（${data.examDate}）</div>
      <div style="margin-top:8px"><span class="tag tag-warning">当前阶段：${data.currentStage}</span></div>
    </div>
    ${data.stages.map(s => `
      <div class="timeline-item ${s.name === data.currentStage ? 'current' : ''}">
        <div class="timeline-title">${s.name}</div>
        <div class="timeline-date">${s.start} ~ ${s.end}</div>
        <ul class="timeline-goals">${s.goals.map(g => `<li>${g}</li>`).join('')}</ul>
      </div>
    `).join('')}
  `;
  
  // 本周建议
  const weekly = await api('/report/weekly');
  $('weekly-advice').innerHTML = `
    <p><strong>本周重点：</strong>${weekly.nextWeekFocus}</p>
    <p style="margin-top:8px"><strong>建议每日学习：</strong>${weekly.suggestedDailyMinutes}分钟</p>
    ${weekly.worstModule ? `<p style="margin-top:8px"><strong>最需加强：</strong>${weekly.worstModule.name}（正确率${weekly.worstModule.accuracy}%）</p>` : ''}
  `;
}

// ===== 个人设置 =====
async function loadProfile() {
  const data = await api('/user/profile');
  const container = $('profile-content');
  const u = data.user;
  
  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-row"><span class="profile-label">考试日期</span><span class="profile-value">${u.exam_date || '未设置'}</span></div>
      <div class="profile-row"><span class="profile-label">目标分数</span><span class="profile-value">${u.target_score || 425}分</span></div>
      <div class="profile-row"><span class="profile-label">每日学习时间</span><span class="profile-value">${u.daily_study_minutes || 60}分钟</span></div>
      <div class="profile-row"><span class="profile-label">每周学习天数</span><span class="profile-value">${u.weekly_days || 6}天</span></div>
      <div class="profile-row"><span class="profile-label">晚上空闲</span><span class="profile-value">${u.available_evening || '未设置'}</span></div>
      <div class="profile-row"><span class="profile-label">高考英语</span><span class="profile-value">${u.gaokao_english_score}分（初始参考）</span></div>
      <div class="profile-row"><span class="profile-label">诊断测试</span><span class="profile-value">${u.diagnostic_completed ? '已完成' : '未完成'}</span></div>
    </div>
    <div class="profile-card">
      <h3 style="margin-bottom:12px">能力画像</h3>
      ${['vocabulary','grammar','reading','listening','writing','translation'].map(k => {
        const names = {vocabulary:'词汇',grammar:'语法',reading:'阅读',listening:'听力',writing:'写作',translation:'翻译'};
        return `<div class="ability-bar"><span class="ability-name">${names[k]}</span><div class="ability-track"><div class="ability-fill" style="width:${data.profile[k]}%;background:var(--primary)"></div></div><span class="ability-score">${data.profile[k]}</span></div>`;
      }).join('')}
    </div>
    <button class="btn-secondary btn-large" onclick="navigateTo('setup')">修改档案设置</button>
  `;
}

// ===== 页面加载回调 =====
function onPageLoad(page) {
  switch (page) {
    case 'home': loadHomeData(); break;
    case 'vocabulary': loadVocabulary(); break;
    case 'writing': getNewWritingTopic(); break;
    case 'translation': getNewTranslationTopic(); break;
    case 'wrong': loadWrongQuestions('all'); break;
    case 'report': loadReport('weekly'); break;
    case 'coach': initCoach(); break;
    case 'plan': loadPlan(); break;
    case 'schedule': loadSchedule(); break;
    case 'profile': loadProfile(); break;
    case 'mock': loadMockHistory(); break;
  }
}

// ===== 底部导航 =====
document.querySelectorAll('.nav-item').forEach(item => {
  item.onclick = () => {
    const page = item.dataset.page;
    if (page === 'more') {
      $('more-modal').style.display = 'flex';
    } else {
      navigateTo(page);
    }
  };
});

document.querySelectorAll('.more-item').forEach(item => {
  item.onclick = () => {
    closeMoreModal();
    navigateTo(item.dataset.page);
  };
});

function closeMoreModal() {
  $('more-modal').style.display = 'none';
}

// 点击模态框外部关闭
$('more-modal').onclick = (e) => { if (e.target === $('more-modal')) closeMoreModal(); };
$('practice-modal').onclick = (e) => { if (e.target === $('practice-modal')) closePracticeModal(); };

// ===== 课表模块 =====
async function loadSchedule() {
  const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  
  // 加载今日课程
  const todayData = await api(`/schedule/day/${dayOfWeek}`);
  const todayContainer = $('today-classes');
  if (todayData.classes.length > 0) {
    todayContainer.innerHTML = `
      <div class="schedule-today-card">
        <div class="schedule-today-title">今天（${dayNames[dayOfWeek]}）有 ${todayData.classes.length} 节课</div>
        <div class="schedule-today-list">
          ${todayData.classes.map(c => `
            <div class="schedule-today-item">
              <div class="schedule-time">${c.start_time} - ${c.end_time}</div>
              <div class="schedule-course-info">
                <div class="schedule-course-name">${c.course_name}</div>
                <div class="schedule-course-meta">${c.teacher || ''} ${c.location ? '· ' + c.location : ''} ${c.week_range ? '· ' + c.week_range : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    todayContainer.innerHTML = `<div class="schedule-today-card"><div class="schedule-today-title">今天（${dayNames[dayOfWeek]}）无课，全天可安排学习</div></div>`;
  }
  
  // 设置周标签点击事件，默认选中今天
  document.querySelectorAll('.week-tab').forEach(tab => {
    tab.classList.toggle('active', parseInt(tab.dataset.day) === dayOfWeek);
    tab.onclick = () => {
      document.querySelectorAll('.week-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadDaySchedule(parseInt(tab.dataset.day));
    };
  });
  
  // 加载今天的详情和空闲时间
  loadDaySchedule(dayOfWeek);
}

async function loadDaySchedule(day) {
  const dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const [dayData, freeData] = await Promise.all([
    api(`/schedule/day/${day}`),
    api(`/schedule/free-slots/${day}`)
  ]);
  
  const container = $('day-schedule');
  if (dayData.classes.length > 0) {
    container.innerHTML = `
      <div class="schedule-day-title">${dayNames[day]} 课程安排</div>
      ${dayData.classes.map(c => `
        <div class="schedule-day-item">
          <div class="schedule-day-period">第${c.start_period}-${c.end_period}节</div>
          <div class="schedule-day-time">${c.start_time} - ${c.end_time}</div>
          <div class="schedule-day-course">
            <strong>${c.course_name}</strong>
            <span>${c.teacher || ''}</span>
            <span>${c.location || ''}</span>
            <span class="tag tag-info">${c.week_range || ''}</span>
          </div>
        </div>
      `).join('')}
    `;
  } else {
    container.innerHTML = `<div class="schedule-day-empty">${dayNames[day]}无课</div>`;
  }
  
  // 显示空闲时间段
  const freeContainer = $('free-slots');
  if (freeData.freeSlots && freeData.freeSlots.length > 0) {
    const totalFree = freeData.freeSlots.reduce((sum, s) => sum + s.duration, 0);
    freeContainer.innerHTML = `
      <div class="free-slots-title">⏰ ${dayNames[day]}可学习时间（共约${Math.round(totalFree/60)}小时）</div>
      <div class="free-slots-list">
        ${freeData.freeSlots.map(s => `
          <div class="free-slot-item">
            <span class="free-slot-time">${s.start} - ${s.end}</span>
            <span class="free-slot-duration">${s.duration}分钟</span>
          </div>
        `).join('')}
      </div>
      <div class="free-slots-hint">AI将根据这些空闲时段自动安排每日学习计划</div>
    `;
  }
}

// ===== 启动 =====
init();
