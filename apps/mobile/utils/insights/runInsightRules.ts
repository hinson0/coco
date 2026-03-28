import type { InsightContext, InsightItem } from './types';
import { healthScoreRule } from './healthScoreRule';
import { categoryChangeRule } from './categoryChangeRule';
import { anomalyRule } from './anomalyRule';
import { paceRule } from './paceRule';
import { frequencyRule } from './frequencyRule';
import { savingRule } from './savingRule';

export function runInsightRules(ctx: InsightContext): InsightItem[] {
  const results: InsightItem[] = [];

  // 健康度始终存在
  results.push(healthScoreRule(ctx));

  // 执行独立规则
  const catChange = categoryChangeRule(ctx);
  if (catChange) {
    if (Array.isArray(catChange)) results.push(...catChange);
    else results.push(catChange);
  }

  const anomaly = anomalyRule(ctx);
  if (anomaly) results.push(anomaly);

  const pace = paceRule(ctx);
  if (pace) results.push(pace);

  const freq = frequencyRule(ctx);
  if (freq) results.push(freq);

  // 节省建议依赖前序结果
  const saving = savingRule(ctx, results);
  if (saving) results.push(saving);

  // 按 priority 升序排序
  results.sort((a, b) => a.priority - b.priority);

  return results;
}
