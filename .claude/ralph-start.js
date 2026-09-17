// Ralph Loop — автономная реализация issues по фазам (milestones).
// Запуск: node .claude/ralph-start.js
// Мягкая остановка: поставить "active": false в ralph.config.json —
// раннер завершится после текущего шага.

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'ralph.config.json');
const LOG_FILE = path.join(__dirname, 'ralph.log');

process.chdir(ROOT);

class StopError extends Error {}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// Конфиг перечитывается перед каждым шагом, чтобы подхватывать "active": false.
function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

function ensureActive() {
  if (!loadConfig().active) {
    throw new StopError('Ralph выключен (active=false).');
  }
}

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8' }).trim();
}

function gh(args) {
  return JSON.parse(run('gh', args));
}

function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// captureOutput: вернуть итоговый ответ агента (stdout `claude -p`) вместо вывода в консоль.
function claude(
  { prompt, model, maxTurns, allowedTools, disallowedTools = [], captureOutput = false },
  description,
) {
  log(`▶️  ${description} (model=${model}, max-turns=${maxTurns})`);
  const start = Date.now();
  const seconds = () => ((Date.now() - start) / 1000).toFixed(1);

  const args = ['-p', prompt, '--model', model, '--max-turns', String(maxTurns)];
  args.push('--allowedTools', allowedTools.join(','));
  if (disallowedTools.length) args.push('--disallowedTools', disallowedTools.join(','));

  try {
    const output = execFileSync('claude', args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', captureOutput ? 'pipe' : 'inherit', 'inherit'],
    });
    log(`✔️  Готово: ${description} (${seconds()}s)`);
    return output?.trim() ?? '';
  } catch (error) {
    throw new StopError(`Ошибка: ${description} (${seconds()}s) — ${error.message}`);
  }
}

function openIssues(milestone, skipLabels) {
  const issues = gh([
    'issue',
    'list',
    '--milestone',
    milestone,
    '--state',
    'open',
    '--limit',
    '100',
    '--json',
    'number,title,labels',
  ]).sort((a, b) => a.number - b.number);

  const skipped = issues.filter((issue) => issue.labels.some((l) => skipLabels.includes(l.name)));
  const workable = issues.filter((issue) => !skipped.includes(issue));

  for (const issue of skipped) {
    log(`⏭️  Пропуск #${issue.number} (метка из skipLabels): ${issue.title}`);
  }
  return workable;
}

function isClosed(number) {
  return gh(['issue', 'view', String(number), '--json', 'state']).state === 'CLOSED';
}

function checkoutBranch(branch, baseBranch) {
  if (run('git', ['branch', '--show-current']) === branch) return;

  if (run('git', ['status', '--porcelain', '--untracked-files=no'])) {
    throw new StopError(`Есть незакоммиченные изменения — не могу переключиться на ${branch}.`);
  }

  const exists = run('git', ['branch', '--list', branch]) !== '';
  run('git', exists ? ['switch', branch] : ['switch', '-c', branch, baseBranch]);
  log(`🌿 Ветка ${branch}${exists ? '' : ` создана от ${baseBranch}`}`);
}

function findPr(branch) {
  const prs = gh(['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state']);
  return prs.find((pr) => pr.state === 'OPEN') ?? prs[0];
}

function createPr(phase, config) {
  run('git', ['push', '-u', 'origin', phase.branch]);

  const closed = gh([
    'issue',
    'list',
    '--milestone',
    phase.milestone,
    '--state',
    'closed',
    '--limit',
    '100',
    '--json',
    'number',
  ]);
  const body = [
    `Реализация milestone «${phase.milestone}».`,
    '',
    ...closed.map((issue) => `- Closes #${issue.number}`),
  ].join('\n');

  const url = run('gh', [
    'pr',
    'create',
    '--base',
    config.baseBranch,
    '--head',
    phase.branch,
    '--title',
    phase.prTitle,
    '--body',
    body,
  ]);
  log(`📬 PR создан: ${url}`);
  return findPr(phase.branch);
}

function runPhase(phase, index, config, budget) {
  log(`━━ Фаза ${index + 1}: ${phase.milestone} (${phase.branch})`);

  const existingPr = findPr(phase.branch);
  if (existingPr && existingPr.state !== 'OPEN') {
    log(`PR #${existingPr.number} уже ${existingPr.state}, фаза пропущена.`);
    return;
  }

  checkoutBranch(phase.branch, config.baseBranch);

  for (;;) {
    ensureActive();
    const [issue] = openIssues(phase.milestone, config.skipLabels);
    if (!issue) break;

    if (budget.left <= 0) {
      throw new StopError(`Лимит итераций (${config.maxIterations}) исчерпан.`);
    }
    budget.left--;

    claude(
      {
        ...config.work,
        prompt: fill(config.work.prompt, { ...phase, issue: issue.number, title: issue.title }),
      },
      `Issue #${issue.number}: ${issue.title}`,
    );

    // Агент не закрыл issue — повтор с нуля сожжёт токены, останавливаемся.
    if (!isClosed(issue.number)) {
      throw new StopError(`Issue #${issue.number} осталась открытой — нужна ручная проверка.`);
    }
  }

  if (existingPr) {
    log(`PR #${existingPr.number} уже открыт — пушим ветку, review не повторяем.`);
    run('git', ['push', 'origin', phase.branch]);
    return;
  }

  ensureActive();
  const pr = createPr(phase, config);
  const review = claude(
    {
      ...config.review,
      prompt: fill(config.review.prompt, { ...phase, pr: pr.number }),
      captureOutput: true,
    },
    `Code review PR #${pr.number}`,
  );
  postReviewComment(pr.number, review);
}

// Комментарий публикует раннер, а не агент: агент может «отчитаться» о публикации, не сделав её.
function postReviewComment(prNumber, review) {
  if (!review) {
    throw new StopError(
      `Code review PR #${prNumber} вернул пустой ответ — комментарий не опубликован.`,
    );
  }

  const bodyFile = path.join(os.tmpdir(), `ralph-review-${prNumber}-${Date.now()}.md`);
  fs.writeFileSync(bodyFile, `## 🤖 Code review\n\n${review}\n`);
  try {
    const url = run('gh', ['pr', 'comment', String(prNumber), '--body-file', bodyFile]);
    log(`💬 Ревью опубликовано: ${url}`);
  } finally {
    fs.rmSync(bodyFile, { force: true });
  }
}

function main() {
  const config = loadConfig();
  const budget = { left: config.maxIterations };

  log('🚀 Ralph запущен');
  try {
    ensureActive();
    config.phases.forEach((phase, index) => runPhase(phase, index, config, budget));
    log('🎉 Все фазы завершены!');
  } catch (error) {
    if (!(error instanceof StopError)) throw error;
    log(`⛔ ${error.message}`);
    process.exitCode = 1;
  }
}

main();
