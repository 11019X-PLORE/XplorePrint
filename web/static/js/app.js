/**
 * XplorePrint - Main Application JavaScript
 * FRC Team 11019 Xplore
 * 3D Printer Management Software
 */

const socket = io();

class PrinterApp {
    constructor() {
        this.printers = [];
        this.queue = [];
        this.filaments = [];
        this.currentView = 'dashboard';
        this.init();
    }

    init() {
        this.bindNavigation();
        this.bindSocket();
        this.loadPrinters();
        setInterval(() => this.loadStats(), 5000);
    }

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                this.switchView(view);
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(view + 'View');
        if (targetView) {
            targetView.classList.add('active');
        }
        if (view === 'printers') {
            this.renderPrinterList();
        } else if (view === 'queue') {
            this.loadQueue();
        } else if (view === 'filaments') {
            this.loadFilaments();
        } else if (view === 'history') {
            this.loadHistory();
        } else if (view === 'partsLibrary') {
            this.loadPartsLibrary();
        } else if (view === 'partsBoard') {
            this.loadPartsBoard();
        } else if (view === 'competitions') {
            this.loadCompetitions();
        }
    }

    bindSocket() {
        socket.on('connect', () => {
            this.updateServerStatus(true);
        });

        socket.on('disconnect', () => {
            this.updateServerStatus(false);
        });

        socket.on('printer_update', (data) => {
            this.printers = data;
            this.renderDashboard();
            if (this.currentView === 'printers') {
                this.renderPrinterList();
            }
            this.loadStats();
        });
    }

    updateServerStatus(connected) {
        const dot = document.getElementById('serverStatus');
        const text = document.getElementById('serverStatusText');
        if (connected) {
            dot.style.background = 'var(--green)';
            dot.style.boxShadow = '0 0 6px var(--green)';
            text.textContent = '服务器运行中';
        } else {
            dot.style.background = 'var(--red)';
            dot.style.boxShadow = '0 0 6px var(--red)';
            text.textContent = '服务器断开';
        }
    }

    async loadPrinters() {
        try {
            const res = await fetch('/api/printers');
            this.printers = await res.json();
            this.renderDashboard();
            this.loadStats();
        } catch (e) {
            console.error('Failed to load printers:', e);
        }
    }

    async loadStats() {
        try {
            const res = await fetch('/api/stats');
            const stats = await res.json();
            document.getElementById('statTotal').textContent = stats.total;
            document.getElementById('statOnline').textContent = stats.online;
            document.getElementById('statPrinting').textContent = stats.printing;
            document.getElementById('statError').textContent = stats.error;
        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    }

    renderDashboard() {
        const grid = document.getElementById('printerGrid');
        const emptyState = document.getElementById('emptyState');

        if (this.printers.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            const existingCards = grid.querySelectorAll('.printer-card');
            existingCards.forEach(c => c.remove());
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        const existingCards = {};
        grid.querySelectorAll('.printer-card').forEach(c => {
            existingCards[c.dataset.printerId] = c;
        });

        this.printers.forEach(printer => {
            if (existingCards[printer.id]) {
                this.updatePrinterCard(existingCards[printer.id], printer);
                delete existingCards[printer.id];
            } else {
                const card = this.createPrinterCard(printer);
                grid.appendChild(card);
            }
        });

        Object.values(existingCards).forEach(c => c.remove());
    }

    createPrinterCard(printer) {
        const card = document.createElement('div');
        card.className = 'printer-card';
        card.dataset.printerId = printer.id;
        card.innerHTML = this.getPrinterCardHTML(printer);
        this.bindCardActions(card, printer);
        return card;
    }

    updatePrinterCard(card, printer) {
        const temp = card.querySelector('.printer-card-content');
        if (temp) {
            temp.innerHTML = this.getPrinterCardInnerHTML(printer);
        }
        this.bindCardActions(card, printer);
    }

    getPrinterCardHTML(printer) {
        return `<div class="printer-card-content">${this.getPrinterCardInnerHTML(printer)}</div>`;
    }

    getPrinterCardInnerHTML(printer) {
        const statusClass = printer.status;
        const statusText = this.getStatusText(printer.status);
        const progress = printer.print_progress || 0;
        const isError = printer.status === 'error';

        let amsHTML = '';
        if (printer.ams_units && printer.ams_units.length > 0) {
            amsHTML = `
                <div class="ams-section">
                    <div class="ams-title">AMS 耗材</div>
                    <div class="ams-trays">
                        ${printer.ams_units.map(tray => `
                            <div class="ams-tray" style="background-color:${tray.color};" title="${tray.material} - ${tray.remaining}%"></div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        let progressHTML = '';
        if (printer.status === 'printing' || printer.status === 'paused' || printer.status === 'finishing') {
            const remaining = this.formatTime(printer.print_time_remaining);
            progressHTML = `
                <div class="progress-section">
                    <div class="progress-header">
                        <span>${this.escapeHtml(printer.current_file || '打印中...')}</span>
                        <span>${progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill${isError ? ' error' : ''}" style="width:${progress}%;"></div>
                    </div>
                    ${remaining ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">剩余时间: ${remaining}</div>` : ''}
                </div>
            `;
        }

        let errorHTML = '';
        if (printer.status === 'error' && printer.error_message) {
            errorHTML = `
                <div style="font-size:12px;color:var(--red);margin-bottom:12px;padding:8px;background:rgba(239,68,68,0.1);border-radius:6px;">
                    ${this.escapeHtml(printer.error_message)}
                </div>
            `;
        }

        let actionsHTML = '';
        if (printer.status === 'offline') {
            actionsHTML = `<button class="btn btn-sm btn-primary" onclick="manager.connectPrinter('${printer.id}')">连接</button>`;
        } else if (printer.status === 'printing') {
            actionsHTML = `
                <button class="btn btn-sm btn-outline" onclick="manager.sendCommand('${printer.id}','pause')">暂停</button>
                <button class="btn btn-sm btn-danger" onclick="manager.sendCommand('${printer.id}','stop')">停止</button>
            `;
        } else if (printer.status === 'paused') {
            actionsHTML = `
                <button class="btn btn-sm btn-success" onclick="manager.sendCommand('${printer.id}','resume')">继续</button>
                <button class="btn btn-sm btn-danger" onclick="manager.sendCommand('${printer.id}','stop')">停止</button>
            `;
        } else if (printer.status === 'online' || printer.status === 'idle') {
            actionsHTML = `
                <button class="btn btn-sm btn-outline" onclick="manager.disconnectPrinter('${printer.id}')">断开</button>
            `;
        } else if (printer.status === 'error') {
            actionsHTML = `
                <button class="btn btn-sm btn-outline" onclick="manager.disconnectPrinter('${printer.id}')">断开</button>
                <button class="btn btn-sm btn-primary" onclick="manager.connectPrinter('${printer.id}')">重连</button>
            `;
        }

        return `
            <div class="printer-card-header">
                <div>
                    <div class="printer-name">${this.escapeHtml(printer.name)}</div>
                    <div class="printer-model">${printer.model} · ${printer.ip_address || '未配置IP'}</div>
                </div>
                <span class="status-badge ${statusClass}">
                    <span class="status-dot"></span>${statusText}
                </span>
            </div>
            ${errorHTML}
            ${progressHTML}
            <div class="temp-grid">
                <div class="temp-item">
                    <span class="temp-label">喷头</span>
                    <span class="temp-value">${printer.nozzle_temp}°C <span class="temp-target">/ ${printer.target_nozzle_temp}°C</span></span>
                </div>
                <div class="temp-item">
                    <span class="temp-label">热床</span>
                    <span class="temp-value">${printer.bed_temp}°C <span class="temp-target">/ ${printer.target_bed_temp}°C</span></span>
                </div>
                <div class="temp-item">
                    <span class="temp-label">腔体</span>
                    <span class="temp-value">${printer.chamber_temp}°C</span>
                </div>
                <div class="temp-item">
                    <span class="temp-label">层数</span>
                    <span class="temp-value">${printer.layer_num}/${printer.total_layers}</span>
                </div>
            </div>
            ${amsHTML}
            <div class="card-actions">
                ${actionsHTML}
            </div>
        `;
    }

    bindCardActions(card, printer) {
        card.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });
    }

    renderPrinterList() {
        const list = document.getElementById('printerListDetail');
        if (this.printers.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
                    <p>暂无打印机</p>
                    <span>点击"添加打印机"开始管理</span>
                </div>
            `;
            return;
        }

        list.innerHTML = this.printers.map(printer => {
            const statusClass = printer.status;
            const statusText = this.getStatusText(printer.status);
            const statusColor = this.getStatusColor(printer.status);

            return `
                <div class="printer-list-item">
                    <div class="printer-list-info">
                        <div class="status-dot" style="background:${statusColor};box-shadow:0 0 6px ${statusColor};"></div>
                        <div>
                            <div style="font-weight:600;">${this.escapeHtml(printer.name)}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${printer.model} · ${printer.ip_address}</div>
                        </div>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="printer-list-actions">
                        ${printer.status === 'offline'
                            ? `<button class="btn btn-sm btn-primary" onclick="manager.connectPrinter('${printer.id}')">连接</button>`
                            : `<button class="btn btn-sm btn-outline" onclick="manager.disconnectPrinter('${printer.id}')">断开</button>`
                        }
                        <button class="btn btn-sm btn-outline btn-danger" onclick="manager.removePrinter('${printer.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== 打印队列 ====================

    async loadQueue() {
        try {
            const res = await fetch('/api/queue');
            this.queue = await res.json();
            this.renderQueue();
        } catch (e) {
            console.error('Failed to load queue:', e);
        }
    }

    renderQueue() {
        const container = document.getElementById('queueContainer');
        if (this.queue.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    <p>打印队列为空</p>
                    <span>添加打印任务以管理排队</span>
                </div>
            `;
            return;
        }

        const statusMap = { waiting: '等待中', printing: '打印中', completed: '已完成', cancelled: '已取消' };
        const priorityLabels = { 0: '', 1: '<span class="priority-badge high">高</span>', 2: '<span class="priority-badge urgent">紧急</span>' };

        container.innerHTML = this.queue.map((item, index) => `
            <div class="queue-item">
                <div class="queue-info">
                    <div class="queue-rank">#${index + 1}</div>
                    <div class="queue-detail">
                        <div class="queue-file">${this.escapeHtml(item.file_name)} ${priorityLabels[item.priority] || ''}</div>
                        <div class="queue-meta">
                            ${item.printer_name} · ${item.material} · ${item.estimated_time ? item.estimated_time + '分钟' : '未知时间'}
                            ${item.notes ? ' · ' + this.escapeHtml(item.notes) : ''}
                        </div>
                    </div>
                </div>
                <span class="queue-status ${item.status}">${statusMap[item.status] || item.status}</span>
                <div class="queue-actions">
                    <button class="btn btn-sm btn-outline btn-danger" onclick="manager.removeQueueItem('${item.id}')">删除</button>
                </div>
            </div>
        `).join('');
    }

    async addQueueItem(data) {
        try {
            const res = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.status === 'ok') {
                this.showToast('已添加到打印队列', 'success');
                closeQueueModal();
                this.loadQueue();
            } else {
                this.showToast(result.message || '添加失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误', 'error');
        }
    }

    async removeQueueItem(id) {
        try {
            await fetch(`/api/queue/${id}`, { method: 'DELETE' });
            this.showToast('已从队列移除', 'info');
            this.loadQueue();
        } catch (e) {
            this.showToast('移除失败', 'error');
        }
    }

    async clearQueue() {
        if (!confirm('确定要清空所有打印队列吗?')) return;
        try {
            await fetch('/api/queue/clear', { method: 'POST' });
            this.showToast('队列已清空', 'info');
            this.loadQueue();
        } catch (e) {
            this.showToast('清空失败', 'error');
        }
    }

    // ==================== 耗材库存 ====================

    async loadFilaments() {
        try {
            const res = await fetch('/api/filaments');
            this.filaments = await res.json();
            this.renderFilaments();
        } catch (e) {
            console.error('Failed to load filaments:', e);
        }
    }

    renderFilaments() {
        const grid = document.getElementById('filamentGrid');
        if (this.filaments.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                    <p>暂无耗材记录</p>
                    <span>添加耗材以跟踪库存和使用情况</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.filaments.map(f => {
            const usage = f.usage_percent || 0;
            let barClass = '';
            if (usage > 80) barClass = 'critical';
            else if (usage > 60) barClass = 'low';

            return `
                <div class="filament-card">
                    <div class="filament-header">
                        <div class="filament-swatch" style="background-color:${f.color};"></div>
                        <div>
                            <div class="filament-name">${f.material} ${f.color_name}</div>
                            <div class="filament-brand">${f.brand || '无品牌'}</div>
                        </div>
                    </div>
                    <div class="filament-usage">
                        <div class="filament-usage-header">
                            <span>已使用 ${usage}%</span>
                            <span>${f.remaining_weight.toFixed(0)}g / ${f.total_weight}g</span>
                        </div>
                        <div class="filament-usage-bar">
                            <div class="filament-usage-fill ${barClass}" style="width:${Math.min(usage, 100)}%;"></div>
                        </div>
                    </div>
                    <div class="filament-stats">
                        <div class="filament-stat">
                            <span class="label">剩余</span>
                            <span class="value">${f.remaining_weight.toFixed(0)}g</span>
                        </div>
                        <div class="filament-stat">
                            <span class="label">价格</span>
                            <span class="value">¥${f.price.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="filament-actions">
                        <button class="btn btn-sm btn-outline btn-danger" onclick="manager.removeFilament('${f.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async addFilamentData(data) {
        try {
            const res = await fetch('/api/filaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.status === 'ok') {
                this.showToast('耗材添加成功', 'success');
                closeFilamentModal();
                this.loadFilaments();
            } else {
                this.showToast(result.message || '添加失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误', 'error');
        }
    }

    async removeFilament(id) {
        if (!confirm('确定要删除此耗材记录吗?')) return;
        try {
            await fetch(`/api/filaments/${id}`, { method: 'DELETE' });
            this.showToast('耗材已删除', 'info');
            this.loadFilaments();
        } catch (e) {
            this.showToast('删除失败', 'error');
        }
    }

    // ==================== 打印历史 ====================

    async loadHistory() {
        try {
            const [histRes, statsRes] = await Promise.all([
                fetch('/api/history?limit=50'),
                fetch('/api/history/stats')
            ]);
            const history = await histRes.json();
            const stats = await statsRes.json();
            this.renderHistoryStats(stats);
            this.renderHistoryTable(history);
        } catch (e) {
            console.error('Failed to load history:', e);
        }
    }

    renderHistoryStats(stats) {
        const container = document.getElementById('historyStats');
        container.innerHTML = `
            <div class="history-stat-card">
                <div class="label">总打印次数</div>
                <div class="value">${stats.total}</div>
            </div>
            <div class="history-stat-card">
                <div class="label">成功</div>
                <div class="value success">${stats.success}</div>
            </div>
            <div class="history-stat-card">
                <div class="label">失败</div>
                <div class="value failed">${stats.failed}</div>
            </div>
            <div class="history-stat-card">
                <div class="label">成功率</div>
                <div class="value">${stats.success_rate}%</div>
            </div>
        `;
    }

    renderHistoryTable(history) {
        const container = document.getElementById('historyTable');
        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:40px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p>暂无打印记录</p>
                    <span>打印完成后会自动记录历史</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>打印机</th>
                        <th>文件名</th>
                        <th>材料</th>
                        <th>开始时间</th>
                        <th>耗时</th>
                        <th>状态</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.map(h => `
                        <tr>
                            <td>${this.escapeHtml(h.printer_name)}</td>
                            <td>${this.escapeHtml(h.file_name)}</td>
                            <td>${h.material}</td>
                            <td>${this.formatDateTime(h.started_at)}</td>
                            <td>${this.formatDuration(h.duration)}</td>
                            <td><span class="history-badge ${h.success ? 'success' : 'fail'}">${h.success ? '成功' : '失败'}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async exportHistory() {
        try {
            const res = await fetch('/api/history/export');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'xploreprint_history.csv';
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('历史记录已导出', 'success');
        } catch (e) {
            this.showToast('导出失败', 'error');
        }
    }

    async clearHistory() {
        if (!confirm('确定要清空所有打印历史记录吗?此操作不可撤销。')) return;
        try {
            await fetch('/api/history/clear', { method: 'POST' });
            this.showToast('历史记录已清空', 'info');
            this.loadHistory();
        } catch (e) {
            this.showToast('清空失败', 'error');
        }
    }

    // ==================== FRC 零件库 ====================

    async loadPartsLibrary() {
        try {
            const [partsRes, catsRes] = await Promise.all([
                fetch('/api/parts/library'),
                fetch('/api/parts/categories')
            ]);
            this.partsLibrary = await partsRes.json();
            const categories = await catsRes.json();
            this.renderPartsCategories(categories);
            this.renderPartsLibrary(this.partsLibrary);
        } catch (e) {
            console.error('Failed to load parts library:', e);
        }
    }

    renderPartsCategories(categories) {
        const select = document.getElementById('partsCategoryFilter');
        select.innerHTML = '<option value="">全部类别</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    filterPartsLibrary() {
        const category = document.getElementById('partsCategoryFilter').value;
        const parts = category ? this.partsLibrary.filter(p => p.category === category) : this.partsLibrary;
        this.renderPartsLibrary(parts);
    }

    renderPartsLibrary(parts) {
        const grid = document.getElementById('partsGrid');
        if (parts.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                    <p>暂无零件模板</p>
                </div>
            `;
            return;
        }
        grid.innerHTML = parts.map(p => `
            <div class="part-card" onclick="manager.quickAddPart('${p.id}')">
                <div class="part-card-header">
                    <div class="part-card-name">${this.escapeHtml(p.name)}</div>
                    <span class="part-card-category">${p.category}</span>
                </div>
                <div class="part-card-desc">${this.escapeHtml(p.description)}</div>
                <div class="part-card-meta">
                    <span>🕐 ${p.estimated_time}分钟</span>
                    <span>🧵 ${p.filament_grams}g</span>
                    <span>📐 ${p.infill}</span>
                    <span>🔧 ${p.recommended_material}</span>
                </div>
                <div class="part-card-notes">💡 ${this.escapeHtml(p.notes)}</div>
                <button class="btn btn-sm btn-primary" style="width:100%;">快速添加到队列</button>
            </div>
        `).join('');
    }

    async quickAddPart(partId) {
        const part = this.partsLibrary.find(p => p.id === partId);
        if (!part) return;
        if (this.printers.length === 0) {
            this.showToast('请先添加打印机', 'error');
            return;
        }
        try {
            const res = await fetch('/api/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    printer_id: this.printers[0].id,
                    file_name: part.name,
                    material: part.recommended_material,
                    estimated_time: part.estimated_time,
                    priority: 0,
                    notes: `[FRC零件库] ${part.notes}`,
                    part_status: 'needed',
                })
            });
            const result = await res.json();
            if (result.status === 'ok') {
                this.showToast(`"${part.name}" 已添加到打印队列`, 'success');
            } else {
                this.showToast(result.message || '添加失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误', 'error');
        }
    }

    // ==================== 零件状态看板 ====================

    async loadPartsBoard() {
        try {
            const robotId = document.getElementById('boardRobotFilter').value;
            const [boardRes, robotsRes] = await Promise.all([
                fetch('/api/parts/board' + (robotId ? `?robot_id=${robotId}` : '')),
                fetch('/api/robots')
            ]);
            const board = await boardRes.json();
            const robots = await robotsRes.json();
            this.renderBoardRobotFilter(robots);
            this.renderKanbanBoard(board);
        } catch (e) {
            console.error('Failed to load parts board:', e);
        }
    }

    renderBoardRobotFilter(robots) {
        const select = document.getElementById('boardRobotFilter');
        const currentVal = select.value;
        select.innerHTML = '<option value="">全部机器人</option>' +
            robots.map(r => `<option value="${r.id}">${this.escapeHtml(r.name)} (${r.type === 'competition' ? '比赛机' : r.type === 'practice' ? '练习机' : '原型机'})</option>`).join('');
        select.value = currentVal;
    }

    renderKanbanBoard(board) {
        const columns = { needed: [], printing: [], done: [], installed: [] };
        board.forEach(item => {
            const status = item.part_status || 'needed';
            if (columns[status]) columns[status].push(item);
        });

        const statusLabels = { needed: '待打印', printing: '打印中', done: '已完成', installed: '已装机' };
        const nextStatus = { needed: 'printing', printing: 'done', done: 'installed', installed: 'needed' };
        const nextLabel = { needed: '开始打印', printing: '标记完成', done: '标记装机', installed: '重置' };

        Object.keys(columns).forEach(status => {
            const container = document.getElementById('kanban' + status.charAt(0).toUpperCase() + status.slice(1));
            const items = columns[status];
            if (items.length === 0) {
                container.innerHTML = '<div class="kanban-empty">暂无零件</div>';
                return;
            }
            container.innerHTML = items.map(item => `
                <div class="kanban-card" onclick="manager.movePartStatus('${item.id}', '${nextStatus[status]}')" title="点击移动到: ${nextLabel[status]}">
                    <div class="kanban-card-name">${this.escapeHtml(item.part_name)}</div>
                    <div class="kanban-card-meta">
                        <span>${item.robot_name || '未分配'} · ${item.subsystem || '未分类'}</span>
                        <span>${item.assigned_to || '未指派'}</span>
                    </div>
                </div>
            `).join('');
        });
    }

    async movePartStatus(queueId, newStatus) {
        try {
            await fetch(`/api/parts/${queueId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ part_status: newStatus })
            });
            this.loadPartsBoard();
        } catch (e) {
            this.showToast('状态更新失败', 'error');
        }
    }

    // ==================== 机器人管理 ====================

    async loadRobots() {
        try {
            const res = await fetch('/api/robots');
            return await res.json();
        } catch (e) {
            return [];
        }
    }

    async addRobotData(data) {
        try {
            const res = await fetch('/api/robots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.status === 'ok') {
                this.showToast('机器人添加成功', 'success');
                this.renderRobotListInModal();
            } else {
                this.showToast(result.message || '添加失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误', 'error');
        }
    }

    async removeRobot(id) {
        if (!confirm('确定要删除此机器人吗?')) return;
        try {
            await fetch(`/api/robots/${id}`, { method: 'DELETE' });
            this.showToast('机器人已删除', 'info');
            this.renderRobotListInModal();
        } catch (e) {
            this.showToast('删除失败', 'error');
        }
    }

    async renderRobotListInModal() {
        const robots = await this.loadRobots();
        const container = document.getElementById('robotList');
        const typeLabels = { competition: '比赛机', practice: '练习机', prototype: '原型机' };
        if (robots.length === 0) {
            container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px;">暂无机器人</div>';
            return;
        }
        container.innerHTML = robots.map(r => `
            <div class="robot-list-item">
                <div>
                    <span class="badge ${r.type}">${typeLabels[r.type] || r.type}</span>
                    <span>${this.escapeHtml(r.name)} (${r.year})</span>
                </div>
                <button class="btn btn-sm btn-outline btn-danger" onclick="manager.removeRobot('${r.id}')">删除</button>
            </div>
        `).join('');
    }

    async populateRobotSelects() {
        const robots = await this.loadRobots();
        const selects = ['queueRobotId', 'queueSubsystem'];
        const typeLabels = { competition: '比赛机', practice: '练习机', prototype: '原型机' };

        const robotSelect = document.getElementById('queueRobotId');
        if (robotSelect) {
            robotSelect.innerHTML = '<option value="">不分配</option>' +
                robots.map(r => `<option value="${r.id}">${this.escapeHtml(r.name)} (${typeLabels[r.type] || r.type})</option>`).join('');
        }
    }

    // ==================== 比赛管理 ====================

    async loadCompetitions() {
        try {
            const res = await fetch('/api/competitions');
            const competitions = await res.json();
            this.renderCompetitions(competitions);
        } catch (e) {
            console.error('Failed to load competitions:', e);
        }
    }

    renderCompetitions(competitions) {
        const grid = document.getElementById('competitionGrid');
        if (competitions.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p>暂无比赛</p>
                    <span>添加即将到来的比赛以跟踪截止日期</span>
                </div>
            `;
            return;
        }
        grid.innerHTML = competitions.map(c => {
            let countdownHTML = '';
            let cardClass = '';
            if (c.days_until < 0) {
                countdownHTML = `<div class="competition-countdown past">✅ 比赛已结束</div>`;
            } else if (c.days_until === 0) {
                countdownHTML = `<div class="competition-countdown urgent">🔥 比赛就在今天!</div>`;
                cardClass = 'urgent';
            } else if (c.days_until <= 3) {
                countdownHTML = `<div class="competition-countdown urgent">⏰ 还剩 ${c.days_until} 天!</div>`;
                cardClass = 'urgent';
            } else if (c.days_until <= 14) {
                countdownHTML = `<div class="competition-countdown days">📅 还剩 ${c.days_until} 天</div>`;
            } else {
                countdownHTML = `<div class="competition-countdown days">📅 还剩 ${c.days_until} 天</div>`;
            }
            return `
                <div class="competition-card ${cardClass}">
                    <div class="competition-name">${this.escapeHtml(c.name)}</div>
                    <div class="competition-meta">
                        ${c.location ? '📍 ' + this.escapeHtml(c.location) + ' · ' : ''}
                        ${c.start_date ? c.start_date : '日期待定'}
                        ${c.end_date ? ' → ' + c.end_date : ''}
                    </div>
                    ${countdownHTML}
                    ${c.notes ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">${this.escapeHtml(c.notes)}</div>` : ''}
                    <div class="competition-actions">
                        <button class="btn btn-sm btn-outline btn-danger" onclick="manager.removeCompetition('${c.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async addCompetitionData(data) {
        try {
            const res = await fetch('/api/competitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.status === 'ok') {
                this.showToast('比赛添加成功', 'success');
                closeCompetitionModal();
                this.loadCompetitions();
            } else {
                this.showToast(result.message || '添加失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误', 'error');
        }
    }

    async removeCompetition(id) {
        if (!confirm('确定要删除此比赛吗?')) return;
        try {
            await fetch(`/api/competitions/${id}`, { method: 'DELETE' });
            this.showToast('比赛已删除', 'info');
            this.loadCompetitions();
        } catch (e) {
            this.showToast('删除失败', 'error');
        }
    }

    // ==================== 通用工具 ====================

    getStatusText(status) {
        const map = {
            'online': '在线', 'offline': '离线', 'printing': '打印中',
            'paused': '已暂停', 'error': '错误', 'idle': '空闲', 'finishing': '完成中'
        };
        return map[status] || status;
    }

    getStatusColor(status) {
        const map = {
            'online': 'var(--green)', 'offline': 'var(--text-muted)',
            'printing': 'var(--accent-blue)', 'paused': 'var(--yellow)',
            'error': 'var(--red)', 'idle': 'var(--text-secondary)',
            'finishing': 'var(--purple)'
        };
        return map[status] || 'var(--text-muted)';
    }

    formatTime(seconds) {
        if (!seconds || seconds <= 0) return '';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}小时${m}分钟`;
        return `${m}分钟`;
    }

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '-';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    formatDateTime(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== API 调用 ====================

    async addPrinter(data) {
        try {
            const res = await fetch('/api/printers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.status === 'ok') {
                this.showToast('打印机添加成功!', 'success');
                closeAddPrinterModal();
                this.loadPrinters();
            } else {
                this.showToast(result.message || '添加失败', 'error');
            }
        } catch (e) {
            this.showToast('网络错误，请重试', 'error');
        }
    }

    async removePrinter(id) {
        if (!confirm('确定要删除这台打印机吗?')) return;
        try {
            await fetch(`/api/printers/${id}`, { method: 'DELETE' });
            this.showToast('打印机已删除', 'info');
            this.loadPrinters();
        } catch (e) {
            this.showToast('删除失败', 'error');
        }
    }

    async connectPrinter(id) {
        try {
            await fetch(`/api/printers/${id}/connect`, { method: 'POST' });
            this.showToast('正在连接打印机...', 'info');
        } catch (e) {
            this.showToast('连接失败', 'error');
        }
    }

    async disconnectPrinter(id) {
        try {
            await fetch(`/api/printers/${id}/disconnect`, { method: 'POST' });
            this.showToast('已断开连接', 'info');
        } catch (e) {
            this.showToast('断开失败', 'error');
        }
    }

    async connectAll() {
        try {
            await fetch('/api/connect_all', { method: 'POST' });
            this.showToast('正在连接所有打印机...', 'info');
        } catch (e) {
            this.showToast('连接失败', 'error');
        }
    }

    async sendCommand(id, command, params = {}) {
        try {
            await fetch(`/api/printers/${id}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, params })
            });
            const cmdText = {
                'pause': '已发送暂停指令', 'resume': '已发送恢复指令', 'stop': '已发送停止指令'
            };
            this.showToast(cmdText[command] || `已发送指令: ${command}`, 'info');
        } catch (e) {
            this.showToast('指令发送失败', 'error');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = '0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

const manager = new PrinterApp();

// ==================== 全局模态框函数 ====================

function showAddPrinterModal() {
    document.getElementById('addPrinterModal').classList.add('active');
}

function closeAddPrinterModal() {
    document.getElementById('addPrinterModal').classList.remove('active');
    document.getElementById('addPrinterForm').reset();
}

function addPrinter(event) {
    event.preventDefault();
    const data = {
        name: document.getElementById('printerName').value.trim(),
        ip_address: document.getElementById('printerIP').value.trim(),
        access_code: document.getElementById('printerCode').value.trim(),
        serial_number: document.getElementById('printerSerial').value.trim(),
        model: document.getElementById('printerModel').value
    };
    manager.addPrinter(data);
}

function showQueueModal() {
    const select = document.getElementById('queuePrinter');
    select.innerHTML = manager.printers.map(p =>
        `<option value="${p.id}">${manager.escapeHtml(p.name)}</option>`
    ).join('');
    if (manager.printers.length === 0) {
        select.innerHTML = '<option value="">请先添加打印机</option>';
    }
    manager.populateRobotSelects();
    document.getElementById('queueModal').classList.add('active');
}

function closeQueueModal() {
    document.getElementById('queueModal').classList.remove('active');
    document.getElementById('queueForm').reset();
}

function addQueueItem(event) {
    event.preventDefault();
    const data = {
        printer_id: document.getElementById('queuePrinter').value,
        file_name: document.getElementById('queueFileName').value.trim(),
        material: document.getElementById('queueMaterial').value,
        estimated_time: parseInt(document.getElementById('queueTime').value) || 0,
        priority: parseInt(document.getElementById('queuePriority').value),
        notes: document.getElementById('queueNotes').value.trim(),
        robot_id: document.getElementById('queueRobotId').value,
        subsystem: document.getElementById('queueSubsystem').value,
        assigned_to: document.getElementById('queueAssignedTo').value.trim(),
    };
    manager.addQueueItem(data);
}

function showFilamentModal() {
    document.getElementById('filamentModal').classList.add('active');
}

function closeFilamentModal() {
    document.getElementById('filamentModal').classList.remove('active');
    document.getElementById('filamentForm').reset();
}

function addFilament(event) {
    event.preventDefault();
    const data = {
        material: document.getElementById('filMaterial').value,
        brand: document.getElementById('filBrand').value.trim(),
        color: document.getElementById('filColor').value,
        color_name: document.getElementById('filColorName').value.trim(),
        total_weight: parseFloat(document.getElementById('filWeight').value),
        price: parseFloat(document.getElementById('filPrice').value) || 0
    };
    manager.addFilamentData(data);
}

function showRobotModal() {
    manager.renderRobotListInModal();
    document.getElementById('robotModal').classList.add('active');
}

function closeRobotModal() {
    document.getElementById('robotModal').classList.remove('active');
    document.getElementById('robotForm').reset();
}

function addRobot(event) {
    event.preventDefault();
    const data = {
        name: document.getElementById('robotName').value.trim(),
        year: document.getElementById('robotYear').value.trim(),
        type: document.getElementById('robotType').value,
        notes: document.getElementById('robotNotes').value.trim(),
    };
    manager.addRobotData(data);
    document.getElementById('robotForm').reset();
}

function showCompetitionModal() {
    document.getElementById('competitionModal').classList.add('active');
}

function closeCompetitionModal() {
    document.getElementById('competitionModal').classList.remove('active');
    document.getElementById('competitionForm').reset();
}

function addCompetition(event) {
    event.preventDefault();
    const data = {
        name: document.getElementById('compName').value.trim(),
        start_date: document.getElementById('compStartDate').value,
        end_date: document.getElementById('compEndDate').value,
        location: document.getElementById('compLocation').value.trim(),
        notes: document.getElementById('compNotes').value.trim(),
    };
    manager.addCompetitionData(data);
    document.getElementById('competitionForm').reset();
}

// Close modals on overlay click
['addPrinterModal', 'queueModal', 'filamentModal', 'robotModal', 'competitionModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('active');
        }
    });
});