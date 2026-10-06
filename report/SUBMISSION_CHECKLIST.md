# 最终提交检查

作业原文要求：5-8 页 PDF 报告、源码、README 和截图；无需视频，无数据库时无需数据库文件。

## 当前状态

- [x] Solidity、Flask、HTML/CSS/JS、测试与依赖配置已完成。
- [x] Sepolia 合约已部署，创建回执及运行字节码已核验。
- [x] Render 网站可访问，公开 API 连接正确合约。
- [x] 用户确认在 Render 上完成 MetaMask 功能测试，全部正常。
- [x] 英文 LaTeX 报告源码已准备，包含姓名 Ji Chengyu、学号 G2608005K 和全部 13 个章节。
- [x] 已记录本地自动测试、真实 Sepolia 金额、交易哈希及 Gas，且明确区分证据来源。
- [x] 七张原始截图已整理进 `report/screenshots/`，全部加入 LaTeX 并核对图注：部署、钱包、成功交易/完整历史、非法输入、零持仓、API 与 Render Live。图片尺寸和 SHA-256 已记录；API 与赎回图片的不同区块已说明。
- [x] `report/MicroInvest_LaTeX.zip` 提供可自行编译的报告源码、七张原图及说明。
- [x] 按用户最新要求编译 `MicroInvest_Report.pdf`，最终 8 页，保留全部 13 章与七张截图，已逐页检查排版。LaTeX 重复编译后无未解析引用或越界警告。
- [ ] 确认课程最终命名、提交入口和截止时间，再提交完整材料。

## 报告章节核对

1. Introduction
2. Problem Statement
3. Objectives
4. System Architecture
5. Technologies Used
6. Smart Contract Design
7. Application Design
8. Implementation
9. Testing and Results
10. Challenges Encountered
11. Limitations
12. Future Improvements
13. Conclusion

安全性是 Word 中的明确要求。报告已经说明调用者权限、输入校验、重入与转账失败测试、私钥保护、Gas 观察和公开链数据隐私；并未声称经过商业审计、压力测试或新手用户研究。

## 源码与证据

提交现有项目源码，保留 `contracts/`、`contract/MicroInvest.json`、`app.py`、`microinvest/`、`templates/`、`static/`、测试、脚本、依赖清单及锁文件、`render.yaml`、README 与公开部署记录。LaTeX 源码和原始截图可一并提交，最终报告格式仍按要求使用 PDF。

打包时不纳入 `.env`、私钥、助记词、RPC 密钥、`.venv/`、`node_modules/`、本地链缓存或 LaTeX 临时文件。公开网址、合约地址和交易哈希可以作为项目证据。源码中无需提供部署签名密钥。

报告中的三个金额案例和 Gas 来自已核验的 Sepolia 回执；若截图展示另一笔交易，图注保留其实际金额/哈希，不把不同交易误写为同一案例。无需为了报告重新部署合约。
