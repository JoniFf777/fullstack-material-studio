import type { TemplateDetailDto } from "@/lib/api/types";
import { acceptedTypesLabel, formatBytes } from "@/lib/format";

type Rules = Pick<TemplateDetailDto, "acceptedMimeTypes" | "maxFileSizeBytes">;

/**
 * 前端校验只看浏览器给出的类型（按扩展名推断）和大小；真实类型由服务端按文件头判断。
 * 所以把文本文件改名成 .jpg 能通过这里、被后端拒绝——这正是要演示的效果。
 * 返回 null 表示通过，否则返回给用户看的原因。
 */
export function validateFile(file: Pick<File, "type" | "size">, rules: Rules): string | null {
  if (file.size === 0) return "文件是空的，请换一张图片";
  if (!rules.acceptedMimeTypes.includes(file.type)) return `只支持 ${acceptedTypesLabel(rules.acceptedMimeTypes)} 图片`;
  if (file.size > rules.maxFileSizeBytes) {
    return `图片超过 ${formatBytes(rules.maxFileSizeBytes)} 上限（这张 ${formatBytes(file.size)}）`;
  }
  return null;
}
