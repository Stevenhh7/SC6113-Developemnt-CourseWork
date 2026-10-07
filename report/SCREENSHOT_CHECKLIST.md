# 报告截图清单

**以下为第一版已收齐的截图记录。** 新版已增加多 Investment、搜索与 PostgreSQL，需要新截图，旧图不能单独证明新版上线。新拍摄清单见 [USER_ACTIONS.md](../USER_ACTIONS.md) 第 4 部分；旧图原样保留，更新报告时区分版本。

作者：Ji Chengyu，G2608005K。请优先在已测试通过的 [Render 网站](https://sc6113-developemnt-coursework.onrender.com/) 截图，使用 Sepolia。

原 Word 的 VIII Testing 明确要求成功交易、非法输入、钱包连接、合约部署以及结果截图。计划还要求持仓、赎回、历史和后端集成的证据。目前共七张原图已收齐，全部加入 LaTeX；第 3 张同时覆盖成功交易与完整历史，无需额外第 5 张。

| 编号及建议文件名 | 拍什么 | 必须能读清的内容 |
| --- | --- | --- |
| 1 `01-deployment.png` | 已有合约的 Etherscan 创建交易，或保留的 Deployment confirmed 页面 | Sepolia、成功状态、合约地址/创建交易和部署区块。无需重新部署。 |
| 2 `02-wallet.png` | 连接后的首页，打开钱包账户菜单 | 地址、Sepolia、已授权账户及当前选择；同时显示个人持仓区域更好。 |
| 3 `03-history.png` | 已收到完整交易历史，兼作成功交易证据 | Confirmed、金额、交易哈希，以及投入和赎回记录。 |
| 4 `04-invalid-input.png` | 已收到输入 `-1` 后的 Deposit 校验提示 | 负数输入与要求正数金额的提示同屏。该校验不会提交交易。 |
| 5 完整历史 | 已由第 3 张覆盖，无需重复提供 | Deposit/Redemption、金额、日期、Confirmed、交易链接。 |
| 6 `06-redemption.png` | 已收到赎回后的零持仓与成功反馈 | 区块 11857372、Confirmed、零份额、可赎回本金 0 ETH。 |
| 7 `07-backend.png` | 已收到 `/api/pool` JSON | 区块 11857366、本金与合约余额 0.04 ETH、零额外余额、`solvent: true`。图片未包含地址栏；公开端点另有独立 HTTPS 核验记录。 |
| 8 `08-render.png` | 已收到 Render 成功部署日志 | Deploy succeeded / Live、commit b65f9c3、Gunicorn 启动及公开域名。 |

截图收集已完成，无需继续提供。七张均保留原始 PNG 字节，尺寸和 SHA-256 见 `screenshots/manifest.json`。编译后检查缩放后的截图文字是否可读；原图一并作为独立提交材料。

若现有成功交易可以在历史/Etherscan 中展示，无需重新签名。已有部署可从下面的创建交易打开，不要点击 Deploy 再创建一个资金池。持仓截图若需要复现，可由你按自己的测试余额选择再走一次小额投入、部分赎回、全部退出。

## 可直接打开的证据页面

- [网站首页](https://sc6113-developemnt-coursework.onrender.com/)
- [完整历史](https://sc6113-developemnt-coursework.onrender.com/activity?wallet=0xc63A507a39C37CB4C752BA56408138386D06146f)
- [资金池 API](https://sc6113-developemnt-coursework.onrender.com/api/pool)
- [合约创建交易](https://sepolia.etherscan.io/tx/0x45dba804763f4d53c4da30957b3d4da0f02dd15eecb65762a904926f99efd2ea)
- [已确认投入 0.003 ETH](https://sepolia.etherscan.io/tx/0x0304792edcd32dc589e6e5c7756f86fdc33a283c295b78772a8e323b4d490798)
- [已确认部分赎回 0.001 ETH](https://sepolia.etherscan.io/tx/0xcb3ebbe7044daf65d6129d01cb936cfaa9ccc8553b347ebccbe13a09b477804e)
- [已确认全部退出 0.002 ETH](https://sepolia.etherscan.io/tx/0xe47ab65933833624b02fddd362fcce5ade0c734d1626790b3239831ff4f06e9a)

原图已整理进 `report/screenshots/`，`MicroInvest_Report.tex` 的图注已按实际内容核对。API 图早于零持仓图 6 个区块，报告已说明状态变化。按你后续要求，已编译最终英文 PDF 为 8 页并逐页核对。

## 接收进度

- [x] 1 部署成功，已保存原图并核对链 ID、合约地址和区块。
- [x] 2 钱包连接，显示 Sepolia 与两个已授权账户。
- [x] 3 成功交易与完整历史，原图保存为 `03-history.png`，包含 Confirmed 的投入/赎回记录。
- [x] 4 非法输入，原图展示 `-1` 和正数金额校验消息。
- [x] 5 完整历史，已由第 3 张覆盖，无需重复提供。
- [x] 6 全部赎回后的零持仓与交易确认。
- [x] 7 后端 API，正本金的较早快照。
- [x] 8 Render 服务 Live、成功部署日志与公开域名。
