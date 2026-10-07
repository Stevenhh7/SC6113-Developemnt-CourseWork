# 新版最终提交检查

原作业要求 5-8 页 PDF、源码、README、截图，以及采用数据库时的数据库相关内容；不需要视频。

## 已完成

- [x] 用户创建独立合约、名称/说明、部署者签名登记与登记重试。
- [x] 目录、名称/说明关键词搜索、ID/地址区分和创建者筛选。
- [x] 独立详情、账户菜单、投入/持仓/部分及全部赎回、独立分页历史。
- [x] PostgreSQL 元数据/确认历史存储、本地 SQLite、结构和公开导出工具。
- [x] 54 后端、9 前端、24 本地浏览器检查通过，12 项未修改合约测试保留。
- [x] PostgreSQL 专项测试加入 CI；本机跳过，报告未称其已通过。
- [x] 用户已重新部署历史索引版本并确认测试成功。
- [x] 独立公开核验两个合约、搜索、资金池、更新浏览器模块及数据库历史。
- [x] 新版报告更新为 8 页（含参考文献），全部 13 节、九个截图来源。
- [x] LaTeX 两次编译、引用及八页排版核对，更新可编译源码 ZIP。
- [x] 新旧截图来源区分，完整原图及公开核验记录保留。
- [x] 2026-10-08 已只读导出并核对最终 PostgreSQL 数据：2 项目、10 确认事件、9 同步范围；JSON、SQL、结构已加入提交 ZIP。

线上核验记录见 `../docs/evidence/live-multi-investment-2026-10-07.json`。两个公开项目目前由同一账户创建；两创建者/跨项目隔离证据来自本地模拟钱包测试。托管服务专门停启实验、PostgreSQL 专项测试和商业安全审计没有独立完成记录，报告没有把它们写成成功。

## 提交前由学生完成

- [ ] 按课程通知确认命名、提交入口和截止时间，提交所有材料。
- [ ] 如需把最终报告放入 GitHub，检查本次报告/文档改动后自行提交推送。

最终 PDF、LaTeX 和 ZIP 已修订为当前多 Investment 版本，无需额外截图。原有真实部署、交易/Gas 和未使用的旧截图仍作为历史资料保留。

## 报告章节

Introduction、Problem Statement、Objectives、System Architecture、Technologies Used、Smart Contract Design、Application Design、Implementation、Testing and Results、Challenges Encountered、Limitations、Future Improvements、Conclusion。

Word 明确要求的安全性、可用性和性能已有按实际范围的分析：调用者权限、输入/签名/字节码校验、重入/转账失败测试、私钥边界、Gas 和公开数据隐私。没有声称性能压力测试或新手用户研究。

## 打包范围

提交业务合约、artifact、Flask 与数据库模块、前端、测试、脚本、依赖/锁文件、render.yaml、README、数据库结构/相关数据、公开部署信息、真实截图及修订 PDF。排除 `.env`、数据库/RPC 密码、私钥/助记词、`instance/`、`.venv/`、`node_modules/`、本地链缓存和 LaTeX 临时文件。

LaTeX ZIP 是报告源码包，不等同于完整应用提交包。完整项目与数据库资料的交付流程见 `../USER_ACTIONS.md`。
