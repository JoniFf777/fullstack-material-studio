import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppShell } from "@/components/AppShell";
import { HistoryPanel } from "@/features/tasks/HistoryPanel";
import type { TaskDto } from "@/lib/api/types";
import { createFakeApi, delayed, json, type FakeApi } from "@/test/fakeApi";
import { taskFixture } from "@/test/fixtures";
import { navigationState, routerMock } from "@/test/navigation";
import { renderWithProviders } from "@/test/render";

// spec/06 §5.4 authReset（P1）：退出或会话失效后，缓存被清空，旧用户的任务不再渲染，进行中的请求被 abort

const LIST = "/api/tasks?templateId=travel-postcard&limit=50";
const running: TaskDto = taskFixture("processing", { id: 201, templateId: "travel-postcard" });

function userQueries(queryClient: ReturnType<typeof renderWithProviders>["queryClient"]) {
  return queryClient.getQueryCache().findAll({ queryKey: ["u"] });
}

describe("退出登录与会话失效时的清理", () => {
  let api: FakeApi;

  beforeEach(() => {
    api = createFakeApi();
    api.install();
    navigationState.pathname = "/templates/travel-postcard";
  });

  it("退出登录：中止进行中的请求，清空用户缓存，旧任务立即消失，然后去登录页", async () => {
    api.on("GET", LIST, json(200, { items: [running] }));
    api.on("GET", "/api/tasks/201", delayed(10_000, json(200, running)));
    api.on("POST", "/api/auth/logout", json(204));
    const user = userEvent.setup();

    const { queryClient } = renderWithProviders(
      <AppShell>
        <HistoryPanel templateId="travel-postcard" />
      </AppShell>,
    );
    expect(await screen.findByRole("article", { name: "任务 #201" })).toBeInTheDocument();
    await waitFor(() => expect(api.calls("GET", "/api/tasks/201")).toBe(1));
    const inflight = api.signals("GET", "/api/tasks/201")[0];
    expect(userQueries(queryClient).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "账号：演示用户" }));
    await user.click(await screen.findByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
    expect(api.calls("POST", "/api/auth/logout")).toBe(1);
    expect(inflight?.aborted).toBe(true);
    expect(screen.queryByRole("article", { name: "任务 #201" })).toBeNull();
    expect(userQueries(queryClient)).toHaveLength(0);
    expect(queryClient.getQueryData(["me"])).toBeNull();
  });

  it("会话中途失效（401 UNAUTHENTICATED）：同样清空缓存、卸载旧数据并去登录页", async () => {
    api.on("GET", LIST, json(200, { items: [running] }));
    api.on("GET", "/api/tasks/201", json(401, { code: "UNAUTHENTICATED", message: "请先登录", fieldErrors: [] }));

    const { queryClient } = renderWithProviders(
      <AppShell>
        <HistoryPanel templateId="travel-postcard" />
      </AppShell>,
    );

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/login/)));
    await waitFor(() => expect(screen.queryByRole("article", { name: "任务 #201" })).toBeNull());
    expect(userQueries(queryClient)).toHaveLength(0);
    expect(queryClient.getQueryData(["me"])).toBeNull();
  });
});
