import { describe, expect, it } from "vitest";
import { fixture } from "@/test/fixtures";
import type { MaterialDto } from "@/lib/api/types";
import { initSlots, submitReadiness, uploadSlotsReducer, type SlotsAction, type SlotsState } from "./uploadSlotsReducer";

const material = (id: number): MaterialDto => ({ ...fixture<MaterialDto>("material"), id, url: `/api/materials/${id}/content` });
const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

function run(state: SlotsState, ...actions: SlotsAction[]): SlotsState {
  return actions.reduce(uploadSlotsReducer, state);
}

describe("uploadSlotsReducer", () => {
  it("开始上传 → 进度 → 成功", () => {
    const s = run(
      initSlots(2),
      { type: "start", slot: 0, uploadId: 1, file: file("a.jpg"), previewUrl: "blob:a" },
      { type: "progress", slot: 0, uploadId: 1, progress: 42 },
    );
    expect(s.slots[0]).toMatchObject({ status: "uploading", progress: 42, previewUrl: "blob:a" });
    const done = run(s, { type: "succeed", slot: 0, uploadId: 1, material: material(11) });
    expect(done.slots[0]).toMatchObject({ status: "ready", material: { id: 11 } });
    expect(done.slots[1]).toEqual({ status: "empty" });
  });

  it("替换后，旧 uploadId 的进度、成功、失败事件都被忽略；新上传的进度从 0 开始", () => {
    let s = run(
      initSlots(1),
      { type: "start", slot: 0, uploadId: 1, file: file("old.jpg"), previewUrl: "blob:old" },
      { type: "progress", slot: 0, uploadId: 1, progress: 80 },
      { type: "start", slot: 0, uploadId: 2, file: file("new.jpg"), previewUrl: "blob:new" },
    );
    expect(s.slots[0]).toMatchObject({ status: "uploading", uploadId: 2, progress: 0, previewUrl: "blob:new" });

    s = run(
      s,
      { type: "progress", slot: 0, uploadId: 1, progress: 99 },
      { type: "succeed", slot: 0, uploadId: 1, material: material(99) },
      { type: "fail", slot: 0, uploadId: 1, message: "旧的失败" },
    );
    expect(s.slots[0]).toMatchObject({ status: "uploading", uploadId: 2, progress: 0 });

    s = run(s, { type: "succeed", slot: 0, uploadId: 2, material: material(12) });
    expect(s.slots[0]).toMatchObject({ status: "ready", material: { id: 12 } });
  });

  it("移除后回到 empty，之后迟到的事件不会把它变回来", () => {
    const s = run(
      initSlots(1),
      { type: "start", slot: 0, uploadId: 1, file: file("a.jpg"), previewUrl: "blob:a" },
      { type: "remove", slot: 0 },
      { type: "succeed", slot: 0, uploadId: 1, material: material(11) },
    );
    expect(s.slots[0]).toEqual({ status: "empty" });
  });

  it("上传失败进入 error，保留文件以便重试；前端校验不通过进入 invalid", () => {
    const s = run(
      initSlots(2),
      { type: "start", slot: 0, uploadId: 1, file: file("not-image.jpg"), previewUrl: "blob:a" },
      { type: "fail", slot: 0, uploadId: 1, message: "只支持 JPG 和 PNG 图片" },
      { type: "reject", slot: 1, fileName: "large-photo.jpg", message: "图片超过 200KB 上限" },
    );
    expect(s.slots[0]).toMatchObject({ status: "error", message: "只支持 JPG 和 PNG 图片" });
    expect(s.slots[0].status === "error" && s.slots[0].file.name).toBe("not-image.jpg");
    expect(s.slots[1]).toMatchObject({ status: "invalid", fileName: "large-photo.jpg" });
  });

  it("全部 ready 时才可提交，materialIds 按上传位顺序", () => {
    const start = (slot: number, uploadId: number): SlotsAction => ({ type: "start", slot, uploadId, file: file(`${slot}.jpg`), previewUrl: `blob:${slot}` });
    let s = initSlots(2);
    expect(submitReadiness(s.slots)).toEqual({ kind: "missing", count: 2 });

    s = run(s, start(0, 1));
    expect(submitReadiness(s.slots)).toEqual({ kind: "missing", count: 1 });

    s = run(s, start(1, 2));
    expect(submitReadiness(s.slots)).toEqual({ kind: "uploading" });

    s = run(s, { type: "fail", slot: 1, uploadId: 2, message: "网络错误" });
    expect(submitReadiness(s.slots)).toEqual({ kind: "problem" });

    s = run(s, start(1, 3), { type: "succeed", slot: 1, uploadId: 3, material: material(12) }, { type: "succeed", slot: 0, uploadId: 1, material: material(11) });
    expect(submitReadiness(s.slots)).toEqual({ kind: "ready", materialIds: [11, 12] });

    expect(run(s, { type: "reset" }).slots).toEqual([{ status: "empty" }, { status: "empty" }]);
  });
});
