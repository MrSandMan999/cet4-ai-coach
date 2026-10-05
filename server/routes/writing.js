const express = require('express');
const router = express.Router();
const db = require('../db/database');
const aiService = require('../ai/aiService');
const { writingQuestions } = require('../data/questions');

// 获取写作题目
router.get('/topic', (req, res) => {
  const topics = [
    ...writingQuestions,
    { topic: 'Directions: For this part, you are allowed 30 minutes to write a short essay on the importance of reading. You should write at least 120 words but no more than 180 words.', knowledge_point: '议论文-重要性', difficulty: 3 },
    { topic: 'Directions: For this part, you are allowed 30 minutes to write a short essay on the topic of online education. You should write at least 120 words but no more than 180 words.', knowledge_point: '议论文-社会现象', difficulty: 3 },
    { topic: 'Directions: For this part, you are allowed 30 minutes to write a short essay on how to balance study and entertainment. You should write at least 120 words but no more than 180 words.', knowledge_point: '议论文-方法建议', difficulty: 3 }
  ];
  const t = topics[Math.floor(Math.random() * topics.length)];
  res.json(t);
});

// 提交作文并AI批改
router.post('/submit', async (req, res) => {
  const { topic, essay } = req.body;
  
  if (!essay || essay.length < 20) {
    return res.json({ error: '作文内容太短，请至少写20个词' });
  }
  
  let feedback = null;
  let score = null;
  
  if (aiService.isAIEnabled()) {
    try {
      feedback = await aiService.gradeWriting(topic, essay);
      score = feedback.score;
    } catch (e) {
      console.log('AI批改失败:', e.message);
    }
  }
  
  // 如果AI不可用，使用基础评分
  if (!feedback) {
    score = calculateBasicWritingScore(essay);
    feedback = {
      score,
      task_response: 'AI服务未配置，以下为基础评估。建议配置Doubao API获取详细批改。',
      structure: essay.split('\n').length >= 3 ? '结构基本完整' : '建议分为3段：开头、主体、结尾',
      grammar: ['请检查时态一致性', '注意主谓一致'],
      vocabulary: ['建议使用更多高级词汇替换简单词'],
      chinese_english: [],
      sentence_by_sentence: [],
      revised_version: 'AI服务未配置，无法生成修改版本',
      good_expressions: [],
      overall_feedback: `基础评分：${score}/15。作文长度${essay.split(/\s+/).length}词。建议配置AI服务获取逐句批改和详细反馈。`
    };
  }
  
  // 保存记录
  db.prepare(`INSERT INTO writing_records (user_id, topic, user_essay, ai_feedback, score, created_at) 
    VALUES ('default', ?, ?, ?, ?, datetime('now','localtime'))`).run(
    topic, essay, JSON.stringify(feedback), score
  );
  
  // 更新写作能力值
  const profile = db.prepare('SELECT writing FROM ability_profile WHERE user_id=?').get('default');
  if (profile) {
    const scorePercent = (score / 15) * 100;
    const newAbility = Math.round(profile.writing * 0.7 + scorePercent * 0.3);
    db.prepare("UPDATE ability_profile SET writing=?, updated_at=datetime('now','localtime') WHERE user_id='default'").run(newAbility);
  }
  
  res.json({ success: true, feedback, score });
});

// 基础作文评分（无AI时使用）
function calculateBasicWritingScore(essay) {
  const words = essay.split(/\s+/).filter(w => w.length > 0).length;
  let score = 6; // 基础分
  
  if (words >= 120) score += 2;
  if (words >= 150) score += 1;
  if (essay.split('\n').length >= 3) score += 2;
  
  // 简单检查连接词
  const connectors = ['however', 'therefore', 'moreover', 'furthermore', 'in addition', 'firstly', 'secondly', 'finally', 'in conclusion'];
  const foundConnectors = connectors.filter(c => essay.toLowerCase().includes(c)).length;
  score += Math.min(2, foundConnectors);
  
  return Math.min(15, score);
}

// 获取写作历史
router.get('/history', (req, res) => {
  const records = db.prepare("SELECT * FROM writing_records WHERE user_id='default' ORDER BY created_at DESC LIMIT 20").all();
  res.json({ records });
});

module.exports = router;
