# CET-4 AI 备考网站 - Git 仓库初始化与推送脚本
# 使用方法：
# 1. 先在 GitHub 上创建一个空仓库（不要勾选 README、.gitignore、license）
# 2. 把你的仓库地址填到下面 $repoUrl 变量中
# 3. 右键此文件 -> 使用 PowerShell 运行

# ====== 请修改这里 ======
$repoUrl = "https://github.com/你的用户名/cet4-ai-coach.git"
# ========================

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CET-4 AI 备考网站 - Git 初始化推送" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 检查 Git
try {
    git --version | Out-Null
} catch {
    Write-Host "`n错误：未检测到 Git，请先安装 Git" -ForegroundColor Red
    Write-Host "下载地址：https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "安装后重新运行此脚本`n" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 检查仓库地址是否已修改
if ($repoUrl -match "你的用户名") {
    Write-Host "`n请先编辑此脚本，把 \$repoUrl 改成你的 GitHub 仓库地址" -ForegroundColor Red
    Write-Host "例如：https://github.com/zhangsan/cet4-ai-coach.git`n" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 进入项目目录
Set-Location $PSScriptRoot
Write-Host "`n当前目录：$(Get-Location)" -ForegroundColor Gray

# 初始化 Git
if (-not (Test-Path ".git")) {
    Write-Host "`n[1/5] 初始化 Git 仓库..." -ForegroundColor Green
    git init
    git branch -M main
} else {
    Write-Host "`n[1/5] Git 仓库已存在，跳过初始化" -ForegroundColor Green
}

# 配置用户信息（如果未配置）
$userName = git config user.name 2>$null
$userEmail = git config user.email 2>$null
if (-not $userName -or -not $userEmail) {
    Write-Host "`n[2/5] 配置 Git 用户信息..." -ForegroundColor Green
    Write-Host "请输入你的 GitHub 用户名：" -ForegroundColor Yellow -NoNewline
    $name = Read-Host
    Write-Host "请输入你的 GitHub 邮箱：" -ForegroundColor Yellow -NoNewline
    $email = Read-Host
    git config user.name $name
    git config user.email $email
} else {
    Write-Host "`n[2/5] Git 用户信息已配置：$userName <$userEmail>" -ForegroundColor Green
}

# 添加文件
Write-Host "`n[3/5] 添加文件到暂存区..." -ForegroundColor Green
git add -A
$fileCount = (git diff --cached --name-only | Measure-Object -Line).Lines
Write-Host "  已添加 $fileCount 个文件" -ForegroundColor Gray

# 提交
Write-Host "`n[4/5] 提交代码..." -ForegroundColor Green
git commit -m "feat: CET-4 AI 个人备考网站 - 完整功能版本

- 个人档案与CET-4诊断测试
- 六维能力画像与雷达图
- 智能每日学习计划（具体到时间段）
- 课表感知排课（自动避开上课时间）
- 词汇/阅读/听力/写作/翻译训练模块
- AI批改与错题本（含变式题）
- 学习报告与周报
- 模拟考试
- AI教练对话
- 响应式设计（移动端/平板/PC）
- Docker部署支持" 2>&1 | Out-Null
Write-Host "  提交完成" -ForegroundColor Gray

# 添加远程并推送
Write-Host "`n[5/5] 推送到 GitHub..." -ForegroundColor Green
$remoteExists = git remote 2>$null | Select-String "origin"
if ($remoteExists) {
    git remote set-url origin $repoUrl
} else {
    git remote add origin $repoUrl
}

Write-Host "  远程仓库：$repoUrl" -ForegroundColor Gray
Write-Host "  正在推送（可能需要输入 GitHub 用户名和 Token）..." -ForegroundColor Gray

try {
    git push -u origin main
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  推送成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "`n仓库地址：$repoUrl" -ForegroundColor Cyan
    Write-Host "`n接下来可以：" -ForegroundColor Yellow
    Write-Host "  1. 在 Render/Railway 连接此仓库一键部署" -ForegroundColor White
    Write-Host "  2. 在云服务器上 git clone 后运行 bash deploy.sh" -ForegroundColor White
    Write-Host ""
} catch {
    Write-Host "`n推送失败，请检查：" -ForegroundColor Red
    Write-Host "  1. 仓库地址是否正确" -ForegroundColor White
    Write-Host "  2. GitHub 是否需要 Personal Access Token（密码处填Token）" -ForegroundColor White
    Write-Host "  3. 网络是否正常" -ForegroundColor White
    Write-Host "`nToken 获取：GitHub -> Settings -> Developer settings -> Personal access tokens" -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "按回车键退出"
