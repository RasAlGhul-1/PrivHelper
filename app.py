from flask import Flask, render_template, jsonify
import os
import threading
import logging
from http.server import HTTPServer, SimpleHTTPRequestHandler
import argparse
import sys
import json
import socket
import shutil
import subprocess
import time

# ===================== 工具函数 =====================
def get_ip_address(ifname="tun0"):
    """获取指定网卡的 IPv4 地址"""
    if sys.platform == "win32":
        # Windows 下简单获取主机名对应的 IP
        try:
            return socket.gethostbyname(socket.gethostname())
        except:
            return "127.0.0.1"
    
    # Linux 下获取网卡 IP
    try:
        import fcntl
        import struct
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        return socket.inet_ntoa(fcntl.ioctl(
            s.fileno(),
            0x8915,  # SIOCGIFADDR
            struct.pack('256s', ifname[:15].encode('utf-8'))
        )[20:24])
    except Exception:
        # 如果指定网卡不存在，尝试获取默认网卡 IP
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

def find_available_port(start_port, host="0.0.0.0"):
    """寻找可用端口"""
    port = start_port
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind((host, port))
                return port
            except socket.error:
                port += 1
    return start_port

def parse_usage_file(file_path):
    desc = ""
    usage_items = []
    try:
        with open(file_path, encoding="utf-8") as uf:
            raw_lines = [l.rstrip("\n").rstrip("\r") for l in uf]
            first_content_index = None
            for i, l in enumerate(raw_lines):
                if l.strip():
                    first_content_index = i
                    break

            if first_content_index is not None:
                desc = raw_lines[first_content_index].strip()
                remaining_lines = raw_lines[first_content_index + 1:]
            else:
                remaining_lines = []

            in_block = False
            block_lines = []
            pending_hint = None
            for l in remaining_lines:
                if not in_block:
                    if not l.strip():
                        continue
                    stripped = l.strip()
                    if stripped.startswith(">"):
                        hint = stripped[1:].lstrip()
                        pending_hint = hint if hint else None
                        continue
                    if l.lstrip().startswith("###"):
                        pending_hint = None
                        in_block = True
                        block_lines = []
                        continue
                    if l.lstrip().startswith("#"):
                        continue
                    if pending_hint:
                        usage_items.append({"type": "cmd", "text": l.strip(), "hint": pending_hint})
                        pending_hint = None
                    else:
                        usage_items.append({"type": "cmd", "text": l.strip()})
                else:
                    if l.lstrip().startswith("###"):
                        in_block = False
                        usage_items.append({"type": "comment_block", "text": "\n".join(block_lines).rstrip()})
                        block_lines = []
                        continue
                    block_lines.append(l)

            if in_block:
                usage_items.append({"type": "comment_block", "text": "\n".join(block_lines).rstrip()})
    except:
        desc = "读取描述失败"
        usage_items = []
    return desc, usage_items

# ===================== 配置 =====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(BASE_DIR, "tools")
HTTP_SERVER_HOST = "0.0.0.0"
WEB_HOST = "0.0.0.0"
HTTP_SERVER_LOG = os.path.join(BASE_DIR, "logs", "http_server.log")

# 确保目录存在
os.makedirs(TOOLS_DIR, exist_ok=True)
os.makedirs(os.path.dirname(HTTP_SERVER_LOG), exist_ok=True)
# 清空日志
with open(HTTP_SERVER_LOG, "w", encoding="utf-8") as f:
    f.write("")

# ===================== 命令行参数 =====================
parser = argparse.ArgumentParser(description="PrivHelper")
parser.add_argument("-l", "--web-port", type=int, default=5000, help="Web 端口")
parser.add_argument("-p", "--http-port", type=int, default=None, help="HTTP 文件服务器端口 (默认从 80 开始自动寻找可用端口)")
parser.add_argument("-badip", "--bad-ip", default=None, help="默认替换$badip的IP (Linux 下默认尝试 tun0)")
args = parser.parse_args()

# 处理 HTTP 端口逻辑
if args.http_port is None:
    # 默认从 80 开始寻找可用端口
    HTTP_SERVER_PORT = find_available_port(80, HTTP_SERVER_HOST)
else:
    HTTP_SERVER_PORT = args.http_port

# 处理 BAD_IP 逻辑
if args.bad_ip is None:
    BAD_IP = get_ip_address("tun0")
else:
    BAD_IP = args.bad_ip

WEB_PORT = args.web_port

# ===================== 通用目录树构建（兼容所有分类） =====================
def build_tool_tree():
    """
    构建通用工具目录树
    返回结构：{
        "windows": {"__type__": "dir", "__children__": {子目录/文件}},
        "linux": {"__type__": "dir", "__children__": {子目录/文件}},
        "other": {"__type__": "dir", "__children__": {子目录/文件}}
    }
    """
    # 初始化根分类（固定为windows/linux/other）
    tool_tree = {
        "windows": {"__type__": "dir", "__children__": {}, "__name__": "windows"},
        "linux": {"__type__": "dir", "__children__": {}, "__name__": "linux"},
        "other": {"__type__": "dir", "__children__": {}, "__name__": "other"}
    }

    # 遍历工具目录所有文件/目录
    for root, dirs, files in os.walk(TOOLS_DIR):
        # 跳过隐藏文件和.usage文件
        files = [f for f in files if not (f.startswith(".") or f.endswith(".usage"))]
        dirs[:] = [d for d in dirs if not d.startswith(".")]  # 跳过隐藏目录

        # 计算相对路径（相对于tools目录）
        rel_path = os.path.relpath(root, TOOLS_DIR)
        if rel_path == ".":
            continue  # 跳过tools根目录

        # 拆分路径层级
        path_parts = rel_path.split(os.sep)
        # 根分类（第一个目录必须是windows/linux/other，否则归为other）
        root_category = path_parts[0] if path_parts[0] in tool_tree else "other"
        # 子路径（去掉根分类后的剩余路径）
        sub_parts = path_parts[1:] if len(path_parts) > 1 else []

        # 定位到当前分类的根节点
        current_node = tool_tree[root_category]["__children__"]

        # 逐层创建子目录节点
        for part in sub_parts:
            if part not in current_node:
                current_node[part] = {
                    "__type__": "dir",
                    "__name__": part,
                    "__children__": {}
                }
            current_node = current_node[part]["__children__"]

        readme_usage_path = os.path.join(root, "readme.usage")
        if not os.path.exists(readme_usage_path):
            readme_usage_path = os.path.join(root, "README.usage")

        if os.path.exists(readme_usage_path):
            desc, usage_items = parse_usage_file(readme_usage_path)
            current_node["__readme__"] = {
                "__type__": "readme",
                "__name__": "README",
                "desc": desc,
                "usage_items": usage_items,
                "dir_path": rel_path.replace("\\", "/"),
                "abs_dir": os.path.abspath(root).replace("\\", "/")
            }

        # 添加文件到当前目录节点
        for file in files:
            # 读取.usage文件
            usage_path = os.path.join(root, file + ".usage")
            desc = ""
            usage_items = []
            if os.path.exists(usage_path):
                desc, usage_items = parse_usage_file(usage_path)

            # 添加文件节点
            current_node[file] = {
                "__type__": "file",
                "__name__": file,
                "desc": desc,
                "usage_items": usage_items,
                "full_path": os.path.join(rel_path, file).replace("\\", "/"),  # 统一路径分隔符
                "abs_path": os.path.abspath(os.path.join(root, file)).replace("\\", "/"),
                "abs_dir": os.path.abspath(root).replace("\\", "/")
            }

    return tool_tree

# ===================== Flask 初始化 =====================
app = Flask(__name__)
app.config["BAD_IP"] = BAD_IP
app.config["HTTP_SERVER_PORT"] = HTTP_SERVER_PORT
app.config["WEB_PORT"] = WEB_PORT

# ===================== HTTP 下载服务器 =====================
class LoggingHTTPHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=TOOLS_DIR, **kwargs)

    def log_message(self, format, *args):
        # 格式化日志
        log_line = f"{self.log_date_time_string()} {self.address_string()} - {format % args}"
        # 写入日志文件
        with open(HTTP_SERVER_LOG, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")

def start_http_server():
    try:
        server = HTTPServer((HTTP_SERVER_HOST, HTTP_SERVER_PORT), LoggingHTTPHandler)
        print(f"[+] HTTP 文件服务器启动：{HTTP_SERVER_HOST}:{HTTP_SERVER_PORT}")
        server.serve_forever()
    except PermissionError:
        print(f"\n[-] 权限错误：无法绑定 {HTTP_SERVER_PORT} 端口！")
        print(f"   原因：Linux 下 1-1024 端口需要 root 权限，解决方案：")
        print(f"   1. 使用 sudo 启动：sudo python app.py -p {HTTP_SERVER_PORT} -l {WEB_PORT}")
        print(f"   2. 改用大于 1024 的端口：python app.py -p 8080 -l {WEB_PORT}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[-] HTTP 服务器启动失败：{str(e)}")
        sys.exit(1)

def try_start_updog():
    """
    尝试启动 updog；若不可用或启动失败则返回 False
    """
    candidates = [
        # 直接 updog
        (["updog"], ["updog", "--version"]),
        # pipx run updog
        (["pipx", "run", "updog"], ["pipx", "run", "updog", "--version"]),
        # python -m updog
        ([sys.executable, "-m", "updog"], [sys.executable, "-c", "import updog"]),
    ]

    for start_cmd, check_cmd in candidates:
        # 检测命令可用性
        try:
            res = subprocess.run(
                check_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5,
                cwd=BASE_DIR,
            )
            if res.returncode != 0:
                continue
        except Exception:
            continue

        # 启动 updog
        try:
            # 兼容 updog CLI：使用 -p/-d，移除不支持的 --host/--upload
            args = start_cmd + ["-p", str(HTTP_SERVER_PORT), "-d", TOOLS_DIR]
            proc = subprocess.Popen(
                args,
                cwd=BASE_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
            # 等待片刻，检查是否立即退出
            time.sleep(1.0)
            if proc.poll() is None:
                print(f"[+] Updog 文件服务器启动：{HTTP_SERVER_HOST}:{HTTP_SERVER_PORT}")
                app.config["FILE_SERVER"] = "updog"
                app.config["UPDOG_PROC"] = proc
                # 将 updog 的输出写入日志文件，供前端读取
                def _pipe_to_log(stream, prefix="UPDOG"):
                    try:
                        for line in stream:
                            line = (line or "").rstrip("\n").rstrip("\r")
                            if not line:
                                continue
                            ts = time.strftime("%Y-%m-%d %H:%M:%S")
                            try:
                                with open(HTTP_SERVER_LOG, "a", encoding="utf-8") as f:
                                    f.write(f"{ts} [{prefix}] {line}\n")
                            except Exception:
                                pass
                    except Exception:
                        pass
                threading.Thread(target=_pipe_to_log, args=(proc.stdout, "UPDOG"), daemon=True).start()
                threading.Thread(target=_pipe_to_log, args=(proc.stderr, "UPDOG-ERR"), daemon=True).start()
                return True
            else:
                try:
                    err = proc.stderr.read().decode("utf-8", errors="ignore")
                except Exception:
                    err = ""
                print(f"[*] Updog 进程退出，回退到内置HTTP：{err.strip()}")
        except Exception as e:
            print(f"[*] Updog 启动失败，回退到内置HTTP：{e}")
    return False

def start_file_server():
    if not try_start_updog():
        app.config["FILE_SERVER"] = "builtin"
        start_http_server()

# ===================== 接口 =====================
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/tools")
def get_tools():
    """获取工具目录树"""
    tool_tree = build_tool_tree()
    return jsonify({"code": 0, "data": tool_tree})

@app.route("/api/http-logs")
def get_logs():
    """获取HTTP日志"""
    logs = []
    if os.path.exists(HTTP_SERVER_LOG):
        with open(HTTP_SERVER_LOG, "r", encoding="utf-8") as f:
            logs = [line.strip() for line in f.readlines()[-200:]]  # 只返回最后200行
    return jsonify({"code": 0, "data": logs[::-1]})  # 倒序显示（最新的在最上面）

# ===================== 启动 =====================
if __name__ == "__main__":
    http_thread = threading.Thread(target=start_file_server, daemon=True)
    http_thread.start()

    # 启动Flask Web服务
    print("=== PrivHelper ===")
    print(f"[*] Web 面板：http://127.0.0.1:{WEB_PORT}")
    print(f"[*] 下载服务：http://0.0.0.0:{HTTP_SERVER_PORT}")
    print(f"[*] 工具目录：{TOOLS_DIR}")
    print(f"[*] 默认BADIP：{BAD_IP}（前端可手动修改）\n")

    # 检查Web端口权限（Linux）
    if sys.platform == "linux" and WEB_PORT < 1024:
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.bind((WEB_HOST, WEB_PORT))
            s.close()
        except PermissionError:
            print(f"[!] 警告：Web 端口 {WEB_PORT} 需要 root 权限，可能无法访问！")
            print(f"   建议：改用大于 1024 的端口，如 -l 5000")

    # 启动Flask
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    app.run(host=WEB_HOST, port=WEB_PORT, debug=False, threaded=True)
