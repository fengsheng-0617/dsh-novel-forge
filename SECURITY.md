# 安全与隐私说明（dsh-novel-forge 插件版）

完整隐私边界见主仓库（novel-forge 写作引擎）的 SECURITY.md，本文件补充插件侧要点：

- **数据位置**：插件的书稿与模型 API Key 保存在插件目录 `app/data/`（`projects/*.json`、
  `settings.json`），仅存本机，随插件路径持久化。
- **网络行为**：插件只在 `127.0.0.1` 拉起内嵌引擎；`novel_forge_*` 工具仅访问该本机服务。
  无遥测、无上报；模型请求仅发往你在 NovelForge 设置页配置的厂商端点。
- **引擎镜像**：`app/server`、`app/public` 是 novel-forge 引擎的镜像（SHA-256 校验，
  见 `scripts/engine-mirror.mjs`）；如需改引擎请改主仓库后 `sync`，勿直接手改镜像。
- **密钥提示**：API Key 为明文 JSON；请勿将 `app/data/` 随 zip 分发、上传不受信网盘或提交 git。
- **上报**：发现安全问题时勿公开细节——经主仓库/插件仓库的私有渠道联系维护者。

## 大陆用户提示

从镜像/网盘取得发布包后请核对 `SHA256SUMS.txt`；Node.js 可用国内镜像（nodejs.cn / npmmirror）。
