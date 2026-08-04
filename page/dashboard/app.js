const bridge = window.AstrBotPluginPage;

const totalUsersEl = document.getElementById('totalUsers');
const negativeCountEl = document.getElementById('negativeCount');
const tableBody = document.getElementById('tableBody');
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('statusBar');
const modal = document.getElementById('confirmModal');
const modalText = document.getElementById('modalText');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');

let ready = false;

function showStatus(msg, type) {
    if (!statusEl) return;
    if (!msg) {
        statusEl.hidden = true;
        statusEl.textContent = '';
        statusEl.className = 'status';
        return;
    }
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.className = 'status' + (type ? ' ' + type : '');
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function customConfirm(message) {
    return new Promise((resolve) => {
        modalText.textContent = message;
        modal.hidden = false;
        const onOk = () => done(true);
        const onCancel = () => done(false);
        const done = (val) => {
            modal.hidden = true;
            modalConfirm.removeEventListener('click', onOk);
            modalCancel.removeEventListener('click', onCancel);
            resolve(val);
        };
        modalConfirm.addEventListener('click', onOk);
        modalCancel.addEventListener('click', onCancel);
    });
}

async function loadData() {
    if (!ready) {
        showStatus('面板未就绪，无法加载数据', 'danger');
        return;
    }
    showStatus('加载中...', '');
    refreshBtn.disabled = true;
    try {
        const data = await bridge.apiGet('data');
        const entries = Object.entries(data || {});
        totalUsersEl.textContent = entries.length;
        let negative = 0;
        tableBody.innerHTML = '';
        if (entries.length === 0) {
            tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">暂无数据</td></tr>';
            negativeCountEl.textContent = '0';
            showStatus('', '');
            return;
        }
        for (const [uid, info] of entries) {
            const emotion = (info && info.current) || '未知';
            const score = (info && info.score) || 0;
            const count = ((info && info.history) || []).length;
            if (['悲伤', '愤怒', '焦虑'].includes(emotion)) negative++;
            const row = document.createElement('tr');
            row.innerHTML =
                '<td>' + escapeHtml(String(uid).slice(0, 12)) + '</td>' +
                '<td>' + escapeHtml(emotion) + '</td>' +
                '<td>' + (score * 100).toFixed(0) + '%</td>' +
                '<td>' + count + '</td>';
            tableBody.appendChild(row);
        }
        negativeCountEl.textContent = negative;
        showStatus('', '');
    } catch (e) {
        showStatus('加载失败：' + (e && e.message ? e.message : e), 'danger');
    } finally {
        refreshBtn.disabled = false;
    }
}

refreshBtn.addEventListener('click', loadData);
clearBtn.addEventListener('click', async () => {
    if (!ready) {
        showStatus('面板未就绪，无法清除数据', 'danger');
        return;
    }
    const ok = await customConfirm('确定要清除所有情绪数据吗？');
    if (!ok) return;
    clearBtn.disabled = true;
    showStatus('清除中...', '');
    try {
        await bridge.apiPost('clear');
        await loadData();
    } catch (e) {
        showStatus('清除失败：' + (e && e.message ? e.message : e), 'danger');
    } finally {
        clearBtn.disabled = false;
    }
});

try {
    await bridge.ready();
    ready = true;
} catch (e) {
    showStatus('面板初始化失败：' + (e && e.message ? e.message : e), 'danger');
}

await loadData();
