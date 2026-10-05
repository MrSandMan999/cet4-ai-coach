const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db/database');
const aiService = require('./ai/aiService');

// 导入路由
const userRoutes = require('./routes/user');
const diagnosticRoutes = require('./routes/diagnostic');
const studyRoutes = require('./routes/study');
const vocabularyRoutes = require('./routes/vocabulary');
const practiceRoutes = require('./routes/practice');
const writingRoutes = require('./routes/writing');
const translationRoutes = require('./routes/translation');
const wrongRoutes = require('./routes/wrong');
const reportRoutes = require('./routes/report');
const coachRoutes = require('./routes/coach');
const mockRoutes = require('./routes/mock');
const scheduleRoutes = require('./routes/schedule');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 挂载路由
app.use('/api/user', userRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/writing', writingRoutes);
app.use('/api/translation', translationRoutes);
app.use('/api/wrong', wrongRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/schedule', scheduleRoutes);

// AI状态检查
app.get('/api/ai-status', (req, res) => {
  res.json({ enabled: aiService.isAIEnabled(), model: aiService.AI_CONFIG.model });
});

// SPA fallback - 所有非API路由返回index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// 初始化词汇库（首次运行时）
const vocabCount = db.prepare('SELECT COUNT(*) as count FROM vocabulary').get().count;
if (vocabCount === 0) {
  const vocabList = require('./data/vocabulary');
  const insert = db.prepare(`INSERT OR IGNORE INTO vocabulary (word, phonetic, meaning, part_of_speech, example, example_translation, frequency, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  for (const item of vocabList) {
    insert.run(item.word, item.phonetic, item.meaning, item.part_of_speech, item.example, item.example_translation, item.frequency, item.category);
  }
  db.exec('COMMIT');
  console.log(`已导入 ${vocabList.length} 个CET-4核心词汇`);
}

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  CET-4 AI 备考网站已启动`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`  AI服务: ${aiService.isAIEnabled() ? '已启用 (' + aiService.AI_CONFIG.model + ')' : '未配置（使用内置题库模式）'}`);
  console.log(`========================================\n`);
});
