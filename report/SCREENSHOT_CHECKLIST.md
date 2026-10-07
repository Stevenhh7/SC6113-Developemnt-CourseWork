# 新版报告截图记录

作者：Ji Chengyu，G2608005K。报告已更新为 **8 页（含参考文献）**，保留全部 13 个规定章节。目前证据足够，无需再补截图。

Word 的 Testing 部分要求合约部署、钱包连接、成功交易、非法输入及结果截图。更新报告沿用未修改业务合约的真实交易证据，并增加新版公开网站的创建表单、搜索、详情和恢复历史，不把旧图冒充新版页面。

| 图片 | 内容 | 新版 PDF |
| --- | --- | --- |
| 01-deployment.png | 原合约部署成功，Sepolia、地址、区块 11856501 | 已采用清晰裁切，说明业务合约规则未变 |
| 02-wallet.png | Sepolia 钱包及两个已授权账户 | 已采用，说明账户功能沿用 |
| 03-history.png | 早期投入/赎回 Confirmed 完整历史 | 保留原图，正文使用当前历史 |
| 04-invalid-input.png | -1 ETH 与正数金额提示 | 已采用输入/错误提示裁切 |
| 06-redemption.png | 区块 11857372 赎回确认、零个人持仓 | 已采用；当前索引已找回同一交易 |
| 07-backend.png | 较早区块 11857366、本金 0.04 ETH | 保留原图，正文改用当前 API 核验摘要 |
| 08-render.png | 旧 commit b65f9c3 部署成功 | 保留原图，不作为新版本证据 |
| 09-directory-search.jpg | 当前 Render 搜索 test1 及对应项目结果 | 已采用，同一截图的两个局部 |
| 10-create-form.jpg | 当前 Render 名称/说明表单 | 已采用；示例填写，未提交部署 |
| 11-project-detail.jpg | 当前 ID 2 的名称、说明、合约及创建者 | 已采用 |
| 12-current-history.jpg | 当前原项目历史的已确认记录 | 已采用；截图仅截取前三行方便阅读 |
| 13-render-updated.png | 用户提供的 b6941a7、Deploy succeeded / Live | 原图保留，PDF 用 13-render-status.png 裁切状态和 source |

上述新版网站截图为真实公开页面。完整 API JSON 另存 `docs/evidence/live-multi-investment-2026-10-07.json`；报告中的 API 摘要明确注明不是浏览器截图。当前独立读取确认五条预览、十条原池完整事件和 `source: database`。Render 状态图片与清除构建缓存后的独立服务核验分别说明。

所有原图保留，原始尺寸、SHA-256、用途和裁切信息见 `screenshots/manifest.json`。正文含九个截图来源，另有架构图和 API 摘要；不是要求用户重新签名或重新部署来拍照。

## 已收齐

- [x] 必需部署、钱包、成功交易、非法输入证据。
- [x] 赎回后持仓与交易确认。
- [x] 新版创建表单、关键词搜索、独立详情与数据库恢复历史。
- [x] 新版 Render Live 状态及公开 API 核验记录。
- [x] 八页最终 PDF 的截图和图注逐页检查。

## 证据页面

- [新版目录](https://sc6113-developemnt-coursework.onrender.com/)
- [test1 独立详情](https://sc6113-developemnt-coursework.onrender.com/investments/2)
- [原项目完整历史](https://sc6113-developemnt-coursework.onrender.com/investments/1/activity?wallet=0xc63A507a39C37CB4C752BA56408138386D06146f)
- [新版目录 API](https://sc6113-developemnt-coursework.onrender.com/api/investments)
- [原项目历史 API](https://sc6113-developemnt-coursework.onrender.com/api/history/0xc63A507a39C37CB4C752BA56408138386D06146f?investment=1&limit=5)
- [test1 创建交易](https://sepolia.etherscan.io/tx/0x5f3b67afb977a0e2c4e53738b14266a406df702a4b700f78bebf0664e1e11a0a)

真实双创建者和托管服务停启恢复没有独立新增截图；报告如实把双创建者隔离列为本地浏览器结果，不将其说成已独立复现的线上结果。若课程另要求现场演示，可按 `USER_ACTIONS.md` 的验收流程展示。
