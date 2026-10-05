const express = require('express');
const router = express.Router();
const db = require('../db/database');
const aiService = require('../ai/aiService');
const { readingPractice, listeningQuestions } = require('../data/questions');

// 获取练习题（阅读/听力/语法）
router.get('/question', async (req, res) => {
  const { module, knowledge_point, difficulty } = req.query;
  
  // 优先从内置题库获取
  if (module === 'reading') {
    // 随机选一篇阅读
    const passage = readingPractice[Math.floor(Math.random() * readingPractice.length)];
    const q = passage.questions[Math.floor(Math.random() * passage.questions.length)];
    return res.json({
      module: 'reading',
      passage: passage.passage,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      knowledge_point: q.knowledge_point,
      difficulty: q.difficulty,
      source: 'builtin'
    });
  }
  
  if (module === 'listening') {
    const q = listeningQuestions[Math.floor(Math.random() * listeningQuestions.length)];
    return res.json({
      module: 'listening',
      transcript: q.transcript,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      knowledge_point: q.knowledge_point,
      difficulty: q.difficulty,
      source: 'builtin',
      note: '当前为文本模式，音频功能可扩展'
    });
  }
  
  if (module === 'grammar') {
    const { grammarQuestions } = require('../data/questions');
    const q = grammarQuestions[Math.floor(Math.random() * grammarQuestions.length)];
    return res.json({
      module: 'grammar',
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      knowledge_point: q.knowledge_point,
      difficulty: q.difficulty,
      source: 'builtin'
    });
  }
  
  // 如果AI启用，尝试AI生成个性化题目
  if (aiService.isAIEnabled() && knowledge_point) {
    try {
      const aiQuestion = await aiService.generatePracticeQuestion(module, knowledge_point, parseInt(difficulty) || 3);
      return res.json({ ...aiQuestion, module, source: 'ai_generated', is_ai_generated: true });
    } catch (e) {
      console.log('AI生成题目失败，使用内置题库:', e.message);
    }
  }
  
  res.json({ error: '暂无可练习题' });
});

// 提交答案并自动批改
router.post('/answer', (req, res) => {
  const { module, question, options, user_answer, correct_answer, is_correct, explanation, knowledge_point, error_type, difficulty, source, time_spent } = req.body;
  
  const correct = is_correct !== undefined ? is_correct : (user_answer === correct_answer);
  
  // 记录答题
  const info = db.prepare(`INSERT INTO user_answers (user_id, module, user_answer, correct, time_spent, error_type, created_at) 
    VALUES ('default', ?, ?, ?, ?, ?, datetime('now','localtime'))`).run(
    module, user_answer, correct ? 1 : 0, time_spent || 0, error_type || null
  );
  
  // 错题处理
  if (!correct) {
    const existing = db.prepare('SELECT id FROM wrong_questions WHERE user_id=? AND content=?').get('default', question || '');
    if (existing) {
      db.prepare('UPDATE wrong_questions SET error_count=error_count+1, last_review=datetime(\'now\',\'localtime\') WHERE id=?').run(existing.id);
    } else {
      db.prepare(`INSERT INTO wrong_questions (user_id, module, content, options, user_answer, correct_answer, error_type, knowledge_point, next_review) 
        VALUES ('default', ?, ?, ?, ?, ?, ?, ?, date('now','+1 day','localtime'))`).run(
        module, question || '', JSON.stringify(options || []), user_answer, correct_answer, error_type || '', knowledge_point || ''
      );
    }
  }
  
  // 更新知识点掌握度
  if (knowledge_point) {
    const kp = db.prepare('SELECT * FROM knowledge_points WHERE user_id=? AND module=? AND knowledge_point=?').get('default', module, knowledge_point);
    if (kp) {
      const newTotal = kp.total_count + 1;
      const newErrors = kp.error_count + (correct ? 0 : 1);
      const newMastery = Math.max(0, Math.round((1 - newErrors / newTotal) * 100));
      db.prepare('UPDATE knowledge_points SET total_count=?, error_count=?, mastery_level=?, last_review=datetime(\'now\',\'localtime\') WHERE id=?').run(newTotal, newErrors, newMastery, kp.id);
    } else {
      db.prepare('INSERT INTO knowledge_points (user_id, module, knowledge_point, mastery_level, error_count, total_count, last_review) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\',\'localtime\'))').run(
        'default', module, knowledge_point, correct ? 100 : 0, correct ? 0 : 1, 1
      );
    }
  }
  
  // 更新能力画像（滑动平均）
  if (correct !== undefined) {
    const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id=?').get('default');
    if (profile && profile[module] !== undefined) {
      const current = profile[module];
      // 答对+2，答错-3，平滑更新
      const delta = correct ? 2 : -3;
      const newValue = Math.max(0, Math.min(100, current + delta));
      db.prepare(`UPDATE ability_profile SET ${module}=?, updated_at=datetime('now','localtime') WHERE user_id='default'`).run(newValue);
    }
  }
  
  // 生成下一道题的建议知识点
  const nextKP = getNextKnowledgePoint(module, knowledge_point, correct);
  
  res.json({
    success: true,
    correct,
    answer_id: info.lastInsertRowid,
    next_knowledge_point: nextKP
  });
});

// 根据答题情况决定下一个知识点
function getNextKnowledgePoint(module, currentKP, correct) {
  if (!correct) {
    // 答错了，继续练同一个知识点
    return currentKP;
  }
  // 答对了，找一个薄弱知识点
  const weak = db.prepare(`
    SELECT knowledge_point FROM knowledge_points 
    WHERE user_id='default' AND module=? AND mastery_level < 60
    ORDER BY mastery_level ASC LIMIT 1
  `).get(module);
  return weak?.knowledge_point || null;
}

// 获取一组阅读题（完整文章+多题）
router.get('/reading-set', (req, res) => {
  const passage = readingPractice[Math.floor(Math.random() * readingPractice.length)];
  res.json({
    passage: passage.passage,
    questions: passage.questions,
    source: 'builtin'
  });
});

module.exports = router;
