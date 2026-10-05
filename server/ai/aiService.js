/**
 * AI 服务层 - 封装 Doubao 大模型调用
 * 所有AI调用集中在此，更换模型只需修改配置
 */
require('dotenv').config();

const AI_CONFIG = {
  apiKey: process.env.DOUBAO_API_KEY || '',
  baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  model: process.env.DOUBAO_MODEL || 'Doubao-2.1-Turbo',
  endpointId: process.env.DOUBAO_ENDPOINT_ID || ''
};

const isAIEnabled = () => {
  return !!(AI_CONFIG.apiKey && AI_CONFIG.apiKey !== 'your_api_key_here');
};

/**
 * 调用 Doubao 聊天补全接口
 * @param {Array} messages - 消息数组 [{role, content}]
 * @param {Object} options - 可选参数 {temperature, max_tokens, response_format}
 * @returns {Promise<string>} AI回复内容
 */
async function chatCompletion(messages, options = {}) {
  if (!isAIEnabled()) {
    throw new Error('AI服务未配置，请在.env中设置DOUBAO_API_KEY');
  }

  const model = AI_CONFIG.endpointId || AI_CONFIG.model;
  
  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 2000
  };

  if (options.response_format) {
    body.response_format = options.response_format;
  }

  const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_CONFIG.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API错误 ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 获取结构化JSON输出
 */
async function chatJSON(messages, options = {}) {
  const content = await chatCompletion(messages, {
    ...options,
    response_format: { type: 'json_object' }
  });
  try {
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取JSON
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI返回内容无法解析为JSON: ' + content.substring(0, 200));
  }
}

/**
 * 生成CET-4诊断题目
 */
async function generateDiagnosticQuestion(module, type) {
  const systemPrompt = `你是资深CET-4教研老师。请生成一道CET-4${module}诊断题，题型：${type}。
要求：难度适中，符合CET-4水平，题目清晰，只有一个最佳答案。
返回JSON格式：
{
  "question": "题目内容",
  "options": ["A选项","B选项","C选项","D选项"],
  "answer": "正确选项字母",
  "explanation": "答案解析",
  "knowledge_point": "知识点",
  "difficulty": 1-5
}`;
  return chatJSON([{ role: 'system', content: systemPrompt }], { temperature: 0.8 });
}

/**
 * 生成个性化练习题（基于薄弱知识点）
 */
async function generatePracticeQuestion(module, knowledgePoint, difficulty = 3) {
  const systemPrompt = `你是CET-4教研专家。根据学生薄弱知识点"${knowledgePoint}"，生成一道CET-4${module}练习题。
难度等级${difficulty}/5。要求干扰项合理，答案可从材料推导。
返回JSON：
{
  "question": "题干",
  "passage": "阅读文章(如需要)",
  "options": ["A","B","C","D"],
  "answer": "正确字母",
  "explanation": "详细解析，说明为什么对、为什么错",
  "knowledge_point": "${knowledgePoint}",
  "error_type_hint": "常见错误类型"
}`;
  return chatJSON([{ role: 'system', content: systemPrompt }], { temperature: 0.8 });
}

/**
 * AI批改作文
 */
async function gradeWriting(topic, essay) {
  const systemPrompt = `你是CET-4写作阅卷专家。请批改以下作文，给出详细反馈。
作文题目：${topic}
学生作文：${essay}

返回JSON：
{
  "score": 0-15,
  "task_response": "切题度评价",
  "structure": "结构评价",
  "grammar": "语法问题列表",
  "vocabulary": "词汇问题列表",
  "chinese_english": "中式英语问题",
  "sentence_by_sentence": [{"original":"原句","issue":"问题","suggestion":"修改建议"}],
  "revised_version": "修改后的作文",
  "good_expressions": ["优秀表达1","优秀表达2"],
  "overall_feedback": "总体评价和改进建议"
}`;
  return chatJSON([{ role: 'system', content: systemPrompt }], { temperature: 0.5 });
}

/**
 * AI批改翻译
 */
async function gradeTranslation(sourceText, userTranslation) {
  const systemPrompt = `你是CET-4翻译专家。请批改以下中译英。
原文：${sourceText}
学生翻译：${userTranslation}

返回JSON：
{
  "score": 0-15,
  "reference_translation": "参考译文",
  "vocabulary_issues": ["词汇问题"],
  "grammar_issues": ["语法问题"],
  "chinese_english": ["中式英语"],
  "missing_info": ["信息遗漏"],
  "error_pairs": [{"wrong":"错误表达","correct":"推荐表达","reason":"原因"}],
  "overall_feedback": "总体评价"
}`;
  return chatJSON([{ role: 'system', content: systemPrompt }], { temperature: 0.5 });
}

/**
 * AI教练对话（结合用户数据）
 */
async function coachChat(userMessage, userContext) {
  const systemPrompt = `你是一位专业的CET-4 AI私人教练。请结合以下学生数据给出个性化建议：
${JSON.stringify(userContext, null, 2)}

要求：
1. 回答要具体、可执行，不要空泛
2. 结合学生的实际薄弱点和学习数据
3. 语气鼓励但客观，不制造焦虑
4. 如果学生问"今天学什么"，给出具体任务建议
5. 回答控制在300字以内`;

  return chatCompletion([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ], { temperature: 0.7, max_tokens: 800 });
}

/**
 * 生成每日学习计划
 */
async function generateDailyPlan(userData) {
  const systemPrompt = `你是CET-4学习规划师。根据以下学生数据，生成今日学习计划。
学生数据：${JSON.stringify(userData)}

要求：
1. 根据薄弱点动态分配时间，弱项多分配
2. 总时长不超过daily_minutes
3. 每个任务明确：模块、内容、时长、重点
4. 优先复习错题和薄弱知识点
返回JSON：
{
  "tasks": [
    {"module":"vocabulary","title":"任务名","duration":20,"content":"具体内容","focus":"训练重点","knowledge_point":"知识点"}
  ],
  "reasoning": "计划制定逻辑说明"
}`;
  return chatJSON([{ role: 'system', content: systemPrompt }], { temperature: 0.6 });
}

/**
 * 生成变式题（错题举一反三）
 */
async function generateVariantQuestion(wrongQuestion) {
  const systemPrompt = `你是CET-4命题专家。请根据以下错题，生成一道相同知识点、不同材料、类似难度的变式题。
错题信息：${JSON.stringify(wrongQuestion)}

返回JSON：
{
  "question": "新题干",
  "passage": "新文章(如需要)",
  "options": ["A","B","C","D"],
  "answer": "正确字母",
  "explanation": "解析",
  "knowledge_point": "相同知识点",
  "difficulty": 类似难度
}`;
  return chatJSON([{ role: 'system', content: systemPrompt }], { temperature: 0.8 });
}

module.exports = {
  isAIEnabled,
  chatCompletion,
  chatJSON,
  generateDiagnosticQuestion,
  generatePracticeQuestion,
  gradeWriting,
  gradeTranslation,
  coachChat,
  generateDailyPlan,
  generateVariantQuestion,
  AI_CONFIG
};
