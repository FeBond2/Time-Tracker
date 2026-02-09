class PtoTracker {
    constructor() {
        this.editingId = null;
        this.init();
    }

    init() {
        this.dateInput = document.getElementById('pto-date');
        this.typeSelect = document.getElementById('pto-type');
        this.notesInput = document.getElementById('pto-notes');
        this.saveButton = document.getElementById('pto-save');
        this.listContainer = document.getElementById('pto-list');
        this.statsContainer = document.getElementById('pto-stats');
        this.yearSelect = document.getElementById('pto-year');

        this.dateInput.value = this.getTodayDateString();
        this.saveButton.addEventListener('click', () => this.saveEntry());
        this.yearSelect.addEventListener('change', () => this.render());

        this.populateYearOptions();
        this.render();
    }

    getTodayDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    loadData() {
        const saved = localStorage.getItem('timeTrackerPto');
        const parsed = saved ? JSON.parse(saved) : { entries: [] };
        if (!parsed.entries || !Array.isArray(parsed.entries)) {
            return { entries: [] };
        }
        return parsed;
    }

    saveData(data) {
        localStorage.setItem('timeTrackerPto', JSON.stringify(data));
    }

    populateYearOptions() {
        const data = this.loadData();
        const years = new Set(data.entries.map(entry => entry.date.split('-')[0]));
        years.add(String(new Date().getFullYear()));
        const sortedYears = Array.from(years).sort((a, b) => b.localeCompare(a));

        this.yearSelect.innerHTML = '';
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            this.yearSelect.appendChild(option);
        });
    }

    getSelectedYear() {
        return this.yearSelect.value || String(new Date().getFullYear());
    }

    saveEntry() {
        const date = this.dateInput.value;
        const type = this.typeSelect.value;
        const notes = this.notesInput.value.trim();

        if (!date || !type) {
            alert('Please select a date and type.');
            return;
        }

        const data = this.loadData();
        const existingIndex = data.entries.findIndex(entry => entry.date === date);

        if (existingIndex >= 0 && this.editingId === null) {
            if (!confirm(`There is already a PTO entry for ${date}. Replace it?`)) {
                return;
            }
        }

        const entry = {
            id: this.editingId || (existingIndex >= 0 ? data.entries[existingIndex].id : Date.now()),
            date,
            type,
            notes,
            createdAt: existingIndex >= 0 ? data.entries[existingIndex].createdAt : new Date().toISOString()
        };

        if (existingIndex >= 0) {
            data.entries[existingIndex] = entry;
        } else {
            data.entries.push(entry);
        }

        this.saveData(data);
        this.resetForm();
        this.populateYearOptions();
        this.render();
    }

    resetForm() {
        this.editingId = null;
        this.dateInput.value = this.getTodayDateString();
        this.typeSelect.value = 'vacation';
        this.notesInput.value = '';
        this.saveButton.textContent = 'Save PTO';
    }

    editEntry(id) {
        const data = this.loadData();
        const entry = data.entries.find(item => item.id === id);
        if (!entry) return;

        this.editingId = id;
        this.dateInput.value = entry.date;
        this.typeSelect.value = entry.type;
        this.notesInput.value = entry.notes || '';
        this.saveButton.textContent = 'Update PTO';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    deleteEntry(id) {
        const data = this.loadData();
        const entry = data.entries.find(item => item.id === id);
        if (!entry) return;
        if (!confirm(`Delete PTO entry for ${entry.date}?`)) return;
        data.entries = data.entries.filter(item => item.id !== id);
        this.saveData(data);
        this.populateYearOptions();
        this.render();
    }

    renderStats(entries, year) {
        const limits = {
            vacation: 15,
            sick: 5,
            personal: 5
        };

        const totals = {
            vacation: 0,
            sick: 0,
            personal: 0
        };

        entries.forEach(entry => {
            if (totals[entry.type] !== undefined) {
                totals[entry.type] += 1;
            }
        });

        this.statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totals.vacation}/${limits.vacation}</div>
                <div class="stat-label">Vacation (${year})</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totals.sick}/${limits.sick}</div>
                <div class="stat-label">Sick (${year})</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totals.personal}/${limits.personal}</div>
                <div class="stat-label">Personal (${year})</div>
            </div>
        `;
    }

    renderList(entries) {
        if (entries.length === 0) {
            this.listContainer.innerHTML = '<p class="empty-state">No PTO days yet.</p>';
            return;
        }

        const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
        const typeLabel = {
            vacation: 'Vacation',
            sick: 'Sick',
            personal: 'Personal'
        };

        let html = '';
        sorted.forEach(entry => {
            html += `
                <div class="entry-item" id="pto-${entry.id}">
                    <div class="entry-info">
                        <div class="entry-time">${entry.date}</div>
                        <div class="entry-duration">Type: ${typeLabel[entry.type] || entry.type}</div>
                        ${entry.notes ? `<div class="entry-description">${entry.notes}</div>` : ''}
                    </div>
                    <div class="entry-actions">
                        <button class="btn btn-edit" data-action="edit" data-id="${entry.id}">Edit</button>
                        <button class="btn btn-danger" data-action="delete" data-id="${entry.id}">Delete</button>
                    </div>
                </div>
            `;
        });

        this.listContainer.innerHTML = html;
        this.listContainer.querySelectorAll('button[data-action]').forEach(button => {
            const id = Number(button.getAttribute('data-id'));
            const action = button.getAttribute('data-action');
            if (action === 'edit') {
                button.addEventListener('click', () => this.editEntry(id));
            } else {
                button.addEventListener('click', () => this.deleteEntry(id));
            }
        });
    }

    render() {
        const data = this.loadData();
        const year = this.getSelectedYear();
        const entries = data.entries.filter(entry => entry.date.startsWith(`${year}-`));
        this.renderStats(entries, year);
        this.renderList(entries);
    }
}

new PtoTracker();
