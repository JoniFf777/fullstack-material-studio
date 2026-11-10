import { describe, expect, it } from "vitest";
import { validateFile } from "./validateFile";

const POSTCARD = { acceptedMimeTypes: ["image/jpeg", "image/png"], maxFileSizeBytes: 5 * 1024 * 1024 };
const AVATAR = { acceptedMimeTypes: ["image/jpeg", "image/png"], maxFileSizeBytes: 204800 };
const FILM = { acceptedMimeTypes: ["image/jpeg"], maxFileSizeBytes: 5 * 1024 * 1024 };

describe("validateFile", () => {
  it("类型和大小都符合时通过", () => {
    expect(validateFile({ type: "image/jpeg", size: 35_298 }, POSTCARD)).toBeNull();
    expect(validateFile({ type: "image/png", size: 171_263 }, POSTCARD)).toBeNull();
  });

  it("类型不在模板允许范围内时，提示支持的类型（S02：复古胶片只收 JPG）", () => {
    expect(validateFile({ type: "image/png", size: 171_263 }, FILM)).toBe("只支持 JPG 图片");
    expect(validateFile({ type: "image/gif", size: 1000 }, POSTCARD)).toBe("只支持 JPG / PNG 图片");
    expect(validateFile({ type: "", size: 1000 }, POSTCARD)).toBe("只支持 JPG / PNG 图片");
  });

  it("超过模板大小上限时提示上限和实际大小（S02：迷你头像 200KB）", () => {
    expect(validateFile({ type: "image/jpeg", size: 1_794_725 }, AVATAR)).toBe("图片超过 200KB 上限（这张 1.7MB）");
    expect(validateFile({ type: "image/jpeg", size: 204_800 }, AVATAR)).toBeNull();
  });

  it("空文件直接拒绝", () => {
    expect(validateFile({ type: "image/jpeg", size: 0 }, POSTCARD)).toBe("文件是空的，请换一张图片");
  });

  it("前端只看浏览器给出的类型：文本改名成 .jpg 会被放行，由服务端按文件头拒绝", () => {
    expect(validateFile({ type: "image/jpeg", size: 32 }, POSTCARD)).toBeNull();
  });
});
