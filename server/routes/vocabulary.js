const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 获取今日词汇（新词+复习词）
router.get('/daily', (req, res) => {
  const count = parseInt(req.query.count) || 20;
  
  // 获取需要复习的词（间隔复习机制）
  const reviewWords = db.prepare(`
    SELECT v.*, uv.mastery_level, uv.error_count, uv.review_count, uv.last_review, uv.next_review
    FROM vocabulary v
    LEFT JOIN user_vocabulary uv ON v.word = uv.word AND uv.user_id = 'default'
    WHERE uv.next_review <= date('now','localtime') OR uv.next_review IS NULL
    ORDER BY uv.mastery_level ASC, v.frequency DESC
    LIMIT ?
  `).all(Math.floor(count * 0.4));
  
  // 获取新词
  const learnedWords = db.prepare("SELECT word FROM user_vocabulary WHERE user_id='default'").all().map(w => w.word);
  const placeholders = learnedWords.length > 0 ? learnedWords.map(() => '?').join(',') : 'NULL';
  const newWords = db.prepare(`
    SELECT * FROM vocabulary 
    WHERE word NOT IN (${placeholders})
    ORDER BY frequency DESC, RANDOM()
    LIMIT ?
  `).all(...learnedWords, count - reviewWords.length);
  
  // 合并并打乱
  const allWords = [...reviewWords, ...newWords].sort(() => Math.random() - 0.5);
  
  res.json({ words: allWords, newCount: newWords.length, reviewCount: reviewWords.length });
});

// 获取词汇列表（分页/分类）
router.get('/list', (req, res) => {
  const { category, page = 1, limit = 50, search } = req.query;
  const offset = (page - 1) * limit;
  
  let query = 'SELECT v.*, uv.mastery_level FROM vocabulary v LEFT JOIN user_vocabulary uv ON v.word=uv.word AND uv.user_id=\'default\'';
  let countQuery = 'SELECT COUNT(*) as total FROM vocabulary';
  const conditions = [];
  const params = [];
  
  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(word LIKE ? OR meaning LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
    countQuery += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY frequency DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  const words = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...params.slice(0, -2)).total;
  
  res.json({ words, total, page: parseInt(page), limit: parseInt(limit) });
});

// 提交词汇学习结果
router.post('/answer', (req, res) => {
  const { word, correct, review_type } = req.body;
  
  let uv = db.prepare('SELECT * FROM user_vocabulary WHERE user_id=? AND word=?').get('default', word);
  
  if (!uv) {
    db.prepare('INSERT INTO user_vocabulary (user_id, word, mastery_level, error_count, review_count, last_review, next_review) VALUES (?, ?, ?, ?, 1, datetime(\'now\',\'localtime\'), ?)').run(
      'default', word, correct ? 60 : 20, correct ? 0 : 1, calculateNextReview(correct ? 60 : 20, 1)
    );
  } else {
    const newReviewCount = uv.review_count + 1;
    const newErrorCount = uv.error_count + (correct ? 0 : 1);
    // 掌握度调整：答对+10，答错-20，范围0-100
    let newMastery = correct ? Math.min(100, uv.mastery_level + 10) : Math.max(0, uv.mastery_level - 20);
    const nextReview = calculateNextReview(newMastery, newReviewCount);
    
    db.prepare('UPDATE user_vocabulary SET mastery_level=?, error_count=?, review_count=?, last_review=datetime(\'now\',\'localtime\'), next_review=? WHERE id=?').run(
      newMastery, newErrorCount, newReviewCount, nextReview, uv.id
    );
  }
  
  // 记录答题
  db.prepare(`INSERT INTO user_answers (user_id, module, user_answer, correct, created_at) VALUES ('default', 'vocabulary', ?, ?, datetime('now','localtime'))`).run(
    word, correct ? 1 : 0
  );
  
  res.json({ success: true });
});

// 间隔复习算法（简化版SM-2）
function calculateNextReview(mastery, reviewCount) {
  const intervals = [1, 2, 4, 7, 15, 30]; // 天
  let interval;
  if (mastery >= 90) {
    interval = intervals[Math.min(5, reviewCount)] || 30;
  } else if (mastery >= 70) {
    interval = intervals[Math.min(4, reviewCount)] || 15;
  } else if (mastery >= 50) {
    interval = intervals[Math.min(3, reviewCount)] || 7;
  } else if (mastery >= 30) {
    interval = intervals[Math.min(2, reviewCount)] || 4;
  } else {
    interval = 1;
  }
  const date = new Date();
  date.setDate(date.getDate() + interval);
  return date.toISOString().split('T')[0];
}

// 获取错词列表
router.get('/wrong', (req, res) => {
  const words = db.prepare(`
    SELECT v.*, uv.mastery_level, uv.error_count, uv.last_review, uv.next_review
    FROM user_vocabulary uv
    JOIN vocabulary v ON uv.word = v.word
    WHERE uv.user_id='default' AND uv.mastery_level < 60
    ORDER BY uv.error_count DESC, uv.mastery_level ASC
    LIMIT 100
  `).all();
  res.json({ words });
});

// 获取词汇学习统计
router.get('/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as c FROM vocabulary').get().c;
  const learned = db.prepare("SELECT COUNT(*) as c FROM user_vocabulary WHERE user_id='default'").get().c;
  const mastered = db.prepare("SELECT COUNT(*) as c FROM user_vocabulary WHERE user_id='default' AND mastery_level >= 80").get().c;
  const weak = db.prepare("SELECT COUNT(*) as c FROM user_vocabulary WHERE user_id='default' AND mastery_level < 50").get().c;
  const todayReview = db.prepare("SELECT COUNT(*) as c FROM user_vocabulary WHERE user_id='default' AND next_review <= date('now','localtime')").get().c;
  
  res.json({ total, learned, mastered, weak, todayReview, progress: Math.round((learned / total) * 100) });
});

module.exports = router;
