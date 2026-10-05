const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { vocabularyQuestions, grammarQuestions, readingQuestions, listeningQuestions } = require('../data/questions');

// 开始模拟考试
router.post('/start', (req, res) => {
  // 生成一套模拟题（从内置题库组合）
  const exam = {
    started_at: new Date().toISOString(),
    sections: {
      writing: { time: 30, questions: [{ topic: 'Directions: For this part, you are allowed 30 minutes to write a short essay on the importance of perseverance. You should write at least 120 words but no more than 180 words.' }] },
      listening: { time: 25, questions: listeningQuestions },
      reading: { time: 40, questions: readingQuestions },
      translation: { time: 30, questions: [{ source: '中国的茶文化源远流长，可以追溯到几千年前。茶不仅是一种饮品，更是中国传统文化的重要组成部分。' }] },
      vocabulary_grammar: { time: 15, questions: [...vocabularyQuestions.slice(0, 5), ...grammarQuestions.slice(0, 5)] }
    },
    total_time: 140
  };
  
  const examId = db.prepare(`INSERT INTO mock_exams (user_id, started_at, created_at) VALUES ('default', ?, datetime('now','localtime'))`).run(
    exam.started_at
  ).lastInsertRowid;
  
  res.json({ exam_id: examId, exam });
});

// 提交模拟考试
router.post('/submit', (req, res) => {
  const { exam_id, answers, duration, writing_essay, translation_text } = req.body;
  
  // 计算各部分得分
  let vocabCorrect = 0, vocabTotal = 0;
  let grammarCorrect = 0, grammarTotal = 0;
  let readingCorrect = 0, readingTotal = 0;
  let listeningCorrect = 0, listeningTotal = 0;
  
  const allQuestions = [...vocabularyQuestions, ...grammarQuestions];
  for (const ans of answers || []) {
    const q = allQuestions.find(x => x.question === ans.question);
    if (q) {
      if (ans.module === 'vocabulary') { vocabTotal++; if (ans.user_answer === q.answer) vocabCorrect++; }
      if (ans.module === 'grammar') { grammarTotal++; if (ans.user_answer === q.answer) grammarCorrect++; }
    }
  }
  
  // 阅读
  for (const passage of readingQuestions) {
    for (const q of passage.questions) {
      readingTotal++;
      const ans = answers?.find(a => a.question === q.question);
      if (ans && ans.user_answer === q.answer) readingCorrect++;
    }
  }
  
  // 听力
  for (const q of listeningQuestions) {
    listeningTotal++;
    const ans = answers?.find(a => a.question === q.question);
    if (ans && ans.user_answer === q.answer) listeningCorrect++;
  }
  
  // 估算分数（CET-4满分710，各部分占比）
  // 写作15%、听力35%、阅读35%、翻译15%
  const writingScore = writing_essay ? Math.min(106.5, 60 + writing_essay.split(/\s+/).length * 0.3) : 0; // 0-106.5
  const listeningScore = listeningTotal > 0 ? (listeningCorrect / listeningTotal) * 248.5 : 0; // 0-248.5
  const readingScore = readingTotal > 0 ? (readingCorrect / readingTotal) * 248.5 : 0; // 0-248.5
  const translationScore = translation_text ? Math.min(106.5, 50 + translation_text.split(/\s+/).length * 0.4) : 0; // 0-106.5
  
  const totalScore = Math.round(writingScore + listeningScore + readingScore + translationScore);
  
  const sectionScores = {
    writing: Math.round(writingScore),
    listening: Math.round(listeningScore),
    reading: Math.round(readingScore),
    translation: Math.round(translationScore),
    vocabulary_grammar: vocabTotal > 0 ? Math.round((vocabCorrect + grammarCorrect) / (vocabTotal + grammarTotal) * 100) : 0
  };
  
  // 更新考试记录
  db.prepare(`UPDATE mock_exams SET completed_at=datetime('now','localtime'), total_score=?, section_scores=?, answers=?, duration=? WHERE id=?`).run(
    totalScore, JSON.stringify(sectionScores), JSON.stringify(answers || []), duration || 0, exam_id
  );
  
  // 与上一次对比
  const prevExam = db.prepare("SELECT total_score FROM mock_exams WHERE user_id='default' AND id < ? AND total_score IS NOT NULL ORDER BY id DESC LIMIT 1").get(exam_id);
  
  // 薄弱知识点
  const weakKP = db.prepare(`
    SELECT knowledge_point, COUNT(*) as errors
    FROM user_answers
    WHERE user_id='default' AND correct=0 AND created_at >= datetime('now','-1 day')
    GROUP BY knowledge_point
    ORDER BY errors DESC LIMIT 5
  `).all();
  
  const report = {
    exam_id,
    total_score: totalScore,
    note: 'AI训练估算，仅用于学习参考，非官方CET-4成绩',
    section_scores: sectionScores,
    accuracy: {
      vocabulary: vocabTotal > 0 ? Math.round((vocabCorrect / vocabTotal) * 100) : 0,
      grammar: grammarTotal > 0 ? Math.round((grammarCorrect / grammarTotal) * 100) : 0,
      reading: readingTotal > 0 ? Math.round((readingCorrect / readingTotal) * 100) : 0,
      listening: listeningTotal > 0 ? Math.round((listeningCorrect / listeningTotal) * 100) : 0
    },
    comparison: prevExam ? { previous_score: prevExam.total_score, change: totalScore - prevExam.total_score } : null,
    weak_points: weakKP,
    suggestions: generateSuggestions(sectionScores, weakKP)
  };
  
  res.json({ success: true, report });
});

function generateSuggestions(scores, weakKP) {
  const suggestions = [];
  if (scores.listening < 150) suggestions.push('听力较弱，建议每天精听1组，重点训练关键词捕捉');
  if (scores.reading < 150) suggestions.push('阅读较弱，建议加强定位训练和长难句分析');
  if (scores.writing < 70) suggestions.push('写作需提升，建议学习范文结构，积累高级表达和连接词');
  if (scores.translation < 70) suggestions.push('翻译需加强，建议积累中国文化相关词汇和句型');
  if (suggestions.length === 0) suggestions.push('各模块表现均衡，继续保持，重点突破薄弱知识点');
  return suggestions;
}

// 获取模拟考试历史
router.get('/history', (req, res) => {
  const exams = db.prepare("SELECT * FROM mock_exams WHERE user_id='default' AND total_score IS NOT NULL ORDER BY id DESC LIMIT 10").all();
  res.json({ exams });
});

module.exports = router;
