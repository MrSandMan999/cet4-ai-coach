const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { vocabularyQuestions, grammarQuestions, readingQuestions, translationQuestions, writingQuestions, listeningQuestions } = require('../data/questions');

// 获取诊断测试题目
router.get('/questions', (req, res) => {
  const { module } = req.query;
  
  let questions = [];
  if (!module || module === 'all') {
    // 返回所有模块的诊断题
    questions = {
      vocabulary: vocabularyQuestions,
      grammar: grammarQuestions,
      reading: readingQuestions,
      listening: listeningQuestions,
      translation: translationQuestions,
      writing: writingQuestions
    };
  } else if (module === 'vocabulary') {
    questions = vocabularyQuestions;
  } else if (module === 'grammar') {
    questions = grammarQuestions;
  } else if (module === 'reading') {
    questions = readingQuestions;
  } else if (module === 'listening') {
    questions = listeningQuestions;
  } else if (module === 'translation') {
    questions = translationQuestions;
  } else if (module === 'writing') {
    questions = writingQuestions;
  }
  
  res.json(questions);
});

// 提交诊断测试结果，生成能力画像
router.post('/submit', (req, res) => {
  const { results } = req.body;
  // results: { vocabulary: {correct, total}, grammar: {...}, reading: {...}, listening: {...}, translation: score, writing: score }
  
  // 计算各模块能力值（0-100）
  const calcAbility = (correct, total) => total > 0 ? Math.round((correct / total) * 100) : 50;
  
  const vocabulary = calcAbility(results.vocabulary?.correct || 0, results.vocabulary?.total || 8);
  const grammar = calcAbility(results.grammar?.correct || 0, results.grammar?.total || 10);
  const reading = calcAbility(results.reading?.correct || 0, results.reading?.total || 4);
  const listening = calcAbility(results.listening?.correct || 0, results.listening?.total || 2);
  const writing = results.writing?.score ? Math.round((results.writing.score / 15) * 100) : 50;
  const translation = results.translation?.score ? Math.round((results.translation.score / 15) * 100) : 50;
  
  // 更新能力画像
  db.prepare(`UPDATE ability_profile SET 
    vocabulary=?, grammar=?, reading=?, listening=?, writing=?, translation=?,
    updated_at=datetime('now','localtime')
    WHERE user_id='default'`).run(vocabulary, grammar, reading, listening, writing, translation);
  
  // 标记诊断完成
  db.prepare("UPDATE users SET diagnostic_completed=1 WHERE user_id='default'").run();
  
  // 记录答题
  if (results.answers) {
    const insertAnswer = db.prepare(`INSERT INTO user_answers (user_id, question_id, module, user_answer, correct, error_type, created_at) VALUES ('default', ?, ?, ?, ?, ?, datetime('now','localtime'))`);
    for (const ans of results.answers) {
      insertAnswer.run(ans.question_id || null, ans.module, ans.user_answer, ans.correct ? 1 : 0, ans.error_type || null);
      
      // 错题自动加入错题本
      if (!ans.correct) {
        const existing = db.prepare('SELECT id FROM wrong_questions WHERE user_id=? AND content=?').get('default', ans.content || '');
        if (existing) {
          db.prepare('UPDATE wrong_questions SET error_count=error_count+1, last_review=datetime(\'now\',\'localtime\') WHERE id=?').run(existing.id);
        } else {
          db.prepare(`INSERT INTO wrong_questions (user_id, module, question_type, content, options, user_answer, correct_answer, error_type, knowledge_point, next_review) 
            VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, date('now','+1 day','localtime'))`).run(
            ans.module, ans.question_type || '', ans.content || '', JSON.stringify(ans.options || []), ans.user_answer, ans.correct_answer, ans.error_type || '', ans.knowledge_point || ''
          );
        }
      }
      
      // 更新知识点掌握度
      if (ans.knowledge_point) {
        const kp = db.prepare('SELECT * FROM knowledge_points WHERE user_id=? AND module=? AND knowledge_point=?').get('default', ans.module, ans.knowledge_point);
        if (kp) {
          const newTotal = kp.total_count + 1;
          const newErrors = kp.error_count + (ans.correct ? 0 : 1);
          const newMastery = Math.max(0, Math.round((1 - newErrors / newTotal) * 100));
          db.prepare('UPDATE knowledge_points SET total_count=?, error_count=?, mastery_level=?, last_review=datetime(\'now\',\'localtime\') WHERE id=?').run(newTotal, newErrors, newMastery, kp.id);
        } else {
          db.prepare('INSERT INTO knowledge_points (user_id, module, knowledge_point, mastery_level, error_count, total_count, last_review) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\',\'localtime\'))').run(
            'default', ans.module, ans.knowledge_point, ans.correct ? 100 : 0, ans.correct ? 0 : 1, 1
          );
        }
      }
    }
  }
  
  // 生成诊断报告
  const abilities = { vocabulary, grammar, reading, listening, writing, translation };
  const sorted = Object.entries(abilities).sort((a, b) => b[1] - a[1]);
  const strengths = sorted.slice(0, 3).map(([k, v]) => ({ module: k, score: v }));
  const weaknesses = sorted.slice(-3).reverse().map(([k, v]) => ({ module: k, score: v }));
  
  const moduleNames = {
    vocabulary: '词汇', grammar: '语法', reading: '阅读',
    listening: '听力', writing: '写作', translation: '翻译'
  };
  
  // 确定学习阶段
  const avgScore = Object.values(abilities).reduce((a, b) => a + b, 0) / 6;
  let stage, stageDesc;
  if (avgScore < 40) {
    stage = '基础建立';
    stageDesc = '当前基础较薄弱，需要从核心词汇和基础语法开始系统学习。';
  } else if (avgScore < 60) {
    stage = '基础建立→专项突破';
    stageDesc = '有一定基础但不够扎实，需要巩固基础同时开始专项训练。';
  } else if (avgScore < 75) {
    stage = '专项突破';
    stageDesc = '基础尚可，需要针对薄弱模块进行专项突破。';
  } else {
    stage = '真题强化';
    stageDesc = '基础扎实，可以进入真题训练和冲刺阶段。';
  }
  
  // 计算剩余天数
  const user = db.prepare('SELECT exam_date, daily_study_minutes FROM users WHERE user_id=?').get('default');
  let daysLeft = null;
  if (user.exam_date) {
    const exam = new Date(user.exam_date);
    const now = new Date();
    daysLeft = Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
  }
  
  const report = {
    abilities,
    strengths: strengths.map(s => ({ ...s, name: moduleNames[s.module] })),
    weaknesses: weaknesses.map(w => ({ ...w, name: moduleNames[w.module] })),
    topPriority: weaknesses[0] ? { module: weaknesses[0].module, name: moduleNames[weaknesses[0].module], score: weaknesses[0].score } : null,
    stage,
    stageDesc,
    daysLeft,
    suggestedDailyMinutes: user.daily_study_minutes || 60,
    overallScore: Math.round(avgScore),
    recommendations: generateRecommendations(weaknesses, stage)
  };
  
  res.json({ success: true, report });
});

function generateRecommendations(weaknesses, stage) {
  const recs = [];
  const moduleAdvice = {
    vocabulary: '每天坚持背诵20-30个核心词汇，结合例句和语境记忆，重点复习错词。',
    grammar: '系统复习时态、从句、非谓语动词等核心语法点，每学一个知识点配合专项练习。',
    reading: '每天至少做1篇仔细阅读，训练定位能力和同义替换识别，做完后精读分析长难句。',
    listening: '每天坚持精听1组听力，先做题再看原文，重点训练关键词捕捉和同义替换。',
    writing: '每周至少写2篇作文，学习范文结构和高级表达，积累万能句型和连接词。',
    translation: '每天练习1段中译英，重点掌握中国传统文化、社会发展等高频话题的词汇和句型。'
  };
  
  for (const w of weaknesses) {
    if (moduleAdvice[w.module]) {
      recs.push({ module: w.module, name: {vocabulary:'词汇',grammar:'语法',reading:'阅读',listening:'听力',writing:'写作',translation:'翻译'}[w.module], advice: moduleAdvice[w.module] });
    }
  }
  return recs;
}

// 获取诊断报告
router.get('/report', (req, res) => {
  const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id=?').get('default');
  const user = db.prepare('SELECT * FROM users WHERE user_id=?').get('default');
  
  if (!user.diagnostic_completed) {
    return res.json({ completed: false });
  }
  
  const abilities = {
    vocabulary: profile.vocabulary,
    grammar: profile.grammar,
    reading: profile.reading,
    listening: profile.listening,
    writing: profile.writing,
    translation: profile.translation
  };
  
  const sorted = Object.entries(abilities).sort((a, b) => b[1] - a[1]);
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  
  let daysLeft = null;
  if (user.exam_date) {
    const exam = new Date(user.exam_date);
    const now = new Date();
    daysLeft = Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
  }
  
  res.json({
    completed: true,
    abilities,
    strengths: sorted.slice(0, 3).map(([k, v]) => ({ module: k, name: moduleNames[k], score: v })),
    weaknesses: sorted.slice(-3).reverse().map(([k, v]) => ({ module: k, name: moduleNames[k], score: v })),
    daysLeft,
    overallScore: Math.round(Object.values(abilities).reduce((a, b) => a + b, 0) / 6)
  });
});

module.exports = router;
