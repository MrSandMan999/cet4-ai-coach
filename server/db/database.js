const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DB_DIR, 'cet4.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// 兼容层：统一 run() 返回格式
const _origPrepare = db.prepare.bind(db);
db.prepare = function(sql) {
  const stmt = _origPrepare(sql);
  const origRun = stmt.run.bind(stmt);
  stmt.run = function(...params) {
    const result = origRun(...params);
    return {
      changes: result.changes ?? 0,
      lastInsertRowid: result.lastInsertRowid ?? result.insertRowId ?? 0
    };
  };
  return stmt;
};

// 初始化数据表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY DEFAULT 'default',
    exam_date TEXT,
    target_score INTEGER DEFAULT 425,
    daily_study_minutes INTEGER DEFAULT 60,
    weekly_days INTEGER DEFAULT 6,
    available_morning TEXT,
    available_noon TEXT,
    available_afternoon TEXT,
    available_evening TEXT DEFAULT '19:00-21:00',
    gaokao_english_score INTEGER DEFAULT 111,
    diagnostic_completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS ability_profile (
    user_id TEXT PRIMARY KEY,
    vocabulary REAL DEFAULT 50,
    grammar REAL DEFAULT 50,
    reading REAL DEFAULT 50,
    listening REAL DEFAULT 50,
    writing REAL DEFAULT 50,
    translation REAL DEFAULT 50,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS questions (
    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    question_type TEXT,
    difficulty INTEGER DEFAULT 3,
    content TEXT NOT NULL,
    passage TEXT,
    options TEXT,
    answer TEXT NOT NULL,
    explanation TEXT,
    knowledge_point TEXT,
    source TEXT DEFAULT 'builtin',
    is_ai_generated INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS user_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    question_id INTEGER,
    module TEXT,
    user_answer TEXT,
    correct INTEGER,
    time_spent INTEGER,
    error_type TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS knowledge_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    module TEXT,
    knowledge_point TEXT,
    mastery_level REAL DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    last_review TEXT,
    next_review TEXT,
    UNIQUE(user_id, module, knowledge_point)
  );

  CREATE TABLE IF NOT EXISTS study_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    date TEXT,
    study_minutes INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    accuracy REAL,
    vocabulary_accuracy REAL,
    reading_accuracy REAL,
    listening_accuracy REAL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS daily_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    date TEXT,
    tasks TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS wrong_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    question_id INTEGER,
    module TEXT,
    question_type TEXT,
    content TEXT,
    options TEXT,
    user_answer TEXT,
    correct_answer TEXT,
    error_type TEXT,
    knowledge_point TEXT,
    error_count INTEGER DEFAULT 1,
    mastery_level REAL DEFAULT 0,
    next_review TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    last_review TEXT
  );

  CREATE TABLE IF NOT EXISTS vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    phonetic TEXT,
    meaning TEXT NOT NULL,
    part_of_speech TEXT,
    example TEXT,
    example_translation TEXT,
    frequency INTEGER DEFAULT 3,
    category TEXT DEFAULT 'core',
    UNIQUE(word)
  );

  CREATE TABLE IF NOT EXISTS user_vocabulary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    word TEXT NOT NULL,
    mastery_level REAL DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    last_review TEXT,
    next_review TEXT,
    UNIQUE(user_id, word)
  );

  CREATE TABLE IF NOT EXISTS writing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    topic TEXT,
    user_essay TEXT,
    ai_feedback TEXT,
    score REAL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS translation_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    source_text TEXT,
    user_translation TEXT,
    reference_translation TEXT,
    ai_feedback TEXT,
    score REAL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS mock_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    started_at TEXT,
    completed_at TEXT,
    total_score REAL,
    section_scores TEXT,
    answers TEXT,
    duration INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    role TEXT,
    content TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS class_schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT DEFAULT 'default',
    day_of_week INTEGER NOT NULL,
    start_period INTEGER NOT NULL,
    end_period INTEGER NOT NULL,
    course_name TEXT NOT NULL,
    teacher TEXT,
    location TEXT,
    week_range TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period INTEGER UNIQUE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
  );
`);

// 确保默认用户存在
const defaultUser = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get('default');
if (!defaultUser) {
  db.prepare('INSERT INTO users (user_id) VALUES (?)').run('default');
  db.prepare('INSERT INTO ability_profile (user_id) VALUES (?)').run('default');
}

// 初始化标准大学作息时间
const slotCount = db.prepare('SELECT COUNT(*) as c FROM time_slots').get().c;
if (slotCount === 0) {
  const slots = [
    [1, '08:00', '08:45'], [2, '08:55', '09:40'],
    [3, '10:00', '10:45'], [4, '10:55', '11:40'],
    [5, '11:50', '12:35'],
    [6, '14:00', '14:45'], [7, '14:55', '15:40'],
    [8, '16:00', '16:45'], [9, '16:55', '17:40'],
    [10, '19:00', '19:45'], [11, '19:55', '20:40'], [12, '20:50', '21:35']
  ];
  const insertSlot = db.prepare('INSERT OR IGNORE INTO time_slots (period, start_time, end_time) VALUES (?, ?, ?)');
  db.exec('BEGIN');
  slots.forEach(([p, s, e]) => insertSlot.run(p, s, e));
  db.exec('COMMIT');
}

// 初始化默认课表（根据用户提供的课表）
const scheduleCount = db.prepare('SELECT COUNT(*) as c FROM class_schedule').get().c;
if (scheduleCount === 0) {
  const defaultSchedule = [
    // 周一 (day=1)
    [1, 3, 5, '经济学原理', '贾赟', '尚射4-3', '1-16周'],
    [1, 6, 7, '大学体育I', '赵耀', '篮球场1', '1-16周'],
    [1, 8, 10, '思想道德与法治', '蒋国惠', '尚射2-1', '1-16周'],
    // 周二 (day=2)
    [2, 1, 2, '大学外语(英语)I', '廖海鹰', '同乐4-2', '1-16周'],
    [2, 3, 5, '管理学', '王灵芝,刘晓青', '尚射5-3', '1-16周'],
    [2, 6, 7, '职业生涯与发展规划', '白玉琼', '尚射4-4', '1-8周'],
    // 周三 (day=3)
    [3, 3, 5, '国家安全教育', '何杰', '尚射5-1', '12-16周'],
    // 周四 (day=4)
    [4, 3, 5, '会计学原理', '陈莲枝', '尚射5-2', '1-16周'],
    [4, 6, 7, '大学外语(英语)I', '廖海鹰', '同乐4-2', '1-16周'],
    // 周五 (day=5)
    [5, 6, 7, '大学生心理健康教育', '施忠海', '尚射4-2', '6-13周']
  ];
  const insertSchedule = db.prepare('INSERT INTO class_schedule (user_id, day_of_week, start_period, end_period, course_name, teacher, location, week_range) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.exec('BEGIN');
  defaultSchedule.forEach(([day, sp, ep, name, teacher, loc, week]) => {
    insertSchedule.run('default', day, sp, ep, name, teacher, loc, week);
  });
  db.exec('COMMIT');
}

module.exports = db;
