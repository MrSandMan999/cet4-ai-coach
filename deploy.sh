#!/bin/bash
# CET-4 AI 备考网站 - 云服务器一键部署脚本
# 使用方法：在云服务器上执行 bash deploy.sh

set -e

echo "========================================="
echo "  CET-4 AI 备考网站 - 一键部署"
echo "========================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "安装 Docker Compose 插件..."
    apt-get update && apt-get install -y docker-compose-plugin
fi

# 创建数据目录
mkdir -p data

# 如果没有 .env 文件，创建模板
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# CET-4 AI 备考网站配置
PORT=3000

# 豆包 AI 配置（可选，不配置则使用内置题库模式）
# DOUBAO_API_KEY=your_api_key_here
# DOUBAO_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
# DOUBAO_MODEL=Doubao-2.1-Turbo
# DOUBAO_ENDPOINT_ID=your_endpoint_id
EOF
    echo "已创建 .env 配置文件，如需 AI 功能请编辑填入 API Key"
fi

# 构建并启动
echo "构建 Docker 镜像..."
docker compose build

echo "启动服务..."
docker compose up -d

# 等待启动
sleep 3

# 检查状态
if curl -s http://localhost:3000/api/ai-status > /dev/null 2>&1; then
    echo ""
    echo "========================================="
    echo "  部署成功！"
    echo "========================================="
    echo "  本地访问: http://localhost:3000"
    echo "  外网访问: http://$(curl -s ifconfig.me):3000"
    echo ""
    echo "  常用命令:"
    echo "    查看日志: docker compose logs -f"
    echo "    停止服务: docker compose down"
    echo "    重启服务: docker compose restart"
    echo "    更新代码: git pull && docker compose build && docker compose up -d"
    echo "========================================="
else
    echo "启动失败，请查看日志: docker compose logs"
    exit 1
fi
