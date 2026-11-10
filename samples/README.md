# 演示上传文件

在仓库根目录使用 JDK 21 执行 `java scripts/GenerateDemoAssets.java` 可重复生成这些文件和九张模板封面。全部图形由 Java2D 绘制，不使用外部照片或字体；随机种子固定。

| 文件 | 用途 |
|---|---|
| photo-1.jpg | 1200×1200，低于 200KB，正常上传 |
| photo-2.jpg | 1200×900，低于 200KB，正常上传 |
| photo-3.png | 900×1200，PNG，可用于新年贺卡 |
| large-photo.jpg | 2400×1800，带噪点，超过迷你头像的 200KB 限制 |
| tiny-32.png | 32×32，上传通过，在异步素材检查阶段因分辨率过低失败 |
| not-image.jpg | 文本伪装的 JPG，服务端按文件头拒绝 |
