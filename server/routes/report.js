const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 获取周报
router.get('/weekly', (req, res) => {
  // 最近7天数据
  const weekData = db.prepare(`
    SELECT 
      COALESCE(SUM(study_minutes), 0) as total_minutes,
      COALESCE(SUM(completed_tasks), 0) as total_tasks,
      COUNT(*) as study_days
    FROM study_records 
    WHERE user_id='default' AND date >= date('now','-6 days','localtime')
  `).get();
  
  // 各模块正确率
  const moduleAccuracy = db.prepare(`
    SELECT module, 
      COUNT(*) as total,
      SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) as correct_count,
      ROUND(AVG(correct)*100, 1) as accuracy
    FROM user_answers 
    WHERE user_id='default' AND created_at >= datetime('now','-7 days')
    GROUP BY module
  `).all();
  
  // 总体正确率
  const overall = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) as correct_count
    FROM user_answers 
    WHERE user_id='default' AND created_at >= datetime('now','-7 days')
  `).get();
  
  // 高频错误TOP5
  const topErrors = db.prepare(`
    SELECT error_type, COUNT(*) as count, module
    FROM user_answers 
    WHERE user_id='default' AND correct=0 AND error_type IS NOT NULL AND error_type != ''
      AND created_at >= datetime('now','-7 days')
    GROUP BY error_type 
    ORDER BY count DESC LIMIT 5
  `).all();
  
  // 能力变化（对比上周）
  const currentProfile = db.prepare('SELECT * FROM ability_profile WHERE user_id=?').get('default');
  
  // 高频错题知识点
  const topWrongKP = db.prepare(`
    SELECT knowledge_point, module, SUM(error_count) as errors
    FROM wrong_questions
    WHERE user_id='default'
    GROUP BY knowledge_point
    ORDER BY errors DESC LIMIT 5
  `).all();
  
  // 找出进步最大和最严重问题
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  
  const accMap = {};
  moduleAccuracy.forEach(m => { accMap[m.module] = m.accuracy; });
  
  const sortedByAcc = Object.entries(accMap).sort((a, b) => b[1] - a[1]);
  const bestModule = sortedByAcc[0] ? { module: sortedByAcc[0][0], name: moduleNames[sortedByAcc[0][0]], accuracy: sortedByAcc[0][1] } : null;
  const worstModule = sortedByAcc[sortedByAcc.length - 1] ? { module: sortedByAcc[sortedByAcc.length-1][0], name: moduleNames[sortedByAcc[sortedByAcc.length-1][0]], accuracy: sortedByAcc[sortedByAcc.length-1][1] } : null;
  
  // 下周建议
  const user = db.prepare('SELECT daily_study_minutes FROM users WHERE user_id=?').get('default');
  const nextWeekFocus = worstModule ? `重点加强${worstModule.name}训练，每天分配更多时间` : '保持各模块均衡训练';
  
  res.json({
    period: '最近7天',
    totalMinutes: weekData.total_minutes,
    totalTasks: weekData.total_tasks,
    studyDays: weekData.study_days,
    totalQuestions: overall.total,
    overallAccuracy: overall.total > 0 ? Math.round((overall.correct_count / overall.total) * 100) : 0,
    moduleAccuracy: moduleAccuracy.map(m => ({ ...m, name: moduleNames[m.module] || m.module })),
    topErrors,
    topWrongKP,
    bestModule,
    worstModule,
    currentAbilities: {
      vocabulary: currentProfile.vocabulary,
      grammar: currentProfile.grammar,
      reading: currentProfile.reading,
      listening: currentProfile.listening,
      writing: currentProfile.writing,
      translation: currentProfile.translation
    },
    nextWeekFocus,
    suggestedDailyMinutes: user?.daily_study_minutes || 60
  });
});

// 获取今日报告
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  const record = db.prepare('SELECT * FROM study_records WHERE user_id=? AND date=?').get('default', today);
  
  const todayAnswers = db.prepare(`
    SELECT module, COUNT(*) as total, SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END) as correct
    FROM user_answers 
    WHERE user_id='default' AND date(created_at)=date('now','localtime')
    GROUP BY module
  `).all();
  
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  
  res.json({
    date: today,
    record,
    moduleStats: todayAnswers.map(a => ({
      ...a,
      name: moduleNames[a.module] || a.module,
      accuracy: a.total > 0 ? Math.round((a.correct / a.total) * 100) : 0
    }))
  });
});

// 获取能力雷达图数据
router.get('/radar', (req, res) => {
  const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id=?').get('default');
  res.json({
    indicators: [
      { name: '词汇', value: profile.vocabulary },
      { name: '语法', value: profile.grammar },
      { name: '阅读', value: profile.reading },
      { name: '听力', value: profile.listening },
      { name: '写作', value: profile.writing },
      { name: '翻译', value: profile.translation }
    ]
  });
});

// 获取学习趋势（最近30天）
router.get('/trend', (req, res) => {
  const records = db.prepare(`
    SELECT date, study_minutes, accuracy
    FROM study_records 
    WHERE user_id='default' AND date >= date('now','-29 days','localtime')
    ORDER BY date
  `).all();
  
  const abilityHistory = db.prepare(`
    SELECT date(created_at) as date, 
      AVG(vocabulary) as vocab, AVG(grammar) as grammar, AVG(reading) as reading,
      AVG(listening) as listening, AVG(writing) as writing, AVG(translation) as translation
    FROM (
      SELECT created_at, vocabulary, grammar, reading, listening, writing, translation
      FROM ability_profile_history
      WHERE user_id='default'
      UNION ALL
      SELECT datetime('now','localtime'), vocabulary, grammar, reading, listening, writing, translation
      FROM ability_profile WHERE user_id='default'
    )
    GROUP BY date(created_at)
    ORDER BY date
    LIMIT 30
  `).all();
  
  res.json({ studyTrend: records, abilityTrend: abilityHistory });
});

module.exports = router;
