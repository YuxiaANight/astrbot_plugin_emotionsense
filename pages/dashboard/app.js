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
const llmEmotionEl = document.getElementById('llmEmotion');
const llmScoreEl = document.getElementById('llmScore');
const llmTimeEl = document.getElementById('llmTime');
const llmHistoryEl = document.getElementById('llmHistory');
const llmCardEl = document.getElementById('llmCurrent');

const EMOTION_STYLE = {
    '开心': 'pos',
    '平静': 'neutral',
    '懒惰': 'lazy',
    '生气': 'angry',
    '伤心': 'sad',
    '烦躁': 'irritable',
};

const NEGATIVE_EMOTIONS = ['悲伤', '愤怒', '焦虑'];

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

function formatTime(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (e) {
        return iso;
    }
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

function renderLlmState(llm) {
    const emotion = (llm && llm.emotion) || '平静';
    const score = (llm && typeof llm.score === 'number') ? llm.score : 0;
    const updated = (llm && llm.updated_at) || null;
    llmEmotionEl.textContent = emotion;
    llmScoreEl.textContent = '强度 ' + (score * 100).toFixed(0) + '%';
    llmTimeEl.textContent = updated ? '更新于 ' + formatTime(updated) : '尚未产生情绪';
    llmCardEl.className = 'llm-card ' + (EMOTION_STYLE[emotion] || 'neutral');
}

function renderHistoryItems(items) {
    return items.map((h) => {
        const emotion = h.emotion || '未知';
        const score = (typeof h.score === 'number') ? h.score : 0;
        const cls = EMOTION_STYLE[emotion] || 'neutral';
        return '<li class="history-item ' + cls + '">' +
            '<span class="hi-dot"></span>' +
            '<span class="hi-emotion">' + escapeHtml(emotion) + '</span>' +
            '<span class="hi-score">' + (score * 100).toFixed(0) + '%</span>' +
            '<span class="hi-time">' + escapeHtml(formatTime(h.time)) + '</span>' +
            '</li>';
    }).join('');
}

function renderLlmHistory(history) {
    const list = Array.isArray(history) ? history : [];
    if (list.length === 0) {
        llmHistoryEl.innerHTML = '<li class="empty-history">暂无变化记录</li>';
        return;
    }
    llmHistoryEl.innerHTML = renderHistoryItems(list.slice().reverse());
}

async function loadData() {
    if (!ready) {
        showStatus('面板未就绪，无法加载数据', 'danger');
        return;
    }
    showStatus('加载中...', '');
    refreshBtn.disabled = true;
    try {
        const payload = await bridge.apiGet('data');
        const users = (payload && payload.users) || {};
        const llm = (payload && payload.llm) || {};
        const entries = Object.entries(users);
        totalUsersEl.textContent = entries.length;
        let negative = 0;
        tableBody.innerHTML = '';
        if (entries.length === 0) {
            tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">暂无数据</td></tr>';
            negativeCountEl.textContent = '0';
        } else {
            for (const [uid, info] of entries) {
                const emotion = (info && info.current) || '未知';
                const score = (info && info.score) || 0;
                const count = ((info && info.history) || []).length;
                if (NEGATIVE_EMOTIONS.includes(emotion)) negative++;
                const row = document.createElement('tr');
                row.innerHTML =
                    '<td>' + escapeHtml(String(uid).slice(0, 12)) + '</td>' +
                    '<td>' + escapeHtml(emotion) + '</td>' +
                    '<td>' + (score * 100).toFixed(0) + '%</td>' +
                    '<td>' + count + '</td>';
                tableBody.appendChild(row);
            }
            negativeCountEl.textContent = negative;
        }
        renderLlmState(llm);
        renderLlmHistory(llm.history);
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
