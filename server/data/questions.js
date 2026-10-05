/**
 * CET-4 诊断测试题库 + 内置练习题
 * 覆盖：词汇、语法、阅读、翻译、写作
 */

// 词汇诊断题
const vocabularyQuestions = [
  {
    question: 'The company decided to ______ the old policy and adopt a new one.',
    options: ['A. abandon', 'B. adapt', 'C. adjust', 'D. acquire'],
    answer: 'A',
    explanation: 'abandon意为"放弃"，符合句意"公司决定放弃旧政策，采用新政策"。adapt是"适应"，adjust是"调整"，acquire是"获得"。',
    knowledge_point: '动词词义辨析',
    difficulty: 2
  },
  {
    question: 'Regular exercise can ______ your immune system and reduce the risk of illness.',
    options: ['A. enhance', 'B. ensure', 'C. enable', 'D. encounter'],
    answer: 'A',
    explanation: 'enhance意为"增强，提高"，enhance immune system"增强免疫系统"。ensure"确保"，enable"使能够"，encounter"遇到"。',
    knowledge_point: '动词词义辨析',
    difficulty: 2
  },
  {
    question: 'The results of the experiment ______ that the new method is more effective.',
    options: ['A. indicate', 'B. impose', 'C. incline', 'D. infer'],
    answer: 'A',
    explanation: 'indicate意为"表明，指示"，实验结果表明新方法更有效。infer是"推断"，主语通常是人。',
    knowledge_point: '动词词义辨析',
    difficulty: 3
  },
  {
    question: 'Despite the heavy rain, the sports meeting was held as ______.',
    options: ['A. planned', 'B. schedule', 'C. arranged', 'D. expected'],
    answer: 'B',
    explanation: 'as scheduled是固定搭配，意为"按计划"。despite表示"尽管"。',
    knowledge_point: '固定搭配',
    difficulty: 3
  },
  {
    question: 'She has a(n) ______ ability to learn new languages quickly.',
    options: ['A. enormous', 'B. remarkable', 'C. obvious', 'D. distinct'],
    answer: 'B',
    explanation: 'remarkable意为"非凡的，显著的"，remarkable ability"非凡的能力"。enormous"巨大的"，obvious"明显的"，distinct"独特的"。',
    knowledge_point: '形容词词义辨析',
    difficulty: 3
  },
  {
    question: 'The government has ______ a new law to protect the environment.',
    options: ['A. launched', 'B. issued', 'C. published', 'D. released'],
    answer: 'B',
    explanation: 'issue a law"颁布法律"是固定搭配。launch"发起，推出"，publish"出版"，release"发布，释放"。',
    knowledge_point: '动词搭配',
    difficulty: 3
  },
  {
    question: 'It is ______ that we finish the project before the deadline.',
    options: ['A. critical', 'B. critic', 'C. criticism', 'D. critically'],
    answer: 'A',
    explanation: 'critical是形容词，意为"关键的，至关重要的"。It is critical that...是常用句型。',
    knowledge_point: '词性辨析',
    difficulty: 2
  },
  {
    question: 'The new policy will have a significant ______ on the economy.',
    options: ['A. affect', 'B. effect', 'C. impact', 'D. influence'],
    answer: 'C',
    explanation: 'have an impact on"对...有影响"是固定搭配。affect是动词，effect作名词时是"效果"，influence通常用have influence on但此处impact更常用。',
    knowledge_point: '名词词义与搭配',
    difficulty: 3
  }
];

// 语法诊断题
const grammarQuestions = [
  {
    question: 'By the time you arrive, I ______ for two hours.',
    options: ['A. will study', 'B. will have studied', 'C. have studied', 'D. had studied'],
    answer: 'B',
    explanation: 'by the time引导的时间状语从句用一般现在时表将来，主句用将来完成时(will have done)，表示到将来某时已经完成的动作。',
    knowledge_point: '时态-将来完成时',
    difficulty: 3
  },
  {
    question: 'The reason ______ he was late is that he missed the bus.',
    options: ['A. why', 'B. which', 'C. that', 'D. what'],
    answer: 'A',
    explanation: '先行词是reason，在定语从句中作原因状语，用关系副词why。',
    knowledge_point: '定语从句-关系副词',
    difficulty: 2
  },
  {
    question: '______ from the top of the mountain, the city looks beautiful.',
    options: ['A. Seeing', 'B. Seen', 'C. To see', 'D. See'],
    answer: 'B',
    explanation: '句子主语the city与see是被动关系，用过去分词Seen作状语，表示"被看"。',
    knowledge_point: '非谓语动词-过去分词',
    difficulty: 3
  },
  {
    question: 'Neither the teacher nor the students ______ satisfied with the result.',
    options: ['A. is', 'B. are', 'C. was', 'D. has been'],
    answer: 'B',
    explanation: 'neither...nor...连接两个主语时，谓语动词遵循"就近原则"，与最近的students一致，用复数are。',
    knowledge_point: '主谓一致-就近原则',
    difficulty: 3
  },
  {
    question: 'If I ______ you, I would accept the offer immediately.',
    options: ['A. am', 'B. was', 'C. were', 'D. be'],
    answer: 'C',
    explanation: '这是与现在事实相反的虚拟语气，if从句用一般过去时，be动词统一用were。',
    knowledge_point: '虚拟语气-与现在相反',
    difficulty: 2
  },
  {
    question: 'She insisted that the meeting ______ postponed.',
    options: ['A. is', 'B. was', 'C. be', 'D. would be'],
    answer: 'C',
    explanation: 'insist表示"坚持要求"时，宾语从句用虚拟语气，谓语用(should)+动词原形，should可省略。',
    knowledge_point: '虚拟语气-宾语从句',
    difficulty: 3
  },
  {
    question: 'The book ______ on the desk belongs to my sister.',
    options: ['A. lying', 'B. lain', 'C. lay', 'D. lies'],
    answer: 'A',
    explanation: 'lying是现在分词作后置定语，修饰book，表示"放在桌上的书"。book与lie是主动关系。',
    knowledge_point: '非谓语动词-现在分词',
    difficulty: 3
  },
  {
    question: 'It was not until midnight ______ he finished his homework.',
    options: ['A. when', 'B. that', 'C. which', 'D. since'],
    answer: 'B',
    explanation: '这是强调句型It is/was not until...that...，"直到...才..."，that不能换成when。',
    knowledge_point: '强调句型',
    difficulty: 3
  },
  {
    question: 'I have no idea ______ he will come back.',
    options: ['A. that', 'B. whether', 'C. what', 'D. which'],
    answer: 'B',
    explanation: 'have no idea后面接同位语从句，根据句意"我不知道他是否会回来"，用whether引导。',
    knowledge_point: '名词性从句-同位语从句',
    difficulty: 3
  },
  {
    question: 'The more you practice, ______ you will become.',
    options: ['A. the more confident', 'B. more confident', 'C. the most confident', 'D. most confident'],
    answer: 'A',
    explanation: 'the+比较级..., the+比较级...表示"越...越..."，confident的比较级是more confident。',
    knowledge_point: '比较级句型',
    difficulty: 2
  }
];

// 阅读诊断题（仔细阅读）
const readingQuestions = [
  {
    passage: `The concept of lifelong learning has gained increasing attention in recent years. With rapid technological advancements and changing job markets, the ability to continuously acquire new knowledge and skills has become essential for personal and professional growth.

Research shows that individuals who engage in lifelong learning tend to have better career prospects, higher job satisfaction, and improved cognitive function. They are more adaptable to change and better equipped to navigate the challenges of an ever-evolving world.

However, lifelong learning does not necessarily mean formal education. It can take many forms: reading books, taking online courses, attending workshops, learning a new language, or even acquiring a new hobby. The key is maintaining curiosity and a willingness to grow throughout one's life.

Employers are also recognizing the value of employees who demonstrate a commitment to continuous learning. Such individuals often bring fresh perspectives and innovative solutions to the workplace, making them invaluable assets to their organizations.`,
    questions: [
      {
        question: 'What is the main idea of the passage?',
        options: ['A. Formal education is the best way to learn', 'B. Lifelong learning is important in today\'s world', 'C. Technology has changed the job market', 'D. Employers prefer experienced workers'],
        answer: 'B',
        explanation: '文章通篇围绕"终身学习"展开，首段提出主题，后续论述其重要性和形式。A与原文相反，C和D只是细节。',
        knowledge_point: '主旨大意',
        difficulty: 2,
        error_type: '主旨判断错误'
      },
      {
        question: 'According to the passage, lifelong learners tend to have all of the following EXCEPT ______.',
        options: ['A. better career prospects', 'B. higher job satisfaction', 'C. improved cognitive function', 'D. higher salaries than others'],
        answer: 'D',
        explanation: '第二段明确提到better career prospects, higher job satisfaction, improved cognitive function，但没有提到higher salaries。',
        knowledge_point: '细节理解',
        difficulty: 2,
        error_type: '细节遗漏'
      },
      {
        question: 'What does the author say about the form of lifelong learning?',
        options: ['A. It must be formal education', 'B. It can be various forms', 'C. It requires online courses', 'D. It should be related to work'],
        answer: 'B',
        explanation: '第三段明确说"lifelong learning does not necessarily mean formal education. It can take many forms"，说明形式多样。',
        knowledge_point: '细节理解',
        difficulty: 2,
        error_type: '定位错误'
      },
      {
        question: 'The word "invaluable" in the last paragraph is closest in meaning to ______.',
        options: ['A. worthless', 'B. expensive', 'C. extremely useful', 'D. rare'],
        answer: 'C',
        explanation: 'invaluable意为"无价的，极有用的"，注意不要望文生义以为是"没有价值的"。根据上下文，持续学习的员工能带来新视角和创新方案，所以是极有价值的。',
        knowledge_point: '词义判断',
        difficulty: 3,
        error_type: '词义判断错误'
      }
    ]
  }
];

// 翻译诊断题
const translationQuestions = [
  {
    source: '随着互联网的发展，越来越多的人选择在线购物。这不仅方便了消费者，也改变了传统的商业模式。',
    reference: 'With the development of the Internet, more and more people choose to shop online. This not only benefits consumers but also changes the traditional business model.',
    knowledge_point: '中译英基础表达',
    difficulty: 2
  }
];

// 写作诊断题
const writingQuestions = [
  {
    topic: 'Directions: For this part, you are allowed 30 minutes to write a short essay on the importance of time management. You should write at least 120 words but no more than 180 words.',
    knowledge_point: '议论文写作',
    difficulty: 3
  }
];

// 听力诊断题（文本形式，可扩展音频）
const listeningQuestions = [
  {
    transcript: 'W: I heard you got a part-time job at the library. How is it going?\nM: Well, it\'s not bad. The pay is reasonable, and I can study when it\'s not busy.\nQ: What does the man think of his part-time job?',
    options: ['A. It pays very well', 'B. It allows him to study', 'C. It is too tiring', 'D. It takes too much time'],
    answer: 'B',
    explanation: '男士说"I can study when it\'s not busy"，说明工作允许他学习。A不对因为只是reasonable不是very well。',
    knowledge_point: '短对话-细节理解',
    difficulty: 2
  },
  {
    transcript: 'M: The meeting is supposed to start at 9 o\'clock.\nW: But it\'s already 9:15, and the manager hasn\'t shown up yet.\nQ: What can we learn from the conversation?',
    options: ['A. The meeting has been canceled', 'B. The manager is late', 'C. The man is the manager', 'D. The meeting started at 9:15'],
    answer: 'B',
    explanation: '会议9点开始，现在9:15经理还没到，说明经理迟到了。',
    knowledge_point: '短对话-推理判断',
    difficulty: 2
  }
];

// 阅读练习题（长篇阅读/选词填空素材）
const readingPractice = [
  {
    passage: `Climate change is one of the most pressing issues of our time. Scientists warn that rising global temperatures could lead to severe consequences, including extreme weather events, rising sea levels, and the loss of biodiversity.

The primary cause of climate change is the increasing concentration of greenhouse gases in the atmosphere, mainly due to human activities such as burning fossil fuels, deforestation, and industrial processes. These gases trap heat from the sun, causing the Earth\'s temperature to rise.

To address this challenge, countries around the world have taken various measures. Many have committed to reducing their carbon emissions by transitioning to renewable energy sources such as solar and wind power. Others have implemented policies to promote energy efficiency and sustainable transportation.

Individuals can also contribute to the fight against climate change. Simple actions like reducing energy consumption, using public transportation, recycling, and supporting environmentally friendly products can make a difference. While the challenge is enormous, collective action at all levels can help mitigate its effects and create a more sustainable future.`,
    questions: [
      {
        question: 'What is the main cause of climate change according to the passage?',
        options: ['A. Natural disasters', 'B. Human activities', 'C. Solar radiation', 'D. Population growth'],
        answer: 'B',
        explanation: '第二段明确指出"mainly due to human activities such as burning fossil fuels..."。',
        knowledge_point: '细节理解',
        difficulty: 2
      },
      {
        question: 'Which of the following is NOT mentioned as a measure to address climate change?',
        options: ['A. Using renewable energy', 'B. Promoting energy efficiency', 'C. Banning all industrial activities', 'D. Sustainable transportation'],
        answer: 'C',
        explanation: '第三段提到了renewable energy, energy efficiency, sustainable transportation，但没有提到banning all industrial activities。',
        knowledge_point: '细节理解',
        difficulty: 2
      },
      {
        question: 'The word "mitigate" in the last paragraph probably means ______.',
        options: ['A. worsen', 'B. reduce', 'C. ignore', 'D. cause'],
        answer: 'B',
        explanation: 'mitigate意为"减轻，缓解"，根据上下文"collective action can help mitigate its effects"，集体行动能帮助减轻影响。',
        knowledge_point: '词义判断',
        difficulty: 3
      },
      {
        question: 'What is the author\'s attitude towards solving climate change?',
        options: ['A. Pessimistic', 'B. Optimistic but realistic', 'C. Indifferent', 'D. Completely hopeless'],
        answer: 'B',
        explanation: '作者说"While the challenge is enormous, collective action...can help"，既承认挑战巨大，又相信集体行动有效，是乐观但现实的态度。',
        knowledge_point: '态度观点',
        difficulty: 3
      }
    ]
  }
];

module.exports = {
  vocabularyQuestions,
  grammarQuestions,
  readingQuestions,
  translationQuestions,
  writingQuestions,
  listeningQuestions,
  readingPractice
};
