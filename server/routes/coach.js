const express = require('express');
const router = express.Router();
const db = require('../db/database');
const aiService = require('../ai/aiService');

// AI教练对话
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  
  if (!message || !message.trim()) {
    return res.json({ error: '请输入问题' });
  }
  
  // 收集用户上下文数据
  const user = db.prepare('SELECT * FROM users WHERE user_id=?').get('default');
  const profile = db.prepare('SELECT * FROM ability_profile WHERE user_id=?').get('default');
  
  // 最近7天统计
  const weekStats = db.prepare(`
    SELECT module, COUNT(*) as total, ROUND(AVG(correct)*100,1) as accuracy
    FROM user_answers 
    WHERE user_id='default' AND created_at >= datetime('now','-7 days')
    GROUP BY module
  `).all();
  
  // 高频错误
  const topErrors = db.prepare(`
    SELECT error_type, COUNT(*) as count 
    FROM user_answers 
    WHERE user_id='default' AND correct=0 AND error_type IS NOT NULL
    GROUP BY error_type ORDER BY count DESC LIMIT 3
  `).all();
  
  // 错题数
  const wrongCount = db.prepare("SELECT COUNT(*) as c FROM wrong_questions WHERE user_id='default'").get().c;
  
  // 计算剩余天数
  let daysLeft = null;
  if (user.exam_date) {
    const exam = new Date(user.exam_date);
    const now = new Date();
    daysLeft = Math.ceil((exam - now) / (1000 * 60 * 60 * 24));
  }
  
  const userContext = {
    exam_date: user.exam_date,
    days_left: daysLeft,
    target_score: user.target_score,
    daily_study_minutes: user.daily_study_minutes,
    gaokao_score: user.gaokao_english_score,
    diagnostic_completed: user.diagnostic_completed,
    ability_profile: {
      vocabulary: profile.vocabulary,
      grammar: profile.grammar,
      reading: profile.reading,
      listening: profile.listening,
      writing: profile.writing,
      translation: profile.translation
    },
    week_stats: weekStats,
    top_errors: topErrors,
    wrong_question_count: wrongCount
  };
  
  let reply = '';
  
  if (aiService.isAIEnabled()) {
    try {
      reply = await aiService.coachChat(message, userContext);
    } catch (e) {
      reply = `AI服务暂时不可用（${e.message}）。以下是基于你的学习数据的建议：\n\n` + generateFallbackReply(message, userContext);
    }
  } else {
    reply = generateFallbackReply(message, userContext);
  }
  
  // 保存对话历史
  db.prepare("INSERT INTO chat_history (user_id, role, content) VALUES ('default', 'user', ?)").run(message);
  db.prepare("INSERT INTO chat_history (user_id, role, content) VALUES ('default', 'assistant', ?)").run(reply);
  
  res.json({ reply, context: userContext });
});

// 生成离线回复
function generateFallbackReply(message, context) {
  const msg = message.toLowerCase();
  const abilities = context.ability_profile;
  const moduleNames = { vocabulary: '词汇', grammar: '语法', reading: '阅读', listening: '听力', writing: '写作', translation: '翻译' };
  
  // 找出最弱模块
  const weakest = Object.entries(abilities).sort((a, b) => a[1] - b[1])[0];
  
  if (msg.includes('今天') || msg.includes('学什么') || msg.includes('怎么学')) {
    return `根据你目前的情况，今天最应该学习的是：\n\n1. **${moduleNames[weakest[0]]}**（当前能力值${weakest[1]}/100，是你最薄弱的环节）\n2. 错题复习（你共有${context.wrong_question_count}道错题待巩固）\n3. 核心词汇背诵\n\n建议按照今日任务列表的顺序完成，每个任务结束后查看解析。${context.days_left ? `距离考试还有${context.days_left}天，保持每天${context.daily_study_minutes}分钟的学习节奏即可。` : ''}`;
  }
  
  if (msg.includes('阅读') && (msg.includes('为什么') || msg.includes('总错') || msg.includes('差'))) {
    return `阅读能力提升建议：\n\n1. **定位训练**：先读题干，划出关键词，再回原文找对应位置\n2. **同义替换**：CET-4阅读正确答案往往是原文的同义改写，注意积累常见替换\n3. **排除法**：过于绝对的选项（always, never, all）通常是错的\n4. **精读分析**：做完题后逐句分析长难句，搞懂每个句子结构\n\n你当前阅读能力值${abilities.reading}/100，建议每天至少做1篇仔细阅读并精读。`;
  }
  
  if (msg.includes('听力') && (msg.includes('为什么') || msg.includes('总错') || msg.includes('差'))) {
    return `听力提升建议：\n\n1. **精听训练**：第一遍做题，第二遍看原文听，第三遍跟读\n2. **关键词捕捉**：注意转折词（but, however）后的内容，往往是答案\n3. **同义替换**：听力也大量考查同义替换，和阅读互通\n4. **每天坚持**：听力需要语感积累，每天15-20分钟比突击有效\n\n你当前听力能力值${abilities.listening}/100，建议每天安排听力训练。`;
  }
  
  if (msg.includes('单词') || msg.includes('词汇') || msg.includes('意思')) {
    return `词汇学习建议：\n\n1. **语境记忆**：不要孤立背单词，结合例句记忆\n2. **间隔复习**：利用艾宾浩斯遗忘曲线，在第1、2、4、7、15天复习\n3. **熟词僻义**：CET-4常考熟词僻义，如address(处理)、charge(负责)\n4. **词组搭配**：注意固定搭配和介词用法\n\n你当前词汇能力值${abilities.vocabulary}/100，建议每天学习20个新词+复习错词。`;
  }
  
  if (msg.includes('作文') || msg.includes('写作')) {
    return `写作提升建议：\n\n1. **三段式结构**：开头引出话题+主体论述+结尾总结\n2. **连接词**：使用however, therefore, moreover等让逻辑更清晰\n3. **高级词汇**：用significant代替important，用numerous代替many\n4. **万能句型**：积累5-8个万能句型，如It is widely acknowledged that...\n5. **每周2篇**：坚持每周写2篇，对照范文修改\n\n你当前写作能力值${abilities.writing}/100，建议进入写作模块进行AI批改训练。`;
  }
  
  if (msg.includes('翻译')) {
    return `翻译提升建议：\n\n1. **高频话题**：重点准备中国文化、社会发展、科技教育等话题\n2. **句式转换**：中文多短句，英文多长句，学会用从句和非谓语连接\n3. **核心词汇**：积累传统文化相关词汇，如festival, tradition, culture\n4. **检查要点**：时态、主谓一致、单复数、介词搭配\n\n你当前翻译能力值${abilities.translation}/100，建议进入翻译模块练习。`;
  }
  
  if (msg.includes('剩余') || msg.includes('多少天') || msg.includes('考试')) {
    if (context.days_left) {
      return `距离CET-4考试还有**${context.days_left}天**。\n\n当前各模块能力：\n- 词汇：${abilities.vocabulary}/100\n- 语法：${abilities.grammar}/100\n- 阅读：${abilities.reading}/100\n- 听力：${abilities.listening}/100\n- 写作：${abilities.writing}/100\n- 翻译：${abilities.translation}/100\n\n最需要加强的是**${moduleNames[weakest[0]]}**（${weakest[1]}/100）。建议每天优先安排该模块训练。`;
    }
    return '你还没有设置考试日期，请在个人档案中设置CET-4考试日期，我会为你生成精确的倒计时和学习计划。';
  }
  
  // 默认回复
  return `我是你的CET-4 AI教练。你可以问我：\n\n- "今天应该学什么？"\n- "为什么我阅读总错？"\n- "距离考试还有多少天？"\n- "帮我分析这篇作文"\n- "这个单词怎么用？"\n\n你当前最薄弱的模块是**${moduleNames[weakest[0]]}**（${weakest[1]}/100），建议优先加强。`;
}

// 获取对话历史
router.get('/history', (req, res) => {
  const history = db.prepare("SELECT * FROM chat_history WHERE user_id='default' ORDER BY id DESC LIMIT 20").all().reverse();
  res.json({ history });
});

module.exports = router;
