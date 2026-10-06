# 你还需要完成的操作

代码已写入你确认的 `Course/SC6113-Developemnt-CourseWork` 仓库。合约、Flask 后端、英文前端、测试、README、本地启动工具、Sepolia 部署工具与 Render 配置已经完成。原有 12 项合约测试通过；2026-10-07 账户菜单更新通过 17 项后端测试、4 项金额/错误测试及 19 项浏览器联调检查。首页最多展示 5 条最近交易，完整历史通过“View all activity”进入独立分页页面查看。

连接后点击右上角钱包地址，即可在下拉菜单切换已授权账户。若只有一个账户，点击 **Manage accounts in MetaMask**，在钱包中授权其他账户后再切换；每笔投入、赎回由当前选择的账户签名。首页和完整记录页均已支持。刷新会恢复仍有授权的账户选择；切换网络后可使用菜单中的 **Reconnect wallet** 重新连接。真实 MetaMask 的授权弹窗仍需要你在自己的浏览器中确认。

**Sepolia 合约已由你通过 MetaMask 部署成功，并已独立核验成功回执与运行字节码。** 地址为 `0xE560121978f80c390f6B0d091E9579A2812Cb3DD`，部署区块为 `11856501`。本地 `.env` 与公开部署 JSON 已配置；不要再次部署同一演示所用资金池。尚需实际投入/赎回验证和 Render 上线。以下部署步骤作为重建参考；无需把私钥、助记词或账号密码发给我。PDF 报告和截图按照你的要求没有制作。

## 1 先在 VS Code 打开项目

打开当前仓库根目录，按照 [README.md](README.md) 配置 Node.js 24 / Python 3.12 / pnpm 11.19.0。当前电脑已安装项目依赖，可直接运行测试或应用；换电脑/提交后重建需要按 README 安装。

可选本地演示：`pnpm run dev:local 你的钱包公开地址`。它自动启动本地链、部署合约、给该地址 10 个本地测试 ETH，再启动 Flask；MetaMask 自定义网络 RPC 为 `http://127.0.0.1:8545`，Chain ID 为 `31337`。这一步不使用 Sepolia，也不是最终线上部署。按 Ctrl+C 停止。

## 2 用自己的钱包部署到 Sepolia

1. 准备 MetaMask 测试钱包，开启 Sepolia，获取足够的 Sepolia 测试 ETH；投入与部署、退出都需要 Gas。
2. 将 `.env.example` 复制为 `.env`，选择并填入自己的 Sepolia `RPC_URL`。保留 `CHAIN_ID=11155111`、`LOCAL_DEVELOPMENT=false`，暂时留空合约地址和部署区块。不需要填写 `DEPLOYER_PRIVATE_KEY`。
3. 在项目根目录运行 `.\.venv\Scripts\python.exe app.py`，打开 `http://127.0.0.1:5000/deploy`。
4. 连接 MetaMask，确认是 Sepolia，点击部署并在钱包中签名；等页面确认成功。部署若超时，先用已有哈希检查结果，避免重复部署新池。
5. 保存页面显示的 `CONTRACT_ADDRESS`、`DEPLOYMENT_BLOCK` 和交易哈希。下载公开部署 JSON，可存为 `deployments/sepolia.json`；把地址和区块写入本地 `.env`，重启 Flask。
6. 首页连接钱包，进行一笔小额投入、部分赎回和全部退出。示例投入 0.003 ETH，部分赎回 0.001 ETH，余下全部退出；数量可按你的测试 ETH 余额调整。

推荐的网页部署全程由 MetaMask 签名，后端不接触私钥。部署者没有管理特权。

## 3 发布到 Render

1. 检查并将代码提交、推送到已有 GitHub 仓库 `Stevenhh7/SC6113-Developemnt-CourseWork`。仓库公开/私有由你决定。不要提交 `.env`、钱包文件、虚拟环境或依赖目录。
2. 在 Render 登录自己的账号，连接仓库，使用项目的 `render.yaml` 创建 Blueprint，或按 README 手动建立 Python Web Service。服务规格/费用由你选择。根目录保持仓库根目录，Root Directory 留空。
3. 在 Render 填写自己的 `RPC_URL`、真实 `CONTRACT_ADDRESS` 与 `DEPLOYMENT_BLOCK`；`CHAIN_ID=11155111`，`LOCAL_DEVELOPMENT=false`，Python 3.12.10。不要配置部署私钥。
4. 构建命令 `pip install -r requirements.txt`；启动命令 `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120`；健康检查 `/healthz`。
5. 部署后保存 HTTPS 网站地址，访问 `/api/pool` 核实真正连到正确合约，再从网站用实际 MetaMask 测试完整流程。刷新及重启 Render 后核实链上持仓、历史仍可查询。

`/healthz` 成功只代表 Web 服务运行；真实链上连接请检查 `/api/pool`。具体设置与故障排查见 README。当前没有替你选择付费方案或修改远程仓库。

## 4 收集真实线上截图与测试记录

截图由你完成，至少覆盖作业规定的部署、钱包连接、成功交易、非法输入，再补充个人持仓、部分/全部赎回、交易历史与后端 API 响应。建议同时保存对应 Sepolia Etherscan 哈希和实际 Gas 数据。不要在截图中暴露助记词、私钥、RPC 密钥或平台环境变量秘密。

[docs/TESTING.md](docs/TESTING.md) 已整理本地测试结果、安全性、可用性、Gas 数据和线上验收表，可用于你的报告资料。自动浏览器测试使用模拟钱包，不能代替真实 MetaMask/Sepolia 的截图与验证。没有真实新手用户参与的可用性研究，不要在报告里声称做过用户研究。

## 5 完成英文 PDF 报告并提交

按原 Word 要求完成 **5–8 页英文 PDF**，覆盖全部 13 个部分：Introduction、Problem Statement、Objectives、System Architecture、Technologies Used、Smart Contract Design、Application Design、Implementation、Testing and Results、Challenges Encountered、Limitations、Future Improvements、Conclusion。

可引用 `docs/ARCHITECTURE.md` 的架构/接口、`docs/TESTING.md` 的实际测试和 Gas，以及你的线上证据。明确项目是单资金池投资流程原型，只实现本金与份额，不产生收益或市场策略。不要把本地链结果写成 Sepolia 上线结果。

最终提交源码（合约、前后端、测试、依赖配置、README）、真实公开部署信息、截图和 PDF；不需要数据库文件，也不需要视频。截止时间、提交平台、文件命名及页数细节未在现有文档明确的部分由你按课程通知确认。
