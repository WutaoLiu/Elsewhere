# Passing Light

独立摄影作品站，纯 HTML / CSS / JavaScript，部署到 GitHub Pages。暂用 Passing Light 作为标题。

## 预览

在项目目录运行 `python3 -m http.server 8080 --directory site`，访问 http://localhost:8080 。不要直接用 file:// 打开，照片清单通过 fetch 读取。

当前图片均为自制抽象布局占位图，不是刘武韬的摄影作品。导入真实照片后清单中的 demo 会自动关闭。

## 导入照片

安装 `python3 -m pip install -r requirements.txt`。然后运行：

```sh
python3 scripts/import_photos.py '/安全备份盘/相册文件夹' --series 'Album name'
```

工具递归读取 JPEG / PNG / WebP / TIFF，生成 800px 缩略图与 2000px 展示图，按 EXIF 方向旋转；带可识别 ICC 的照片转换为 sRGB。导出不保留 EXIF（包括 GPS）。不会改动或上传原图。RAW 应先在 Lightroom 等软件中导出带 sRGB 色彩配置的 JPEG/TIFF。

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

photos.json 每张图片的 thumbnail、preview 和可选 full 都可以填写对象存储/CDN 的 HTTPS 地址。浏览列表自动根据屏幕尺寸选缩略图或展示图，点开大图才读取 full（未填写时使用 preview）。跨域图片服务器应允许公开图片读取；不要把私密原图设为公开。

本地静态网站无需服务器、数据库或 API 密钥。页面使用弹窗原生键盘焦点管理，支持 Esc 关闭、左右键翻页、系列筛选和手机布局。
