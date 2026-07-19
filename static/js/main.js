/**
 * 全局配置兼容
 */
let config = {
    WEB_PORT: 5000,
    HTTP_PORT: 8080
};

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

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

    const savedCallbackIp = localStorage.getItem("privhelper_callback_ip");
    if (!savedCallbackIp) {
        window.currentCallbackIp = currentBadIp;
        const cipEl = document.getElementById("callback-ip");
        if (cipEl) cipEl.value = currentBadIp;
    }
    // 重新加载工具（传递最新HTTP端口）
    loadTools(httpPort);
}

/**
 * 更新下载目录配置
 */
function updateDownloadDirs() {
    const winDirInput = document.getElementById("win-download-dir");
    const linuxDirInput = document.getElementById("linux-download-dir");
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const httpPort = httpPortEl ? httpPortEl.innerText : CONFIG.httpPort || 8080;

    let winDir = winDirInput ? winDirInput.value.trim() : "C:\\windows\\tasks";
    let linuxDir = linuxDirInput ? linuxDirInput.value.trim() : "/tmp";

    if (!winDir) winDir = "C:\\windows\\tasks";
    if (!linuxDir) linuxDir = "/tmp";

    if (winDirInput) winDirInput.value = winDir;
    if (linuxDirInput) linuxDirInput.value = linuxDir;

    window.currentWinDownloadDir = winDir;
    window.currentLinuxDownloadDir = linuxDir;
    localStorage.setItem("privhelper_win_download_dir", winDir);
    localStorage.setItem("privhelper_linux_download_dir", linuxDir);

    loadTools(httpPort);
}

/**
 * 切换标签页
 */
function switchTab(tabName) {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.classList.remove('active');
    });
    tabPanes.forEach(pane => {
        pane.classList.remove('active');
    });

    const activeBtn = document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`);
    const activePane = document.getElementById(`tab-${tabName}`);
    
    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.classList.add('active');
}

/**
 * 更新回连参数（callback_ip / callback_port）
 * 默认：callback_ip 使用当前 BADIP（仅在用户未设置时）
 */
function updateCallback() {
    const ipInput = document.getElementById("callback-ip");
    const portInput = document.getElementById("callback-port");
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const httpPort = httpPortEl ? httpPortEl.innerText : CONFIG.httpPort || 8080;

    let cip = ipInput ? ipInput.value.trim() : "";
    let cport = portInput ? portInput.value.trim() : "";

    if (!cip) {
        cip = typeof currentBadIp === "string" && currentBadIp ? currentBadIp : "127.0.0.1";
        if (ipInput) ipInput.value = cip;
    }
    if (!cport || isNaN(Number(cport))) {
        cport = "4444";
        if (portInput) portInput.value = cport;
    }

    window.currentCallbackIp = cip;
    window.currentCallbackPort = cport;
    localStorage.setItem("privhelper_callback_ip", cip);
    localStorage.setItem("privhelper_callback_port", cport);

    loadTools(httpPort);
}

/**
 * 加载所有数据
 */
async function loadAll() {
    // 初始化时读取页面上的HTTP端口
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const initHttpPort = httpPortEl ? httpPortEl.innerText : CONFIG.httpPort || 8080;
    // 初始化 callback_ip / callback_port：优先本地存储，否则默认 = BADIP / 4444
    const savedCallbackIp = localStorage.getItem("privhelper_callback_ip");
    const savedCallbackPort = localStorage.getItem("privhelper_callback_port");
    window.currentCallbackIp = savedCallbackIp || (typeof currentBadIp === "string" && currentBadIp ? currentBadIp : "127.0.0.1");
    window.currentCallbackPort = savedCallbackPort || "4444";
    const cipEl = document.getElementById("callback-ip");
    const cportEl = document.getElementById("callback-port");
    if (cipEl && !cipEl.value) cipEl.value = window.currentCallbackIp;
    if (cportEl && !cportEl.value) cportEl.value = window.currentCallbackPort;
    
    // 初始化下载目录配置
    const savedWinDir = localStorage.getItem("privhelper_win_download_dir");
    const savedLinuxDir = localStorage.getItem("privhelper_linux_download_dir");
    window.currentWinDownloadDir = savedWinDir || "C:\\windows\\tasks";
    window.currentLinuxDownloadDir = savedLinuxDir || "/tmp";
    const winDirEl = document.getElementById("win-download-dir");
    const linuxDirEl = document.getElementById("linux-download-dir");
    if (winDirEl) winDirEl.value = window.currentWinDownloadDir;
    if (linuxDirEl) linuxDirEl.value = window.currentLinuxDownloadDir;
    
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

function getReadmeUniqueId(category, path) {
    if (!path) return `readme_${category}_root`;
    return `readme_${category}_${path.replace(/\//g, "_")}`;
}

function saveReadmeExpandedState(category, path, isExpanded) {
    const id = getReadmeUniqueId(category, path);
    localStorage.setItem(id, isExpanded ? "1" : "0");
}

function getReadmeExpandedState(category, path) {
    const id = getReadmeUniqueId(category, path);
    const v = localStorage.getItem(id);
    if (v === null) return true;
    return v === "1";
}

function getFileUniqueId(category, fullPath) {
    if (!fullPath) return `file_${category}_unknown`;
    return `file_${category}_${fullPath.replace(/\//g, "_")}`;
}

function saveFileExpandedState(category, fullPath, isExpanded) {
    const id = getFileUniqueId(category, fullPath);
    localStorage.setItem(id, isExpanded ? "1" : "0");
}

function getFileExpandedState(category, fullPath) {
    const id = getFileUniqueId(category, fullPath);
    const v = localStorage.getItem(id);
    if (v === null) return false;
    return v === "1";
}

/**
 * 递归渲染文件夹树（接收最新HTTP端口）
 */
function renderTreeNode(node, parentEl, readmeEl, category, parentPath = "", httpPort) {
    if (!node) return;

    if (node.__type__ === "readme") {
        const dirPath = parentPath || "";
        const isExpanded = getReadmeExpandedState(category, dirPath);

        const readmeNode = document.createElement("div");
        readmeNode.className = `readme-node file-node${isExpanded ? "" : " readme-collapsed"}`;

        const headerEl = document.createElement("div");
        headerEl.className = "readme-header";

        const titleEl = document.createElement("div");
        titleEl.className = "readme-title";
        titleEl.textContent = node.__name__ || "README";

        const toggleEl = document.createElement("button");
        toggleEl.className = "readme-toggle";
        toggleEl.textContent = isExpanded ? "收起" : "展开";

        headerEl.appendChild(titleEl);
        headerEl.appendChild(toggleEl);

        const bodyEl = document.createElement("div");
        bodyEl.className = "readme-body";

        const badUrlBase = `http://${currentBadIp || "127.0.0.1"}:${httpPort || 8080}`;
        const callbackIp = window.currentCallbackIp || currentBadIp || "127.0.0.1";
        const callbackPort = window.currentCallbackPort || "4444";
        const winDownloadDir = window.currentWinDownloadDir || "C:\\windows\\tasks";
        const linuxDownloadDir = window.currentLinuxDownloadDir || "/tmp";
        const toolDir = node.abs_dir || "";
        const toolFile = "";

        const usageItems = Array.isArray(node.usage_items) ? node.usage_items : [];
        let cmdHtml = "";
        let commentCount = 0;
        let commentHtml = "";

        usageItems.forEach(item => {
            if (!item) return;
            if (item.type === "cmd" && item.text) {
                let replacedCmd = String(item.text).replace(/\$badurl/g, badUrlBase);
                replacedCmd = replacedCmd.replace(/\$toolpath/g, toolDir);
                replacedCmd = replacedCmd.replace(/\$toolfile/g, toolFile);
                replacedCmd = replacedCmd.replace(/\$callback_ip/g, callbackIp);
                replacedCmd = replacedCmd.replace(/\$callback_port/g, callbackPort);
                replacedCmd = replacedCmd.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                replacedCmd = replacedCmd.replace(/\$win_download_dir/g, winDownloadDir);
                replacedCmd = replacedCmd.replace(/\$linux_download_dir/g, linuxDownloadDir);
                if (item.hint) {
                    let hintText = String(item.hint).replace(/\$badurl/g, badUrlBase);
                    hintText = hintText.replace(/\$toolpath/g, toolDir);
                    hintText = hintText.replace(/\$toolfile/g, toolFile);
                    hintText = hintText.replace(/\$callback_ip/g, callbackIp);
                    hintText = hintText.replace(/\$callback_port/g, callbackPort);
                    hintText = hintText.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                    hintText = hintText.replace(/\$win_download_dir/g, winDownloadDir);
                    hintText = hintText.replace(/\$linux_download_dir/g, linuxDownloadDir);
                    cmdHtml += `<div class='cmd-hint'>${escapeHtml(hintText)}</div>`;
                }
                cmdHtml += `<div class='cmd' onclick='copy(this)'>${replacedCmd}</div>`;
                return;
            }

            if (item.type === "comment_block" && item.text) {
                const commentText = String(item.text);
                const safeText = commentText
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                commentCount += 1;
                commentHtml += `<div class='comment-block' onclick='copy(this)'>${safeText}</div>`;
            }
        });

        const readmeTitle = node.desc ? `<div class="file-desc">${node.desc}</div>` : "";
        const commentToggle = commentCount > 0
            ? `<button class="file-comment-toggle" onclick="toggleComments(this)">注释(${commentCount})</button>`
            : "";

        bodyEl.innerHTML = `
            <div class="file-title">
                <div class="file-name">readme.usage</div>
                ${commentToggle}
            </div>
            ${readmeTitle}
            ${cmdHtml}
            ${commentHtml}
        `;

        const setExpanded = (expanded) => {
            readmeNode.classList.toggle("readme-collapsed", !expanded);
            toggleEl.textContent = expanded ? "收起" : "展开";
            saveReadmeExpandedState(category, dirPath, expanded);
        };

        headerEl.addEventListener("click", () => {
            const expanded = readmeNode.classList.contains("readme-collapsed");
            setExpanded(expanded);
        });

        readmeNode.appendChild(headerEl);
        readmeNode.appendChild(bodyEl);
        readmeEl.appendChild(readmeNode);
        return;
    }

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
            const children = Object.values(node.__children__).sort((a, b) => {
                const aw = a && a.__type__ === "readme" ? 0 : 1;
                const bw = b && b.__type__ === "readme" ? 0 : 1;
                return aw - bw;
            });
            children.forEach(child => {
                renderTreeNode(child, dirChildren, readmeEl, category, currentPath, httpPort);
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
        const toolDir = node.abs_dir || "";
        const toolFile = node.abs_path || "";
        const callbackIp = window.currentCallbackIp || currentBadIp || "127.0.0.1";
        const callbackPort = window.currentCallbackPort || "4444";
        const winDownloadDir = window.currentWinDownloadDir || "C:\\windows\\tasks";
        const linuxDownloadDir = window.currentLinuxDownloadDir || "/tmp";
        const isExpanded = getFileExpandedState(category, node.full_path);
        fileEl.classList.toggle("file-collapsed", !isExpanded);
        
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
                replacedCmd = replacedCmd.replace(/\$toolpath/g, toolDir);
                replacedCmd = replacedCmd.replace(/\$toolfile/g, toolFile);
                replacedCmd = replacedCmd.replace(/\$callback_ip/g, callbackIp);
                replacedCmd = replacedCmd.replace(/\$callback_port/g, callbackPort);
                replacedCmd = replacedCmd.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                replacedCmd = replacedCmd.replace(/\$win_download_dir/g, winDownloadDir);
                replacedCmd = replacedCmd.replace(/\$linux_download_dir/g, linuxDownloadDir);
                cmdHtml += `<div class='cmd' onclick='copy(this)'>${replacedCmd}</div>`;
                return;
            }

            if (item.type === "cmd" && item.text) {
                let replacedCmd = String(item.text).replace(/\$badurl/g, badUrlBase);
                replacedCmd = replacedCmd.replace(/\$downloadurl/g, downloadUrl);
                replacedCmd = replacedCmd.replace(/\$badfile/g, badFile);
                replacedCmd = replacedCmd.replace(/\$file/g, badFile);
                replacedCmd = replacedCmd.replace(/\$toolpath/g, toolDir);
                replacedCmd = replacedCmd.replace(/\$toolfile/g, toolFile);
                replacedCmd = replacedCmd.replace(/\$callback_ip/g, callbackIp);
                replacedCmd = replacedCmd.replace(/\$callback_port/g, callbackPort);
                replacedCmd = replacedCmd.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                replacedCmd = replacedCmd.replace(/\$win_download_dir/g, winDownloadDir);
                replacedCmd = replacedCmd.replace(/\$linux_download_dir/g, linuxDownloadDir);
                if (item.hint) {
                    let hintText = String(item.hint).replace(/\$badurl/g, badUrlBase);
                    hintText = hintText.replace(/\$downloadurl/g, downloadUrl);
                    hintText = hintText.replace(/\$badfile/g, badFile);
                    hintText = hintText.replace(/\$file/g, badFile);
                    hintText = hintText.replace(/\$toolpath/g, toolDir);
                    hintText = hintText.replace(/\$toolfile/g, toolFile);
                    hintText = hintText.replace(/\$callback_ip/g, callbackIp);
                    hintText = hintText.replace(/\$callback_port/g, callbackPort);
                    hintText = hintText.replace(/\$badip/g, currentBadIp || "127.0.0.1");
                    hintText = hintText.replace(/\$win_download_dir/g, winDownloadDir);
                    hintText = hintText.replace(/\$linux_download_dir/g, linuxDownloadDir);
                    cmdHtml += `<div class='cmd-hint'>${escapeHtml(hintText)}</div>`;
                }
                cmdHtml += `<div class='cmd' onclick='copy(this)'>${replacedCmd}</div>`;
                return;
            }

            if (item.type === "comment_block" && item.text) {
                const commentText = String(item.text);
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
            <div class="file-header">
                <div class="file-header-left">
                    <span class="file-arrow">▶</span>
                    <div class="file-name">${node.__name__ || "未知文件"}</div>
                </div>
                <div class="file-header-right">${toggleHtml}</div>
            </div>
            <div class="file-body">
                <div class="file-desc">${node.desc || "无描述"}</div>
                ${cmdHtml}
            </div>
        `;

        const headerEl = fileEl.querySelector(".file-header");
        if (headerEl) {
            headerEl.addEventListener("click", (e) => {
                const target = e.target;
                if (target && target.closest && target.closest(".file-comment-toggle")) return;
                const expandedNow = fileEl.classList.contains("file-collapsed");
                fileEl.classList.toggle("file-collapsed", !expandedNow);
                saveFileExpandedState(category, node.full_path, expandedNow);
            });
        }
        
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
        
        const windowsReadme = document.getElementById("windows-readme");
        const linuxReadme = document.getElementById("linux-readme");
        const otherReadme = document.getElementById("other-readme");
        
        if (windowsTree) windowsTree.innerHTML = "";
        if (linuxTree) linuxTree.innerHTML = "";
        if (otherTree) otherTree.innerHTML = "";
        
        if (windowsReadme) windowsReadme.innerHTML = "";
        if (linuxReadme) linuxReadme.innerHTML = "";
        if (otherReadme) otherReadme.innerHTML = "";

        const weight = (n) => {
            if (!n || !n.__type__) return 9;
            if (n.__type__ === "readme") return 0;
            if (n.__type__ === "dir") return 1;
            if (n.__type__ === "file") return 2;
            return 9;
        };
        const renderRootChildren = (catNode, container, readmeContainer, category) => {
            const arr = Object.values(catNode.__children__ || {});
            arr.sort((a, b) => weight(a) - weight(b));
            arr.forEach(child => {
                renderTreeNode(child, container, readmeContainer, category, "", httpPort);
            });
        };

        // 传递最新HTTP端口到渲染函数
        if (toolData.windows?.__children__) {
            renderRootChildren(toolData.windows, windowsTree, windowsReadme, "windows");
        }
        if (toolData.linux?.__children__) {
            renderRootChildren(toolData.linux, linuxTree, linuxReadme, "linux");
        }
        if (toolData.other?.__children__) {
            renderRootChildren(toolData.other, otherTree, otherReadme, "other");
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

/**
 * 一键重置所有配置
 */
function resetAll() {
    if (!confirm("确定要重置所有配置吗？这将清空所有持久化数据，恢复到默认状态。")) {
        return;
    }
    
    localStorage.clear();
    
    currentBadIp = CONFIG.badIp;
    window.currentCallbackIp = CONFIG.badIp;
    window.currentCallbackPort = "4444";
    window.currentWinDownloadDir = "C:\\windows\\tasks";
    window.currentLinuxDownloadDir = "/tmp";
    
    document.getElementById("server-ip").value = CONFIG.badIp;
    document.getElementById("callback-ip").value = CONFIG.badIp;
    document.getElementById("callback-port").value = "4444";
    document.getElementById("win-download-dir").value = "C:\\windows\\tasks";
    document.getElementById("linux-download-dir").value = "/tmp";
    
    const httpPortEl = document.querySelector('.header-middle .info-item:last-child .info-value');
    const httpPort = httpPortEl ? httpPortEl.innerText : CONFIG.httpPort || 8080;
    
    loadTools(httpPort);
    alert("所有配置已重置！");
}
