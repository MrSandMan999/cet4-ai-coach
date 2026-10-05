const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 获取课表
router.get('/', (req, res) => {
  const schedule = db.prepare(`
    SELECT cs.*, ts_start.start_time as start_time, ts_end.end_time as end_time
    FROM class_schedule cs
    LEFT JOIN time_slots ts_start ON cs.start_period = ts_start.period
    LEFT JOIN time_slots ts_end ON cs.end_period = ts_end.period
    WHERE cs.user_id = 'default'
    ORDER BY cs.day_of_week, cs.start_period
  `).all();
  
  const timeSlots = db.prepare('SELECT * FROM time_slots ORDER BY period').all();
  
  // 按天分组
  const byDay = {};
  for (let i = 1; i <= 7; i++) byDay[i] = [];
  schedule.forEach(s => {
    byDay[s.day_of_week].push(s);
  });
  
  res.json({ schedule: byDay, timeSlots, raw: schedule });
});

// 获取某一天的课表
router.get('/day/:day', (req, res) => {
  const day = parseInt(req.params.day);
  const classes = db.prepare(`
    SELECT cs.*, ts_start.start_time as start_time, ts_end.end_time as end_time
    FROM class_schedule cs
    LEFT JOIN time_slots ts_start ON cs.start_period = ts_start.period
    LEFT JOIN time_slots ts_end ON cs.end_period = ts_end.period
    WHERE cs.user_id = 'default' AND cs.day_of_week = ?
    ORDER BY cs.start_period
  `).all(day);
  res.json({ day, classes });
});

// 获取今天的空闲时间段（用于排课）
router.get('/free-slots/:day', (req, res) => {
  const day = parseInt(req.params.day);
  const classes = db.prepare(`
    SELECT cs.*, ts_start.start_time as start_time, ts_end.end_time as end_time
    FROM class_schedule cs
    LEFT JOIN time_slots ts_start ON cs.start_period = ts_start.period
    LEFT JOIN time_slots ts_end ON cs.end_period = ts_end.period
    WHERE cs.user_id = 'default' AND cs.day_of_week = ?
    ORDER BY cs.start_period
  `).all(day);
  
  // 计算空闲时间段（07:00-22:00之间，排除上课时间）
  const dayStart = 7 * 60; // 07:00
  const dayEnd = 22 * 60;  // 22:00
  
  const busyRanges = classes.map(c => {
    const [sh, sm] = c.start_time.split(':').map(Number);
    const [eh, em] = c.end_time.split(':').map(Number);
    return { start: sh * 60 + sm, end: eh * 60 + em };
  }).sort((a, b) => a.start - b.start);
  
  const freeSlots = [];
  let current = dayStart;
  
  for (const busy of busyRanges) {
    if (busy.start > current + 10) { // 至少10分钟空隙才算空闲
      freeSlots.push({
        start: formatTime(current),
        end: formatTime(busy.start),
        duration: busy.start - current
      });
    }
    current = Math.max(current, busy.end);
  }
  if (current < dayEnd - 10) {
    freeSlots.push({
      start: formatTime(current),
      end: formatTime(dayEnd),
      duration: dayEnd - current
    });
  }
  
  res.json({ day, classes, freeSlots });
});

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 添加课程
router.post('/', (req, res) => {
  const { day_of_week, start_period, end_period, course_name, teacher, location, week_range } = req.body;
  const info = db.prepare(`INSERT INTO class_schedule (user_id, day_of_week, start_period, end_period, course_name, teacher, location, week_range) 
    VALUES ('default', ?, ?, ?, ?, ?, ?, ?)`).run(
    day_of_week, start_period, end_period, course_name, teacher || '', location || '', week_range || ''
  );
  res.json({ success: true, id: info.lastInsertRowid });
});

// 删除课程
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM class_schedule WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 更新作息时间
router.put('/timeslot/:period', (req, res) => {
  const { start_time, end_time } = req.body;
  db.prepare('UPDATE time_slots SET start_time=?, end_time=? WHERE period=?').run(start_time, end_time, req.params.period);
  res.json({ success: true });
});

module.exports = router;
