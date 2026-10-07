# 新版上线与提交：你需要完成的操作

多 Investment 版本已经写入现有仓库。现在每个用户都能填写名称与说明，用 MetaMask 部署自己的合约并登记到目录；其他用户按名称、说明关键词、编号或合约地址搜索，进入对应详情页投入和赎回。

每个合约仍是 1 ETH = 1 份、无收益、无平台费、随时部分/全部赎回；创建者不能提取其他用户的本金。持仓、交易和历史按合约与账户区分。PostgreSQL 只存项目目录，链上资金不存入数据库。

验证结果：47 项后端测试、4 项金额测试、23 项本地浏览器检查通过。原有合约未修改，已有 12 项合约测试仍适用。本地验证包含两账户创建项目、取消签名后登记同一合约、按说明搜索、跨项目参与、资金/历史隔离和重启后目录恢复。真实 PostgreSQL 测试已加入 CI，但本机无数据库服务，该项未运行。

**这些代码尚未替你推送或部署。线上仍是旧版；旧 PDF 与截图也描述旧版。**

## 1 在 Render 新建 PostgreSQL

1. 选择 **New → Postgres**，名称与规格由你选择。
2. Region 与现有 Web Service 一致；之前的设置是 Oregon。
3. 数据库就绪后，复制 **Internal Database URL**，在现有 Web Service 的 Environment 新增 **DATABASE_URL**。
4. URL 含密码，直接填入 Render；不要发给我、放进 Git 或截图。

[Render 官方说明](https://render.com/docs/free)规定免费 PostgreSQL 创建后 30 天过期。请按课程演示/提交日期选择能覆盖相应时间的方案。连接步骤见 [官方连接说明](https://render.com/docs/postgresql-creating-connecting)。

## 2 更新现有网站

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

## 3 用真实 MetaMask 验收新版

1. 首页应显示 Explore 和原有资金池；原合约地址应保持正确。
2. 账户 A 在 Create investment 填写名称/说明，批准合约部署，再批准登记消息；保存 ID、合约地址与交易哈希。
3. 账户 B 创建第二个项目，可以拒绝一次登记签名，再刷新、连接部署账户，点击 Retry registration。应登记原来的合约，不重复部署。
4. 分别用名称和说明关键词搜索；结果应进入对应项目。
5. 同一账户参与两个项目，在一个项目部分/全部赎回后，另一个项目的持仓应保持不变。
6. 切换账户，核对当前项目的个人持仓与历史。View all activity 应保留项目和账户。
7. 重启/重新部署 Web Service 后，名称、编号、说明和地址仍在；持仓与历史仍与链上一致。

部署用 Sepolia 测试 ETH 支付 Gas，登记名称的消息签名不花 Gas，也不转移资金。创建流程中断时保留部署记录，优先重试登记。

## 4 提供新版截图，再更新报告

新版上线、验收后，建议提供这些真实截图：

- 首页关键词搜索：显示至少两个项目结果及名称。
- 创建成功：显示项目名称、ID、合约地址、部署哈希。
- 项目详情：显示名称/说明、合约、非零个人持仓与 Confirmed 投入。
- 赎回与历史：当前项目赎回成功，以及另一项目仍保留的持仓。
- Render 新部署成功与 /api/investments 或带 investment 参数的资金池 API。

截图不要出现数据库连接密码或 RPC 密钥。已有钱包、非法输入等原图可以保留作旧版证据，但报告必须解释版本。旧的 report/MicroInvest_Report.pdf、.tex、ZIP 没有覆盖这次改动，不应直接作为新版最终报告提交。最终报告仍需 5–8 页、全部 13 个规定章节。

## 5 数据库与源码提交材料

已提供 [docs/schema.sql](docs/schema.sql)。完成线上验收后，从最终数据库导出公开项目数据：

~~~powershell
.\.venv\Scripts\python.exe scripts/export-catalog.py --output test-results/catalog-public.json
~~~

在连接最终 PostgreSQL 的环境执行。留空 DATABASE_URL 会导出本地 SQLite，不是线上目录；本地连接 Render 需要其 External Database URL，内部 URL 用于 Render。无需把连接字符串发给我。导出包含公开名称/说明/ID/合约/创建者等资料，无密码、私钥或资金余额；它不是完整数据库备份工具。

按课程通知提交源码、README、数据库结构与相关数据、公开部署信息、真实截图和修订后的 PDF。不要提交 .env、instance/、.venv、node_modules 或本地测试数据库。不需要视频。最终命名、入口与截止时间由你按课程通知确认。
