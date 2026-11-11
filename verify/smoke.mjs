#!/usr/bin/env node
// API 冒烟验收脚本（spec/06 §7）。Node 24，不依赖第三方包，只用内置的 fetch、FormData、Blob。
//
//   node verify/smoke.mjs                          默认 http://localhost:3000（经过 Next 代理）
//   node verify/smoke.mjs http://localhost:8080    直连后端
//   node verify/smoke.mjs http://localhost:8080 --only tasks
//   node verify/smoke.mjs --self-check             不发请求：检查脚本自身、夹具、样例文件和封面
//
// 每条检查输出 ✓ 或 ✗ 和耗时；⚠ 是不影响结果的提示。有任何 ✗ 时退出码为 1。

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';

// ───────────────────────── 常量（来自 spec/03、spec/04） ─────────────────────────

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const FIXTURE_DIR = path.join(HERE, 'fixtures');
const COVER_DIR = path.join(REPO_ROOT, 'backend', 'src', 'main', 'resources', 'static', 'demo', 'covers');

const SECTION_NAMES = ['templates', 'auth', 'upload', 'tasks', 'isolation'];
const SECTIONS_NEEDING_DEV_API = new Set(['tasks', 'isolation']);
const SECTION_TITLES = {
  templates: 'templates：分类与模板',
  auth: 'auth：登录、注册、退出',
  upload: 'upload：素材上传与读取',
  tasks: 'tasks：提交、执行、失败与查询',
  isolation: 'isolation：用户隔离',
};

const TASK_STATUSES = ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'];
const STAGES = ['MATERIAL_CHECK', 'GENERATING', 'RESULT_ASSEMBLY'];
const STEP_STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED'];
const FAIL_STAGES = ['NONE', ...STAGES];
const TERMINAL = new Set(['SUCCEEDED', 'FAILED']);
const TASK_ERROR_CODES = [
  'SIMULATED_FAILURE', 'MATERIAL_FILE_MISSING', 'MATERIAL_CORRUPTED', 'MATERIAL_RESOLUTION_TOO_LOW',
  'GENERATION_FAILED', 'RESULT_WRITE_FAILED', 'INTERRUPTED', 'INTERNAL_ERROR',
];
const MIME_TYPES = ['image/jpeg', 'image/png'];
const STATUS_LABELS = { PENDING: '等待处理', PROCESSING: '处理中', SUCCEEDED: '已完成', FAILED: '失败' };
const STAGE_LABELS = { MATERIAL_CHECK: '素材检查', GENERATING: '模拟生成', RESULT_ASSEMBLY: '结果整理' };
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
const SESSION_COOKIE = 'XY_SESSION';
const FAST_DELAYS = { MATERIAL_CHECK: 300, GENERATING: 600, RESULT_ASSEMBLY: 300 };
const MAX_DELAY_MS = 60000;

const SEED_CATEGORIES = [
  { code: 'hot', name: '热门', templateCount: 2 },
  { code: 'pets', name: '萌宠', templateCount: 2 },
  { code: 'festival', name: '节日', templateCount: 2 },
  { code: 'travel', name: '旅行', templateCount: 2 },
  { code: 'wedding', name: '婚礼', templateCount: 0 },
];
const MB5 = 5 * 1024 * 1024;
const JPEG_PNG = ['image/jpeg', 'image/png'];
// 按列表应有的顺序排列（先分类的 sort_order，再模板的 sort_order）；description 不比对
const SEED_TEMPLATES = {
  'hot-avatar': { title: '迷你头像', categoryCode: 'hot', requiredImageCount: 1, acceptedMimeTypes: JPEG_PNG, maxFileSizeBytes: 204800 },
  'hot-film': { title: '复古胶片', categoryCode: 'hot', requiredImageCount: 1, acceptedMimeTypes: ['image/jpeg'], maxFileSizeBytes: MB5 },
  'pet-sticker': { title: '萌宠贴纸', categoryCode: 'pets', requiredImageCount: 1, acceptedMimeTypes: JPEG_PNG, maxFileSizeBytes: MB5 },
  'pet-duo': { title: '双宠合影', categoryCode: 'pets', requiredImageCount: 2, acceptedMimeTypes: JPEG_PNG, maxFileSizeBytes: MB5 },
  'festival-hug': { title: '节日拥抱', categoryCode: 'festival', requiredImageCount: 2, acceptedMimeTypes: JPEG_PNG, maxFileSizeBytes: MB5 },
  'festival-card': { title: '新年贺卡', categoryCode: 'festival', requiredImageCount: 1, acceptedMimeTypes: ['image/png'], maxFileSizeBytes: MB5 },
  'travel-postcard': { title: '旅行明信片', categoryCode: 'travel', requiredImageCount: 2, acceptedMimeTypes: JPEG_PNG, maxFileSizeBytes: MB5 },
  'travel-triptych': { title: '旅途三联拼', categoryCode: 'travel', requiredImageCount: 3, acceptedMimeTypes: JPEG_PNG, maxFileSizeBytes: MB5 },
};
const SEED_TEMPLATE_ORDER = Object.keys(SEED_TEMPLATES);
const DISABLED_TEMPLATE = 'wedding-invite';
const ALL_TEMPLATE_IDS = [...SEED_TEMPLATE_ORDER, DISABLED_TEMPLATE];
const SEED_USERS = {
  demo: { username: 'demo', password: 'demo123' },
  alice: { username: 'alice', password: 'alice123' },
};

const FIXTURE_NAMES = [
  'user', 'categories', 'templates', 'template-detail', 'material',
  'task-pending', 'task-processing', 'task-succeeded', 'task-failed', 'task-list',
  'simulation', 'error-validation', 'error-not-found',
];
const TASK_FIXTURE_BY_STATUS = {
  PENDING: 'task-pending', PROCESSING: 'task-processing', SUCCEEDED: 'task-succeeded', FAILED: 'task-failed',
};

// 样例文件（spec/04 §8，B1 由 scripts/GenerateDemoAssets.java 生成）
const SAMPLE_SPECS = {
  'photo-1.jpg': { type: 'jpeg', width: 1200, height: 1200, maxBytes: 204800 },
  'photo-2.jpg': { type: 'jpeg', width: 1200, height: 900, maxBytes: 204800 },
  'photo-3.png': { type: 'png', width: 900, height: 1200, maxBytes: MB5 },
  'large-photo.jpg': { type: 'jpeg', width: 2400, height: 1800, minBytes: 204801, maxBytes: MB5 },
  'tiny-32.png': { type: 'png', width: 32, height: 32 },
  'not-image.jpg': { type: 'other', minBytes: 1 },
};
const COVER_SPEC = { type: 'png', width: 720, height: 960 };
const RESULT_SIZE = { width: 720, height: 960 };

const USAGE = `用法：node verify/smoke.mjs [地址] [选项]

  地址               默认 http://localhost:3000（经过 Next 代理）；直连后端用 http://localhost:8080
  --only <段名>      只跑指定的段，可以用逗号分隔或重复使用：${SECTION_NAMES.join('、')}
  --samples <目录>   样例文件目录，默认是仓库里的 samples/
  --self-check       不发请求：检查脚本自身、夹具、样例文件和封面
  -h, --help         显示本说明

templates、auth、upload 三段不需要开发接口；tasks、isolation 需要（DEV_API_ENABLED=true）。
退出码：全部通过为 0；有任何 ✗ 为 1；参数错误为 2。`;

// ───────────────────────── 输出与断言 ─────────────────────────

const stats = { pass: 0, fail: 0, warn: 0 };
let insideCheck = false;
let pendingWarnings = [];

class CheckFailure extends Error {}
class SectionAbort extends Error {}
class UsageError extends Error {}

const log = (line = '') => process.stdout.write(`${line}\n`);
const indent = (text, pad = '      ') => String(text).split('\n').map((l) => pad + l).join('\n');

function show(value, max = 300) {
  let s;
  try { s = JSON.stringify(value); } catch { s = String(value); }
  if (s === undefined) s = String(value);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function fail(message) { throw new CheckFailure(message); }
function ensure(condition, message) { if (!condition) fail(message); }
function ensureEqual(actual, expected, what) {
  if (!isDeepStrictEqual(actual, expected)) fail(`${what}：期望 ${show(expected)}，实际 ${show(actual)}`);
}
function ensureNoErrors(errors, title) {
  if (errors.length) fail(`${title}：\n${errors.map((e) => `- ${e}`).join('\n')}`);
}

function section(title) { log(''); log(`▶ ${title}`); }

function warn(message) {
  stats.warn += 1;
  if (insideCheck) pendingWarnings.push(message);
  else log(`  ⚠ ${message}`);
}

async function check(name, fn, { critical = false } = {}) {
  const started = performance.now();
  insideCheck = true;
  let note;
  let error;
  try { note = await fn(); } catch (e) { error = e; } finally { insideCheck = false; }
  const ms = Math.round(performance.now() - started);
  if (error) {
    stats.fail += 1;
    log(`  ✗ ${name}（${ms}ms）`);
    log(indent(error instanceof CheckFailure ? error.message : (error?.stack ?? String(error))));
  } else {
    stats.pass += 1;
    log(`  ✓ ${name}${note ? `：${note}` : ''}（${ms}ms）`);
  }
  for (const w of pendingWarnings.splice(0)) log(`    ⚠ ${w}`);
  if (error && critical) throw new SectionAbort(name);
  return !error;
}

// ───────────────────────── 契约比对（spec/06 §6.2） ─────────────────────────

const FIXTURES = {};

function typeName(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// 字段集合必须相同；值类型必须相同，null 与任何类型兼容；数组两边都非空时比对第一个元素
function shapeDiff(actual, expected, at = '$', out = []) {
  const ta = typeName(actual);
  const te = typeName(expected);
  if (ta === 'null' || te === 'null') return out;
  if (ta !== te) { out.push(`${at}：类型应为 ${te}，实际为 ${ta}`); return out; }
  if (ta === 'object') {
    const missing = Object.keys(expected).filter((k) => !Object.hasOwn(actual, k));
    const extra = Object.keys(actual).filter((k) => !Object.hasOwn(expected, k));
    if (missing.length) out.push(`${at}：缺少字段 ${missing.join('、')}`);
    if (extra.length) out.push(`${at}：多出字段 ${extra.join('、')}`);
    for (const k of Object.keys(expected)) {
      if (Object.hasOwn(actual, k)) shapeDiff(actual[k], expected[k], `${at}.${k}`, out);
    }
  } else if (ta === 'array' && actual.length > 0 && expected.length > 0) {
    shapeDiff(actual[0], expected[0], `${at}[0]`, out);
  }
  return out;
}

function expectShape(actual, fixtureName) {
  ensureNoErrors(shapeDiff(actual, FIXTURES[fixtureName]), `字段与夹具 ${fixtureName}.json 不一致`);
}

// ───────────────────────── 语义校验（spec/03 §1、§2、§5） ─────────────────────────

const isInt = (v) => Number.isInteger(v);
const isText = (v) => typeof v === 'string' && v.length > 0;
const time = (v) => Date.parse(v);

function tsErrors(v, at, { nullable = false } = {}) {
  if (v === null && nullable) return [];
  if (typeof v !== 'string' || !TIMESTAMP.test(v) || Number.isNaN(time(v))) {
    return [`${at}：应为以 Z 结尾的 ISO-8601 UTC 时间，实际 ${show(v)}`];
  }
  return [];
}

function listErrors(body, itemErrors) {
  if (typeName(body) !== 'object' || !Array.isArray(body.items)) return ['响应应为 { "items": [...] }'];
  return body.items.flatMap((item, i) => itemErrors(item, `items[${i}]`));
}

function userErrors(u, at = 'user') {
  const e = [];
  if (!isInt(u?.id) || u.id <= 0) e.push(`${at}.id 应为正整数`);
  if (!isText(u?.username)) e.push(`${at}.username 不能为空`);
  if (!isText(u?.displayName)) e.push(`${at}.displayName 不能为空`);
  e.push(...tsErrors(u?.createdAt, `${at}.createdAt`));
  return e;
}

function categoryErrors(c, at) {
  const e = [];
  if (!isText(c?.code)) e.push(`${at}.code 不能为空`);
  if (!isText(c?.name)) e.push(`${at}.name 不能为空`);
  if (!isInt(c?.templateCount) || c.templateCount < 0) e.push(`${at}.templateCount 应为非负整数`);
  return e;
}

function templateSummaryErrors(t, at) {
  const e = [];
  for (const k of ['id', 'title', 'categoryCode', 'categoryName']) if (!isText(t?.[k])) e.push(`${at}.${k} 不能为空`);
  if (t?.coverUrl !== `/demo/covers/${t?.id}.png`) e.push(`${at}.coverUrl 应为 /demo/covers/${t?.id}.png，实际 ${show(t?.coverUrl)}`);
  if (!isInt(t?.requiredImageCount) || t.requiredImageCount < 1 || t.requiredImageCount > 4) e.push(`${at}.requiredImageCount 应在 1–4 之间`);
  return e;
}

function templateDetailErrors(t, at = 'template') {
  const e = templateSummaryErrors(t, at);
  if (typeof t?.description !== 'string') e.push(`${at}.description 应为字符串`);
  const types = t?.acceptedMimeTypes;
  if (!Array.isArray(types) || types.length === 0) e.push(`${at}.acceptedMimeTypes 应为非空数组`);
  else {
    if (types.some((m) => !MIME_TYPES.includes(m))) e.push(`${at}.acceptedMimeTypes 只能包含 ${MIME_TYPES.join('、')}，实际 ${show(types)}`);
    if (new Set(types).size !== types.length) e.push(`${at}.acceptedMimeTypes 有重复`);
  }
  if (!isInt(t?.maxFileSizeBytes) || t.maxFileSizeBytes <= 0) e.push(`${at}.maxFileSizeBytes 应为正整数`);
  return e;
}

function materialErrors(m, at = 'material') {
  const e = [];
  if (!isInt(m?.id) || m.id <= 0) e.push(`${at}.id 应为正整数`);
  if (!isText(m?.originalName)) e.push(`${at}.originalName 不能为空`);
  if (!MIME_TYPES.includes(m?.mimeType)) e.push(`${at}.mimeType 应为 ${MIME_TYPES.join(' 或 ')}，实际 ${show(m?.mimeType)}`);
  if (!isInt(m?.sizeBytes) || m.sizeBytes <= 0) e.push(`${at}.sizeBytes 应为正整数`);
  if (m?.url !== `/api/materials/${m?.id}/content`) e.push(`${at}.url 应为 /api/materials/${m?.id}/content，实际 ${show(m?.url)}`);
  e.push(...tsErrors(m?.createdAt, `${at}.createdAt`));
  return e;
}

function simulationErrors(s, at = 'simulation') {
  const e = [];
  if (!FAIL_STAGES.includes(s?.failStage)) e.push(`${at}.failStage 应为 ${FAIL_STAGES.join(' / ')}，实际 ${show(s?.failStage)}`);
  const d = s?.delaysMs;
  if (typeName(d) !== 'object') e.push(`${at}.delaysMs 应为对象`);
  else {
    if (!isDeepStrictEqual(Object.keys(d).sort(), [...STAGES].sort())) e.push(`${at}.delaysMs 的键应正好是 ${STAGES.join('、')}，实际 ${show(Object.keys(d))}`);
    for (const [k, v] of Object.entries(d)) if (!isInt(v) || v < 0 || v > MAX_DELAY_MS) e.push(`${at}.delaysMs.${k} 应为 0–${MAX_DELAY_MS} 的整数，实际 ${show(v)}`);
  }
  if (typeof s?.queryOutage !== 'boolean') e.push(`${at}.queryOutage 应为布尔值`);
  return e;
}

function errorBodyErrors(b, at = 'error') {
  const e = [];
  if (!isText(b?.code)) e.push(`${at}.code 不能为空`);
  if (!isText(b?.message)) e.push(`${at}.message 不能为空（给用户看的中文说明）`);
  if (!Array.isArray(b?.fieldErrors)) { e.push(`${at}.fieldErrors 应为数组`); return e; }
  if (b.code !== 'VALIDATION_FAILED' && b.fieldErrors.length > 0) e.push(`${at}：只有 VALIDATION_FAILED 的 fieldErrors 可以非空，当前 code 是 ${b.code}`);
  b.fieldErrors.forEach((f, i) => {
    if (!isText(f?.field) || !isText(f?.message)) e.push(`${at}.fieldErrors[${i}] 应为 { field, message }，且都不为空`);
  });
  return e;
}

function taskErrors(t, at = 'task') {
  const e = [];
  if (typeName(t) !== 'object') return [`${at} 应为对象`];
  if (!isInt(t.id) || t.id <= 0) e.push(`${at}.id 应为正整数`);
  if (!isText(t.templateId)) e.push(`${at}.templateId 不能为空`);
  if (!isText(t.templateTitle)) e.push(`${at}.templateTitle 不能为空`);
  if (t.coverUrl !== `/demo/covers/${t.templateId}.png`) e.push(`${at}.coverUrl 应为 /demo/covers/${t.templateId}.png，实际 ${show(t.coverUrl)}`);
  if (!TASK_STATUSES.includes(t.status)) e.push(`${at}.status 取值非法：${show(t.status)}`);
  for (const k of ['stage', 'failedStage']) {
    if (t[k] !== null && !STAGES.includes(t[k])) e.push(`${at}.${k} 取值非法：${show(t[k])}`);
  }
  if (t.errorCode !== null && !TASK_ERROR_CODES.includes(t.errorCode)) e.push(`${at}.errorCode 不在 03 §5.2 的列表里：${show(t.errorCode)}`);
  e.push(
    ...tsErrors(t.createdAt, `${at}.createdAt`),
    ...tsErrors(t.updatedAt, `${at}.updatedAt`),
    ...tsErrors(t.startedAt, `${at}.startedAt`, { nullable: true }),
    ...tsErrors(t.finishedAt, `${at}.finishedAt`, { nullable: true }),
  );

  if (!Array.isArray(t.materials) || t.materials.length === 0) e.push(`${at}.materials 应为非空数组`);
  else {
    t.materials.forEach((m, i) => {
      if (m?.slotIndex !== i) e.push(`${at}.materials[${i}].slotIndex 应为 ${i}，实际 ${show(m?.slotIndex)}`);
      if (!isInt(m?.materialId)) e.push(`${at}.materials[${i}].materialId 应为整数`);
      else if (m.url !== `/api/materials/${m.materialId}/content`) e.push(`${at}.materials[${i}].url 应为 /api/materials/${m.materialId}/content，实际 ${show(m.url)}`);
    });
  }

  if (!Array.isArray(t.steps)) { e.push(`${at}.steps 应为数组`); return e; }
  t.steps.forEach((s, i) => {
    const sp = `${at}.steps[${i}]`;
    if (!STAGES.includes(s?.stage)) e.push(`${sp}.stage 取值非法：${show(s?.stage)}`);
    if (!STEP_STATUSES.includes(s?.status)) e.push(`${sp}.status 取值非法：${show(s?.status)}`);
    e.push(...tsErrors(s?.startedAt, `${sp}.startedAt`), ...tsErrors(s?.finishedAt, `${sp}.finishedAt`, { nullable: true }));
    if (s?.status === 'RUNNING' && s.finishedAt !== null) e.push(`${sp}：RUNNING 的步骤 finishedAt 应为 null`);
    if (s?.status !== 'RUNNING' && s?.finishedAt === null) e.push(`${sp}：已结束的步骤 finishedAt 不能为 null`);
    if (s?.finishedAt && time(s.finishedAt) < time(s.startedAt)) e.push(`${sp}：finishedAt 早于 startedAt`);
    if (i > 0 && time(s?.startedAt) < time(t.steps[i - 1]?.startedAt)) e.push(`${sp}.startedAt 早于上一步`);
    if (i < t.steps.length - 1 && s?.status !== 'SUCCEEDED') e.push(`${sp}：后面还有步骤，所以状态应为 SUCCEEDED，实际 ${show(s?.status)}`);
  });
  const stages = t.steps.map((s) => s?.stage);
  if (!isDeepStrictEqual(stages, STAGES.slice(0, stages.length))) {
    e.push(`${at}.steps 应按 ${STAGES.join(' → ')} 的顺序排列，实际 [${stages.join(', ')}]`);
  }

  if (t.startedAt && time(t.startedAt) < time(t.createdAt)) e.push(`${at}.startedAt 早于 createdAt`);
  if (t.finishedAt && t.startedAt && time(t.finishedAt) < time(t.startedAt)) e.push(`${at}.finishedAt 早于 startedAt`);
  if (time(t.updatedAt) < time(t.createdAt)) e.push(`${at}.updatedAt 早于 createdAt`);

  // 03 §2 的状态表
  const last = t.steps.at(-1);
  const mustBeNull = (keys) => {
    for (const k of keys) if (t[k] !== null) e.push(`${at}：${t.status} 时 ${k} 应为 null，实际 ${show(t[k])}`);
  };
  switch (t.status) {
    case 'PENDING':
      mustBeNull(['stage', 'failedStage', 'errorCode', 'errorMessage', 'resultUrl', 'startedAt', 'finishedAt']);
      if (t.steps.length) e.push(`${at}：PENDING 时 steps 应为空`);
      break;
    case 'PROCESSING':
      mustBeNull(['failedStage', 'errorCode', 'errorMessage', 'resultUrl', 'finishedAt']);
      if (t.startedAt === null) e.push(`${at}：PROCESSING 时 startedAt 不能为 null`);
      if (t.stage === null) { if (t.steps.length) e.push(`${at}：stage 为 null 时 steps 应为空`); }
      else if (last?.stage !== t.stage) e.push(`${at}：最后一条步骤应是当前阶段 ${t.stage}，实际 ${show(last?.stage)}`);
      else if (last.status === 'FAILED') e.push(`${at}：PROCESSING 时当前步骤不能是 FAILED`);
      break;
    case 'SUCCEEDED':
      mustBeNull(['failedStage', 'errorCode', 'errorMessage']);
      if (t.stage !== 'RESULT_ASSEMBLY') e.push(`${at}：SUCCEEDED 时 stage 应为 RESULT_ASSEMBLY，实际 ${show(t.stage)}`);
      if (t.resultUrl !== `/api/tasks/${t.id}/result`) e.push(`${at}.resultUrl 应为 /api/tasks/${t.id}/result，实际 ${show(t.resultUrl)}`);
      if (t.steps.length !== STAGES.length || t.steps.some((s) => s?.status !== 'SUCCEEDED')) e.push(`${at}：SUCCEEDED 时应有三条成功的步骤`);
      if (t.startedAt === null || t.finishedAt === null) e.push(`${at}：SUCCEEDED 时 startedAt 和 finishedAt 都不能为 null`);
      break;
    case 'FAILED':
      mustBeNull(['resultUrl']);
      if (t.failedStage !== t.stage) e.push(`${at}：FAILED 时 failedStage 应与 stage 相同（${show(t.stage)}），实际 ${show(t.failedStage)}`);
      if (!isText(t.errorCode)) e.push(`${at}：FAILED 时 errorCode 不能为空`);
      if (!isText(t.errorMessage)) e.push(`${at}：FAILED 时 errorMessage 不能为空`);
      if (t.finishedAt === null) e.push(`${at}：FAILED 时 finishedAt 不能为 null`);
      if (t.stage === null) { if (t.steps.length) e.push(`${at}：stage 为 null 时 steps 应为空`); }
      else if (last?.stage !== t.stage) e.push(`${at}：最后一条步骤应是失败阶段 ${t.stage}，实际 ${show(last?.stage)}`);
      else if (t.errorCode !== 'INTERRUPTED' && last.status !== 'FAILED') e.push(`${at}：失败阶段的步骤状态应为 FAILED，实际 ${show(last.status)}`);
      break;
    default:
      break;
  }
  return e;
}

function taskLabel(t) {
  const status = STATUS_LABELS[t?.status] ?? String(t?.status);
  return t?.stage && t.status !== 'SUCCEEDED' && t.status !== 'PENDING' ? `${status}·${STAGE_LABELS[t.stage] ?? t.stage}` : status;
}

function progressRank(t) {
  if (t.status === 'PENDING') return 0;
  if (t.status === 'PROCESSING') return t.stage ? 2 + STAGES.indexOf(t.stage) : 1;
  return 9;
}

// 同一任务前后两次观察：只能前进；终态之后完全不变
function progressErrors(prev, next) {
  const e = [];
  if (TERMINAL.has(prev.status)) {
    if (!isDeepStrictEqual(prev, next)) {
      const changed = Object.keys(prev).filter((k) => !isDeepStrictEqual(prev[k], next[k]));
      e.push(`终态（${taskLabel(prev)}）的任务被修改了：${changed.join('、')}`);
    }
    return e;
  }
  if (progressRank(next) < progressRank(prev)) e.push(`状态后退：${taskLabel(prev)} → ${taskLabel(next)}`);
  if (time(next.updatedAt) < time(prev.updatedAt)) e.push(`updatedAt 后退：${prev.updatedAt} → ${next.updatedAt}`);
  if (next.steps.length < prev.steps.length) e.push(`步骤记录变少：${prev.steps.length} → ${next.steps.length}`);
  prev.steps.forEach((s, i) => {
    if (s.status !== 'RUNNING' && !isDeepStrictEqual(s, next.steps[i])) e.push(`已结束的步骤 ${s.stage} 被修改了`);
  });
  if (!isDeepStrictEqual(prev.materials, next.materials)) e.push('任务的素材发生了变化');
  if (prev.id !== next.id || prev.templateId !== next.templateId) e.push('id 或 templateId 发生了变化');
  if (time(prev.createdAt) !== time(next.createdAt)) e.push(`createdAt 发生了变化：${prev.createdAt} → ${next.createdAt}`);
  return e;
}

// ───────────────────────── 文件头解析 ─────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function imageInfo(buf) {
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIGNATURE) && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2;
    while (i + 3 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker === 0xff) { i += 1; continue; }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { i += 2; continue; }
      if (marker === 0xd9 || marker === 0xda) break;
      const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSof && i + 8 < buf.length) return { type: 'jpeg', width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { type: 'jpeg', width: null, height: null };
  }
  return { type: 'other', width: null, height: null };
}

function assetErrors(buf, spec) {
  const e = [];
  const info = imageInfo(buf);
  if (spec.type === 'other') {
    if (info.type !== 'other') e.push(`不应是 JPEG 或 PNG，实际文件头是 ${info.type}`);
  } else if (info.type !== spec.type) {
    e.push(`应为 ${spec.type.toUpperCase()}，实际文件头是 ${info.type}`);
  } else if (spec.width && (info.width !== spec.width || info.height !== spec.height)) {
    e.push(`尺寸应为 ${spec.width}×${spec.height}，实际 ${info.width}×${info.height}`);
  }
  if (spec.maxBytes && buf.length > spec.maxBytes) e.push(`应不超过 ${spec.maxBytes} 字节，实际 ${buf.length}`);
  if (spec.minBytes && buf.length < spec.minBytes) e.push(`应至少 ${spec.minBytes} 字节，实际 ${buf.length}`);
  return e;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function mimeFromName(name) {
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  return 'application/octet-stream';
}

// ───────────────────────── HTTP 与 Cookie ─────────────────────────

function parseSetCookie(header) {
  const [pair, ...attrs] = header.split(';');
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  const cookie = { name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), attrs: {} };
  for (const attr of attrs) {
    const [k, ...v] = attr.split('=');
    if (k.trim()) cookie.attrs[k.trim().toLowerCase()] = v.length ? v.join('=').trim() : true;
  }
  return cookie;
}

function isCookieDeletion(c) {
  if (c.attrs['max-age'] !== undefined && Number(c.attrs['max-age']) <= 0) return true;
  if (typeof c.attrs.expires === 'string' && time(c.attrs.expires) <= Date.now()) return true;
  return false;
}

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
    this.user = null;
  }

  get loggedIn() { return this.cookies.has(SESSION_COOKIE); }

  cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }

  clone(label) {
    const s = new Session(label);
    s.cookies = new Map(this.cookies);
    s.user = this.user;
    return s;
  }
}

let BASE = 'http://localhost:3000';

async function request(method, urlPath, { session, json, form, headers = {}, timeoutMs = 15000 } = {}) {
  const h = new Headers(headers);
  if (session?.cookies.size) h.set('cookie', session.cookieHeader());
  let body;
  if (json !== undefined) { h.set('content-type', 'application/json'); body = JSON.stringify(json); }
  else if (form) body = form;
  const started = performance.now();
  let res;
  try {
    res = await fetch(new URL(urlPath, BASE), { method, headers: h, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? `超过 ${timeoutMs}ms 没有响应` : (error?.cause?.code ?? error?.cause?.message ?? error?.message);
    fail(`${method} ${urlPath} 请求没有完成：${reason}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const ms = Math.round(performance.now() - started);
  const setCookies = res.headers.getSetCookie();
  if (session) {
    for (const raw of setCookies) {
      const c = parseSetCookie(raw);
      if (!c) continue;
      if (isCookieDeletion(c) || c.value === '') session.cookies.delete(c.name);
      else session.cookies.set(c.name, c.value);
    }
  }
  const contentType = res.headers.get('content-type') ?? '';
  let data;
  if (/json/i.test(contentType) && bytes.length) {
    try { data = JSON.parse(bytes.toString('utf8')); } catch { data = undefined; }
  }
  return { method, path: urlPath, status: res.status, headers: res.headers, contentType, bytes, data, ms, setCookies };
}

function describe(res) {
  let body;
  if (res.data !== undefined) body = show(res.data, 400);
  else if (res.bytes.length) body = `<${res.contentType || '没有 Content-Type'}，${res.bytes.length} 字节>`;
  else body = '<空>';
  const location = res.status >= 300 && res.status < 400 ? `，Location=${res.headers.get('location')}` : '';
  return `${res.method} ${res.path} → ${res.status}${location}，${body}`;
}

function findCookie(res, name) {
  return res.setCookies.map(parseSetCookie).find((c) => c?.name === name) ?? null;
}

function expectStatus(res, status, code) {
  const ok = res.status === status && (code === undefined || res.data?.code === code);
  if (!ok) fail(`期望 ${status}${code ? ` ${code}` : ''}，实际 ${describe(res)}`);
  if (code !== undefined) {
    ensure(/json/i.test(res.contentType), `错误响应应为 JSON，实际 Content-Type=${show(res.contentType)}`);
    expectShape(res.data, res.data.code === 'VALIDATION_FAILED' ? 'error-validation' : 'error-not-found');
    ensureNoErrors(errorBodyErrors(res.data), '错误体不符合 03 §1');
  }
}

function expectJson(res, status, fixtureName, validator) {
  expectStatus(res, status);
  ensure(/json/i.test(res.contentType), `应返回 JSON，实际 Content-Type=${show(res.contentType)}，${describe(res)}`);
  ensure(res.data !== undefined, `响应体不是合法的 JSON：${describe(res)}`);
  if (fixtureName) expectShape(res.data, fixtureName);
  if (validator) ensureNoErrors(validator(res.data), '不符合 03 的约定');
  return res.data;
}

function expectTask(task, at = 'task') {
  expectShape(task, TASK_FIXTURE_BY_STATUS[task?.status] ?? 'task-pending');
  ensureNoErrors(taskErrors(task, at), `任务 ${task?.id} 不符合 03 §2`);
  return task;
}

function expectAccepted(res, { replay = false } = {}) {
  expectStatus(res, 202);
  ensure(/json/i.test(res.contentType) && res.data !== undefined, `受理响应应为 JSON 的 TaskDto，实际 ${describe(res)}`);
  const task = expectTask(res.data);
  if (!replay) ensure(['PENDING', 'PROCESSING'].includes(task.status), `受理时的状态应为 PENDING 或 PROCESSING，实际 ${task.status}`);
  const location = res.headers.get('location') ?? '';
  ensure(location === `/api/tasks/${task.id}` || location.endsWith(`/api/tasks/${task.id}`), `Location 头应为 /api/tasks/${task.id}，实际 ${show(location)}`);
  return task;
}

function expectFailedAt(task, stage, code) {
  ensureEqual(task.status, 'FAILED', 'status');
  ensureEqual(task.failedStage, stage, 'failedStage');
  ensureEqual(task.errorCode, code, 'errorCode');
  ensureEqual(task.steps.map((s) => s.stage), STAGES.slice(0, STAGES.indexOf(stage) + 1), '步骤记录（失败之后的步骤不应执行）');
  ensureEqual(task.steps.at(-1).status, 'FAILED', '失败阶段的步骤状态');
  ensureEqual(task.resultUrl, null, 'resultUrl');
}

// 私有图片：只能由浏览器私有缓存保存，并且缓存要按登录会话区分（Vary: Cookie），
// 否则同一个浏览器切换账号后，新用户会从缓存里读到上一个用户的图片
function expectPrivateCache(res) {
  const cc = res.headers.get('cache-control') ?? '';
  const vary = res.headers.get('vary') ?? '';
  ensure(/\bprivate\b/i.test(cc), `${res.path} 的 Cache-Control 应包含 private（03 §4.3），实际 ${show(cc)}`);
  ensure(/(^|[\s,])cookie($|[\s,])/i.test(vary) || vary.trim() === '*', `${res.path} 应带 Vary: Cookie（03 §4.3），实际 Vary=${show(vary)}`);
}

// ───────────────────────── 业务辅助 ─────────────────────────

async function getSimulation() {
  return expectJson(await request('GET', '/api/dev/simulation'), 200, 'simulation', simulationErrors);
}
async function patchSimulation(patch) {
  return expectJson(await request('PATCH', '/api/dev/simulation', { json: patch }), 200, 'simulation', simulationErrors);
}
async function resetSimulation() {
  return expectJson(await request('POST', '/api/dev/simulation/reset'), 200, 'simulation', simulationErrors);
}
async function useFastSettings() {
  return patchSimulation({ failStage: 'NONE', delaysMs: { ...FAST_DELAYS }, queryOutage: false });
}

async function listTasks(session, query = '') {
  const body = expectJson(await request('GET', `/api/tasks${query}`, { session }), 200, 'task-list');
  ensure(Array.isArray(body.items), '任务列表应为 { items: [...] }');
  body.items.forEach((t, i) => expectTask(t, `items[${i}]`));
  return body.items;
}

async function latestTaskId(session) {
  const items = await listTasks(session, '?limit=1');
  return items[0]?.id ?? null;
}

function submitTask(session, templateId, materialIds, { idempotencyKey } = {}) {
  const headers = idempotencyKey ? { 'idempotency-key': idempotencyKey } : {};
  return request('POST', '/api/tasks', { session, json: { templateId, materialIds }, headers });
}

async function getTask(session, id) {
  return expectTask(expectJson(await request('GET', `/api/tasks/${id}`, { session }), 200), `task#${id}`);
}

// 轮询一个任务直到满足条件；每次观察都检查契约和"只前进"
async function waitForTask(session, taskId, { until = (t) => TERMINAL.has(t.status), initial = null, timeoutMs = 20000, intervalMs = 100 } = {}) {
  const trail = initial ? [taskLabel(initial)] : [];
  let prev = initial;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const task = await getTask(session, taskId);
    if (prev) ensureNoErrors(progressErrors(prev, task), `任务 ${taskId} 的状态变化不合法`);
    const label = taskLabel(task);
    if (trail.at(-1) !== label) trail.push(label);
    prev = task;
    if (until(task)) return { task, trail };
    if (Date.now() > deadline) fail(`任务 ${taskId} 在 ${timeoutMs}ms 内没有达到预期状态，经过：${trail.join(' → ')}`);
    await sleep(intervalMs);
  }
}

class Context {
  constructor(samplesDir) {
    this.samplesDir = samplesDir;
    this.sessions = { demo: new Session('demo'), alice: new Session('alice') };
    this.samples = new Map();
    this.materials = new Map(); // "用户:文件名" → MaterialDto
    this.successTask = null;    // demo 名下一个已成功的任务
    this.resultHashes = new Map();
    this.probeTask = null;
  }

  async sample(name) {
    if (this.samples.has(name)) return this.samples.get(name);
    const file = path.join(this.samplesDir, name);
    let buf;
    try { buf = await readFile(file); } catch { fail(`缺少样例文件 ${file}（B1 由 scripts/GenerateDemoAssets.java 生成）`); }
    ensureNoErrors(assetErrors(buf, SAMPLE_SPECS[name]), `样例文件 ${name} 不符合 spec/04 §8`);
    this.samples.set(name, buf);
    return buf;
  }

  async login(who) {
    const s = this.sessions[who];
    if (s.loggedIn && s.user) return s;
    const res = await request('POST', '/api/auth/login', { session: s, json: SEED_USERS[who] });
    const body = expectJson(res, 200, 'user', (b) => userErrors(b?.user));
    ensure(s.loggedIn, `登录 ${who} 后没有拿到 ${SESSION_COOKIE} Cookie`);
    ensureEqual(body.user.username, SEED_USERS[who].username, 'user.username');
    s.user = body.user;
    return s;
  }

  async upload(session, fileName, { templateId, bytes, type } = {}) {
    const buf = bytes ?? (await this.sample(fileName));
    const form = new FormData();
    form.append('file', new Blob([buf], { type: type ?? mimeFromName(fileName) }), fileName);
    if (templateId !== undefined) form.append('templateId', templateId);
    return request('POST', '/api/materials', { session, form, timeoutMs: 30000 });
  }

  async material(who, fileName, templateId) {
    const key = `${who}:${fileName}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const s = await this.login(who);
    const m = expectJson(await this.upload(s, fileName, { templateId }), 201, 'material', materialErrors);
    this.materials.set(key, m);
    return m;
  }
}

// ───────────────────────── 段：templates ─────────────────────────

async function sectionTemplates() {
  let categories = [];
  await check('分类：5 个，顺序和名称与种子一致，婚礼为 0 个', async () => {
    const body = expectJson(await request('GET', '/api/categories'), 200, 'categories', (b) => listErrors(b, categoryErrors));
    categories = body.items;
    ensureEqual(categories, SEED_CATEGORIES, '分类');
  }, { critical: true });

  await check('全部模板：8 个上架模板，先按分类、再按模板排序', async () => {
    const body = expectJson(await request('GET', '/api/templates'), 200, 'templates', (b) => listErrors(b, templateSummaryErrors));
    ensureEqual(body.items.map((t) => t.id), SEED_TEMPLATE_ORDER, '模板顺序');
  });

  await check('?category=pets 只返回萌宠的 2 个模板', async () => {
    const body = expectJson(await request('GET', '/api/templates?category=pets'), 200, 'templates', (b) => listErrors(b, templateSummaryErrors));
    ensureEqual(body.items.map((t) => t.id), ['pet-sticker', 'pet-duo'], '萌宠模板');
  });

  await check('每个分类的 templateCount 等于按该分类筛选到的模板数', async () => {
    for (const c of categories) {
      const body = expectJson(await request('GET', `/api/templates?category=${encodeURIComponent(c.code)}`), 200, 'templates');
      ensureEqual(body.items.length, c.templateCount, `分类 ${c.code} 的模板数`);
      ensure(body.items.every((t) => t.categoryCode === c.code && t.categoryName === c.name), `分类 ${c.code} 的结果里混入了其他分类的模板`);
    }
  });

  await check('未知分类返回 200 和空列表', async () => {
    ensureEqual(expectJson(await request('GET', '/api/templates?category=no-such-category'), 200), { items: [] }, '响应');
  });

  await check('8 个模板的详情字段齐全，取值与种子一致（04 §3.2）', async () => {
    const problems = [];
    for (const [id, seed] of Object.entries(SEED_TEMPLATES)) {
      const d = expectJson(await request('GET', `/api/templates/${id}`), 200, 'template-detail', templateDetailErrors);
      const expected = { id, ...seed, categoryName: SEED_CATEGORIES.find((c) => c.code === seed.categoryCode).name, coverUrl: `/demo/covers/${id}.png` };
      for (const [k, v] of Object.entries(expected)) {
        const actual = k === 'acceptedMimeTypes' ? [...d[k]].sort() : d[k];
        const want = k === 'acceptedMimeTypes' ? [...v].sort() : v;
        if (!isDeepStrictEqual(actual, want)) problems.push(`${id}.${k}：期望 ${show(want)}，实际 ${show(actual)}`);
      }
    }
    ensureNoErrors(problems, '与种子数据不一致');
  });

  await check('已下线的 wedding-invite 和不存在的模板都返回 404 TEMPLATE_NOT_FOUND', async () => {
    expectStatus(await request('GET', `/api/templates/${DISABLED_TEMPLATE}`), 404, 'TEMPLATE_NOT_FOUND');
    expectStatus(await request('GET', '/api/templates/no-such-template'), 404, 'TEMPLATE_NOT_FOUND');
  });

  await check('8 张封面都能访问：200 image/png', async () => {
    for (const id of SEED_TEMPLATE_ORDER) {
      const res = await request('GET', `/demo/covers/${id}.png`);
      expectStatus(res, 200);
      ensure(res.contentType.startsWith('image/png'), `${res.path} 的 Content-Type 应为 image/png，实际 ${show(res.contentType)}`);
      ensureEqual(imageInfo(res.bytes).type, 'png', `${res.path} 的文件头`);
    }
  });
}

// ───────────────────────── 段：auth ─────────────────────────

async function sectionAuth(ctx) {
  const demo = ctx.sessions.demo;

  await check('demo 登录返回 200；Cookie 带 HttpOnly、SameSite=Lax、Path=/、Max-Age', async () => {
    demo.cookies.clear();
    demo.user = null;
    const res = await request('POST', '/api/auth/login', { session: demo, json: SEED_USERS.demo });
    const body = expectJson(res, 200, 'user', (b) => userErrors(b?.user));
    ensureEqual(body.user.username, 'demo', 'user.username');
    const c = findCookie(res, SESSION_COOKIE);
    ensure(c, `响应没有设置 ${SESSION_COOKIE}：${show(res.setCookies)}`);
    ensure(c.value.length >= 16, `${SESSION_COOKIE} 的值太短`);
    ensure(c.attrs.httponly === true, '缺少 HttpOnly');
    ensure(String(c.attrs.samesite).toLowerCase() === 'lax', `SameSite 应为 Lax，实际 ${show(c.attrs.samesite)}`);
    ensure(c.attrs.path === '/', `Path 应为 /，实际 ${show(c.attrs.path)}`);
    ensure(Number(c.attrs['max-age']) > 0, `Max-Age 应大于 0，实际 ${show(c.attrs['max-age'])}`);
    demo.user = body.user;
  }, { critical: true });

  await check('me 返回 demo，响应带 X-User-Id', async () => {
    const res = await request('GET', '/api/auth/me', { session: demo });
    const body = expectJson(res, 200, 'user', (b) => userErrors(b?.user));
    ensureEqual(body.user, demo.user, 'me 返回的用户');
    ensureEqual(res.headers.get('x-user-id'), String(demo.user.id), 'X-User-Id');
  });

  await check('错误密码、不存在的用户都返回 401 INVALID_CREDENTIALS，且不发 Cookie', async () => {
    for (const json of [{ username: 'demo', password: 'wrong-password' }, { username: 'no_such_user_x', password: 'whatever1' }]) {
      const res = await request('POST', '/api/auth/login', { json });
      expectStatus(res, 401, 'INVALID_CREDENTIALS');
      const c = findCookie(res, SESSION_COOKIE);
      ensure(!c || isCookieDeletion(c), `登录失败时不应发放 ${SESSION_COOKIE}`);
    }
  });

  await check('未登录、伪造 Cookie 访问 me 都返回 401 UNAUTHENTICATED', async () => {
    expectStatus(await request('GET', '/api/auth/me'), 401, 'UNAUTHENTICATED');
    const forged = new Session('forged');
    forged.cookies.set(SESSION_COOKIE, 'forged-token-0000000000000000000000000000');
    expectStatus(await request('GET', '/api/auth/me', { session: forged }), 401, 'UNAUTHENTICATED');
  });

  await check('注册字段不合法返回 400 VALIDATION_FAILED，fieldErrors 指出 username 和 password', async () => {
    const res = await request('POST', '/api/auth/register', { json: { username: 'a!', password: '1' } });
    expectStatus(res, 400, 'VALIDATION_FAILED');
    const fields = res.data.fieldErrors.map((f) => f.field);
    ensure(fields.includes('username') && fields.includes('password'), `fieldErrors 应包含 username 和 password，实际 ${show(fields)}`);
  });

  const username = `smoke_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
  const fresh = new Session('fresh');
  await check('注册随机用户返回 201 并直接登录；不传 displayName 时等于 username', async () => {
    const res = await request('POST', '/api/auth/register', { session: fresh, json: { username, password: 'secret123' } });
    const body = expectJson(res, 201, 'user', (b) => userErrors(b?.user));
    ensureEqual(body.user.username, username, 'user.username');
    ensureEqual(body.user.displayName, username, 'user.displayName');
    ensure(fresh.loggedIn, `注册后没有拿到 ${SESSION_COOKIE}`);
    const me = expectJson(await request('GET', '/api/auth/me', { session: fresh }), 200, 'user');
    ensureEqual(me.user.id, body.user.id, '注册后 me 的用户 id');
    fresh.user = body.user;
    return username;
  }, { critical: true });

  await check('重名注册返回 409 USERNAME_TAKEN', async () => {
    expectStatus(await request('POST', '/api/auth/register', { json: { username, password: 'secret123' } }), 409, 'USERNAME_TAKEN');
  });

  await check('退出返回 204 并清除 Cookie；旧 Cookie 随即失效', async () => {
    const stale = fresh.clone('fresh-stale');
    const res = await request('POST', '/api/auth/logout', { session: fresh });
    expectStatus(res, 204);
    const c = findCookie(res, SESSION_COOKIE);
    ensure(c && isCookieDeletion(c), `退出响应应清除 ${SESSION_COOKIE}（Max-Age=0），实际 ${show(res.setCookies)}`);
    expectStatus(await request('GET', '/api/auth/me', { session: stale }), 401, 'UNAUTHENTICATED');
  });

  await check('没有会话时退出也返回 204', async () => {
    expectStatus(await request('POST', '/api/auth/logout'), 204);
  });
}

// ───────────────────────── 段：upload ─────────────────────────

async function sectionUpload(ctx) {
  await check('准备：demo 和 alice 登录，样例文件齐全', async () => {
    await ctx.login('demo');
    await ctx.login('alice');
    for (const name of Object.keys(SAMPLE_SPECS)) await ctx.sample(name);
  }, { critical: true });
  const { demo, alice } = ctx.sessions;

  for (const name of ['photo-1.jpg', 'photo-2.jpg', 'photo-3.png']) {
    await check(`上传 ${name} 返回 201，类型、大小、文件名与文件一致`, async () => {
      const res = await ctx.upload(demo, name, { templateId: 'travel-postcard' });
      const m = expectJson(res, 201, 'material', materialErrors);
      ensureEqual(m.mimeType, mimeFromName(name), 'mimeType');
      ensureEqual(m.sizeBytes, (await ctx.sample(name)).length, 'sizeBytes');
      ensureEqual(m.originalName, name, 'originalName');
      ensureEqual(res.headers.get('x-user-id'), String(demo.user.id), 'X-User-Id');
      ctx.materials.set(`demo:${name}`, m);
      return `id=${m.id}`;
    }, { critical: name === 'photo-1.jpg' });
  }

  await check('not-image.jpg（文本冒充 JPEG）返回 400 FILE_TYPE_NOT_ALLOWED', async () => {
    expectStatus(await ctx.upload(demo, 'not-image.jpg', { templateId: 'travel-postcard', type: 'image/jpeg' }), 400, 'FILE_TYPE_NOT_ALLOWED');
  });

  await check('large-photo.jpg 传给迷你头像（上限 200KB）返回 400 FILE_TOO_LARGE', async () => {
    expectStatus(await ctx.upload(demo, 'large-photo.jpg', { templateId: 'hot-avatar' }), 400, 'FILE_TOO_LARGE');
  });

  await check('photo-3.png 传给复古胶片（只收 JPEG）返回 400 FILE_TYPE_NOT_ALLOWED', async () => {
    expectStatus(await ctx.upload(demo, 'photo-3.png', { templateId: 'hot-film' }), 400, 'FILE_TYPE_NOT_ALLOWED');
  });

  await check('空文件返回 400 FILE_EMPTY', async () => {
    expectStatus(await ctx.upload(demo, 'empty.jpg', { templateId: 'travel-postcard', bytes: Buffer.alloc(0), type: 'image/jpeg' }), 400, 'FILE_EMPTY');
  });

  await check('未知模板返回 404 TEMPLATE_NOT_FOUND', async () => {
    expectStatus(await ctx.upload(demo, 'photo-1.jpg', { templateId: 'no-such-template' }), 404, 'TEMPLATE_NOT_FOUND');
  });

  await check('未登录上传返回 401 UNAUTHENTICATED', async () => {
    expectStatus(await ctx.upload(null, 'photo-1.jpg', { templateId: 'travel-postcard' }), 401, 'UNAUTHENTICATED');
  });

  await check('自己取回素材内容：200，类型正确，字节与原文件一致', async () => {
    const m = ctx.materials.get('demo:photo-1.jpg');
    const res = await request('GET', m.url, { session: demo });
    expectStatus(res, 200);
    ensure(res.contentType.startsWith('image/jpeg'), `Content-Type 应为 image/jpeg，实际 ${show(res.contentType)}`);
    ensureEqual(sha256(res.bytes), sha256(await ctx.sample('photo-1.jpg')), '内容的 sha256');
    expectPrivateCache(res);
  });

  await check('别人取素材内容、取不存在的素材都返回 404 MATERIAL_NOT_FOUND', async () => {
    expectStatus(await request('GET', ctx.materials.get('demo:photo-1.jpg').url, { session: alice }), 404, 'MATERIAL_NOT_FOUND');
    expectStatus(await request('GET', '/api/materials/999999999/content', { session: demo }), 404, 'MATERIAL_NOT_FOUND');
  });
}

// ───────────────────────── 段：tasks ─────────────────────────

async function sectionTasks(ctx) {
  await check('准备：登录，上传 photo-1、photo-2、photo-3、large-photo、tiny-32', async () => {
    for (const f of ['photo-1.jpg', 'photo-2.jpg', 'photo-3.png', 'large-photo.jpg']) await ctx.material('demo', f, 'travel-postcard');
    await ctx.material('demo', 'tiny-32.png', 'pet-sticker');
    await ctx.material('alice', 'photo-1.jpg', 'travel-postcard');
  }, { critical: true });
  const { demo } = ctx.sessions;
  const mid = (f) => ctx.materials.get(`demo:${f}`).id;
  const pair = () => [mid('photo-1.jpg'), mid('photo-2.jpg')];

  await check('未登录访问任务列表和任务详情返回 401 UNAUTHENTICATED', async () => {
    expectStatus(await request('GET', '/api/tasks'), 401, 'UNAUTHENTICATED');
    expectStatus(await request('GET', '/api/tasks/1'), 401, 'UNAUTHENTICATED');
  });

  await check('不存在的任务返回 404 TASK_NOT_FOUND，其结果返回 404 TASK_RESULT_NOT_FOUND', async () => {
    expectStatus(await request('GET', '/api/tasks/999999999', { session: demo }), 404, 'TASK_NOT_FOUND');
    expectStatus(await request('GET', '/api/tasks/999999999/result', { session: demo }), 404, 'TASK_RESULT_NOT_FOUND');
  });

  await check('开发接口：越界的耗时和非法的阶段返回 400，且不生效', async () => {
    for (const json of [{ delaysMs: { GENERATING: MAX_DELAY_MS + 1 } }, { delaysMs: { GENERATING: -1 } }, { failStage: 'BOGUS' }]) {
      expectStatus(await request('PATCH', '/api/dev/simulation', { json }), 400, 'VALIDATION_FAILED');
    }
    ensureEqual(await getSimulation(), { failStage: 'NONE', delaysMs: FAST_DELAYS, queryOutage: false }, '被拒绝之后的配置');
  });

  // ⑧ 校验（放在最前面，顺便预热提交接口）
  const baseline = { id: undefined };
  await check('⑧ 记录校验前最新的任务 id', async () => { baseline.id = await latestTaskId(demo); return `${baseline.id}`; }, { critical: true });
  const invalid = [
    ['缺少字段返回 400 VALIDATION_FAILED', {}, 400, 'VALIDATION_FAILED'],
    ['模板不存在返回 404 TEMPLATE_NOT_FOUND', { templateId: 'no-such-template', materialIds: [mid('photo-1.jpg')] }, 404, 'TEMPLATE_NOT_FOUND'],
    ['模板已下线返回 404 TEMPLATE_NOT_FOUND', { templateId: DISABLED_TEMPLATE, materialIds: pair() }, 404, 'TEMPLATE_NOT_FOUND'],
    ['数量不符返回 400 MATERIAL_COUNT_MISMATCH', { templateId: 'travel-postcard', materialIds: [mid('photo-1.jpg')] }, 400, 'MATERIAL_COUNT_MISMATCH'],
    ['素材重复返回 400 DUPLICATE_MATERIAL', { templateId: 'travel-postcard', materialIds: [mid('photo-1.jpg'), mid('photo-1.jpg')] }, 400, 'DUPLICATE_MATERIAL'],
    ['素材不存在返回 400 MATERIAL_NOT_FOUND', { templateId: 'travel-postcard', materialIds: [mid('photo-1.jpg'), 999999999] }, 400, 'MATERIAL_NOT_FOUND'],
    ['用别人的素材返回 400 MATERIAL_NOT_FOUND', { templateId: 'travel-postcard', materialIds: [mid('photo-1.jpg'), ctx.materials.get('alice:photo-1.jpg').id] }, 400, 'MATERIAL_NOT_FOUND'],
    ['PNG 交给只收 JPEG 的复古胶片返回 400 MATERIAL_TYPE_NOT_ACCEPTED', { templateId: 'hot-film', materialIds: [mid('photo-3.png')] }, 400, 'MATERIAL_TYPE_NOT_ACCEPTED'],
    ['超过 200KB 的素材交给迷你头像返回 400 MATERIAL_TOO_LARGE', { templateId: 'hot-avatar', materialIds: [mid('large-photo.jpg')] }, 400, 'MATERIAL_TOO_LARGE'],
  ];
  for (const [label, json, status, code] of invalid) {
    await check(`⑧ ${label}`, async () => {
      expectStatus(await request('POST', '/api/tasks', { session: demo, json }), status, code);
    });
  }
  await check('⑧ 校验失败都没有建任务', async () => {
    ensureEqual(await latestTaskId(demo), baseline.id, '最新的任务 id');
  });

  // ① 受理
  let accepted = null;
  await check('① 受理：202，1 秒内返回，状态为 PENDING 或 PROCESSING，带 Location', async () => {
    const res = await submitTask(demo, 'travel-postcard', pair());
    accepted = expectAccepted(res);
    ensureEqual(accepted.materials.map((m) => m.materialId), pair(), 'materials 的顺序');
    ensure(res.ms < 1000, `受理用了 ${res.ms}ms，应小于 1000ms：提交接口不能等待步骤执行`);
    return `${res.ms}ms，${taskLabel(accepted)}`;
  }, { critical: true });

  // ② 轮询到成功
  let succeeded = null;
  await check('② 轮询到 SUCCEEDED：阶段只前进、看得到中间状态、三步按顺序成功', async () => {
    const { task, trail } = await waitForTask(demo, accepted.id, { initial: accepted });
    ensureEqual(task.status, 'SUCCEEDED', `最终状态（经过 ${trail.join(' → ')}）`);
    ensure(trail.some((l) => l.startsWith(`${STATUS_LABELS.PROCESSING}·`)), `没有观察到执行中的阶段（经过 ${trail.join(' → ')}）：每次状态变更都应是独立提交的短事务`);
    succeeded = task;
    ctx.successTask = task;
    return trail.join(' → ');
  });

  await check('② 结果图返回 200 image/jpeg', async () => {
    ensure(succeeded, '上一项没有得到成功的任务');
    const res = await request('GET', succeeded.resultUrl, { session: demo });
    expectStatus(res, 200);
    ensure(res.contentType.startsWith('image/jpeg'), `Content-Type 应为 image/jpeg，实际 ${show(res.contentType)}`);
    const info = imageInfo(res.bytes);
    ensureEqual(info.type, 'jpeg', '结果文件的文件头');
    if (info.width !== RESULT_SIZE.width || info.height !== RESULT_SIZE.height) warn(`结果图是 ${info.width}×${info.height}，spec/02 §5.4 约定为 720×960`);
    expectPrivateCache(res);
    ctx.resultHashes.set(succeeded.id, sha256(res.bytes));
    return `${res.bytes.length} 字节`;
  });

  await check('② 任务列表：带 X-User-Id，包含新任务，按 id 倒序，templateId 和 limit 生效', async () => {
    const res = await request('GET', '/api/tasks', { session: demo });
    expectJson(res, 200, 'task-list');
    ensureEqual(res.headers.get('x-user-id'), String(demo.user.id), 'X-User-Id');
    const all = await listTasks(demo);
    ensure(all.some((t) => t.id === accepted.id), '列表里没有刚提交的任务');
    ensure(all.every((t, i) => i === 0 || all[i - 1].id > t.id), '列表没有按 id 倒序');
    const filtered = await listTasks(demo, '?templateId=travel-postcard');
    ensure(filtered.some((t) => t.id === accepted.id), 'templateId=travel-postcard 的结果里没有刚提交的任务');
    ensure(filtered.every((t) => t.templateId === 'travel-postcard'), 'templateId 筛选的结果里混入了其他模板');
    ensureEqual((await listTasks(demo, '?limit=1')).length, 1, 'limit=1 的条数');
  });

  // ③ 指定阶段失败
  await check('③ PATCH failStage=GENERATING：只修改传入的字段', async () => {
    const s = await patchSimulation({ failStage: 'GENERATING' });
    ensureEqual(s, { failStage: 'GENERATING', delaysMs: FAST_DELAYS, queryOutage: false }, '修改后的配置');
  }, { critical: true });

  for (const round of [1, 2]) {
    await check(`③ 第 ${round} 次提交：在模拟生成阶段 FAILED，结果整理没有执行，之后再查不变`, async () => {
      const first = expectAccepted(await submitTask(demo, 'travel-postcard', pair()));
      const { task, trail } = await waitForTask(demo, first.id, { initial: first });
      expectFailedAt(task, 'GENERATING', 'SIMULATED_FAILURE');
      for (let i = 0; i < 3; i += 1) {
        await sleep(150);
        ensureNoErrors(progressErrors(task, await getTask(demo, task.id)), '终态任务再次查询时发生了变化');
      }
      expectStatus(await request('GET', `/api/tasks/${task.id}/result`, { session: demo }), 404, 'TASK_RESULT_NOT_FOUND');
      return `${trail.join(' → ')}；${task.errorMessage}`;
    });
  }

  await check('③ failStage=MATERIAL_CHECK：在素材检查阶段 FAILED，后面两步都没有执行', async () => {
    await patchSimulation({ failStage: 'MATERIAL_CHECK' });
    const first = expectAccepted(await submitTask(demo, 'travel-postcard', pair()));
    const { task, trail } = await waitForTask(demo, first.id, { initial: first });
    expectFailedAt(task, 'MATERIAL_CHECK', 'SIMULATED_FAILURE');
    return trail.join(' → ');
  });

  // ④ 快照隔离
  await check('④ 快照隔离：A 在 failStage=RESULT_ASSEMBLY 时受理；reset 后受理的 B 成功，A 仍按快照失败', async () => {
    await patchSimulation({ failStage: 'RESULT_ASSEMBLY' });
    const a = expectAccepted(await submitTask(demo, 'travel-postcard', [mid('photo-1.jpg'), mid('photo-3.png')]));
    await resetSimulation();
    await useFastSettings();
    const b = expectAccepted(await submitTask(demo, 'travel-postcard', [mid('photo-2.jpg'), mid('photo-3.png')]));
    const [ra, rb] = await Promise.all([waitForTask(demo, a.id, { initial: a }), waitForTask(demo, b.id, { initial: b })]);
    expectFailedAt(ra.task, 'RESULT_ASSEMBLY', 'SIMULATED_FAILURE');
    ensureEqual(rb.task.status, 'SUCCEEDED', `B 的最终状态（经过 ${rb.trail.join(' → ')}）`);
    const res = await request('GET', rb.task.resultUrl, { session: demo });
    expectStatus(res, 200);
    const earlier = succeeded ? ctx.resultHashes.get(succeeded.id) : undefined;
    if (earlier) ensure(sha256(res.bytes) !== earlier, '素材不同的两个任务得到了完全相同的结果图');
    return `A：${ra.trail.join(' → ')}；B：${rb.trail.join(' → ')}`;
  });

  // ⑤ 查询不推进 + 查询故障
  await check('⑤ 查询不推进任务：模拟生成期间连续查询，stage 和 updatedAt 都不变', async () => {
    await patchSimulation({ delaysMs: { GENERATING: 2500 } });
    const first = expectAccepted(await submitTask(demo, 'travel-postcard', pair()));
    await patchSimulation({ delaysMs: { ...FAST_DELAYS } }); // 只影响之后受理的任务
    const { task } = await waitForTask(demo, first.id, { initial: first, until: (t) => t.stage === 'GENERATING' || TERMINAL.has(t.status) });
    ensureEqual(task.stage, 'GENERATING', '等到的阶段');
    ensureEqual(task.status, 'PROCESSING', '等到的状态');
    for (let i = 0; i < 8; i += 1) {
      const again = await getTask(demo, task.id);
      ensureEqual([again.status, again.stage, again.updatedAt], [task.status, task.stage, task.updatedAt], `第 ${i + 1} 次查询的 status、stage、updatedAt`);
    }
    ctx.probeTask = task;
    return '8 次查询';
  });

  await check('⑤ queryOutage：故障期间列表和详情返回 503，任务在后台照常完成', async () => {
    const task = ctx.probeTask;
    ensure(task, '上一项没有准备好处理中的任务');
    await patchSimulation({ queryOutage: true });
    try {
      expectStatus(await request('GET', `/api/tasks/${task.id}`, { session: demo }), 503, 'SERVICE_UNAVAILABLE');
      expectStatus(await request('GET', '/api/tasks', { session: demo }), 503, 'SERVICE_UNAVAILABLE');
      // 结果图接口不受故障影响：故障期间能取到结果，说明任务在故障期间跑完了
      const deadline = Date.now() + 15000;
      for (;;) {
        const r = await request('GET', `/api/tasks/${task.id}/result`, { session: demo });
        if (r.status === 200) break;
        expectStatus(r, 404, 'TASK_RESULT_NOT_FOUND');
        if (Date.now() > deadline) fail('故障期间等了 15 秒仍取不到结果图：任务可能在查询故障期间停止了执行');
        await sleep(200);
      }
      expectStatus(await request('GET', `/api/tasks/${task.id}`, { session: demo }), 503, 'SERVICE_UNAVAILABLE');
    } finally {
      await patchSimulation({ queryOutage: false });
    }
    ensureEqual((await getTask(demo, task.id)).status, 'SUCCEEDED', '关闭故障后查到的状态');
    return '故障期间任务已完成';
  });

  // ⑥ 素材检查的真实失败
  await check('⑥ tiny-32.png 能上传，但在素材检查阶段 FAILED（MATERIAL_RESOLUTION_TOO_LOW）', async () => {
    const first = expectAccepted(await submitTask(demo, 'pet-sticker', [mid('tiny-32.png')]));
    const { task } = await waitForTask(demo, first.id, { initial: first });
    expectFailedAt(task, 'MATERIAL_CHECK', 'MATERIAL_RESOLUTION_TOO_LOW');
    return task.errorMessage;
  });

  // ⑦ 幂等
  await check('⑦ 同一个 Idempotency-Key 提交两次得到同一个任务；换 key 才会新建', async () => {
    const before = await latestTaskId(demo);
    const key = randomUUID();
    const first = expectAccepted(await submitTask(demo, 'pet-sticker', [mid('photo-1.jpg')], { idempotencyKey: key }));
    const second = expectAccepted(await submitTask(demo, 'pet-sticker', [mid('photo-1.jpg')], { idempotencyKey: key }), { replay: true });
    ensureEqual(second.id, first.id, '两次提交得到的任务 id');
    const created = (await listTasks(demo, '?limit=100')).filter((t) => t.id > (before ?? 0)).map((t) => t.id);
    ensureEqual(created, [first.id], '这期间新建的任务');
    const third = expectAccepted(await submitTask(demo, 'pet-sticker', [mid('photo-1.jpg')], { idempotencyKey: randomUUID() }));
    ensure(third.id !== first.id, '换一个 key 应该新建任务');
    await Promise.all([waitForTask(demo, first.id), waitForTask(demo, third.id)]);
    return `id=${first.id}`;
  });
}

// ───────────────────────── 段：isolation ─────────────────────────

async function sectionIsolation(ctx) {
  let aliceTask = null;
  await check('准备：demo 有一个已完成的任务，alice 也有自己的任务', async () => {
    const demo = await ctx.login('demo');
    const alice = await ctx.login('alice');
    const m1 = await ctx.material('demo', 'photo-1.jpg', 'travel-postcard');
    const m2 = await ctx.material('demo', 'photo-2.jpg', 'travel-postcard');
    if (!ctx.successTask) {
      const first = expectAccepted(await submitTask(demo, 'travel-postcard', [m1.id, m2.id]));
      const { task, trail } = await waitForTask(demo, first.id, { initial: first });
      ensureEqual(task.status, 'SUCCEEDED', `准备的任务（经过 ${trail.join(' → ')}）`);
      ctx.successTask = task;
    }
    const am = await ctx.material('alice', 'photo-1.jpg', 'travel-postcard');
    aliceTask = expectAccepted(await submitTask(alice, 'pet-sticker', [am.id]));
  }, { critical: true });
  const { demo, alice } = ctx.sessions;
  const task = ctx.successTask;

  await check('两个用户的 X-User-Id 不同，且与各自的 me 一致', async () => {
    const ids = [];
    for (const s of [demo, alice]) {
      const res = await request('GET', '/api/auth/me', { session: s });
      const body = expectJson(res, 200, 'user');
      ensureEqual(res.headers.get('x-user-id'), String(body.user.id), `${s.label} 的 X-User-Id`);
      ids.push(body.user.id);
    }
    ensure(ids[0] !== ids[1], 'demo 和 alice 的用户 id 相同');
  });

  await check('alice 访问 demo 的任务返回 404 TASK_NOT_FOUND', async () => {
    expectStatus(await request('GET', `/api/tasks/${task.id}`, { session: alice }), 404, 'TASK_NOT_FOUND');
  });

  await check('alice 访问 demo 的结果图返回 404 TASK_RESULT_NOT_FOUND', async () => {
    expectStatus(await request('GET', `/api/tasks/${task.id}/result`, { session: alice }), 404, 'TASK_RESULT_NOT_FOUND');
  });

  await check('alice 访问 demo 的素材返回 404 MATERIAL_NOT_FOUND', async () => {
    expectStatus(await request('GET', ctx.materials.get('demo:photo-1.jpg').url, { session: alice }), 404, 'MATERIAL_NOT_FOUND');
  });

  await check('alice 用 demo 的素材提交返回 400 MATERIAL_NOT_FOUND', async () => {
    const ids = [ctx.materials.get('demo:photo-1.jpg').id, ctx.materials.get('demo:photo-2.jpg').id];
    expectStatus(await submitTask(alice, 'travel-postcard', ids), 400, 'MATERIAL_NOT_FOUND');
  });

  await check('两人的任务列表互不包含对方的任务', async () => {
    const demoIds = new Set((await listTasks(demo, '?limit=100')).map((t) => t.id));
    const aliceIds = new Set((await listTasks(alice, '?limit=100')).map((t) => t.id));
    ensure(demoIds.has(task.id), 'demo 的列表里没有自己的任务');
    ensure(aliceIds.has(aliceTask.id), 'alice 的列表里没有自己的任务');
    const leaked = [...aliceIds].filter((id) => demoIds.has(id));
    ensure(leaked.length === 0, `两人的列表里出现了相同的任务：${leaked.join(', ')}`);
  });

  await check('demo 退出后，旧 Cookie 访问 me 和任务都返回 401', async () => {
    const stale = demo.clone('demo-stale');
    expectStatus(await request('POST', '/api/auth/logout', { session: demo }), 204);
    expectStatus(await request('GET', '/api/auth/me', { session: stale }), 401, 'UNAUTHENTICATED');
    expectStatus(await request('GET', `/api/tasks/${task.id}`, { session: stale }), 401, 'UNAUTHENTICATED');
    demo.user = null;
  });

  await check('alice 的任务正常结束', async () => {
    const { task: done, trail } = await waitForTask(alice, aliceTask.id, { initial: aliceTask });
    ensureEqual(done.status, 'SUCCEEDED', `alice 的任务（经过 ${trail.join(' → ')}）`);
  });
}

const SECTION_FNS = { templates: sectionTemplates, auth: sectionAuth, upload: sectionUpload, tasks: sectionTasks, isolation: sectionIsolation };

// ───────────────────────── 运行 ─────────────────────────

async function loadFixtures() {
  const problems = [];
  let files = [];
  try { files = await readdir(FIXTURE_DIR); } catch { return [`找不到夹具目录 ${FIXTURE_DIR}`]; }
  for (const name of FIXTURE_NAMES) {
    if (!files.includes(`${name}.json`)) { problems.push(`缺少 ${name}.json`); continue; }
    try { FIXTURES[name] = JSON.parse(await readFile(path.join(FIXTURE_DIR, `${name}.json`), 'utf8')); } catch (e) { problems.push(`${name}.json 不是合法的 JSON：${e.message}`); }
  }
  const extra = files.filter((f) => f.endsWith('.json') && !FIXTURE_NAMES.includes(f.slice(0, -5)));
  if (extra.length) problems.push(`多出的夹具（脚本不认识）：${extra.join('、')}`);
  return problems;
}

async function runLive(options) {
  BASE = options.base;
  const ctx = new Context(options.samplesDir);
  const sections = options.only ?? SECTION_NAMES;
  log(`冒烟目标：${BASE}`);
  log(`执行的段：${sections.join('、')}`);

  section('准备');
  const reachable = await check(`能连上 ${BASE}，GET /api/categories 返回 200`, async () => {
    let res;
    try { res = await request('GET', '/api/categories', { timeoutMs: 10000 }); } catch (e) {
      const hint = BASE.endsWith(':3000') ? '前端还没启动时，可以用 http://localhost:8080 直连后端' : '确认后端已经启动、端口正确';
      fail(`${e.message}\n${hint}`);
    }
    expectStatus(res, 200);
  });
  if (!reachable) return;

  const needDevApi = sections.some((s) => SECTIONS_NEEDING_DEV_API.has(s));
  if (needDevApi) {
    const ready = await check('开发接口可用：reset，并把三步耗时设为 300 / 600 / 300 ms', async () => {
      const probe = await request('GET', '/api/dev/simulation');
      if (probe.status === 404) fail('GET /api/dev/simulation 返回 404：开发接口没有打开。请用 local profile 启动后端，或设置 DEV_API_ENABLED=true');
      expectJson(probe, 200, 'simulation', simulationErrors);
      await resetSimulation();
      ensureEqual(await useFastSettings(), { failStage: 'NONE', delaysMs: FAST_DELAYS, queryOutage: false }, '设置后的配置');
    });
    if (!ready) return;
  }

  try {
    for (const name of sections) {
      section(SECTION_TITLES[name]);
      try {
        await SECTION_FNS[name](ctx);
      } catch (e) {
        if (e instanceof SectionAbort) log(`  … 关键项「${e.message}」没有通过，跳过本段其余检查`);
        else { stats.fail += 1; log('  ✗ 本段出现意外错误'); log(indent(e?.stack ?? String(e))); }
      }
    }
  } finally {
    if (needDevApi) {
      section('收尾');
      await check('恢复模拟配置（reset）', async () => { await resetSimulation(); });
    }
  }
}

async function runSelfCheck(options, fixtureProblems) {
  log('自检：不发请求，只检查脚本自身、夹具、样例文件和封面');

  section('夹具（verify/fixtures，对照 spec/03 §2）');
  await check(`${FIXTURE_NAMES.length} 个夹具都存在，且是合法的 JSON`, async () => {
    ensureNoErrors(fixtureProblems, '夹具有问题');
  }, { critical: true });

  const validators = {
    user: (f) => userErrors(f?.user),
    categories: (f) => listErrors(f, categoryErrors),
    templates: (f) => listErrors(f, templateSummaryErrors),
    'template-detail': (f) => templateDetailErrors(f),
    material: (f) => materialErrors(f),
    'task-pending': (f) => taskErrors(f),
    'task-processing': (f) => taskErrors(f),
    'task-succeeded': (f) => taskErrors(f),
    'task-failed': (f) => taskErrors(f),
    'task-list': (f) => listErrors(f, taskErrors),
    simulation: (f) => simulationErrors(f),
    'error-validation': (f) => errorBodyErrors(f),
    'error-not-found': (f) => errorBodyErrors(f),
  };
  for (const name of FIXTURE_NAMES) {
    await check(`${name}.json 符合 03 的类型、枚举和状态表`, async () => ensureNoErrors(validators[name](FIXTURES[name]), '不符合'));
  }

  const F = FIXTURES;
  await check('夹具内容与 06 §6.1、04 §3 的说明一致', async () => {
    ensureEqual(F.categories.items, SEED_CATEGORIES, 'categories.json');
    ensureEqual(F.templates.items.length, 2, 'templates.json 的条数');
    ensureEqual(F['template-detail'].id, 'travel-postcard', 'template-detail.json 的 id');
    const seed = SEED_TEMPLATES['travel-postcard'];
    for (const k of Object.keys(seed)) ensureEqual(F['template-detail'][k], seed[k], `template-detail.json 的 ${k}`);
    ensureEqual([F['task-pending'].status, F['task-processing'].status, F['task-succeeded'].status, F['task-failed'].status], TASK_STATUSES, '四个任务夹具的状态');
    ensureEqual(F['task-processing'].steps.map((s) => [s.stage, s.status]), [['MATERIAL_CHECK', 'SUCCEEDED'], ['GENERATING', 'RUNNING']], 'task-processing.json 的步骤');
    ensureEqual([F['task-failed'].failedStage, F['task-failed'].errorCode], ['GENERATING', 'SIMULATED_FAILURE'], 'task-failed.json 的失败阶段和错误码');
    ensure(F['task-list'].items.every((t, i, a) => i === 0 || a[i - 1].id > t.id), 'task-list.json 应按 id 倒序');
    ensureEqual(F.simulation, { failStage: 'NONE', delaysMs: { MATERIAL_CHECK: 1500, GENERATING: 4000, RESULT_ASSEMBLY: 1500 }, queryOutage: false }, 'simulation.json（02 §6 的默认值）');
    ensureEqual([F['error-validation'].code, F['error-not-found'].code], ['VALIDATION_FAILED', 'TASK_NOT_FOUND'], '两个错误夹具的 code');
  });

  await check('同类夹具的字段集合一致', async () => {
    const tasks = ['task-pending', 'task-processing', 'task-succeeded', 'task-failed'];
    const problems = [];
    for (const a of tasks) for (const b of tasks) if (a !== b) problems.push(...shapeDiff(F[a], F[b]).map((e) => `${a} 对 ${b}：${e}`));
    F['task-list'].items.forEach((t, i) => problems.push(...shapeDiff(t, F[TASK_FIXTURE_BY_STATUS[t.status]]).map((e) => `task-list[${i}]：${e}`)));
    problems.push(...shapeDiff(F['error-validation'], F['error-not-found']).map((e) => `错误夹具：${e}`));
    const summaryKeys = Object.keys(F.templates.items[0]).sort();
    const detailKeys = Object.keys(F['template-detail']).sort();
    ensureEqual(detailKeys, [...summaryKeys, 'description', 'acceptedMimeTypes', 'maxFileSizeBytes'].sort(), '详情字段 = 摘要字段 + description、acceptedMimeTypes、maxFileSizeBytes');
    ensureNoErrors(problems, '字段集合不一致');
  });

  await check('task-pending → task-processing → task-succeeded 是同一任务的合法推进', async () => {
    ensureNoErrors(progressErrors(F['task-pending'], F['task-processing']), 'pending → processing');
    ensureNoErrors(progressErrors(F['task-processing'], F['task-succeeded']), 'processing → succeeded');
  });

  section('比对与校验逻辑本身');
  await check('字段比对能发现缺少字段、多出字段、类型不符和数组元素里的问题', async () => {
    const base = F['task-succeeded'];
    const { stage, ...withoutStage } = base;
    void stage;
    ensure(shapeDiff(withoutStage, base).some((e) => e.includes('缺少字段 stage')), '没有发现缺少的字段');
    ensure(shapeDiff({ ...base, extra: 1 }, base).some((e) => e.includes('多出字段 extra')), '没有发现多出的字段');
    ensure(shapeDiff({ ...base, id: '101' }, base).some((e) => e.startsWith('$.id')), '没有发现类型不符');
    const badStep = structuredClone(base);
    badStep.steps[0].message = 1;
    ensure(shapeDiff(badStep, base).some((e) => e.startsWith('$.steps[0].message')), '没有发现数组元素里的类型不符');
    ensureEqual(shapeDiff(base, base), [], '相同对象的比对结果');
  });

  await check('null 与任何类型兼容；有一边是空数组时不比较元素', async () => {
    ensureEqual(shapeDiff(F['task-pending'], F['task-succeeded']), [], 'PENDING 对 SUCCEEDED');
    ensureEqual(shapeDiff({ a: [] }, { a: [{ x: 1 }] }), [], '空数组');
  });

  await check('任务校验能发现非法取值和互相矛盾的字段', async () => {
    const failed = F['task-failed'];
    const extraStep = structuredClone(failed);
    extraStep.steps.push({ stage: 'RESULT_ASSEMBLY', status: 'SUCCEEDED', startedAt: failed.finishedAt, finishedAt: failed.finishedAt, message: '不应执行' });
    const cases = [
      ['status 非法', { ...F['task-pending'], status: 'DONE' }],
      ['SUCCEEDED 却没有 resultUrl', { ...F['task-succeeded'], resultUrl: null }],
      ['PENDING 却有步骤', { ...F['task-pending'], steps: F['task-succeeded'].steps }],
      ['FAILED 的 failedStage 与 stage 不同', { ...failed, failedStage: 'MATERIAL_CHECK' }],
      ['步骤顺序颠倒', { ...F['task-succeeded'], steps: [...F['task-succeeded'].steps].reverse() }],
      ['失败之后还执行了下一步', extraStep],
      ['时间没有 Z', { ...F['task-pending'], createdAt: '2026-11-10T08:31:00.000' }],
      ['未知的 errorCode', { ...failed, errorCode: 'BOOM' }],
      ['PROCESSING 却有 finishedAt', { ...F['task-processing'], finishedAt: '2026-11-10T08:31:02.000Z' }],
    ];
    const missed = cases.filter(([, t]) => taskErrors(t).length === 0).map(([label]) => label);
    ensure(missed.length === 0, `没有发现：${missed.join('、')}`);
    return `${cases.length} 种错误都能发现`;
  });

  await check('进度检查能发现状态后退、终态被修改和已结束的步骤被改写', async () => {
    const processing = F['task-processing'];
    const succeeded = F['task-succeeded'];
    ensure(progressErrors(processing, F['task-pending']).length > 0, '没有发现 PROCESSING → PENDING');
    ensure(progressErrors(succeeded, processing).length > 0, '没有发现 SUCCEEDED → PROCESSING');
    ensure(progressErrors(succeeded, { ...succeeded, updatedAt: '2026-11-10T09:00:00.000Z' }).length > 0, '没有发现终态的 updatedAt 被修改');
    const rewritten = structuredClone(succeeded);
    rewritten.status = 'PROCESSING';
    rewritten.steps[0].message = '改写';
    ensure(progressErrors(processing, rewritten).some((e) => e.includes('MATERIAL_CHECK')), '没有发现已结束的步骤被改写');
    ensureEqual(progressErrors(succeeded, structuredClone(succeeded)), [], '终态不变时');
  });

  await check('时间格式：接受 .123Z 和不带小数，拒绝缺少 Z 或带时区偏移', async () => {
    for (const ok of ['2026-11-10T08:30:00.123Z', '2026-11-10T08:30:00Z', '2026-11-10T08:30:00.123456Z']) ensureEqual(tsErrors(ok, 't'), [], ok);
    for (const bad of ['2026-11-10 08:30:00', '2026-11-10T08:30:00.123', '2026-11-10T08:30:00.123+08:00', 1731227400000]) ensure(tsErrors(bad, 't').length > 0, `没有拒绝 ${show(bad)}`);
  });

  await check('Set-Cookie 解析与删除判断', async () => {
    const c = parseSetCookie('XY_SESSION=abc.DEF_123; Path=/; Max-Age=604800; Expires=Tue, 17 Nov 2026 08:00:00 GMT; HttpOnly; SameSite=Lax');
    ensureEqual([c.name, c.value, c.attrs.path, c.attrs['max-age'], c.attrs.httponly, c.attrs.samesite], ['XY_SESSION', 'abc.DEF_123', '/', '604800', true, 'Lax'], '解析结果');
    ensure(!isCookieDeletion(c), '把正常的 Cookie 当成了删除');
    ensure(isCookieDeletion(parseSetCookie('XY_SESSION=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT')), '没有识别出删除 Cookie');
  });

  await check('图片文件头解析：PNG 的 IHDR、JPEG 的 SOF', async () => {
    const png = Buffer.alloc(24);
    PNG_SIGNATURE.copy(png, 0);
    png.writeUInt32BE(13, 8);
    png.write('IHDR', 12, 'latin1');
    png.writeUInt32BE(720, 16);
    png.writeUInt32BE(960, 20);
    ensureEqual(imageInfo(png), { type: 'png', width: 720, height: 960 }, 'PNG');
    const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
    const sof0 = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x03, 0xc0, 0x02, 0xd0, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01];
    ensureEqual(imageInfo(Buffer.from([0xff, 0xd8, ...app0, ...sof0, 0xff, 0xd9])), { type: 'jpeg', width: 720, height: 960 }, 'JPEG');
    ensureEqual(imageInfo(Buffer.from('not an image', 'utf8')).type, 'other', '文本文件');
  });

  await check('命令行参数解析', async () => {
    const a = parseCli(['http://localhost:8080/', '--only', 'tasks,auth', '--only', 'templates']);
    ensureEqual([a.base, a.only, a.selfCheck], ['http://localhost:8080', ['templates', 'auth', 'tasks'], false], '解析结果');
    ensureEqual(parseCli([]).base, 'http://localhost:3000', '默认地址');
    let rejected = false;
    try { parseCli(['--only', 'nope']); } catch (e) { rejected = e instanceof UsageError; }
    ensure(rejected, '没有拒绝未知的段');
  });

  section('样例文件与封面（B1 生成；还没生成时只提示，生成后必须全部 ✓）');
  await checkAssets(Object.entries(SAMPLE_SPECS).map(([name, spec]) => [path.join(options.samplesDir, name), spec, `samples/${name}`]), 'samples/ 下还没有样例文件');
  await checkAssets(ALL_TEMPLATE_IDS.map((id) => [path.join(COVER_DIR, `${id}.png`), COVER_SPEC, `封面 ${id}.png`]), `${path.relative(REPO_ROOT, COVER_DIR).split(path.sep).join('/')} 下还没有封面`);
}

async function checkAssets(entries, allMissingMessage) {
  const present = [];
  const missing = [];
  for (const [file, spec, label] of entries) {
    try { present.push([await readFile(file), spec, label]); } catch { missing.push(label); }
  }
  if (present.length === 0) { warn(`${allMissingMessage}（B1 由 scripts/GenerateDemoAssets.java 生成）`); return; }
  for (const label of missing) await check(`${label} 存在`, async () => fail('文件不存在'));
  for (const [buf, spec, label] of present) {
    await check(`${label} 符合 spec/04 §8`, async () => {
      ensureNoErrors(assetErrors(buf, spec), '不符合');
      const info = imageInfo(buf);
      return info.width ? `${info.width}×${info.height}，${buf.length} 字节` : `${buf.length} 字节`;
    });
  }
}

function parseCli(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        only: { type: 'string', multiple: true },
        samples: { type: 'string' },
        'self-check': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (e) {
    throw new UsageError(e.message);
  }
  const { values, positionals } = parsed;
  if (positionals.length > 1) throw new UsageError(`只能指定一个地址，收到：${positionals.join(' ')}`);
  let url;
  try { url = new URL(positionals[0] ?? 'http://localhost:3000'); } catch { throw new UsageError(`地址不合法：${positionals[0]}`); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UsageError(`地址只支持 http 或 https：${positionals[0]}`);
  let only = null;
  if (values.only) {
    const names = values.only.flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean);
    const unknown = names.filter((n) => !SECTION_NAMES.includes(n));
    if (unknown.length) throw new UsageError(`未知的段：${unknown.join('、')}。可选：${SECTION_NAMES.join('、')}`);
    only = SECTION_NAMES.filter((n) => names.includes(n));
  }
  return {
    base: url.origin,
    only,
    samplesDir: values.samples ? path.resolve(values.samples) : path.join(REPO_ROOT, 'samples'),
    selfCheck: values['self-check'],
    help: values.help,
  };
}

async function main() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) { process.stderr.write(`需要 Node 20 或更高版本（推荐 24），当前是 ${process.versions.node}\n`); return 2; }
  let options;
  try { options = parseCli(process.argv.slice(2)); } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    process.stderr.write(`参数错误：${e.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (options.help) { log(USAGE); return 0; }

  const started = performance.now();
  const fixtureProblems = await loadFixtures();
  if (options.selfCheck) {
    try { await runSelfCheck(options, fixtureProblems); } catch (e) { if (!(e instanceof SectionAbort)) throw e; }
  } else if (fixtureProblems.length) {
    log(`夹具有问题，先运行 --self-check 查看：\n${fixtureProblems.map((p) => `- ${p}`).join('\n')}`);
    return 1;
  } else {
    await runLive(options);
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  log('');
  log(`结果：${stats.pass} 项通过，${stats.fail} 项失败${stats.warn ? `，${stats.warn} 个提示` : ''}，用时 ${seconds}s`);
  return stats.fail > 0 ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { process.stderr.write(`${e?.stack ?? e}\n`); process.exitCode = 1; },
);
