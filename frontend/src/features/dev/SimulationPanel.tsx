"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { StatePlaceholder } from "@/components/StatePlaceholder";
import { getSimulation, patchSimulation, resetSimulation } from "@/lib/api/endpoints";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { TASK_STAGES, type SimulationSettingsDto, type TaskStage } from "@/lib/api/types";
import { STAGE_LABELS } from "@/lib/format";

const KEY = ["dev", "simulation"] as const;

function SimulationForm({ initial }: { initial: SimulationSettingsDto }) {
  const queryClient = useQueryClient();
  const [failStage, setFailStage] = useState<SimulationSettingsDto["failStage"]>(initial.failStage);
  const [delays, setDelays] = useState<Record<TaskStage, string>>({
    MATERIAL_CHECK: String(initial.delaysMs.MATERIAL_CHECK),
    GENERATING: String(initial.delaysMs.GENERATING),
    RESULT_ASSEMBLY: String(initial.delaysMs.RESULT_ASSEMBLY),
  });
  const [queryOutage, setQueryOutage] = useState(initial.queryOutage);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const save = useMutation({
    mutationFn: patchSimulation,
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
      setMessage({ tone: "ok", text: "已保存。只影响之后提交的任务（已受理的任务按受理时的快照执行）；查询故障开关立即生效。" });
    },
    onError: (error) => setMessage({ tone: "error", text: errorMessage(error) }),
  });

  const reset = useMutation({
    mutationFn: resetSimulation,
    onSuccess: (data) => {
      queryClient.setQueryData(KEY, data);
      setFailStage(data.failStage);
      setDelays({ MATERIAL_CHECK: String(data.delaysMs.MATERIAL_CHECK), GENERATING: String(data.delaysMs.GENERATING), RESULT_ASSEMBLY: String(data.delaysMs.RESULT_ASSEMBLY) });
      setQueryOutage(data.queryOutage);
      setMessage({ tone: "ok", text: "已恢复为配置文件里的默认值。" });
    },
    onError: (error) => setMessage({ tone: "error", text: errorMessage(error) }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const delaysMs = Object.fromEntries(TASK_STAGES.map((s) => [s, Number(delays[s])])) as Record<TaskStage, number>;
    if (Object.values(delaysMs).some((v) => !Number.isInteger(v) || v < 0 || v > 60000)) {
      setMessage({ tone: "error", text: "耗时必须是 0–60000 之间的整数（毫秒）" });
      return;
    }
    save.mutate({ failStage, delaysMs, queryOutage });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">指定失败阶段</legend>
        <div className="flex flex-wrap gap-2">
          {(["NONE", ...TASK_STAGES] as const).map((value) => (
            <label key={value} className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-sm has-checked:border-brand">
              <input type="radio" name="failStage" value={value} checked={failStage === value} onChange={() => setFailStage(value)} />
              {value === "NONE" ? "不注入失败" : STAGE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">三步各自的耗时（毫秒，0–60000）</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {TASK_STAGES.map((stage) => (
            <label key={stage} className="space-y-1 text-sm">
              <span className="block text-muted">{STAGE_LABELS[stage]}</span>
              <input
                type="number"
                min={0}
                max={60000}
                step={100}
                inputMode="numeric"
                value={delays[stage]}
                onChange={(e) => setDelays((d) => ({ ...d, [stage]: e.target.value }))}
                className="h-10 w-full rounded-xl border border-line bg-card px-3 text-ink"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={queryOutage} onChange={(e) => setQueryOutage(e.target.checked)} className="size-4" />
        查询接口故障（任务列表和详情返回 503，后台执行不受影响）
      </label>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={save.isPending}>
          保存
        </Button>
        <Button onClick={() => reset.mutate()} loading={reset.isPending}>
          恢复默认
        </Button>
      </div>
      <div aria-live="polite" className="min-h-5 text-sm">
        {message ? <p className={message.tone === "ok" ? "text-ok" : "text-bad"}>{message.text}</p> : null}
      </div>
    </form>
  );
}

/** /dev：模拟控制面板（P1）。只有后端 DEV_API_ENABLED=true 时可用。 */
export function SimulationPanel() {
  const query = useQuery({ queryKey: KEY, queryFn: ({ signal }) => getSimulation(signal) });

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">模拟调试</h1>
        <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-warn">仅用于演示和验收，生产环境请关闭（DEV_API_ENABLED=false）。</p>
      </div>
      <section className="rounded-2xl border border-line bg-panel p-5">
        {query.isPending ? <p className="text-sm text-muted">加载中…</p> : null}
        {query.isError ? (
          query.error instanceof ApiError && query.error.status === 404 ? (
            <StatePlaceholder kind="empty" title="开发接口没有打开" description="后端需要以 DEV_API_ENABLED=true 启动（Compose 默认打开）。" />
          ) : (
            <StatePlaceholder kind="error" title="读取模拟配置失败" description={errorMessage(query.error)} action={<Button onClick={() => void query.refetch()}>重试</Button>} />
          )
        ) : null}
        {/* 只在第一次拿到数据时挂载表单；之后保存、恢复默认都由表单自己更新状态 */}
        {query.data ? <SimulationForm initial={query.data} /> : null}
      </section>
    </div>
  );
}
