# 参与贡献（dsh-novel-forge 插件版）

本仓库是 DeepSeek Harness 插件，定位 harness 生态侧。贡献前请先读主仓库的
CONTRIBUTING.md（novel-forge 写作引擎），并遵守这里的边界：

- **引擎不改**：`app/server`、`app/public` 是引擎镜像（单一来源 = novel-forge 主仓库）。
  引擎改动流程：主仓库实现并测试 → 本仓库 `node scripts/engine-mirror.mjs sync` → 本仓库三套自测。
- **本仓库负责**：`index.js`（生命周期服务 novelForge）、`tools.js`（novel_forge_* 会话工具）、
  未来的 client UI、`cordis.patch.yml`、发布与自检脚本。
- 零第三方依赖；宿主 API 用法以宿主文档与已安装生态插件源码为准。

## 提交前检查

```bash
node scripts/test-standalone.mjs && node scripts/test-apply.mjs && node scripts/test-tools.mjs
node scripts/engine-mirror.mjs verify        # 镜像零漂移
node scripts/check-mount.mjs -url http://127.0.0.1:端口   # 挂载自检（可选）
# 语法检查：node <主仓库>/scripts/check-syntax.js <本插件目录>
```

工具行为保持 `ok/code/error` 语义与 `NEED_CONFIRM` 确认机制，禁止静默覆盖用户创作。
