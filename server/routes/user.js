const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 获取用户档案
router.get('/profile', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get('default');
  const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id = ?').get('default');
  res.json({ user, profile });
});

// 更新用户档案
router.put('/profile', (req, res) => {
  const { exam_date, target_score, daily_study_minutes, weekly_days, available_morning, available_noon, available_afternoon, available_evening } = req.body;
  db.prepare(`UPDATE users SET 
    exam_date = COALESCE(?, exam_date),
    target_score = COALESCE(?, target_score),
    daily_study_minutes = COALESCE(?, daily_study_minutes),
    weekly_days = COALESCE(?, weekly_days),
    available_morning = COALESCE(?, available_morning),
    available_noon = COALESCE(?, available_noon),
    available_afternoon = COALESCE(?, available_afternoon),
    available_evening = COALESCE(?, available_evening)
    WHERE user_id = 'default'`).run(
    exam_date ?? null, target_score ?? null, daily_study_minutes ?? null, weekly_days ?? null,
    available_morning ?? null, available_noon ?? null, available_afternoon ?? null, available_evening ?? null
  );
  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get('default');
  res.json({ success: true, user });
});

// 获取能力画像
router.get('/ability', (req, res) => {
  const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id = ?').get('default');
  res.json(profile);
});

// 获取学习统计概览
router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  // 总学习天数
  const totalDays = db.prepare("SELECT COUNT(DISTINCT date) as count FROM study_records WHERE user_id='default' AND study_minutes > 0").get().count;
  
  // 总学习时长
  const totalMinutes = db.prepare("SELECT COALESCE(SUM(study_minutes),0) as total FROM study_records WHERE user_id='default'").get().total;
  
  // 总做题数
  const totalQuestions = db.prepare("SELECT COUNT(*) as count FROM user_answers WHERE user_id='default'").get().count;
  
  // 总正确率
  const accuracyRow = db.prepare("SELECT COALESCE(AVG(correct),0) as acc FROM user_answers WHERE user_id='default'").get();
  
  // 今日学习
  const todayRecord = db.prepare("SELECT * FROM study_records WHERE user_id='default' AND date=?").get(today);
  
  // 错题数
  const wrongCount = db.prepare("SELECT COUNT(*) as count FROM wrong_questions WHERE user_id='default'").get().count;
  
  // 最近7天学习
  const weekRecords = db.prepare(`
    SELECT date, study_minutes, accuracy FROM study_records 
    WHERE user_id='default' AND date >= date('now','-6 days','localtime') 
    ORDER BY date
  `).all();

  res.json({
    totalDays,
    totalMinutes,
    totalQuestions,
    overallAccuracy: Math.round((accuracyRow.acc || 0) * 100),
    today: todayRecord,
    wrongCount,
    weekRecords
  });
});

module.exports = router;
