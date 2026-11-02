# Elsewhere

独立摄影作品站，纯 HTML / CSS / JavaScript，部署到 GitHub Pages。暂用 Elsewhere 作为标题。

## 预览

在项目目录运行 `python3 -m http.server 8080 --directory site`，访问 http://localhost:8080 。不要直接用 file:// 打开，照片清单通过 fetch 读取。

当前展示从桌面 selected 中选出的 16 张真实作品，以及 bio 中的一张肖像。首批选择记录在 selection.json；当前的 Archive、页面顺序、版式和短句以 site/archives.json 为准。原名与数字编号的对照表仅保存在桌面的 selected-renaming-map.json，不上传到公开仓库。

照片保存在 GitHub 仓库并经 GitHub Pages 提供访问。每张有 800px 缩略图、1440px 展示图，以及原始分辨率的 quality=95 WebP 高清副本；高清副本合计约 121MiB，只有点开大图后加载。它保留原始像素尺寸，但不是字节一致的 JPEG 原件，编码有损。不保留 EXIF、GPS 或 XMP。无水印、无下载按钮，但所有公开展示图片仍可被保存，不能依靠隐藏下载入口保护图片。

## 摄影书排版

site/archives.json 定义左侧 Archive 及右侧每一页。每页的 photos 填写 photos.json 的图片 id，layout 可选 solo（1 张）、duo（2 张）、triptych（3 张）、portraits（2 张）或 offset（2 张）；note 可填写多行短句，也可以留空。当前所有短句留空，之后可补充作者自己的文字。所有照片保持原画幅，不进行强制裁切。

桌面左右箭头、分页圆点和键盘 ← → 可翻页；手机支持滑动。点图进入大图，再点击图片或 100% 按钮可按图像像素尺寸查看并滚动。Esc 关闭。Bio 独立位于 bio.html。

## 导入照片

安装 `python3 -m pip install -r requirements.txt`。然后运行：

```sh
python3 scripts/import_photos.py '/安全备份盘/相册文件夹' --series 'Album name'
```

工具递归读取 JPEG / PNG / WebP / TIFF，生成 800px 缩略图与 1440px 展示图，按 EXIF 方向旋转；带可识别 ICC 的照片转换为 sRGB。导出不保留 EXIF（包括 GPS）。不会改动或上传原图。RAW 应先在 Lightroom 等软件中导出带 sRGB 色彩配置的 JPEG/TIFF。

首次导入时加 `--full-resolution` 可同时生成原始分辨率的高清 WebP。该选项会增加公开仓库体积，默认不启用。已导入的图片会跳过，不会自动补生成高清版。

重跑同一来源、同一系列不会重复添加未变化的文件；源文件或系列改变会生成新条目。修改后运行 `git diff` 检查结果；标题、日期、排序和 alt 可以在 site/photos.json 编辑。

请不要从当前有故障的 WT 硬盘批量读取；先备份或恢复数据。

## GitHub Pages

本站仓库：https://github.com/weirdovo/passing-light

本站地址：https://weirdovo.github.io/passing-light/

采用分支发布，避免要求 GitHub OAuth 凭据具备 workflow 权限。main 保存全部源码和导入工具；gh-pages 只保存 site/ 的发布内容。仓库 Settings → Pages → Source 为 Deploy from a branch，分支 gh-pages，目录 / (root)。

照片导入或页面修改后，检查并提交改动，然后执行：

```sh
git add .
git commit -m 'Update photographs'
sh scripts/publish.sh
```

GitHub 完成 Pages 构建后线上页面更新。不要手动在 gh-pages 分支修改网站，否则会与后续 subtree 发布冲突。

页面使用相对路径，兼容 https://用户名.github.io/passing-light/ 这样的项目站点。

## 外部图片存储

photos.json 每张图片的 thumbnail、preview 和可选 full 都可以填写对象存储/CDN 的 HTTPS 地址。浏览页面自动根据屏幕尺寸选缩略图或展示图，点开大图才读取 full（未填写时使用 preview）。跨域图片服务器应允许公开图片读取；不要把私密原图设为公开。照片达到数百上千张时，可将这些文件迁至对象存储而不改页面架构。

本地静态网站无需服务器、数据库或 API 密钥。页面使用弹窗原生键盘焦点管理，支持 Esc 关闭、左右键翻页、系列筛选和手机布局。

## 翻页加载

照片清单内嵌 32px 微型预览，页面先显示微型预览，再使用解码后的 800px 缩略图，并按排版、屏幕和像素密度选择是否加载 1440px 展示图。预览请求最多并发 2 个；当前页完成后，空闲时间预载前后相邻页。省流量或 2G 连接不预载。最近 5 个跨页复用 DOM，图片加载缓存有数量上限。高清图不参与翻页预载，只有点开大图后才请求。

## 首页

根路径不带 hash 时显示单张封面，点击封面进入指定系列。site/archives.json 的 home.photo 和 home.archive 控制封面图片 id 与入口系列；不需要修改页面代码。左侧站名返回首页。当前为纯白底，已移除说明性文案、编号、装饰分隔线和默认短句。
