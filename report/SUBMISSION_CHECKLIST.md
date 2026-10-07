# 新版最终提交检查

原作业要求 5–8 页 PDF、源码、README、截图，以及采用数据库时的数据库相关内容；不需要视频。

## 多 Investment 版本的当前状态

- [x] 用户创建独立合约、填写名称/说明、部署者签名登记。
- [x] 项目目录、名称/说明关键词搜索、编号/地址区分与创建者筛选。
- [x] 独立详情页、账户菜单、投入/持仓/部分及全部赎回、独立分页历史。
- [x] PostgreSQL 支持、本地 SQLite、数据库结构与公开目录导出脚本。
- [x] 54 项后端测试、9 项金额/历史前端测试、24 项本地浏览器检查通过。
- [x] PostgreSQL 专项测试加入 CI；本机无数据库而跳过，不能标为已通过。
- [x] 用户已部署多 Investment；公开目录和资金池接口已检查。
- [ ] 推送本次历史入库改动并重新部署，核对数据库同步与重启恢复。
- [ ] 新版真实 MetaMask/Sepolia 验收：两创建者、搜索、跨项目参与与资金隔离、重启恢复。
- [ ] 提供新版创建/搜索/详情/交易/Render/API 截图，详见 ../USER_ACTIONS.md。
- [ ] 修订报告的架构、数据库、应用设计、实现、测试、限制与结论，编译检查 5–8 页 PDF。
- [ ] 从最终数据库导出并核对公开目录数据，提交 docs/schema.sql 与相关资料；不包含连接密码。
- [ ] 按课程通知确认最终命名、提交入口和截止时间，提交全部材料。

## 保留的第一版报告

已有 MicroInvest_Report.tex、8 页 MicroInvest_Report.pdf、MicroInvest_LaTeX.zip 和七张原图是第一版单资金池、无数据库的报告，作者 Ji Chengyu、G2608005K。原有 Sepolia 部署、Render 验收、真实交易/Gas 和截图均保留，不冒充新版证据。它们需要修订后才能描述当前实现。

## 报告章节

仍需保留全部 13 个部分：Introduction、Problem Statement、Objectives、System Architecture、Technologies Used、Smart Contract Design、Application Design、Implementation、Testing and Results、Challenges Encountered、Limitations、Future Improvements、Conclusion。

安全性是 Word 明确要求。说明已有调用者权限、输入/签名/字节码校验、重入和转账失败测试、私钥边界、Gas 和公开数据隐私，区分已运行测试与尚未运行的 PostgreSQL/新版线上验收。不要声称商业审计、压力测试或新手参与者研究。

## 打包

提交业务合约、artifact、Flask 与目录模块、前端、测试、脚本、依赖/锁文件、render.yaml、README、数据库结构/相关数据、公开部署信息、真实截图及修订 PDF。排除 .env、数据库/RPC 密码、私钥、助记词、instance/、.venv/、node_modules/、本地链缓存和 LaTeX 临时文件。

完整新版上线与截图操作见 ../USER_ACTIONS.md 和 ../docs/RENDER_UPDATE.md。
