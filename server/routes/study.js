const express = require('express');
const router = express.Router();
const db = require('../db/database');
const aiService = require('../ai/aiService');

// 获取今日学习计划
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const user = db.prepare('SELECT * FROM users WHERE user_id=?').get('default');
  const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id=?').get('default');
  
  // 查找今天已有计划
  let plan = db.prepare('SELECT * FROM daily_plans WHERE user_id=? AND date=?').get('default', today);
  
  if (!plan) {
    // 生成今日计划
    const tasks = generateDailyTasks(user, profile);
    const tasksJson = JSON.stringify(tasks);
    db.prepare('INSERT INTO daily_plans (user_id, date, tasks) VALUES (?, ?, ?)').run('default', today, tasksJson);
    plan = { date: today, tasks: tasksJson, completed: 0 };
  }
  
  // 计算完成度
  const tasks = JSON.parse(plan.tasks);
  const todayRecord = db.prepare('SELECT * FROM study_records WHERE user_id=? AND date=?').get('default', today);
  const completedCount = todayRecord?.completed_tasks || 0;
  const totalMinutes = tasks.reduce((sum, t) => sum + t.duration, 0);
  
  // 计算剩余天数
  let daysLeft = null;
  if (user.exam_date) {
    const exam = new Date(user.exam_date);
    const now = new Date();
    daysLeft = Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
  }
  
  // 找出最需要提升的模块
  const abilities = { vocabulary: profile.vocabulary, grammar: profile.grammar, reading: profile.reading, listening: profile.listening, writing: profile.writing, translation: profile.translation };
  const weakest = Object.entries(abilities).sort((a, b) => a[1] - b[1])[0];
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  
  // 计算今天星期几（1=周一, 7=周日）
  const dayOfWeek = new Date().getDay() === 0 ? 7 : new Date().getDay();
  
  res.json({
    date: today,
    daysLeft,
    totalMinutes,
    completedCount,
    totalTasks: tasks.length,
    completionRate: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
    weakestModule: weakest ? { module: weakest[0], name: moduleNames[weakest[0]], score: weakest[1] } : null,
    tasks: assignTimeSlots(tasks, user, dayOfWeek),
    dayOfWeek,
    todayRecord
  });
});

// 生成每日任务（基于能力画像和学习数据）
function generateDailyTasks(user, profile) {
  const dailyMinutes = user.daily_study_minutes || 60;
  const abilities = {
    vocabulary: profile.vocabulary,
    grammar: profile.grammar,
    reading: profile.reading,
    listening: profile.listening,
    writing: profile.writing,
    translation: profile.translation
  };
  
  // 计算各模块权重（弱项权重高）
  const totalAbility = Object.values(abilities).reduce((a, b) => a + b, 0);
  const weights = {};
  for (const [mod, score] of Object.entries(abilities)) {
    // 分数越低权重越高
    weights[mod] = Math.max(0.5, (100 - score) / 50);
  }
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  
  // 获取最近7天各模块练习次数，避免过度集中
  const recentAnswers = db.prepare(`
    SELECT module, COUNT(*) as count 
    FROM user_answers 
    WHERE user_id='default' AND created_at >= datetime('now','-7 days') 
    GROUP BY module
  `).all();
  const recentCount = {};
  recentAnswers.forEach(r => { recentCount[r.module] = r.count; });
  
  // 获取高频错题知识点
  const topWrongKPs = db.prepare(`
    SELECT module, knowledge_point, SUM(error_count) as errors 
    FROM wrong_questions 
    WHERE user_id='default' 
    GROUP BY knowledge_point 
    ORDER BY errors DESC LIMIT 5
  `).all();
  
  const tasks = [];
  let remainingMinutes = dailyMinutes;
  
  // 1. 错题复习（优先，10-15分钟）
  const wrongCount = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id='default' AND next_review <= date('now','localtime')").get().c;
  if (wrongCount > 0) {
    const reviewTime = Math.min(15, Math.max(10, Math.round(dailyMinutes * 0.15)));
    tasks.push({
      module: 'review',
      title: '错题复习',
      duration: reviewTime,
      content: `复习${Math.min(wrongCount, 10)}道待复习错题`,
      focus: '重点关注错误原因和知识点',
      knowledge_point: '错题回顾',
      priority: 1
    });
    remainingMinutes -= reviewTime;
  }
  
  // 2. 词汇（每天必有，15-25分钟）
  const vocabTime = Math.min(25, Math.max(15, Math.round(dailyMinutes * 0.25)));
  const wrongWords = db.prepare("SELECT COUNT(*) as c FROM user_vocabulary WHERE user_id='default' AND mastery_level < 50").get().c;
  tasks.push({
    module: 'vocabulary',
    title: '核心词汇',
    duration: vocabTime,
    content: wrongWords > 0 ? `学习20个新词 + 复习${Math.min(wrongWords, 15)}个错词` : '学习20个CET-4核心词汇',
    focus: '结合例句记忆，重点掌握熟词僻义和固定搭配',
    knowledge_point: '核心词汇',
    priority: 2
  });
  remainingMinutes -= vocabTime;
  
  // 3. 根据弱项分配剩余时间
  const sortedModules = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const moduleConfig = {
    reading: { title: '阅读训练', content: '1篇仔细阅读 + 精读分析', focus: '细节定位和同义替换识别', kp: '仔细阅读' },
    listening: { title: '听力训练', content: '1组听力精听', focus: '关键词捕捉和信息定位', kp: '听力精听' },
    grammar: { title: '语法专项', content: '1个语法知识点 + 10道练习题', focus: '掌握规则并能运用', kp: '语法专项' },
    writing: { title: '写作训练', content: '1篇作文或段落练习', focus: '结构、逻辑和高级表达', kp: '写作' },
    translation: { title: '翻译训练', content: '1段中译英练习', focus: '词汇选择和句式转换', kp: '翻译' }
  };
  
  // 分配2-3个模块
  const modulesToAssign = [];
  for (const [mod, weight] of sortedModules) {
    if (mod === 'vocabulary') continue;
    // 如果最近7天练得太多，适当降低优先级
    const recentModCount = recentCount[mod] || 0;
    const adjustedWeight = weight * Math.max(0.5, 1 - recentModCount * 0.05);
    modulesToAssign.push({ mod, weight: adjustedWeight });
  }
  modulesToAssign.sort((a, b) => b.weight - a.weight);
  
  const numModules = Math.min(3, Math.max(2, Math.floor(remainingMinutes / 20)));
  const selectedModules = modulesToAssign.slice(0, numModules);
  const selectedWeight = selectedModules.reduce((sum, m) => sum + m.weight, 0);
  
  for (const { mod, weight } of selectedModules) {
    const config = moduleConfig[mod];
    if (!config) continue;
    const time = Math.round((weight / selectedWeight) * remainingMinutes);
    if (time < 10) continue;
    
    // 检查是否有该模块的高频错题知识点
    const modWrongKP = topWrongKPs.find(w => w.module === mod);
    tasks.push({
      module: mod,
      title: config.title,
      duration: time,
      content: modWrongKP ? `${config.content}（重点：${modWrongKP.knowledge_point}）` : config.content,
      focus: config.focus,
      knowledge_point: modWrongKP?.knowledge_point || config.kp,
      priority: 3
    });
  }
  
  // 按优先级排序
  tasks.sort((a, b) => a.priority - b.priority);
  
  // 确保总时长不超过设定
  let total = tasks.reduce((sum, t) => sum + t.duration, 0);
  while (total > dailyMinutes + 5 && tasks.length > 2) {
    tasks.pop();
    total = tasks.reduce((sum, t) => sum + t.duration, 0);
  }
  
  return tasks;
}

// 根据课表和用户空闲时间分配时间段
function assignTimeSlots(tasks, user, dayOfWeek) {
  // 获取当天课表
  const classes = db.prepare(`
    SELECT cs.*, ts_start.start_time as start_time, ts_end.end_time as end_time
    FROM class_schedule cs
    LEFT JOIN time_slots ts_start ON cs.start_period = ts_start.period
    LEFT JOIN time_slots ts_end ON cs.end_period = ts_end.period
    WHERE cs.user_id = 'default' AND cs.day_of_week = ?
    ORDER BY cs.start_period
  `).all(dayOfWeek);
  
  // 计算上课时间段（分钟数）
  const busyRanges = classes.map(c => {
    const [sh, sm] = c.start_time.split(':').map(Number);
    const [eh, em] = c.end_time.split(':').map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em, name: c.course_name };
  }).sort((a, b) => a.start - b.start);
  
  // 用户设置的偏好空闲时段（作为优先选择）
  const preferredSlots = [];
  const timeRanges = [
    user.available_morning, user.available_noon,
    user.available_afternoon, user.available_evening
  ].filter(Boolean);
  for (const range of timeRanges) {
    const [start, end] = range.split('-');
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    preferredSlots.push({ start: sh * 60 + sm, end: eh * 60 + em });
  }
  
  // 计算所有可用空闲时间段（07:00-22:30，排除上课时间）
  const dayStart = 7 * 60;
  const dayEnd = 22 * 60 + 30;
  const allFreeSlots = [];
  let current = dayStart;
  
  for (const busy of busyRanges) {
    if (busy.start > current + 15) {
      allFreeSlots.push({ start: current, end: busy.start, duration: busy.start - current });
    }
    current = Math.max(current, busy.end);
  }
  if (current < dayEnd - 15) {
    allFreeSlots.push({ start: current, end: dayEnd, duration: dayEnd - current });
  }
  
  // 优先选择用户偏好的空闲时段，与可用空闲时段取交集
  let usableSlots = [];
  if (preferredSlots.length > 0) {
    for (const pref of preferredSlots) {
      for (const free of allFreeSlots) {
        const overlapStart = Math.max(pref.start, free.start);
        const overlapEnd = Math.min(pref.end, free.end);
        if (overlapEnd - overlapStart >= 15) {
          usableSlots.push({ start: overlapStart, end: overlapEnd, duration: overlapEnd - overlapStart });
        }
      }
    }
  }
  // 如果偏好时段没有可用的，使用所有空闲时段
  if (usableSlots.length === 0) {
    usableSlots = allFreeSlots.filter(s => s.duration >= 15);
  }
  
  // 按时段时长排序，优先用大的时段
  usableSlots.sort((a, b) => b.duration - a.duration);
  
  // 分配任务到时间段
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  
  let slotIndex = 0;
  let currentTime = usableSlots[0]?.start || (19 * 60);
  let currentSlotEnd = usableSlots[0]?.end || (21 * 60);
  
  return tasks.map(task => {
    const taskEnd = currentTime + task.duration;
    
    // 如果当前时段放不下，换到下一个时段
    if (taskEnd > currentSlotEnd && slotIndex < usableSlots.length - 1) {
      slotIndex++;
      currentTime = usableSlots[slotIndex].start;
      currentSlotEnd = usableSlots[slotIndex].end;
    }
    
    const startStr = fmt(currentTime);
    currentTime += task.duration;
    const endStr = fmt(currentTime);
    
    return { ...task, startTime: startStr, endTime: endStr };
  });
}

// 标记任务完成
router.post('/complete-task', (req, res) => {
  const { taskIndex, studyMinutes } = req.body;
  const today = new Date().toISOString().split('T')[0];
  
  let record = db.prepare('SELECT * FROM study_records WHERE user_id=? AND date=?').get('default', today);
  if (!record) {
    db.prepare('INSERT INTO study_records (user_id, date, study_minutes, completed_tasks, total_tasks) VALUES (?, ?, ?, 1, ?)').run(
      'default', today, studyMinutes || 0, 4
    );
  } else {
    db.prepare('UPDATE study_records SET study_minutes=study_minutes+?, completed_tasks=completed_tasks+1 WHERE id=?').run(
      studyMinutes || 0, record.id
    );
  }
  
  res.json({ success: true });
});

// 获取备考时间轴
router.get('/timeline', (req, res) => {
  const user = db.prepare('SELECT exam_date FROM users WHERE user_id=?').get('default');
  
  if (!user.exam_date) {
    return res.json({ error: '请设置准确考试日期，以生成精确的倒计时和学习计划。' });
  }
  
  const examDate = new Date(user.exam_date);
  const now = new Date();
  const daysLeft = Math.ceil((examDate - now) / (1000 * 60 * 60 * 24));
  
  // 计算各阶段
  const stages = [];
  const totalDays = daysLeft;
  
  // 第四阶段：考前冲刺（最后14天）
  const sprintStart = new Date(examDate);
  sprintStart.setDate(sprintStart.getDate() - 14);
  
  // 第三阶段：真题强化（冲刺前21天）
  const practiceStart = new Date(sprintStart);
  practiceStart.setDate(practiceStart.getDate() - 21);
  
  // 第二阶段：专项突破（真题前的时间，至少21天）
  const specialStart = new Date(practiceStart);
  specialStart.setDate(specialStart.getDate() - Math.max(21, Math.floor(totalDays * 0.3)));
  
  // 第一阶段：基础建立（现在到专项开始）
  stages.push({
    name: '基础建立',
    start: now.toISOString().split('T')[0],
    end: specialStart.toISOString().split('T')[0],
    goals: ['CET-4核心词汇', '基础语法', '长难句分析', '阅读基本方法', '听力基础', '写作基本结构', '翻译基本表达'],
    color: '#4F46E5'
  });
  
  if (specialStart > now) {
    stages.push({
      name: '专项突破',
      start: specialStart.toISOString().split('T')[0],
      end: practiceStart.toISOString().split('T')[0],
      goals: ['词汇强化', '听力专项', '阅读专项', '写作专项', '翻译专项', '根据诊断结果动态分配'],
      color: '#0EA5E9'
    });
  }
  
  if (practiceStart > now) {
    stages.push({
      name: '真题强化',
      start: practiceStart.toISOString().split('T')[0],
      end: sprintStart.toISOString().split('T')[0],
      goals: ['CET-4真题训练', '真题题型分析', '错题复盘', '答题节奏训练'],
      color: '#F59E0B'
    });
  }
  
  stages.push({
    name: '考前冲刺',
    start: sprintStart.toISOString().split('T')[0],
    end: user.exam_date,
    goals: ['真题模拟', '错题回顾', '高频词汇', '作文模板', '翻译高频话题', '时间管理', '考试策略'],
    color: '#EF4444'
  });
  
  // 确定当前阶段
  let currentStage = stages[0].name;
  for (const stage of stages) {
    if (now >= new Date(stage.start) && now <= new Date(stage.end)) {
      currentStage = stage.name;
      break;
    }
  }
  
  res.json({ daysLeft, examDate: user.exam_date, stages, currentStage });
});

module.exports = router;
