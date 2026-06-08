import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bankPath = path.join(root, 'src', 'data', 'bank.json');
const zipPath = process.argv[2] || 'W:/Download/南京工业大学毛概历年试卷_统一格式含答案_JSON打包.zip';
const entryName = '南京工业大学毛概历年试卷_统一格式_含答案.json';

const TYPE_LABEL = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  true_false: '判断题',
  short_answer: '简答题',
  essay: '论述题',
  material_analysis: '材料题'
};

function readZipEntry(zip, entry) {
  const script = [
    '$ErrorActionPreference = "Stop"',
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    `$zipPath = ${JSON.stringify(zip)}`,
    `$entryName = ${JSON.stringify(entry)}`,
    '$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)',
    'try {',
    '  $entry = $zip.Entries | Where-Object { $_.FullName -eq $entryName } | Select-Object -First 1',
    '  if (-not $entry) { throw "Missing zip entry: $entryName" }',
    '  $reader = New-Object System.IO.StreamReader($entry.Open(), [System.Text.Encoding]::UTF8)',
    '  try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::Write($reader.ReadToEnd()) } finally { $reader.Dispose() }',
    '} finally { $zip.Dispose() }'
  ].join('; ');
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function optionsFromObject(options = {}) {
  return Object.entries(options).map(([key, text]) => ({ key, text: String(text ?? '') }));
}

function optionText(options) {
  return Object.fromEntries(options.map((option) => [option.key, option.text]));
}

function joinAnswerParts(answer) {
  if (!answer || typeof answer !== 'object') return '';
  const parts = [];
  if (answer.intro) parts.push(answer.intro);
  if (Array.isArray(answer.points)) parts.push(...answer.points.map((point, index) => `${index + 1}. ${point}`));
  if (answer.conclusion) parts.push(answer.conclusion);
  if (Array.isArray(answer.scoring_hint) && answer.scoring_hint.length) parts.push(`答题提示：${answer.scoring_hint.join('；')}`);
  if (answer.text) parts.push(answer.text);
  if (answer.brief_reason) parts.push(`简要解析：${answer.brief_reason}`);
  return parts.filter(Boolean).join('\n');
}

function choiceExplanation(question, answerKeys) {
  const answer = question.answer || {};
  const options = question.options || {};
  const text = answer.text || answerKeys.map((key) => options[key]).filter(Boolean).join('；');
  const reason = answer.brief_reason ? `。${answer.brief_reason}` : '';
  return `正确答案：${answerKeys.join('、')}。${text}${reason}`;
}

function convertQuestion(paper, section, question) {
  const paperId = paper.paper_id;
  const rawType = question.type || section.question_type;
  const base = {
    id: `paper-${question.qid}`,
    chapterCode: `paper-${paperId}`,
    chapter: `${paperId} 南京工业大学历年试卷`,
    source: '南京工业大学毛概历年试卷',
    sourceNumber: question.number ?? '',
    platformAnswer: [],
    userAnswer: [],
    userText: '',
    correctionNote: '',
    initialWrong: false,
    duplicateOf: '',
    tags: ['历年试卷', paperId, TYPE_LABEL[rawType] || rawType]
  };

  if (rawType === 'single_choice') {
    const options = optionsFromObject(question.options);
    const answer = question.answer?.option ? [question.answer.option] : [];
    return {
      ...base,
      type: 'single',
      question: question.stem,
      options,
      answer,
      platformAnswer: answer,
      userAnswer: answer,
      explanation: choiceExplanation(question, answer),
      answerText: '',
      optionText: optionText(options),
      tags: [...base.tags, '单选']
    };
  }

  if (rawType === 'multiple_choice') {
    const options = optionsFromObject(question.options);
    const answer = Array.isArray(question.answer?.options) ? question.answer.options : [];
    return {
      ...base,
      type: 'multi',
      question: question.stem,
      options,
      answer,
      platformAnswer: answer,
      userAnswer: answer,
      explanation: choiceExplanation(question, answer),
      answerText: '',
      optionText: optionText(options),
      tags: [...base.tags, '多选', '多选陷阱']
    };
  }

  if (rawType === 'true_false') {
    const options = [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }];
    const answer = question.answer?.is_true ? ['A'] : ['B'];
    return {
      ...base,
      type: 'single',
      question: question.stem,
      options,
      answer,
      platformAnswer: answer,
      userAnswer: answer,
      explanation: `正确答案：${answer[0]}。${question.answer?.text || options.find((option) => option.key === answer[0])?.text || ''}${question.answer?.brief_reason ? `。${question.answer.brief_reason}` : ''}`,
      answerText: '',
      optionText: optionText(options),
      tags: [...base.tags, '判断题']
    };
  }

  const stem = rawType === 'material_analysis' && question.material
    ? `【材料】${question.material}\n\n${question.stem}`
    : question.stem;
  return {
    ...base,
    type: 'short',
    question: stem,
    options: [],
    answer: [],
    explanation: joinAnswerParts(question.answer),
    answerText: joinAnswerParts(question.answer),
    optionText: {},
    tags: [...base.tags, '背诵']
  };
}

function recomputeStats(bank) {
  const chapters = bank.stats.chapters.map((chapter) => {
    const questions = bank.questions.filter((question) => question.chapterCode === chapter.code);
    return {
      code: chapter.code,
      name: chapter.name,
      total: questions.length,
      single: questions.filter((question) => question.type === 'single').length,
      multi: questions.filter((question) => question.type === 'multi').length,
      short: questions.filter((question) => question.type === 'short').length,
      initialWrong: questions.filter((question) => question.initialWrong).length
    };
  });
  bank.stats = {
    ...bank.stats,
    total: bank.questions.length,
    objective: bank.questions.filter((question) => question.type !== 'short').length,
    single: bank.questions.filter((question) => question.type === 'single').length,
    multi: bank.questions.filter((question) => question.type === 'multi').length,
    short: bank.questions.filter((question) => question.type === 'short').length,
    initialWrong: bank.questions.filter((question) => question.initialWrong).length,
    chapters
  };
}

const bank = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
const source = JSON.parse(readZipEntry(zipPath, entryName).replace(/^\uFEFF/, ''));

bank.questions = bank.questions.filter((question) => !String(question.id).startsWith('paper-'));
bank.stats.chapters = bank.stats.chapters.filter((chapter) => !String(chapter.code).startsWith('paper-'));

const imported = [];
for (const paper of source.papers) {
  const chapterCode = `paper-${paper.paper_id}`;
  bank.stats.chapters.push({ code: chapterCode, name: `${paper.paper_id} 南京工业大学历年试卷`, total: 0, single: 0, multi: 0, short: 0, initialWrong: 0 });
  for (const section of paper.sections || []) {
    for (const question of section.questions || []) {
      imported.push(convertQuestion(paper, section, question));
    }
  }
}

bank.questions.push(...imported);
bank.version = `${String(bank.version).replace(/\+njust-papers-[^+]+/g, '')}+njust-papers-${source.generated_date || 'unknown'}`;
bank.generatedAt = source.generated_date || bank.generatedAt;
recomputeStats(bank);

fs.writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`, 'utf8');
console.log(`Imported ${imported.length} NJUST paper questions.`);
console.log(`Bank now has ${bank.stats.total} questions: ${bank.stats.single} single, ${bank.stats.multi} multi, ${bank.stats.short} short.`);