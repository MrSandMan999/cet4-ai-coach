const express = require('express');
const router = express.Router();
const db = require('../db/database');
const aiService = require('../ai/aiService');

// 获取错题列表
router.get('/list', (req, res) => {
  const { module, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  let query = "SELECT * FROM wrong_questions WHERE user_id='default'";
  let countQuery = "SELECT COUNT(*) as total FROM wrong_questions WHERE user_id='default'";
  const conditions = [];
  const params = [];
  
  if (module && module !== 'all') {
    conditions.push('module = ?');
    params.push(module);
  }
  
  if (conditions.length > 0) {
    query += ' AND ' + conditions.join(' AND ');
    countQuery += ' AND ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY error_count DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  const questions = db.prepare(query).all(...params).map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : []
  }));
  const total = db.prepare(countQuery).get(...params.slice(0, -2)).total;
  
  res.json({ questions, total, page: parseInt(page), limit: parseInt(limit) });
});

// 获取待复习错题
router.get('/due', (req, res) => {
  const questions = db.prepare(`
    SELECT * FROM wrong_questions 
    WHERE user_id='default' AND next_review <= date('now','localtime')
    ORDER BY mastery_level ASC, error_count DESC
    LIMIT 20
  `).all().map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : []
  }));
  res.json({ questions, count: questions.length });
});

// 标记错题已掌握
router.post('/master', (req, res) => {
  const { id, correct } = req.body;
  
  const wq = db.prepare('SELECT * FROM wrong_questions WHERE id=?').get(id);
  if (!wq) return res.json({ error: '错题不存在' });
  
  // 更新掌握度
  const newMastery = correct ? Math.min(100, wq.mastery_level + 25) : Math.max(0, wq.mastery_level - 10);
  
  // 计算下次复习时间
  let nextInterval;
  if (newMastery >= 90) nextInterval = 7;
  else if (newMastery >= 70) nextInterval = 3;
  else if (newMastery >= 50) nextInterval = 2;
  else nextInterval = 1;
  
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + nextInterval);
  
  db.prepare('UPDATE wrong_questions SET mastery_level=?, last_review=datetime(\'now\',\'localtime\'), next_review=? WHERE id=?').run(
    newMastery, nextReview.toISOString().split('T')[0], id
  );
  
  // 如果掌握度>=90，从错题本移除（已掌握）
  if (newMastery >= 90) {
    db.prepare('DELETE FROM wrong_questions WHERE id=?').run(id);
  }
  
  res.json({ success: true, mastery_level: newMastery });
});

// 删除错题
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM wrong_questions WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// 获取错题统计
router.get('/stats', (req, res) => {
  const byModule = db.prepare(`
    SELECT module, COUNT(*) as count, AVG(mastery_level) as avg_mastery
    FROM wrong_questions WHERE user_id='default'
    GROUP BY module
  `).all();
  
  const topErrorTypes = db.prepare(`
    SELECT error_type, COUNT(*) as count 
    FROM wrong_questions 
    WHERE user_id='default' AND error_type IS NOT NULL AND error_type != ''
    GROUP BY error_type 
    ORDER BY count DESC LIMIT 5
  `).all();
  
  const topKP = db.prepare(`
    SELECT knowledge_point, SUM(error_count) as errors
    FROM wrong_questions
    WHERE user_id='default' AND knowledge_point IS NOT NULL AND knowledge_point != ''
    GROUP BY knowledge_point
    ORDER BY errors DESC LIMIT 5
  `).all();
  
  const total = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id='default'").get().c;
  const dueCount = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id='default' AND next_review <= date('now','localtime')").get().c;
  
  res.json({ byModule, topErrorTypes, topKP, total, dueCount });
});

// 生成变式题（AI）
router.post('/variant', async (req, res) => {
  const { id } = req.body;
  
  if (!aiService.isAIEnabled()) {
    return res.json({ error: 'AI服务未配置，无法生成变式题' });
  }
  
  const wq = db.prepare('SELECT * FROM wrong_questions WHERE id=?').get(id);
  if (!wq) return res.json({ error: '错题不存在' });
  
  try {
    const variant = await aiService.generateVariantQuestion({
      module: wq.module,
      content: wq.content,
      knowledge_point: wq.knowledge_point,
      correct_answer: wq.correct_answer,
      error_type: wq.error_type
    });
    res.json({ success: true, variant, source: 'ai_generated' });
  } catch (e) {
    res.json({ error: '生成变式题失败: ' + e.message });
  }
});

module.exports = router;
