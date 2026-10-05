# CET-4 AI 备考网站 - 云端部署指南

## 为什么需要部署到云端？

当前网站运行在你电脑的 `localhost:3000`，电脑关机或休眠后手机就无法访问。
部署到云服务器后，网站 24 小时独立运行，手机随时可访问。

---

## 前置步骤：把代码推送到 GitHub

部署前需要先把代码放到 GitHub 仓库（云服务器或 PaaS 平台都从 GitHub 拉取代码）。

### 方式 A：GitHub Desktop（推荐，图形界面，无需命令行）

1. 下载安装 [GitHub Desktop](https://desktop.github.com/)
2. 打开 GitHub Desktop，登录你的 GitHub 账号
3. 点击 `File` → `Add Local Repository`
4. 选择项目文件夹 `cet4-ai-coach`
5. 点击 `Create repository`（创建本地仓库）
6. 点击 `Publish repository`（推送到 GitHub）
7. 仓库名填 `cet4-ai-coach`，取消勾选 `Keep this code private`（公开仓库免费）
8. 点击 `Publish Repository`

完成后代码就在 GitHub 上了，仓库地址类似：`https://github.com/你的用户名/cet4-ai-coach`

### 方式 B：命令行（已安装 Git 时）

1. 在 GitHub 网页上创建一个**空仓库**（不要勾选 README、.gitignore、license）
2. 编辑项目中的 `init-git.ps1`，把 `$repoUrl` 改成你的仓库地址
3. 右键 `init-git.ps1` → 使用 PowerShell 运行
4. 按提示输入 GitHub 用户名和邮箱，推送时密码处填 **Personal Access Token**

> Token 获取：GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token，勾选 `repo` 权限。

---

## 方案一：云服务器（推荐，最稳定）

### 1. 购买云服务器

| 平台 | 推荐配置 | 价格参考 | 学生优惠 |
|------|---------|---------|---------|
| 腾讯云轻量应用服务器 | 2核2G 4M | ~30元/月 | 学生认证后约9元/月 |
| 阿里云轻量应用服务器 | 2核2G 4M | ~30元/月 | 学生认证后约9元/月 |
| 华为云云耀云服务器 | 2核2G | ~30元/月 | 有学生优惠 |

**建议**：选择「轻量应用服务器」，系统选 **Ubuntu 22.04**，地域选离你最近的（如西南地区选成都/重庆节点）。

### 2. 开放端口

在云服务器控制台的「防火墙/安全组」中，开放 **3000 端口**（TCP协议，来源 0.0.0.0/0）。

### 3. 上传代码到服务器

**方式A：使用 Git（推荐）**

先把代码推送到 GitHub/Gitee 仓库，然后在服务器上克隆：
```bash
# 服务器上执行
apt update && apt install -y git
git clone <你的仓库地址> cet4-ai-coach
cd cet4-ai-coach
```

**方式B：使用 scp 上传**

在你电脑上执行（把代码打包上传）：
```bash
# Windows PowerShell
scp -r .\cet4-ai-coach\ root@<服务器IP>:/root/
```

### 4. 一键部署

```bash
cd /root/cet4-ai-coach
bash deploy.sh
```

脚本会自动安装 Docker、构建镜像、启动服务。

### 5. 访问

部署成功后，手机访问：
```
http://<你的服务器公网IP>:3000
```

---

## 方案二：免费 PaaS 平台（零成本，有局限）

### Render（国际平台，国内访问较慢）

1. 注册 [render.com](https://render.com)（用 GitHub 登录）
2. 把代码推送到 GitHub 仓库
3. Render 控制台 → New → Web Service
4. 连接你的 GitHub 仓库
5. 配置：
   - Runtime: `Docker`
   - Instance Type: `Free`（免费）
6. 点击 Create Web Service

**局限**：免费层 15 分钟无请求会休眠，下次访问需要等 30 秒冷启动。

### Railway（国际平台，有免费额度）

1. 注册 [railway.app](https://railway.app)
2. New Project → Deploy from GitHub repo
3. 选择仓库，自动识别 Dockerfile
4. 部署后在 Settings → Networking 生成域名

**局限**：每月有 $5 免费额度，超出需付费。

---

## 方案三：国内免费平台（访问快，但限制多）

### 腾讯云 CloudBase（云开发）

适合前端+云函数架构，但本项目是 Express + SQLite，需要改造。不推荐第一版使用。

---

## 配置 AI 功能（可选）

部署后如需启用 AI 批改和 AI 教练功能，编辑服务器上的 `.env` 文件：

```bash
cd /root/cet4-ai-coach
nano .env
```

填入：
```
DOUBAO_API_KEY=你的豆包APIKey
DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=Doubao-2.1-Turbo
DOUBAO_ENDPOINT_ID=你的接入点ID
```

保存后重启：
```bash
docker compose restart
```

不配置 AI 时，网站使用内置题库+规则引擎模式，所有核心功能（诊断、排课、做题、错题、报告）均可正常运行。

---

## 服务器运维命令

```bash
cd /root/cet4-ai-coach

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码后重新部署
git pull
docker compose build
docker compose up -d

# 备份数据库（数据在 data/cet4.db）
cp data/cet4.db data/cet4.db.backup
```

---

## 数据安全

- 学习数据存在 `data/cet4.db`（SQLite）
- Docker volume 已挂载，容器重启数据不丢失
- 建议定期备份：`cp data/cet4.db data/backup_$(date +%Y%m%d).db`

---

## 推荐方案总结

| 需求 | 推荐方案 | 月成本 |
|------|---------|--------|
| 长期稳定使用 | 腾讯云/阿里云轻量服务器 | 9-30元 |
| 先试用看看 | Render 免费层 | 0元 |
| 已有云服务器 | 直接用 deploy.sh 部署 | 已有 |

**最推荐**：腾讯云轻量应用服务器（学生9元/月）+ deploy.sh 一键部署，稳定、快速、数据可控。
