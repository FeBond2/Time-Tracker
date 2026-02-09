// Time Tracker Application
class TimeTracker {
    constructor() {
        this.entries = this.loadEntries();
        this.stopwatchInterval = null;
        this.stopwatchStartTime = null;
        this.stopwatchElapsed = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.stopwatchEntryId = null;
        this.initializeApp();
    }

    // Helper function to get today's date in YYYY-MM-DD format (local time)
    getTodayDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper function to parse YYYY-MM-DD string to Date (local time)
    parseLocalDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    // iOS touch event handling
    setupIOSTouchHandling() {
        // Ensure all buttons respond to touch
        document.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                e.target.style.opacity = '0.7';
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                e.target.style.opacity = '1';
            }
        }, { passive: true });

        // Fix for iOS input focus issues
        document.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
                // Allow input focus
                return true;
            }
        }, { passive: true });

        // Ensure file input works on iOS
        const importLabel = document.querySelector('label[for="import-data"]');
        const importInput = document.getElementById('import-data');
        if (importLabel && importInput) {
            importLabel.addEventListener('touchstart', (e) => {
                e.stopPropagation();
            }, { passive: true });
            importLabel.addEventListener('touchend', (e) => {
                e.preventDefault();
                importInput.click();
            });
        }
    }

    initializeApp() {
        // iOS touch event fixes
        this.setupIOSTouchHandling();
        
        document.getElementById('date').value = this.getTodayDateString();
        
        // Load and apply dark mode preference
        this.loadDarkMode();

        // Migrate old entries to timePeriods structure
        this.entries.forEach(entry => {
            if (!entry.timerState) {
                entry.timerState = 'stopped';
                entry.timerElapsed = 0;
                entry.timerStartTime = null;
                entry.timerActualStartTime = null;
            }
            if (entry.timerActualStartTime === undefined) {
                entry.timerActualStartTime = null;
            }
            if (entry.baseDurationMinutes === undefined) {
                if (entry.duration) {
                    entry.baseDurationMinutes = entry.duration.totalSeconds !== undefined 
                        ? Math.floor(entry.duration.totalSeconds / 60)
                        : entry.duration.totalMinutes;
                } else {
                    entry.baseDurationMinutes = 0;
                }
            }
            if (!entry.timePeriods && entry.startTime && entry.endTime) {
                entry.timePeriods = [{ startTime: entry.startTime, endTime: entry.endTime }];
                entry.duration = this.calculateDurationFromPeriods(entry.timePeriods);
            } else if (!entry.timePeriods) {
                entry.timePeriods = [];
            }
            if (entry.completed === undefined) {
                entry.completed = false;
            }
        });
        this.saveEntries();

        // ========== Event Listeners ==========
        this.bindTap(document.getElementById('add-entry'), () => this.addEntry());
        this.bindTap(document.getElementById('add-period'), () => this.addTimePeriod());
        document.getElementById('filter-date').addEventListener('change', (e) => this.filterEntries(e.target.value));
        this.bindTap(document.getElementById('clear-filter'), () => this.clearFilter());
        this.bindTap(document.getElementById('filter-past-week'), () => this.filterPastWeek());
        this.bindTap(document.getElementById('toggle-entries'), () => this.toggleEntriesSection());
        this.bindTap(document.getElementById('dark-mode-toggle'), () => this.toggleDarkMode());
        this.bindTap(document.getElementById('export-data'), () => this.exportData());
        document.getElementById('import-data').addEventListener('change', (e) => this.importData(e));

        const ptoAddButton = document.getElementById('pto-add');
        if (ptoAddButton) {
            ptoAddButton.addEventListener('click', () => {
                const date = document.getElementById('date')?.value;
                const type = document.getElementById('pto-type')?.value;
                this.addOrUpdatePtoEntry(date, type);
            });
        }
        
        document.getElementById('time-periods-container').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-period')) {
                this.removeTimePeriod(e.target);
            }
        });
        this.bindTap(document.getElementById('start-stopwatch'), () => this.startStopwatch());
        this.bindTap(document.getElementById('pause-stopwatch'), () => this.pauseStopwatch());
        this.bindTap(document.getElementById('stop-stopwatch'), () => this.stopStopwatch());
        this.bindTap(document.getElementById('reset-stopwatch'), () => this.resetStopwatch());

        this.updateDisplay();
        setInterval(() => this.updateActiveTimers(), 100);
    }

    bindTap(element, handler) {
        if (!element) return;
        let lastTouch = 0;
        const wrapped = (event) => {
            if (event.type === 'touchend') {
                lastTouch = Date.now();
                event.preventDefault();
                handler();
                return;
            }
            if (event.type === 'click') {
                if (Date.now() - lastTouch < 500) {
                    return;
                }
                handler();
            }
        };
        element.addEventListener('touchend', wrapped, { passive: false });
        element.addEventListener('click', wrapped);
    }

    // ========== Stopwatch Functions ==========

    startStopwatch() {
        if (this.isRunning) return;

        if (!this.stopwatchEntryId) {
            this.createStopwatchEntry();
        }

        this.isRunning = true;
        this.isPaused = false;
        this.stopwatchStartTime = Date.now() - this.stopwatchElapsed;
        
        document.getElementById('start-stopwatch').disabled = true;
        document.getElementById('pause-stopwatch').disabled = false;
        document.getElementById('stop-stopwatch').disabled = false;
        document.getElementById('reset-stopwatch').disabled = false;

        this.stopwatchInterval = setInterval(() => {
            if (this.stopwatchEntryId) {
                this.stopwatchElapsed = Date.now() - this.stopwatchStartTime;
                this.updateStopwatchDisplay();
                this.updateStopwatchEntry();
            }
        }, 100);
    }

    createStopwatchEntry() {
        const today = this.getTodayDateString();
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const startTime = `${hours}:${minutes}`;
        const dateObj = this.parseLocalDate(today);
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        const entry = {
            id: Date.now(),
            date: today,
            day: dayOfWeek,
            timePeriods: [{ startTime, endTime: startTime }],
            duration: { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0, totalMinutes: 0 },
            description: 'Stopwatch Entry',
            timerState: 'stopped',
            timerElapsed: 0,
            timerStartTime: null,
            baseDurationMinutes: 0,
            stopwatchPeriodIndex: 0,
            completed: false
        };

        this.entries.push(entry);
        this.stopwatchEntryId = entry.id;
        this.saveEntries();
        this.updateDisplay();
        
        document.getElementById('stopwatch-info').style.display = 'block';
        document.getElementById('stopwatch-entry-name').textContent = entry.description;
    }

    pauseStopwatch() {
        if (!this.isRunning || !this.stopwatchEntryId) return;

        this.isRunning = false;
        this.isPaused = true;
        clearInterval(this.stopwatchInterval);
        this.updateStopwatchEntry();
        
        document.getElementById('start-stopwatch').disabled = false;
        document.getElementById('pause-stopwatch').disabled = true;
        document.getElementById('stop-stopwatch').disabled = false;
    }

    updateStopwatchEntry() {
        if (!this.stopwatchEntryId) return;

        const entry = this.entries.find(e => e.id === this.stopwatchEntryId);
        if (!entry) return;

        // Update time period with current time
        if (!entry.timePeriods) {
            entry.timePeriods = [];
        }

        const now = new Date();
        const endHours = String(now.getHours()).padStart(2, '0');
        const endMinutes = String(now.getMinutes()).padStart(2, '0');
        const endSeconds = String(now.getSeconds()).padStart(2, '0');
        const endTime = `${endHours}:${endMinutes}:${endSeconds}`;

        if (entry.timePeriods.length === 0 || entry.stopwatchPeriodIndex === undefined) {
            const stopwatchStartDateTime = new Date(this.stopwatchStartTime || Date.now());
            const startHours = String(stopwatchStartDateTime.getHours()).padStart(2, '0');
            const startMinutes = String(stopwatchStartDateTime.getMinutes()).padStart(2, '0');
            const startSeconds = String(stopwatchStartDateTime.getSeconds()).padStart(2, '0');
            const startTime = `${startHours}:${startMinutes}:${startSeconds}`;
            
            entry.timePeriods.push({ startTime, endTime });
            entry.stopwatchPeriodIndex = entry.timePeriods.length - 1;
        } else {
            entry.timePeriods[entry.stopwatchPeriodIndex].endTime = endTime;
        }

        // Duration should always be calculated from time periods only (Option A)
        entry.duration = this.calculateDurationFromPeriods(entry.timePeriods);

        this.saveEntries();
        this.updateDisplay();
    }

    stopStopwatch() {
        if (!this.stopwatchEntryId) return;

        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.stopwatchInterval);
        
        const formDescription = document.getElementById('description').value.trim();
        const entry = this.entries.find(e => e.id === this.stopwatchEntryId);
        if (!entry) return;
        
        if (formDescription && formDescription !== '' && formDescription !== 'Stopwatch Entry') {
            entry.description = formDescription;
        }
        
        this.updateStopwatchEntry();
        
        // Clear form and reset stopwatch
        const today = this.getTodayDateString();
        document.getElementById('date').value = today;
        this.clearEntryForm();
        
        this.stopwatchEntryId = null;
        this.stopwatchElapsed = 0;
        this.stopwatchStartTime = null;
        
        document.getElementById('start-stopwatch').disabled = false;
        document.getElementById('pause-stopwatch').disabled = true;
        document.getElementById('stop-stopwatch').disabled = true;
        document.getElementById('reset-stopwatch').disabled = true;
        document.getElementById('stopwatch-info').style.display = 'none';
        
        this.updateStopwatchDisplay();
    }

    resetStopwatch() {
        this.isRunning = false;
        this.isPaused = false;
        clearInterval(this.stopwatchInterval);
        
        if (this.stopwatchEntryId) {
            const entry = this.entries.find(e => e.id === this.stopwatchEntryId);
            const entrySeconds = entry.duration.totalSeconds !== undefined 
                ? entry.duration.totalSeconds 
                : (entry.duration.totalMinutes * 60);
            if (entry && entrySeconds === 0) {
                this.entries = this.entries.filter(e => e.id !== this.stopwatchEntryId);
                this.saveEntries();
            }
            this.stopwatchEntryId = null;
        }
        
        this.stopwatchElapsed = 0;
        this.stopwatchStartTime = null;
        
        document.getElementById('start-stopwatch').disabled = false;
        document.getElementById('pause-stopwatch').disabled = true;
        document.getElementById('stop-stopwatch').disabled = true;
        document.getElementById('reset-stopwatch').disabled = true;
        document.getElementById('stopwatch-info').style.display = 'none';
        
        this.updateStopwatchDisplay();
        this.updateDisplay();
    }

    updateStopwatchDisplay() {
        const totalSeconds = Math.floor(this.stopwatchElapsed / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('stopwatch-display').textContent = formatted;
    }

    // ========== Form Management ==========
    
    addTimePeriod() {
        const container = document.getElementById('time-periods-container');
        const periodDiv = document.createElement('div');
        periodDiv.className = 'time-period-item';
        periodDiv.innerHTML = `
            <div class="time-period-inputs">
                <label>Start:</label>
                <input type="time" class="period-start-time" required>
                <label>End:</label>
                <input type="time" class="period-end-time" required>
                <button type="button" class="btn btn-danger btn-sm remove-period">Remove</button>
            </div>
        `;
        container.appendChild(periodDiv);
        
        // Show remove buttons if there's more than one period
        this.updateRemoveButtons();
    }

    removeTimePeriod(button) {
        const periodItem = button.closest('.time-period-item');
        periodItem.remove();
        this.updateRemoveButtons();
    }

    updateRemoveButtons() {
        const container = document.getElementById('time-periods-container');
        const periods = container.querySelectorAll('.time-period-item');
        const removeButtons = container.querySelectorAll('.remove-period');
        
        removeButtons.forEach(btn => {
            btn.style.display = periods.length > 1 ? 'inline-block' : 'none';
        });
    }

    // ========== Entry Management ==========


    addEntry() {
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value.trim();

        // Collect all time periods from the form
        const periodItems = document.querySelectorAll('.time-period-item');
        const timePeriods = [];
        
        for (const item of periodItems) {
            const startTime = item.querySelector('.period-start-time').value;
            const endTime = item.querySelector('.period-end-time').value;
            
            if (!startTime || !endTime) {
                alert('Please fill in all time periods (Start Time and End Time are required)');
                return;
            }
            
            if (startTime >= endTime) {
                alert('End time must be after start time for each period');
                return;
            }
            
            timePeriods.push({ startTime, endTime });
        }

        if (timePeriods.length === 0) {
            alert('Please add at least one time period');
            return;
        }

        // Calculate total duration from all periods
        const duration = this.calculateDurationFromPeriods(timePeriods);
        
        // Get day of week - parse date as local time to avoid timezone issues
        const dateObj = this.parseLocalDate(date);
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

        // Create new entry with timePeriods array
        const entry = {
            id: Date.now(),
            date: date,
            day: dayOfWeek,
            timePeriods: timePeriods,
            duration: duration,
            description: description || 'No description',
            timerState: 'stopped',
            timerElapsed: 0,
            timerStartTime: null,
            timerActualStartTime: null,
            baseDurationMinutes: Math.floor(duration.totalSeconds / 60),
            completed: false
        };

        // Add to entries
        this.entries.push(entry);
        
        // Sort entries by date (newest first), then by first start time
        this.entries.sort((a, b) => {
            if (a.date !== b.date) {
                // Compare dates directly as strings (YYYY-MM-DD format sorts correctly)
                return b.date.localeCompare(a.date);
            }
            const aFirstStart = a.timePeriods && a.timePeriods.length > 0 ? a.timePeriods[0].startTime : '';
            const bFirstStart = b.timePeriods && b.timePeriods.length > 0 ? b.timePeriods[0].startTime : '';
            return bFirstStart.localeCompare(aFirstStart);
        });

        // Save and update display
        this.saveEntries();
        this.updateDisplay();

        // Clear form (keep date, reset to one period)
        this.clearEntryForm();
    }

    clearEntryForm() {
        const container = document.getElementById('time-periods-container');
        container.innerHTML = `
            <div class="time-period-item">
                <div class="time-period-inputs">
                    <label>Start:</label>
                    <input type="time" class="period-start-time" required>
                    <label>End:</label>
                    <input type="time" class="period-end-time" required>
                    <button type="button" class="btn btn-danger btn-sm remove-period" style="display: none;">Remove</button>
                </div>
            </div>
        `;
        document.getElementById('description').value = '';
        this.updateRemoveButtons();
    }

    editEntry(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        // If this entry is being tracked by stopwatch, pause it first
        if (id === this.stopwatchEntryId && this.isRunning) {
            this.pauseStopwatch();
        }

        // Toggle inline edit mode for this entry
        const entryElement = document.getElementById(`entry-${id}`);
        if (!entryElement) return;

        // Check if already in edit mode
        const isEditing = entryElement.classList.contains('editing');
        
        if (isEditing) {
            // Save changes
            this.saveInlineEdit(id);
        } else {
            // Enter edit mode
            this.enterInlineEditMode(id, entryElement, entry);
        }
    }

    enterInlineEditMode(id, entryElement, entry) {
        // Get time periods (or create from old entry structure)
        const timePeriods = entry.timePeriods || (entry.startTime && entry.endTime ? [{ startTime: entry.startTime, endTime: entry.endTime }] : []);
        
        // Create inline edit form with time periods
        let periodsHTML = '';
        timePeriods.forEach((period, index) => {
            periodsHTML += `
                <div class="time-period-edit-item" data-period-index="${index}">
                    <div class="time-period-edit-inputs">
                        <label>Start:</label>
                        <input type="time" class="edit-period-start-time" value="${period.startTime}" required>
                        <label>End:</label>
                        <input type="time" class="edit-period-end-time" value="${period.endTime}" required>
                        <button type="button" class="btn btn-danger btn-sm remove-edit-period" ${timePeriods.length > 1 ? '' : 'style="display: none;"'}>Remove</button>
                    </div>
                </div>
            `;
        });
        
        const editHTML = `
            <div class="entry-edit-form">
                <div class="edit-form-row">
                    <label>Date:</label>
                    <input type="date" class="edit-date" value="${entry.date}">
                </div>
                <div class="edit-form-row">
                    <label>Description:</label>
                    <input type="text" class="edit-description" value="${entry.description}">
                </div>
                <div class="edit-form-row">
                    <label>Time Periods:</label>
                    <div class="edit-time-periods-container">
                        ${periodsHTML}
                    </div>
                    <button type="button" class="btn btn-secondary btn-sm add-edit-period">+ Add Period</button>
                </div>
                <div class="edit-form-actions">
                    <button class="btn btn-success btn-sm" onclick="tracker.saveInlineEdit(${id})">Save</button>
                    <button class="btn btn-secondary btn-sm" onclick="tracker.cancelInlineEdit(${id})">Cancel</button>
                </div>
            </div>
        `;
        
        // Store original content
        entryElement.dataset.originalContent = entryElement.innerHTML;
        
        // Replace content with edit form
        entryElement.classList.add('editing');
        entryElement.querySelector('.entry-info').innerHTML = editHTML;
        
        // Add event listeners for add/remove period buttons in edit mode
        const editForm = entryElement.querySelector('.entry-edit-form');
        editForm.querySelector('.add-edit-period')?.addEventListener('click', () => {
            this.addEditPeriod(entryElement);
        });
        
        // Use event delegation for remove buttons
        editForm.querySelector('.edit-time-periods-container')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-edit-period')) {
                this.removeEditPeriod(e.target, entryElement);
            }
        });
    }

    addEditPeriod(entryElement) {
        const container = entryElement.querySelector('.edit-time-periods-container');
        const periodDiv = document.createElement('div');
        periodDiv.className = 'time-period-edit-item';
        const index = container.children.length;
        periodDiv.setAttribute('data-period-index', index);
        periodDiv.innerHTML = `
            <div class="time-period-edit-inputs">
                <label>Start:</label>
                <input type="time" class="edit-period-start-time" required>
                <label>End:</label>
                <input type="time" class="edit-period-end-time" required>
                <button type="button" class="btn btn-danger btn-sm remove-edit-period">Remove</button>
            </div>
        `;
        container.appendChild(periodDiv);
        this.updateEditRemoveButtons(entryElement);
    }

    removeEditPeriod(button, entryElement) {
        const periodItem = button.closest('.time-period-edit-item');
        periodItem.remove();
        this.updateEditRemoveButtons(entryElement);
    }

    updateEditRemoveButtons(entryElement) {
        const container = entryElement.querySelector('.edit-time-periods-container');
        const periods = container.querySelectorAll('.time-period-edit-item');
        const removeButtons = container.querySelectorAll('.remove-edit-period');
        
        removeButtons.forEach(btn => {
            btn.style.display = periods.length > 1 ? 'inline-block' : 'none';
        });
    }

    saveInlineEdit(id) {
        const entryElement = document.getElementById(`entry-${id}`);
        if (!entryElement) return;

        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        // Get values from edit form
        const date = entryElement.querySelector('.edit-date').value;
        const description = entryElement.querySelector('.edit-description').value.trim();
        
        // Collect all time periods from edit form
        const periodItems = entryElement.querySelectorAll('.time-period-edit-item');
        const timePeriods = [];
        
        for (const item of periodItems) {
            const startTime = item.querySelector('.edit-period-start-time').value;
            const endTime = item.querySelector('.edit-period-end-time').value;
            
            if (!startTime || !endTime) {
                alert('Please fill in all time periods (Start Time and End Time are required)');
                return;
            }
            
            if (startTime >= endTime) {
                alert('End time must be after start time for each period');
                return;
            }
            
            timePeriods.push({ startTime, endTime });
        }

        if (timePeriods.length === 0) {
            alert('Please add at least one time period');
            return;
        }

        // Calculate duration from all periods
        const duration = this.calculateDurationFromPeriods(timePeriods);
        
        // Get day of week
        const dateObj = this.parseLocalDate(date);
        const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                // Update entry
                const entryIndex = this.entries.findIndex(e => e.id === id);
                if (entryIndex !== -1) {
                    this.entries[entryIndex] = {
                        ...this.entries[entryIndex],
                        date: date,
                        day: dayOfWeek,
                        timePeriods: timePeriods,
                        duration: duration,
                        description: description || 'No description',
                        // Update base duration when manually editing (this is the new manual duration)
                        baseDurationMinutes: Math.floor(duration.totalSeconds / 60),
                        // Preserve completed status
                        completed: this.entries[entryIndex].completed || false
                    };
                }

        // Remove editing class before updating display
        entryElement.classList.remove('editing');
        delete entryElement.dataset.originalContent;
        
        // Save and refresh display
        this.saveEntries();
        this.updateDisplay();
    }

    cancelInlineEdit(id) {
        const entryElement = document.getElementById(`entry-${id}`);
        if (!entryElement) return;

        // Restore original content
        if (entryElement.dataset.originalContent) {
            entryElement.classList.remove('editing');
            entryElement.querySelector('.entry-info').innerHTML = entryElement.dataset.originalContent;
            delete entryElement.dataset.originalContent;
        } else {
            // If no original content, just refresh display
            this.updateDisplay();
        }
    }

    // ========== Duration Calculation ==========
    
    calculateDuration(startTime, endTime) {
        // Handle both HH:MM and HH:MM:SS formats
        const start = this.timeToSeconds(startTime);
        const end = this.timeToSeconds(endTime);
        const totalSeconds = end - start;
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return { hours, minutes, seconds, totalSeconds, totalMinutes: Math.floor(totalSeconds / 60) };
    }

    calculateDurationFromPeriods(timePeriods) {
        let totalSeconds = 0;
        
        for (const period of timePeriods) {
            if (period.startTime && period.endTime) {
                const periodDuration = this.calculateDuration(period.startTime, period.endTime);
                totalSeconds += periodDuration.totalSeconds;
            }
        }
        
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        return { hours, minutes, seconds, totalSeconds, totalMinutes: Math.floor(totalSeconds / 60) };
    }

    timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    timeToSeconds(time) {
        // Handle both HH:MM and HH:MM:SS formats
        const parts = time.split(':').map(Number);
        const hours = parts[0] || 0;
        const minutes = parts[1] || 0;
        const seconds = parts[2] || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }

    // ========== Entry Helpers ==========
    
    getEntryTimeRange(entry) {
        if (!entry.timePeriods || entry.timePeriods.length === 0) {
            // Fallback for old entries
            if (entry.startTime && entry.endTime) {
                return { startTime: entry.startTime, endTime: entry.endTime };
            }
            return { startTime: '', endTime: '' };
        }
        
        const sortedPeriods = [...entry.timePeriods].sort((a, b) => 
            a.startTime.localeCompare(b.startTime)
        );
        
        return {
            startTime: sortedPeriods[0].startTime,
            endTime: sortedPeriods[sortedPeriods.length - 1].endTime
        };
    }

    formatTimePeriods(entry) {
        if (!entry.timePeriods || entry.timePeriods.length === 0) {
            // Fallback for old entries
            if (entry.startTime && entry.endTime) {
                return `${this.formatTime(entry.startTime)} - ${this.formatTime(entry.endTime)}`;
            }
            return '';
        }
        
        return entry.timePeriods.map(period => 
            `${this.formatTime(period.startTime)} - ${this.formatTime(period.endTime)}`
        ).join(', ');
    }

    // ========== Formatting ==========
    
    formatDuration(duration) {
        // Always show in HH:MM:SS format
        const totalSeconds = duration.totalSeconds !== undefined ? duration.totalSeconds : (duration.totalMinutes * 60);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    formatDurationAsTimer(duration) {
        const totalSeconds = duration.totalSeconds !== undefined ? duration.totalSeconds : (duration.totalMinutes * 60);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    formatTime(time) {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    formatTimerDisplay(timerElapsed, timerStartTime, timerState) {
        const currentTimerTime = timerElapsed + (timerState === 'running' && timerStartTime ? Date.now() - timerStartTime : 0);
        const totalSeconds = Math.floor(currentTimerTime / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    generateTimerControls(entry) {
        const completed = entry.completed || false;
        const checkIcon = completed ? '✓' : '○';
        const checkClass = completed ? 'completed-check' : 'incomplete-check';
        
        let timerButtons = '';
        if (entry.timerState === 'stopped') {
            timerButtons = `<button class="btn btn-success btn-sm" onclick="tracker.startEntryTimer(${entry.id})">Start Timer</button>`;
        } else {
            const timerDisplay = this.formatTimerDisplay(entry.timerElapsed, entry.timerStartTime, entry.timerState);
            const pausedText = entry.timerState === 'paused' ? ' (Paused)' : '';
            
            if (entry.timerState === 'running') {
                timerButtons = `
                    <div class="entry-timer-display">Timer: ${timerDisplay}</div>
                    <button class="btn btn-warning btn-sm" onclick="tracker.pauseEntryTimer(${entry.id})">Pause</button>
                    <button class="btn btn-secondary btn-sm" onclick="tracker.stopEntryTimer(${entry.id})">Stop</button>
                `;
            } else {
                timerButtons = `
                    <div class="entry-timer-display">Timer: ${timerDisplay}${pausedText}</div>
                    <button class="btn btn-success btn-sm" onclick="tracker.resumeEntryTimer(${entry.id})">Resume</button>
                    <button class="btn btn-secondary btn-sm" onclick="tracker.stopEntryTimer(${entry.id})">Stop</button>
                `;
            }
        }
        
        return `
            <button class="btn btn-completion ${checkClass}" onclick="tracker.toggleCompletion(${entry.id})" title="${completed ? 'Mark as incomplete' : 'Mark as completed'}">
                ${checkIcon}
            </button>
            ${timerButtons}
        `;
    }

    toggleCompletion(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;
        
        entry.completed = !entry.completed;
        this.saveEntries();
        this.updateDisplay();
    }

    deleteEntry(id) {
        if (confirm('Are you sure you want to delete this entry?')) {
            // Stop timer if running
            const entry = this.entries.find(e => e.id === id);
            if (entry && entry.timerState === 'running') {
                this.stopEntryTimer(id);
            }
            
            // If this is the stopwatch entry, reset stopwatch
            if (id === this.stopwatchEntryId) {
                this.resetStopwatch();
            }
            
            this.entries = this.entries.filter(entry => entry.id !== id);
            this.saveEntries();
            this.updateDisplay();
        }
    }

    // ========== Entry Timer Functions ==========
    
    startEntryTimer(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        // Record the actual start time (HH:MM:SS format)
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        entry.timerActualStartTime = `${hours}:${minutes}:${seconds}`;
        
        entry.timerState = 'running';
        entry.timerStartTime = Date.now();
        this.saveEntries();
        this.updateDisplay();
    }

    pauseEntryTimer(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry || entry.timerState !== 'running') return;

        // Add elapsed time from current session
        if (entry.timerStartTime) {
            entry.timerElapsed += Date.now() - entry.timerStartTime;
            entry.timerStartTime = null;
        }
        
        // Duration should always be calculated from time periods only (Option A)
        if (entry.timePeriods && entry.timePeriods.length > 0) {
            entry.duration = this.calculateDurationFromPeriods(entry.timePeriods);
        }
        
        entry.timerState = 'paused';
        this.saveEntries();
        this.updateDisplay();
    }

    resumeEntryTimer(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry || entry.timerState !== 'paused') return;

        // If we don't have an actual start time (e.g., timer was paused before first stop),
        // record the resume time as the start time
        if (!entry.timerActualStartTime) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            entry.timerActualStartTime = `${hours}:${minutes}:${seconds}`;
        }

        entry.timerState = 'running';
        entry.timerStartTime = Date.now();
        this.saveEntries();
        this.updateDisplay();
    }

    stopEntryTimer(id) {
        const entry = this.entries.find(e => e.id === id);
        if (!entry) return;

        // Add elapsed time from current session if running
        if (entry.timerState === 'running' && entry.timerStartTime) {
            entry.timerElapsed += Date.now() - entry.timerStartTime;
        }

        // Create or update time period with actual start and stop times (including seconds)
        if (entry.timerActualStartTime) {
            const now = new Date();
            const endHours = String(now.getHours()).padStart(2, '0');
            const endMinutes = String(now.getMinutes()).padStart(2, '0');
            const endSeconds = String(now.getSeconds()).padStart(2, '0');
            
            // Start time should already have seconds from startEntryTimer
            // But handle backward compatibility if it doesn't
            let startTime = entry.timerActualStartTime;
            if (startTime && startTime.split(':').length === 2) {
                // Add seconds if not present (backward compatibility)
                // Calculate the actual start time based on when timer started
                const timerStartTimestamp = entry.timerStartTime || Date.now();
                const elapsedMs = entry.timerElapsed;
                const actualStartTimestamp = timerStartTimestamp - elapsedMs;
                const startDate = new Date(actualStartTimestamp);
                const startSecs = String(startDate.getSeconds()).padStart(2, '0');
                startTime = `${startTime}:${startSecs}`;
            }
            
            const endTime = `${endHours}:${endMinutes}:${endSeconds}`;
            
            // Ensure entry has timePeriods array
            if (!entry.timePeriods) {
                entry.timePeriods = [];
            }
            
            // Add new time period with actual start and stop times
            entry.timePeriods.push({
                startTime: startTime,
                endTime: endTime
            });
            
            // Clear the actual start time and reset timer elapsed (time is now in time period)
            entry.timerActualStartTime = null;
            entry.timerElapsed = 0;
        }
        
        // Duration should always be calculated from time periods only (Option A)
        // Recalculate after adding the new time period
        if (entry.timePeriods && entry.timePeriods.length > 0) {
            entry.duration = this.calculateDurationFromPeriods(entry.timePeriods);
        }
        
        entry.timerState = 'stopped';
        entry.timerStartTime = null;

        this.saveEntries();
        this.updateDisplay();
    }

    updateActiveTimers() {
        this.entries.forEach(entry => {
            if (entry.timerState === 'running' || entry.timerState === 'paused') {
                const entryElement = document.getElementById(`entry-${entry.id}`);
                if (!entryElement) return;
                
                const formattedTimerTime = this.formatTimerDisplay(entry.timerElapsed, entry.timerStartTime, entry.timerState);
                const pausedText = entry.timerState === 'paused' ? ' (Paused)' : '';
                
                const timerDisplay = entryElement.querySelector('.entry-timer-display');
                if (timerDisplay) {
                    timerDisplay.textContent = `Timer: ${formattedTimerTime}${pausedText}`;
                }
                
                // Duration should always be calculated from time periods only (not including timer time)
                const duration = entry.timePeriods ? this.calculateDurationFromPeriods(entry.timePeriods) : entry.duration;
                const formattedDuration = this.formatDurationAsTimer(duration);
                const durationDisplay = entryElement.querySelector(`#duration-${entry.id}`);
                if (durationDisplay) {
                    durationDisplay.textContent = `Duration: ${formattedDuration}`;
                }
            }
        });
    }

    filterEntries(date) {
        const today = this.getTodayDateString();
        
        if (!date) {
            // Show all previous entries (exclude today)
            const previousEntries = this.entries.filter(entry => entry.date !== today);
            this.displayEntries(previousEntries);
            return;
        }

        // If filtering by today, show today's entries in the summary section
        if (date === today) {
            const todayEntries = this.entries.filter(entry => entry.date === date);
            this.displayTodayEntries(todayEntries);
            // Clear the all entries section
            document.getElementById('entries-list').innerHTML = '<p class="empty-state">Today\'s entries are shown in the "Today\'s Summary" section above.</p>';
        } else {
            // Filter previous entries
            const filtered = this.entries.filter(entry => entry.date === date && entry.date !== today);
            this.displayEntries(filtered);
        }
    }

    clearFilter() {
        document.getElementById('filter-date').value = '';
        // Show all previous entries (today's are in the summary section)
        const today = this.getTodayDateString();
        const previousEntries = this.entries.filter(entry => entry.date !== today);
        this.displayEntries(previousEntries);
    }

    filterPastWeek() {
        const today = this.getTodayDateString();
        const todayDate = this.parseLocalDate(today);
        const weekAgo = new Date(todayDate);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        // Format week ago date as YYYY-MM-DD
        const weekAgoString = this.formatDateToLocal(weekAgo);
        
        // Filter entries from the past week (excluding today, which is shown in summary)
        const pastWeekEntries = this.entries.filter(entry => {
            return entry.date !== today && entry.date >= weekAgoString;
        });
        
        this.displayEntries(pastWeekEntries);
        document.getElementById('filter-date').value = '';
    }

    toggleEntriesSection() {
        const container = document.getElementById('entries-list-container');
        const toggleButton = document.getElementById('toggle-entries');
        
        if (container.style.display === 'none') {
            container.style.display = 'block';
            toggleButton.textContent = 'Hide';
        } else {
            container.style.display = 'none';
            toggleButton.textContent = 'Show';
        }
    }

    formatDateToLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    toggleDarkMode() {
        const body = document.body;
        const isDark = body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        this.updateDarkModeIcon(isDark);
    }

    loadDarkMode() {
        const darkMode = localStorage.getItem('darkMode') === 'true';
        if (darkMode) {
            document.body.classList.add('dark-mode');
        }
        this.updateDarkModeIcon(darkMode);
    }

    updateDarkModeIcon(isDark) {
        const icon = document.getElementById('dark-mode-icon');
        icon.textContent = isDark ? '☀️' : '🌙';
    }

    updateDisplay() {
        // Separate today's entries from previous days
        const today = this.getTodayDateString();
        const todayEntries = this.entries.filter(entry => entry.date === today);
        const previousEntries = this.entries.filter(entry => entry.date !== today);
        
        // Display today's entries in the summary section
        this.displayTodayEntries(todayEntries);
        
        // Display previous days' entries in the all entries section
        this.displayEntries(previousEntries);
        
        // Update stats
        this.updateStats();
    }

    // ========== Display Functions ==========
    
    displayEntries(entries) {
        const entriesList = document.getElementById('entries-list');
        
        if (entries.length === 0) {
            entriesList.innerHTML = '<p class="empty-state">No entries found. Add your first entry above!</p>';
            return;
        }

        // Preserve entries that are currently being edited (check actual DOM, not HTML string)
        const editingEntries = new Set();
        document.querySelectorAll('.entry-item.editing').forEach(item => {
            const id = parseInt(item.id.replace('entry-', ''));
            editingEntries.add(id);
        });

        // Group entries by date (these are previous days' entries, today is excluded)
        const grouped = this.groupByDate(entries);
        
        // Sort dates in descending order (newest first)
        const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        
        let html = '';
        for (const date of sortedDates) {
            const dateEntries = grouped[date];
            // Parse date as local time to avoid timezone issues
            const dateObj = this.parseLocalDate(date);
            const formattedDate = dateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            const totalSeconds = dateEntries.reduce((sum, entry) => {
                const entrySeconds = entry.duration.totalSeconds !== undefined 
                    ? entry.duration.totalSeconds 
                    : (entry.duration.totalMinutes * 60);
                return sum + entrySeconds;
            }, 0);
            const totalHours = Math.floor(totalSeconds / 3600);
            const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
            const totalSecs = totalSeconds % 60;
            const totalFormatted = `${String(totalHours).padStart(2, '0')}:${String(totalMinutes).padStart(2, '0')}:${String(totalSecs).padStart(2, '0')}`;

            html += `
                <div class="date-group">
                    <div class="date-group-header">
                        ${formattedDate} - Total: ${totalFormatted}
                    </div>
            `;

            dateEntries.forEach(entry => {
                // Skip if this entry is currently being edited (preserve edit form)
                if (editingEntries.has(entry.id)) {
                    return;
                }
                
                const timePeriodsDisplay = this.formatTimePeriods(entry);
                const timerControls = this.generateTimerControls(entry);
                const isStopwatchEntry = entry.id === this.stopwatchEntryId;
                const stopwatchClass = isStopwatchEntry ? ' stopwatch-active' : '';
                const completedClass = entry.completed ? ' entry-completed' : '';
                const duration = entry.timePeriods ? this.calculateDurationFromPeriods(entry.timePeriods) : entry.duration;
                const durationDisplay = this.formatDurationAsTimer(duration);
                
                html += `
                    <div class="entry-item${stopwatchClass}${completedClass}" id="entry-${entry.id}">
                        <div class="entry-info">
                            ${isStopwatchEntry ? '<div class="stopwatch-badge">⏱️ Main Stopwatch</div>' : ''}
                            <div class="entry-time">${timePeriodsDisplay}</div>
                            <div class="entry-duration" id="duration-${entry.id}">Duration: ${durationDisplay}</div>
                            <div class="entry-description">${entry.description}</div>
                            ${timerControls ? `<div class="entry-timer-controls">${timerControls}</div>` : ''}
                        </div>
                        <div class="entry-actions">
                            <button class="btn btn-edit" onclick="tracker.editEntry(${entry.id})">Edit</button>
                            <button class="btn btn-danger" onclick="tracker.deleteEntry(${entry.id})">Delete</button>
                        </div>
                    </div>
                `;
            });

            html += '</div>';
        }

        entriesList.innerHTML = html;
    }

    groupByDate(entries) {
        const grouped = {};
        entries.forEach(entry => {
            if (!grouped[entry.date]) {
                grouped[entry.date] = [];
            }
            grouped[entry.date].push(entry);
        });

        // Sort entries within each date by first start time (latest first)
        Object.keys(grouped).forEach(date => {
            grouped[date].sort((a, b) => {
                const aRange = this.getEntryTimeRange(a);
                const bRange = this.getEntryTimeRange(b);
                return bRange.startTime.localeCompare(aRange.startTime);
            });
        });

        return grouped;
    }

    displayTodayEntries(entries) {
        const todayEntriesList = document.getElementById('today-entries-list');
        
        if (entries.length === 0) {
            todayEntriesList.innerHTML = '<p class="empty-state" style="margin-top: 20px; text-align: center; color: #999; font-style: italic;">No entries for today yet.</p>';
            return;
        }

        // Preserve entries that are currently being edited (check actual DOM, not HTML string)
        const editingEntries = new Set();
        document.querySelectorAll('.entry-item.editing').forEach(item => {
            const id = parseInt(item.id.replace('entry-', ''));
            editingEntries.add(id);
        });

        // Sort entries by first start time (latest first)
        const sortedEntries = [...entries].sort((a, b) => {
            const aRange = this.getEntryTimeRange(a);
            const bRange = this.getEntryTimeRange(b);
            return bRange.startTime.localeCompare(aRange.startTime);
        });
        
        let html = '';
        sortedEntries.forEach(entry => {
            // Skip if this entry is currently being edited (preserve edit form)
            if (editingEntries.has(entry.id)) {
                return;
            }
            
            const timePeriodsDisplay = this.formatTimePeriods(entry);
            const timerControls = this.generateTimerControls(entry);
            const duration = entry.timePeriods ? this.calculateDurationFromPeriods(entry.timePeriods) : entry.duration;
            const durationDisplay = this.formatDurationAsTimer(duration);
            const isStopwatchEntry = entry.id === this.stopwatchEntryId;
            const stopwatchClass = isStopwatchEntry ? ' stopwatch-active' : '';
            const completedClass = entry.completed ? ' entry-completed' : '';
            
            html += `
                <div class="entry-item${stopwatchClass}${completedClass}" id="entry-${entry.id}">
                    <div class="entry-info">
                        ${isStopwatchEntry ? '<div class="stopwatch-badge">⏱️ Main Stopwatch</div>' : ''}
                        <div class="entry-time">${timePeriodsDisplay}</div>
                        <div class="entry-duration" id="duration-${entry.id}">Duration: ${durationDisplay}</div>
                        <div class="entry-description">${entry.description}</div>
                        ${timerControls ? `<div class="entry-timer-controls">${timerControls}</div>` : ''}
                    </div>
                    <div class="entry-actions">
                        <button class="btn btn-edit" onclick="tracker.editEntry(${entry.id})">Edit</button>
                        <button class="btn btn-danger" onclick="tracker.deleteEntry(${entry.id})">Delete</button>
                    </div>
                </div>
            `;
        });

        todayEntriesList.innerHTML = html;
    }

    // ========== Data Management ==========
    
    updateStats() {
        const today = this.getTodayDateString();
        const todayEntries = this.entries.filter(entry => entry.date === today);
        const totalSeconds = todayEntries.reduce((sum, entry) => {
            const entrySeconds = entry.duration.totalSeconds !== undefined 
                ? entry.duration.totalSeconds 
                : (entry.duration.totalMinutes * 60);
            return sum + entrySeconds;
        }, 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        document.getElementById('today-total').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        document.getElementById('today-entries').textContent = todayEntries.length;
    }

    saveEntries() {
        localStorage.setItem('timeTrackerEntries', JSON.stringify(this.entries));
    }

    loadEntries() {
        const saved = localStorage.getItem('timeTrackerEntries');
        return saved ? JSON.parse(saved) : [];
    }

    // ========== Backup & Restore Functions ==========

    buildEntryKey(entry) {
        const date = entry.date || '';
        const description = entry.description || '';
        const timePeriods = Array.isArray(entry.timePeriods) ? entry.timePeriods : [];
        return JSON.stringify({
            date,
            description,
            timePeriods
        });
    }

    mergeEntries(importedEntries) {
        const existingKeys = new Set(this.entries.map(entry => this.buildEntryKey(entry)));
        let addedCount = 0;
        let skippedCount = 0;

        importedEntries.forEach(entry => {
            const key = this.buildEntryKey(entry);
            if (existingKeys.has(key)) {
                skippedCount += 1;
                return;
            }
            this.entries.push(entry);
            existingKeys.add(key);
            addedCount += 1;
        });

        return { addedCount, skippedCount };
    }

    exportData() {
        const data = {
            entries: this.entries,
            darkMode: localStorage.getItem('darkMode') === 'true',
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `time-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show success message
        this.showNotification('Data exported successfully!', 'success');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate data structure
                if (!data.entries || !Array.isArray(data.entries)) {
                    throw new Error('Invalid backup file: entries array not found');
                }

                // Confirm before importing (this will merge with current data)
                const confirmMessage = `This will merge ${data.entries.length} imported entries with your current ${this.entries.length} entries. Continue?`;
                if (!confirm(confirmMessage)) {
                    event.target.value = ''; // Reset file input
                    return;
                }

                // Merge entries (avoid duplicates)
                const { addedCount, skippedCount } = this.mergeEntries(data.entries);
                this.saveEntries();

                // Import dark mode preference if present
                if (data.darkMode !== undefined) {
                    localStorage.setItem('darkMode', data.darkMode.toString());
                    this.loadDarkMode();
                }

                // Update display
                this.updateDisplay();

                // Show success message
                this.showNotification(`Imported ${addedCount} entries (${skippedCount} duplicates skipped).`, 'success');

                // Reset file input
                event.target.value = '';
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification(`Import failed: ${error.message}`, 'error');
                event.target.value = ''; // Reset file input
            }
        };

        reader.onerror = () => {
            this.showNotification('Error reading file', 'error');
            event.target.value = ''; // Reset file input
        };

        reader.readAsText(file);
    }

    // ========== PTO (Vacation/Sick/Personal) ==========

    loadPtoEntries() {
        const saved = localStorage.getItem('timeTrackerPto');
        const parsed = saved ? JSON.parse(saved) : { entries: [] };
        if (!parsed.entries || !Array.isArray(parsed.entries)) {
            return { entries: [] };
        }
        return parsed;
    }

    savePtoEntries(ptoData) {
        localStorage.setItem('timeTrackerPto', JSON.stringify(ptoData));
    }

    addOrUpdatePtoEntry(date, type) {
        if (!date || !type) {
            this.showNotification('Please select a date and type.', 'error');
            return;
        }

        const ptoData = this.loadPtoEntries();
        const existingIndex = ptoData.entries.findIndex(entry => entry.date === date);
        const entry = {
            id: existingIndex >= 0 ? ptoData.entries[existingIndex].id : Date.now(),
            date,
            type,
            notes: '',
            createdAt: existingIndex >= 0 ? ptoData.entries[existingIndex].createdAt : new Date().toISOString()
        };

        if (existingIndex >= 0) {
            const confirmMessage = `There is already a PTO entry for ${date}. Replace it?`;
            if (!confirm(confirmMessage)) {
                return;
            }
            ptoData.entries[existingIndex] = entry;
        } else {
            ptoData.entries.push(entry);
        }

        this.savePtoEntries(ptoData);
        this.showNotification('PTO day saved.', 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notification if any
        const existing = document.getElementById('backup-notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.id = 'backup-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

        // Set background color based on type
        if (type === 'success') {
            notification.style.backgroundColor = '#28a745';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#dc3545';
        } else {
            notification.style.backgroundColor = '#17a2b8';
        }

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        if (!document.getElementById('backup-notification-style')) {
            style.id = 'backup-notification-style';
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize the app
const tracker = new TimeTracker();

