# ICO API 服务运维手册

本文档详细说明 ICO API 服务的部署流程、日常运维操作及故障处理指南。

## 1. 系统架构

### 核心组件
- **API Server**: Node.js/Express REST API (端口 26002)
- **Database**: SQLite (单文件存储，约 400MB)
- **Cron Job**: 内置定时任务 (每天凌晨 2:00 自动更新数据)
- **Data Source**: ICO 官网每日发布的 CSV 数据 (~500MB)

### 目录结构 (Docker 容器内)
- `/app` - 应用程序根目录
- `/app/data` - 数据持久化目录 (ico.db)
- `/app/logs` - 日志持久化目录 (combined.log, error.log, cron.log)
- `/app/dist` - 编译后的代码

## 2. 部署流程

### 环境要求
- Docker Engine 20.10+
- Docker Compose 1.29+
- 磁盘空间: 至少 2GB (数据文件 + 临时解压空间)
- 内存: 建议 1GB+ (导入数据时峰值内存)

### 首次部署
1. **获取代码**
   ```bash
   git clone <repository-url>
   cd ico-api-service
   ```

2. **配置环境**
   ```bash
   cp .env.example .env
   # 根据需要修改 .env 文件中的配置
   # PORT=26002
   # LOG_LEVEL=info
   ```

3. **构建镜像**
   ```bash
   ./api-control.sh build
   ```

4. **初始化数据** (首次必须执行)
   ```bash
   ./api-control.sh setup
   ```
   *注意：此步骤会下载约 50MB ZIP 包并导入 130 万条数据，耗时约 2-3 分钟*

5. **启动服务**
   ```bash
   ./api-control.sh start
   ```

6. **验证服务**
   ```bash
   curl http://localhost:26002/health
   # 应返回 {"status":"ok","timestamp":"..."}
   ```

## 3. 日常运维

### 服务管理
使用 `api-control.sh` 脚本进行管理：

| 操作 | 命令 | 说明 |
|------|------|------|
| 启动 | `./api-control.sh start` | 后台启动服务 |
| 停止 | `./api-control.sh stop` | 停止服务 |
| 重启 | `./api-control.sh restart` | 重启服务 |
| 状态 | `./api-control.sh status` | 查看容器状态 |
| 日志 | `./api-control.sh logs` | 实时查看日志 |

### 数据更新
系统默认在每天凌晨 2:00 自动执行更新。

**手动触发更新：**
```bash
./api-control.sh update
```
*流程：下载最新 CSV -> 解压 -> 快速导入数据库 -> 记录日志*

**检查更新日志：**
```bash
docker exec ico-api cat /app/logs/cron.log
```

### 备份与恢复

**备份数据库：**
```bash
# 创建备份目录
mkdir -p backups

# 备份数据库文件
docker exec ico-api tar czf - /app/data/ico.db > backups/ico_db_$(date +%Y%m%d).tar.gz
```

**恢复数据库：**
```bash
# 停止服务
./api-control.sh stop

# 恢复文件
tar xzf backups/ico_db_20240211.tar.gz -C data/

# 启动服务
./api-control.sh start
```

## 4. 监控与告警

### 关键指标
1. **健康状态**: `GET /health` (应返回 200 OK)
2. **数据版本**: `GET /api/ico/meta/version` (检查 downloadDate 是否为最近 7 天内)
3. **磁盘空间**: 监控 `/app/data` 所在分区的可用空间

### 日志文件
- **应用日志**: `logs/combined.log` (包含所有 API 请求和错误)
- **错误日志**: `logs/error.log` (仅包含错误级别日志)
- **更新日志**: `logs/cron.log` (包含每日数据更新的执行结果)

## 5. 故障排查

### 常见问题

**Q1: 服务无法启动，报错 "Database not initialized"**
*原因*: 首次启动未执行初始化脚本。
*解决*: 执行 `./api-control.sh setup`

**Q2: 数据更新失败，日志显示 "No space left on device"**
*原因*: 磁盘空间不足。
*解决*: 清理磁盘空间，确保至少有 1GB 可用空间（用于下载解压 500MB CSV）。

**Q3: 内存占用过高导致 OOM**
*原因*: 数据导入过程中 Node.js 内存限制过低。
*解决*: 在 docker-compose.yml 中增加 Node.js 内存限制：
```yaml
environment:
  - NODE_OPTIONS="--max-old-space-size=2048"
```

**Q4: 端口冲突**
*原因*: 26002 端口被占用。
*解决*: 修改 `.env` 文件中的 `PORT` 变量，重启服务。

### 重置环境
如果遇到无法修复的数据问题，可以重置环境：

```bash
# 1. 停止服务
./api-control.sh stop

# 2. 删除数据文件
rm -rf data/ico.db

# 3. 重新初始化
./api-control.sh setup

# 4. 启动服务
./api-control.sh start
```

## 6. 安全建议

1. **不要直接暴露在公网**：建议通过 Nginx/Traefik 反向代理，并配置 HTTPS。
2. **防火墙限制**：仅允许受信任的 IP 访问 API 端口。
3. **定期更新**：定期拉取最新代码并重建镜像，以修复潜在的安全漏洞。
   ```bash
   git pull
   ./api-control.sh build
   ./api-control.sh restart
   ```
