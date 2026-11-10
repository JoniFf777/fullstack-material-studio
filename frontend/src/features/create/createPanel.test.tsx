import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { MaterialDto, TaskDto, TemplateDetailDto } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { FakeXhr, createFakeApi, delayed, json, networkError, type FakeApi } from "@/test/fakeApi";
import { fixture, taskFixture } from "@/test/fixtures";
import { renderWithProviders } from "@/test/render";
import { CreatePanel } from "./CreatePanel";

// spec/06 §5.4 createPanel：按钮状态、提交、4xx、网络错误重试复用 Idempotency-Key

const template = fixture<TemplateDetailDto>("template-detail");
const material = (id: number): MaterialDto => ({ ...fixture<MaterialDto>("material"), id, url: `/api/materials/${id}/content` });
const jpeg = (name: string) => new File(["fake-jpeg"], name, { type: "image/jpeg" });
const submitButton = () => screen.getByRole("button", { name: /还需上传|立即制作|提交中|等待上传|请先处理/ });

async function uploadBoth(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("点击上传第 1 张"), jpeg("photo-1.jpg"));
  await act(async () => FakeXhr.last().respond(201, material(11)));
  await user.upload(screen.getByLabelText("点击上传第 2 张"), jpeg("photo-2.jpg"));
  await act(async () => FakeXhr.last().respond(201, material(12)));
  await waitFor(() => expect(submitButton()).toHaveTextContent("立即制作"));
}

describe("CreatePanel", () => {
  let api: FakeApi;

  beforeEach(() => {
    api = createFakeApi();
    api.install();
    FakeXhr.install();
  });

  it("素材没齐时禁用并写明还差几张 → 就绪后可点 → 提交中禁用 → 202 后清空上传位，新任务插到列表缓存最前面", async () => {
    const created = taskFixture("pending", { id: 500 });
    api.on("POST", "/api/tasks", delayed(200, json(202, created, { Location: "/api/tasks/500" })));
    const user = userEvent.setup();
    const { queryClient, user: me } = renderWithProviders(<CreatePanel template={template} />);
    queryClient.setQueryData(queryKeys.taskList(me.id, "travel-postcard"), [taskFixture("succeeded")]);

    expect(submitButton()).toHaveTextContent("还需上传 2 张");
    expect(submitButton()).toBeDisabled();

    await user.upload(screen.getByLabelText("点击上传第 1 张"), jpeg("photo-1.jpg"));
    expect(submitButton()).toHaveTextContent("还需上传 1 张");
    await act(async () => FakeXhr.last().respond(201, material(11)));

    await user.upload(screen.getByLabelText("点击上传第 2 张"), jpeg("photo-2.jpg"));
    expect(submitButton()).toHaveTextContent("等待上传完成…");
    expect(submitButton()).toBeDisabled();
    await act(async () => FakeXhr.last().respond(201, material(12)));

    await waitFor(() => expect(submitButton()).toHaveTextContent("立即制作"));
    expect(submitButton()).toBeEnabled();

    await user.click(submitButton());
    expect(submitButton()).toHaveTextContent("提交中…");
    expect(submitButton()).toBeDisabled();

    await waitFor(() => expect(submitButton()).toHaveTextContent("还需上传 2 张"));
    expect(screen.getByText("已提交，任务 #500 已进入队列")).toBeInTheDocument();
    expect(screen.getAllByText(/未选择图片/)).toHaveLength(2);
    expect(queryClient.getQueryData<TaskDto[]>(queryKeys.taskList(me.id, "travel-postcard"))?.map((t) => t.id)).toEqual([500, 101]);
    expect(api.calls("POST", "/api/tasks")).toBe(1);
    expect(JSON.parse(String(api.requests("POST", "/api/tasks")[0].body))).toEqual({ templateId: "travel-postcard", materialIds: [11, 12] });
  });

  it("提交返回 400 时显示 message，并保留上传位", async () => {
    api.on("POST", "/api/tasks", json(400, { code: "MATERIAL_NOT_FOUND", message: "素材不存在，请重新上传", fieldErrors: [] }));
    const user = userEvent.setup();
    renderWithProviders(<CreatePanel template={template} />);
    await uploadBoth(user);

    await user.click(submitButton());
    expect(await screen.findByText("素材不存在，请重新上传")).toBeInTheDocument();
    expect(screen.getAllByText(/已就绪/)).toHaveLength(2);
    expect(submitButton()).toHaveTextContent("立即制作");
  });

  it("网络错误后重试：保留上传位，两次请求的 Idempotency-Key 相同", async () => {
    api.on("POST", "/api/tasks", [networkError(), json(202, taskFixture("pending", { id: 501 }))]);
    const user = userEvent.setup();
    renderWithProviders(<CreatePanel template={template} />);
    await uploadBoth(user);

    await user.click(submitButton());
    expect(await screen.findByText("提交请求失败，请检查网络后重试")).toBeInTheDocument();
    expect(screen.getAllByText(/已就绪/)).toHaveLength(2);

    await user.click(submitButton());
    expect(await screen.findByText("已提交，任务 #501 已进入队列")).toBeInTheDocument();

    const keys = api.headers("POST", "/api/tasks").map((h) => h.get("Idempotency-Key"));
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(keys[1]).toBe(keys[0]);
  });
});
