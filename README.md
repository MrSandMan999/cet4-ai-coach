# CET-4 AI 个人备考网站

> 你的 AI CET-4 私人教练 — 根据你的实际表现动态调整学习计划

## 功能特性

### 核心闭环



* 个人档案设置（考试日期、目标分数、学习时间、空闲时段）

* CET-4 入门诊断测试（词汇、语法、阅读、听力、翻译、写作）

* 个人能力画像生成（六维雷达图）

* 智能每日学习计划（具体到时间段）

* 自动批改 + 错误分析

* 错题本 + 间隔复习

* 学习数据追踪 + 周报

### 训练模块



* **词汇**：200+ CET-4 核心词汇，学习 / 测试 / 错词本三种模式，间隔复习算法

* **阅读**：仔细阅读训练，自动批改，详细解析

* **听力**：文本模式训练（可扩展音频），原文对照，关键词分析

* **写作**：AI 作文批改，逐句分析，修改版本，优秀表达

* **翻译**：中译英训练，AI 批改，错误对分析

* **模拟考试**：计时模考，各模块得分，对比分析

### AI 教练



* 结合个人学习数据的个性化对话

* 支持快速提问（今天学什么、阅读总错、考试倒计时等）

### 数据驱动



* 能力画像随学习自动更新

* 弱项优先分配学习时间

* 高频错误知识点强化

* 备考时间轴（基础建立→专项突破→真题强化→考前冲刺）

## 快速开始

### 1. 安装依赖



```
cd cet4-ai-coach

npm install
```

### 2. 配置 AI（可选）

复制 `.env.example` 为 `.env`，填入你的 Doubao API 配置：



```
DOUBAO\_API\_KEY=你的API\_KEY

DOUBAO\_BASE\_URL=https://ark.cn-beijing.volces.com/api/v3

DOUBAO\_MODEL=Doubao-2.1-Turbo

DOUBAO\_ENDPOINT\_ID=你的接入点ID
```

> 不配置 AI 也可以正常使用，网站会使用内置题库和规则引擎运行。

### 3. 启动服务



```
npm start
```

### 4. 访问网站

打开浏览器访问：[http://localhost:3000](http://localhost:3000)

## 技术架构



```
cet4-ai-coach/

├── server/

│   ├── index.js              # Express 服务器入口

│   ├── ai/

│   │   └── aiService.js      # AI服务层（Doubao API封装，更换模型只改这里）

│   ├── db/

│   │   └── database.js       # SQLite 数据库（自动建表）

│   ├── routes/               # API 路由

│   │   ├── user.js           # 用户档案

│   │   ├── diagnostic.js     # 诊断测试

│   │   ├── study.js          # 学习计划

│   │   ├── vocabulary.js     # 词汇

│   │   ├── practice.js       # 阅读/听力/语法练习

│   │   ├── writing.js        # 写作

│   │   ├── translation.js    # 翻译

│   │   ├── wrong.js          # 错题本

│   │   ├── report.js         # 学习报告

│   │   ├── coach.js          # AI教练

│   │   └── mock.js           # 模拟考试

│   └── data/

│       ├── vocabulary.js     # 内置CET-4核心词汇库（200+）

│       └── questions.js      # 内置诊断题和练习题

├── public/

│   ├── index.html            # 单页应用入口

│   ├── css/style.css         # 移动端优先响应式样式

│   └── js/app.js             # 前端应用逻辑

├── data/                     # SQLite数据库文件（自动生成）

├── package.json

├── .env.example

└── README.md
```

## 数据模型



* **User**：用户档案（考试日期、目标分数、学习时间、空闲时段）

* **AbilityProfile**：六维能力画像（词汇、语法、阅读、听力、写作、翻译）

* **Question**：题目库

* **UserAnswer**：答题记录

* **KnowledgePoint**：知识点掌握度

* **StudyRecord**：学习记录

* **DailyPlan**：每日计划

* **WrongQuestion**：错题本

* **Vocabulary / UserVocabulary**：词汇库 + 用户词汇掌握度

* **WritingRecord / TranslationRecord**：写作 / 翻译记录

* **MockExam**：模拟考试记录

* **ChatHistory**：AI 教练对话历史

## AI 模型配置

本项目默认使用 **Doubao 2.1 Turbo**，所有 AI 调用集中在 `server/ai/aiService.js`。

更换模型时只需修改 `.env`：



```
DOUBAO\_MODEL=你的模型名称

DOUBAO\_ENDPOINT\_ID=你的接入点ID
```

AI 输出均为结构化 JSON，前端无需复杂自然语言解析。

## 学习决策逻辑

每日计划由以下因素共同决定：



1. 距离考试天数

2. 目标分数

3. 当前能力画像（六维）

4. 最近 7 天正确率

5. 错题数量和高频错误类型

6. 知识点掌握度

7. 可学习时间和空闲时段

弱项自动分配更多时间，连续错误的知识点自动强化。

## 注意事项



* 高考英语 111 分仅作为初始参考，最终能力以诊断测试和学习数据为准

* AI 生成的题目会明确标记「AI 生成练习」，不冒充历年真题

* 模拟考试分数为 AI 训练估算，仅用于学习参考，非官方成绩

* 听力模块当前为文本模式，音频播放功能可扩展

* 所有数据存储在本地 SQLite 数据库，隐私安全

## 开发模式



```
npm run dev  # 自动重启（node --watch）
```