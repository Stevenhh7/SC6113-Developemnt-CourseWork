# 新版上线与提交：你需要完成的操作

多 Investment 版本已经写入现有仓库。现在每个用户都能填写名称与说明，用 MetaMask 部署自己的合约并登记到目录；其他用户按名称、说明关键词、编号或合约地址搜索，进入对应详情页投入和赎回。

每个合约仍是 1 ETH = 1 份、无收益、无平台费、随时部分/全部赎回；创建者不能提取其他用户的本金。持仓、交易和历史按合约与账户区分。PostgreSQL 保存项目目录、已确认的投入/赎回事件与同步进度。资金和当前份额以合约为准；拒签和未确认交易不写成成功记录。

验证结果：54 项后端测试、9 项金额/历史前端测试、24 项本地浏览器检查通过。原有合约未修改，已有 12 项合约测试仍适用。本地验证包含两账户创建项目、取消签名后登记同一合约、按说明搜索、跨项目参与、资金/历史隔离和重启后目录恢复。真实 PostgreSQL 测试已加入 CI，但本机无数据库服务，该项未运行。

**你已重新部署历史入库版本，并确认新版测试成功。独立公开核验已确认两个项目、搜索、资金池、数据库历史及更新后的浏览器文件。最终报告已修订为 8 页（含参考文献）、13 个章节，PDF 和 LaTeX ZIP 已更新。目前不需要补截图。2026-10-08 已通过只读 PostgreSQL 连接导出 2 个项目、10 条已确认事件、9 条同步范围，已补入提交 ZIP；剩余是按课程要求上传。**

## 1 PostgreSQL 配置（已完成，以下供重建参考）

1. 选择 **New → Postgres**，名称与规格由你选择。
2. Region 与现有 Web Service 一致；之前的设置是 Oregon。
3. 数据库就绪后，复制 **Internal Database URL**，在现有 Web Service 的 Environment 新增 **DATABASE_URL**。
4. URL 含密码，直接填入 Render；不要发给我、放进 Git 或截图。

[Render 官方说明](https://render.com/docs/free)规定免费 PostgreSQL 创建后 30 天过期。请按课程演示/提交日期选择能覆盖相应时间的方案。连接步骤见 [官方连接说明](https://render.com/docs/postgresql-creating-connecting)。

## 2 更新现有网站（本次已完成，以下供再次更新参考）

这次历史更新无需新建数据库或重部署合约：沿用已有 DATABASE_URL 与启动命令，推送改动后重新部署即可。启动自动新增历史/同步范围表；打开原项目并连接原账户，会自动从链上补查并保存旧记录。首次补查可能需要等待，之后只增量同步新块；完整历史按 20 条逐页补齐。

检查并将新版源码提交、推送到已有 GitHub 仓库。保留原有 RPC_URL、CHAIN_ID=11155111、LOCAL_DEVELOPMENT=false、CONTRACT_ADDRESS、DEPLOYMENT_BLOCK；旧池会自动加入目录，新项目不用再修改环境变量。

Build Command：

~~~sh
pip install -r requirements.txt
~~~

Start Command **改为**：

~~~sh
python scripts/init-catalog.py && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
~~~

Root Directory 留空，Health Check 为 /healthz。如果原服务手动设置启动命令，需要在 Dashboard 手动更新，不能只推送 render.yaml。确认 DATABASE_URL 与启动命令已保存后重新部署。

详细步骤和故障排查见 [docs/RENDER_UPDATE.md](docs/RENDER_UPDATE.md)。不要把私钥或助记词配置到服务中。

## 3 用真实 MetaMask 验收新版（你已确认测试成功，以下供演示/回归参考）

1. 首页应显示 Explore 和原有资金池；原合约地址应保持正确。
2. 账户 A 在 Create investment 填写名称/说明，批准合约部署，再批准登记消息；保存 ID、合约地址与交易哈希。
3. 账户 B 创建第二个项目，可以拒绝一次登记签名，再刷新、连接部署账户，点击 Retry registration。应登记原来的合约，不重复部署。
4. 分别用名称和说明关键词搜索；结果应进入对应项目。
5. 同一账户参与两个项目，在一个项目部分/全部赎回后，另一个项目的持仓应保持不变。
6. 切换账户，核对当前项目的个人持仓与历史。View all activity 应保留项目和账户。
7. 重启/重新部署 Web Service 后，名称、编号、说明和地址仍在；持仓与历史仍与链上一致。

部署用 Sepolia 测试 ETH 支付 Gas，登记名称的消息签名不花 Gas，也不转移资金。创建流程中断时保留部署记录，优先重试登记。

## 4 新版报告和截图（已完成）

`report/MicroInvest_Report.pdf` 为更新后的 8 页英文报告，包含全部 13 个规定章节与参考文献。对应 `.tex` 与 `MicroInvest_LaTeX.zip` 同步更新。新增了真实公开网站的创建表单、关键词搜索、独立详情和恢复历史，以及你提供的 b6941a7 Render 成功状态。图注区分旧交易、新界面、API 摘要与示例表单；没有提交新的钱包交易来拍照。

目前无需补截图。报告采用九个截图来源；原始图片与裁切记录保留在 `report/screenshots/`。本地测试、你报告的真实验收和独立公开 API 核验分别说明。两个公开项目由同一账户创建，报告没有把它们冒充线上双创建者证据，也没有声称独立执行了托管停启持久性实验。

最终报告/文档改动目前留在本地，如需要同步 GitHub，请检查后自行提交推送；这次报告修改不要求再次重部署应用。

## 5 数据库与源码提交材料（已导出并打包）

已提供 [docs/schema.sql](docs/schema.sql)。最终线上数据库已于 2026-10-08 通过 TLS 和只读会话导出，包含 2 个项目、10 条确认事件、9 条同步范围；核验记录见 `docs/evidence/database-export-2026-10-08.json`。提交包的 `database/` 含完整公开应用数据 JSON 与 PostgreSQL 数据 SQL，连接密码未包含。以下为再次导出的参考步骤：

~~~powershell
.\.venv\Scripts\python.exe scripts/export-catalog.py --include-history --output test-results/catalog-public.json
~~~

在连接最终 PostgreSQL 的环境执行。留空 DATABASE_URL 会导出本地 SQLite，不是线上目录；本地连接 Render 需要其 External Database URL，内部 URL 用于 Render。无需把连接字符串发给我。导出包含公开项目资料、已同步交易事件和区块检查点，无密码或私钥；它不是完整数据库备份工具。

按课程通知提交源码、README、数据库结构与相关数据、公开部署信息、真实截图和修订后的 PDF。不要提交 .env、instance/、.venv、node_modules 或本地测试数据库。不需要视频。最终命名、入口与截止时间由你按课程通知确认。
