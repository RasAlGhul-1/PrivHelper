/**
 * 全局配置兼容
 */
let config = {
    WEB_PORT: 5000,
    HTTP_PORT: 8080
};

/**
 * 更新BADIP（核心：同步HTTP端口）
 */
function updateIP() {
    let v = document.getElementById("server-ip").value.trim();
    if (!v) v = "127.0.0.1";
    currentBadIp = v;
    localStorage.setItem("privhelper_badip", v);
    
    // 1. 读取页面上显示的HTTP端口（实时值，兼容手动指定的-p参数）
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const httpPort = httpPortEl ? httpPortEl.innerText : CONFIG.httpPort || 8080;
    // 2. 读取Web端口
    const webPort = window.CONFIG?.webPort || config.WEB_PORT;
    
    // 更新Web面板地址
    document.getElementById("web-url").innerText = `http://${currentBadIp}:${webPort}`;
    // 重新加载工具（传递最新HTTP端口）
    loadTools(httpPort);
}

/**
 * 加载所有数据
 */
async function loadAll() {
    // 初始化时读取页面上的HTTP端口
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const initHttpPort = httpPortEl ? httpPortEl.innerText : CONFIG.httpPort || 8080;
    loadTools(initHttpPort);
    loadLogs();
}

/**
 * 获取文件夹唯一标识
 */
function getDirUniqueId(category, path) {
    if (!path) return `dir_${category}_root`;
    return `dir_${category}_${path.replace(/\//g, "_")}`;
}

/**
 * 保存文件夹展开状态
 */
function saveDirExpandedState(category, path, isExpanded) {
    const dirId = getDirUniqueId(category, path);
    localStorage.setItem(dirId, isExpanded ? "1" : "0");
}

/**
 * 读取文件夹展开状态
 */
function getDirExpandedState(category, path) {
    const dirId = getDirUniqueId(category, path);
    return localStorage.getItem(dirId) === "1";
}

/**
 * 递归渲染文件夹树（接收最新HTTP端口）
 */
function renderTreeNode(node, parentEl, category, parentPath = "", httpPort) {
    if (!node) return;

    const currentPath = parentPath 
        ? `${parentPath}/${node.__name__}` 
        : node.__name__ || "";
    
    if (node.__type__ === "dir") {
        const dirEl = document.createElement("div");
        dirEl.className = "dir-node";
        
        const isExpanded = getDirExpandedState(category, currentPath);
        if (isExpanded) {
            dirEl.classList.add("dir-expanded");
        }
        
        const dirHeader = document.createElement("div");
        dirHeader.className = "dir-header";
        dirHeader.innerHTML = `
            <span class="dir-arrow">${isExpanded ? "▶" : "▶"}</span>
            <span class="dir-name">${node.__name__ || "未知目录"}</span>
        `;
        
        const dirChildren = document.createElement("div");
        dirChildren.className = "dir-children";
        
        dirHeader.addEventListener("click", () => {
            const newExpanded = !dirEl.classList.contains("dir-expanded");
            dirEl.classList.toggle("dir-expanded");
            saveDirExpandedState(category, currentPath, newExpanded);
            const arrowEl = dirHeader.querySelector(".dir-arrow");
            if (arrowEl) {
                arrowEl.textContent = newExpanded ? "▶" : "▶";
            }
        });
        
        if (node.__children__ && Object.keys(node.__children__).length > 0) {
            Object.values(node.__children__).forEach(child => {
                renderTreeNode(child, dirChildren, category, currentPath, httpPort);
            });
        }
        
        dirEl.appendChild(dirHeader);
        dirEl.appendChild(dirChildren);
        parentEl.appendChild(dirEl);
    }
    else if (node.__type__ === "file") {
        const fileEl = document.createElement("div");
        fileEl.className = "file-node";
        
        // 核心修复：使用传入的最新HTTP端口替换$badurl
        const badUrlBase = `http://${currentBadIp || "127.0.0.1"}:${httpPort || 8080}`;
        const downloadUrl = `${badUrlBase}/${node.full_path}`;
        const badFile = node.__name__ || "";
        
        let cmdHtml = `<div class='cmd download-link' onclick='copy(this)'>${downloadUrl}</div>`;
        const usageItems = Array.isArray(node.usage_items)
            ? node.usage_items
            : (Array.isArray(node.usage_commands) ? node.usage_commands : []);

        let commentCount = 0;
        let commentHtml = "";
        usageItems.forEach(item => {
            if (!item) return;

            if (typeof item === "string") {
                if (item.trim().startsWith("#")) return;
                let replacedCmd = item.replace(/\$badurl/g, badUrlBase);
                replacedCmd = replacedCmd.replace(/\$downloadurl/g, downloadUrl);
                replacedCmd = replacedCmd.replace(/\$badfile/g, badFile);
                replacedCmd = replacedCmd.replace(/\$file/g, badFile);
                replacedCmd = replacedCmd.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                cmdHtml += `<div class='cmd' onclick='copy(this)'>${replacedCmd}</div>`;
                return;
            }

            if (item.type === "cmd" && item.text) {
                let replacedCmd = String(item.text).replace(/\$badurl/g, badUrlBase);
                replacedCmd = replacedCmd.replace(/\$downloadurl/g, downloadUrl);
                replacedCmd = replacedCmd.replace(/\$badfile/g, badFile);
                replacedCmd = replacedCmd.replace(/\$file/g, badFile);
                replacedCmd = replacedCmd.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                cmdHtml += `<div class='cmd' onclick='copy(this)'>${replacedCmd}</div>`;
                return;
            }

            if (item.type === "comment_block" && item.text) {
                let commentText = String(item.text);
                commentText = commentText.replace(/\$badurl/g, badUrlBase);
                commentText = commentText.replace(/\$downloadurl/g, downloadUrl);
                commentText = commentText.replace(/\$badfile/g, badFile);
                commentText = commentText.replace(/\$file/g, badFile);
                commentText = commentText.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                const safeText = commentText
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                commentCount += 1;
                commentHtml += `<div class='comment-block' onclick='copy(this)'>${safeText}</div>`;
            }
        });
        cmdHtml += commentHtml;

        const toggleHtml = commentCount > 0
            ? `<button class="file-comment-toggle" onclick="toggleComments(this)">注释(${commentCount})</button>`
            : "";
        
        fileEl.innerHTML = `
            <div class="file-title">
                <div class="file-name">${node.__name__ || "未知文件"}</div>
                ${toggleHtml}
            </div>
            <div class="file-desc">${node.desc || "无描述"}</div>
            ${cmdHtml}
        `;
        
        parentEl.appendChild(fileEl);
    }
}

function toggleComments(btn) {
    const fileEl = btn?.closest?.(".file-node");
    if (!fileEl) return;
    const isShowing = fileEl.classList.contains("show-comments");
    fileEl.classList.toggle("show-comments", !isShowing);
}

/**
 * 加载工具目录树（接收最新HTTP端口参数）
 */
async function loadTools(httpPort) {
    try {
        const res = await fetch("/api/tools");
        if (!res.ok) throw new Error(`接口返回错误：${res.status}`);
        
        const data = await res.json();
        const toolData = data.data || {};
        
        const windowsTree = document.getElementById("windows-tools");
        const linuxTree = document.getElementById("linux-tools");
        const otherTree = document.getElementById("other-tools");
        
        if (windowsTree) windowsTree.innerHTML = "";
        if (linuxTree) linuxTree.innerHTML = "";
        if (otherTree) otherTree.innerHTML = "";
        
        // 传递最新HTTP端口到渲染函数
        if (toolData.windows?.__children__) {
            Object.values(toolData.windows.__children__).forEach(child => {
                renderTreeNode(child, windowsTree, "windows", "", httpPort);
            });
        }
        if (toolData.linux?.__children__) {
            Object.values(toolData.linux.__children__).forEach(child => {
                renderTreeNode(child, linuxTree, "linux", "", httpPort);
            });
        }
        if (toolData.other?.__children__) {
            Object.values(toolData.other.__children__).forEach(child => {
                renderTreeNode(child, otherTree, "other", "", httpPort);
            });
        }

    } catch (e) {
        console.error("加载工具失败：", e);
        const windowsTree = document.getElementById("windows-tools");
        if (windowsTree) windowsTree.innerHTML = "<div style='color:#e74c3c; padding:10px'>加载失败：" + e.message + "</div>";
    }
}

/**
 * 复制命令
 */
function copy(el) {
    if (!el || el.textContent.includes("✅") || el.textContent.includes("❌")) return;

    const oldText = el.textContent;
    const text = oldText.trim();

    navigator.clipboard.writeText(text).then(() => {
        el.textContent = "✅ 已复制";

        setTimeout(() => {
            el.textContent = oldText;
        }, 900);

    }).catch(err => {
        console.error("复制失败：", err);
        el.textContent = "❌ 复制失败";

        setTimeout(() => {
            el.textContent = oldText;
        }, 900);
    });
}

/**
 * 加载日志
 */
async function loadLogs() {
    try {
        const r = await fetch("/api/http-logs");
        if (!r.ok) throw new Error(`日志接口返回错误：${r.status}`);
        
        const j = await r.json();
        const logEl = document.getElementById("http-logs");
        if (!logEl) return;
        
        if (!j.data || j.data.length === 0) {
            logEl.innerHTML = "<div style='color:#777; font-size:0.85rem'>暂无日志</div>";
            return;
        }

        let logHtml = "";
        j.data.forEach(line => {
            let statusCode = "未知";
            let decodedLine = decodeURIComponent(line);
            
            const codeMatch = decodedLine.match(/code (\d{3}),/);
            if (codeMatch) {
                statusCode = codeMatch[1];
            } else {
                const httpMatch = decodedLine.match(/"[^"]+" (\d{3}) -/);
                if (httpMatch) {
                    statusCode = httpMatch[1];
                }
            }

            if (statusCode === "200") {
                logHtml += `<div class="log-line log-status-200">${decodedLine}</div>`;
            } else {
                logHtml += `<div class="log-line log-status-other" data-status="${statusCode}">${decodedLine}</div>`;
            }
        });

        logEl.innerHTML = logHtml;
    } catch (e) {
        console.error("加载日志失败：", e);
        const logEl = document.getElementById("http-logs");
        if (logEl) logEl.innerHTML = "<div style='color:#e74c3c; padding:10px'>日志加载失败：" + e.message + "</div>";
    }
}

/**
 * 刷新日志
 */
function refreshLogs() {
    loadLogs();
}

/**
 * 重置文件夹状态
 */
function resetDirStates() {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith("dir_")) {
            localStorage.removeItem(key);
        }
    });
    // 重置时也读取最新HTTP端口
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const httpPort = httpPortEl ? httpPortEl.innerText : 8080;
    loadTools(httpPort);
    alert("文件夹状态已重置！");
}
