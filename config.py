import os
import sys

# 项目根目录（跨平台兼容）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 工具目录（放提权脚本/EXP/二进制文件）
TOOLS_DIR = os.path.join(BASE_DIR, "tools")

# HTTP文件服务器默认配置
HTTP_SERVER_HOST = "0.0.0.0"  # 跨平台兼容
HTTP_SERVER_PORT = 8080
# 日志路径（跨平台兼容）
HTTP_SERVER_LOG = os.path.join(BASE_DIR, "logs", "http_server.log")

# Web服务默认配置
WEB_HOST = "0.0.0.0"
WEB_PORT = 5000

# 确保目录存在（跨平台兼容）
os.makedirs(TOOLS_DIR, exist_ok=True)
os.makedirs(os.path.dirname(HTTP_SERVER_LOG), exist_ok=True)

# 跨平台路径分隔符
OS_SEP = os.sep