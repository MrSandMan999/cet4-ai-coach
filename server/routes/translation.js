const express = require('express');
const router = express.Router();
const db = require('../db/database');
const aiService = require('../ai/aiService');
const { translationQuestions } = require('../data/questions');

// 获取翻译题目
router.get('/topic', (req, res) => {
  const topics = [
    ...translationQuestions,
    { source: '中国是世界上最古老的文明之一，拥有五千年的悠久历史。中国的传统文化对世界产生了深远的影响。', reference: 'China is one of the oldest civilizations in the world, with a long history of 5,000 years. Traditional Chinese culture has had a profound influence on the world.', knowledge_point: '中国文化', difficulty: 3 },
    { source: '近年来，中国的科技发展迅速，在人工智能、5G通信等领域取得了显著成就。', reference: 'In recent years, China has developed rapidly in science and technology, achieving remarkable results in fields such as artificial intelligence and 5G communication.', knowledge_point: '科技发展', difficulty: 3 },
    { source: '随着人们生活水平的提高，越来越多的人开始关注健康问题，健身和健康饮食成为时尚。', reference: 'With the improvement of living standards, more and more people are paying attention to health issues, and fitness and healthy eating have become fashionable.', knowledge_point: '社会生活', difficulty: 3 },
    { source: '春节是中国最重要的传统节日，家人团聚、吃年夜饭、放鞭炮是春节的传统习俗。', reference: 'The Spring Festival is the most important traditional festival in China. Family reunion, New Year\'s Eve dinner, and setting off firecrackers are traditional customs.', knowledge_point: '传统节日', difficulty: 3 }
  ];
  const t = topics[Math.floor(Math.random() * topics.length)];
  res.json(t);
});

// 提交翻译并AI批改
router.post('/submit', async (req, res) => {
  const { source_text, user_translation } = req.body;
  
  if (!user_translation || user_translation.length < 10) {
    return res.json({ error: '翻译内容太短' });
  }
  
  let feedback = null;
  let score = null;
  let reference = '';
  
  if (aiService.isAIEnabled()) {
    try {
      feedback = await aiService.gradeTranslation(source_text, user_translation);
      score = feedback.score;
      reference = feedback.reference_translation;
    } catch (e) {
      console.log('AI批改翻译失败:', e.message);
    }
  }
  
  // 如果AI不可用，使用基础评估
  if (!feedback) {
    score = calculateBasicTranslationScore(user_translation, source_text);
    // 尝试找匹配的参考译文
    const matched = translationQuestions.find(t => t.source === source_text);
    reference = matched?.reference || 'AI服务未配置，无法生成参考译文';
    feedback = {
      score,
      reference_translation: reference,
      vocabulary_issues: ['AI服务未配置，无法详细分析词汇问题'],
      grammar_issues: [],
      chinese_english: [],
      missing_info: [],
      error_pairs: [],
      overall_feedback: `基础评分：${score}/15。建议配置Doubao API获取详细批改和错误对分析。`
    };
  }
  
  // 保存记录
  db.prepare(`INSERT INTO translation_records (user_id, source_text, user_translation, reference_translation, ai_feedback, score, created_at) 
    VALUES ('default', ?, ?, ?, ?, ?, datetime('now','localtime'))`).run(
    source_text, user_translation, reference, JSON.stringify(feedback), score
  );
  
  // 更新翻译能力值
  const profile = db.prepare('SELECT translation FROM ability_profile WHERE user_id=?').get('default');
  if (profile) {
    const scorePercent = (score / 15) * 100;
    const newAbility = Math.round(profile.translation * 0.7 + scorePercent * 0.3);
    db.prepare("UPDATE ability_profile SET translation=?, updated_at=datetime('now','localtime') WHERE user_id='default'").run(newAbility);
  }
  
  res.json({ success: true, feedback, score, reference });
});

// 基础翻译评分
function calculateBasicTranslationScore(userTranslation, sourceText) {
  const words = userTranslation.split(/\s+/).filter(w => w.length > 0).length;
  let score = 5;
  
  if (words >= 30) score += 3;
  else if (words >= 20) score += 2;
  else if (words >= 10) score += 1;
  
  // 检查是否包含关键词
  const keywords = ['the', 'of', 'in', 'and', 'is', 'are', 'to', 'with'];
  const found = keywords.filter(k => userTranslation.toLowerCase().includes(k)).length;
  score += Math.min(4, found);
  
  // 检查首字母大写和句号
  if (/^[A-Z]/.test(userTranslation.trim())) score += 1;
  if (/[.!?]$/.test(userTranslation.trim())) score += 1;
  
  return Math.min(15, score);
}

// 获取翻译历史
router.get('/history', (req, res) => {
  const records = db.prepare("SELECT * FROM translation_records WHERE user_id='default' ORDER BY created_at DESC LIMIT 20").all();
  res.json({ records });
});

module.exports = router;
