// Global State Management
const AppState = {
  sessions: new Map(),
  currentUser: null,
  currentSession: null,
  eventListeners: [],
  socketId: null
};

// Initialize
function init() {
  AppState.socketId = generateSocketId();
  loadState();
  setupRouter();
  startPolling();
}

// State Persistence
function saveState() {
  const data = {
    sessions: Array.from(AppState.sessions.entries()),
    timestamp: Date.now()
  };
  try {
    // Use in-memory storage only
    window.appStateBackup = data;
  } catch (e) {
    console.warn('State save failed:', e);
  }
}

function loadState() {
  try {
    const data = window.appStateBackup;
    if (data && data.sessions) {
      AppState.sessions = new Map(data.sessions);
      // Clean up expired sessions
      cleanupSessions();
    }
  } catch (e) {
    console.warn('State load failed:', e);
  }
}

function cleanupSessions() {
  const now = Date.now();
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  
  for (const [id, session] of AppState.sessions.entries()) {
    if (now - session.createdAt > TWO_HOURS && !session.isActive) {
      AppState.sessions.delete(id);
    }
  }
  saveState();
}

// Utility Functions
function generateSocketId() {
  return 'socket_' + Math.random().toString(36).substring(2, 15) + Date.now();
}

function generateSessionCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 10).toUpperCase();
  } while (AppState.sessions.has(code));
  return code;
}

function generateId(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).substring(2, 15) + Date.now();
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function generateBottleColor() {
  const hue = Math.random() * 360;
  return `hsl(${hue}, 60%, 70%)`;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Session Management
function createSession(config) {
  const id = generateSessionCode();
  const session = {
    id,
    mode: config.mode,
    question: config.question || null,
    optionA: config.optionA || null,
    optionB: config.optionB || null,
    timeout: config.timeout,
    createdAt: Date.now(),
    isActive: true,
    participants: new Set(),
    messages: [],
    autoCloseTimer: null
  };
  
  AppState.sessions.set(id, session);
  saveState();
  return session;
}

function getSession(id) {
  return AppState.sessions.get(id);
}

function addMessage(sessionId, message) {
  const session = getSession(sessionId);
  if (!session) return false;
  
  if (session.messages.length >= 100) {
    return false;
  }
  
  const messageObj = {
    id: generateId('msg'),
    participantId: AppState.socketId,
    studentName: message.studentName || null,
    isAnonymous: message.isAnonymous,
    selectedOption: message.selectedOption || null,
    messageText: message.messageText,
    wordCount: countWords(message.messageText),
    timestamp: Date.now(),
    isRead: false,
    bottlePosition: generateBottlePosition(session.messages.length),
    bottleColor: generateBottleColor()
  };
  
  session.messages.push(messageObj);
  session.participants.add(AppState.socketId);
  saveState();
  emitEvent('messageAdded', { sessionId, message: messageObj });
  return true;
}

function generateBottlePosition(index) {
  const angle = (index * 137.5) * Math.PI / 180; // Golden angle
  const radius = Math.sqrt(index + 1) * 5;
  return {
    x: Math.cos(angle) * radius,
    y: 0,
    z: Math.sin(angle) * radius
  };
}

function closeSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.isActive = false;
    if (session.autoCloseTimer) {
      clearTimeout(session.autoCloseTimer);
    }
    saveState();
    emitEvent('sessionClosed', { sessionId });
  }
}

// Event System
function emitEvent(eventName, data) {
  const event = new CustomEvent(eventName, { detail: data });
  window.dispatchEvent(event);
}

function onEvent(eventName, callback) {
  window.addEventListener(eventName, (e) => callback(e.detail));
}

// Polling for updates (simulate real-time)
function startPolling() {
  setInterval(() => {
    // Emit periodic update event
    emitEvent('stateUpdate', {});
  }, 500);
}

// Router
function setupRouter() {
  function handleRoute() {
    const hash = window.location.hash || '#/';
    const [path, ...params] = hash.substring(2).split('/');
    
    switch (path) {
      case '':
        renderLanding();
        break;
      case 'teacher':
        if (params[0] === 'dashboard') {
          renderTeacherDashboard();
        } else if (params[0] === 'create') {
          renderCreateSession();
        } else if (params[0] === 'monitor') {
          renderMonitor(params[1]);
        } else if (params[0] === 'review') {
          renderReview(params[1]);
        }
        break;
      case 'join':
        if (params[0]) {
          renderStudentLanding(params[0]);
        } else {
          renderStudentJoin();
        }
        break;
      case 'student':
        if (params[0] === 'compose') {
          renderComposer(params[1]);
        } else if (params[0] === 'submitted') {
          renderSubmitted(params[1]);
        }
        break;
      default:
        renderLanding();
    }
  }
  
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

// View Renderers
function renderLanding() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="landing">
      <h1>🏖️ Message in a Bottle</h1>
      <p>A collaborative learning experience where ideas float freely</p>
      <div class="landing-buttons">
        <button class="btn btn-primary btn-large" onclick="location.hash='#/teacher/dashboard'">👨‍🏫 I'm a Teacher</button>
        <button class="btn btn-secondary btn-large" onclick="location.hash='#/join'">🎓 I'm a Student</button>
      </div>
    </div>
  `;
}

function renderTeacherDashboard() {
  const sessions = Array.from(AppState.sessions.values());
  const activeSessions = sessions.filter(s => s.isActive);
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>📊 Teacher Dashboard</h1>
    </div>
    <div class="container dashboard">
      <h2>Your Sessions</h2>
      <div class="session-grid">
        <div class="card" onclick="location.hash='#/teacher/create'" style="cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 200px; border: 2px dashed var(--primary);">
          <div style="text-align: center;">
            <div style="font-size: 48px; margin-bottom: 16px;">➕</div>
            <h3>Create New Session</h3>
          </div>
        </div>
        ${activeSessions.map(session => `
          <div class="card session-card" onclick="location.hash='#/teacher/monitor/${session.id}'">
            <div class="session-info">
              <h3>${session.mode === 'free' ? '✍️ Free Mind' : '❓ A/B Question'}</h3>
              <p>${session.question || 'Open thoughts and ideas'}</p>
            </div>
            <div class="session-code">${session.id}</div>
            <div class="session-info">
              <p>👥 ${session.participants.size} participants</p>
              <p>💬 ${session.messages.length} messages</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderCreateSession() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>✨ Create New Session</h1>
    </div>
    <div class="container create-session">
      <div class="card">
        <form id="create-form" onsubmit="handleCreateSession(event)">
          <div class="form-group">
            <label>Session Mode</label>
            <div class="radio-group">
              <label class="radio-option">
                <input type="radio" name="mode" value="free" checked onchange="toggleQuestionFields()">
                <span>✍️ Free Mind Mode</span>
              </label>
              <label class="radio-option">
                <input type="radio" name="mode" value="question" onchange="toggleQuestionFields()">
                <span>❓ A/B Question Mode</span>
              </label>
            </div>
          </div>
          
          <div id="question-fields" style="display: none;">
            <div class="form-group">
              <label>Your Question</label>
              <input type="text" class="form-control" id="question" placeholder="What would you like to ask?">
            </div>
            <div class="form-group">
              <label>Option A</label>
              <input type="text" class="form-control" id="optionA" placeholder="First option">
            </div>
            <div class="form-group">
              <label>Option B</label>
              <input type="text" class="form-control" id="optionB" placeholder="Second option">
            </div>
          </div>
          
          <div class="form-group">
            <label>Session Timeout (minutes)</label>
            <input type="number" class="form-control" id="timeout" min="1" max="10" value="2">
          </div>
          
          <div style="display: flex; gap: 16px;">
            <button type="submit" class="btn btn-primary btn-full">🚀 Create Session</button>
            <button type="button" class="btn btn-secondary" onclick="location.hash='#/teacher/dashboard'">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function toggleQuestionFields() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const fields = document.getElementById('question-fields');
  fields.style.display = mode === 'question' ? 'block' : 'none';
}

function handleCreateSession(event) {
  event.preventDefault();
  
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const timeout = parseInt(document.getElementById('timeout').value) * 60;
  
  const config = {
    mode,
    timeout
  };
  
  if (mode === 'question') {
    config.question = document.getElementById('question').value;
    config.optionA = document.getElementById('optionA').value;
    config.optionB = document.getElementById('optionB').value;
    
    if (!config.question || !config.optionA || !config.optionB) {
      showToast('Please fill in all question fields', 'error');
      return;
    }
  }
  
  const session = createSession(config);
  showToast('Session created successfully!', 'success');
  location.hash = `#/teacher/monitor/${session.id}`;
}

function renderMonitor(sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    showToast('Session not found', 'error');
    location.hash = '#/teacher/dashboard';
    return;
  }
  
  const app = document.getElementById('app');
  const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${sessionId}`;
  
  app.innerHTML = `
    <div class="header">
      <h1>📡 Event Monitor</h1>
    </div>
    <div class="container monitor">
      <div class="monitor-header">
        <div>
          <div class="qr-container">
            <h3 style="margin-bottom: 16px;">Scan to Join</h3>
            <div id="qr-code"></div>
            <div class="session-code">${session.id}</div>
          </div>
        </div>
        <div class="monitor-info">
          <div class="info-item">
            <div class="info-label">Participants</div>
            <div class="info-value" id="participant-count">${session.participants.size}/100</div>
          </div>
          <div class="info-item">
            <div class="info-label">Messages</div>
            <div class="info-value" id="message-count">${session.messages.length}/100</div>
          </div>
          <div class="info-item">
            <div class="info-label">Time Remaining</div>
            <div class="timer-display" id="timer">--:--</div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">🌊 Ocean View</h3>
        <div class="ocean-container">
          <canvas id="ocean-canvas"></canvas>
        </div>
        <div style="margin-top: 16px; display: flex; gap: 16px; justify-content: center;">
          <button class="btn btn-danger" onclick="handleForceClose('${sessionId}')">⛔ Force Close Session</button>
        </div>
      </div>
    </div>
  `;
  
  // Generate QR Code
  setTimeout(() => {
    new QRCode(document.getElementById('qr-code'), {
      text: joinUrl,
      width: 300,
      height: 300
    });
  }, 100);
  
  // Initialize ocean scene
  setTimeout(() => {
    initOceanScene('ocean-canvas', session.messages, false);
  }, 200);
  
  // Start timer
  startSessionTimer(sessionId);
  
  // Listen for updates
  const updateListener = () => {
    const currentSession = getSession(sessionId);
    if (currentSession) {
      document.getElementById('participant-count').textContent = `${currentSession.participants.size}/100`;
      document.getElementById('message-count').textContent = `${currentSession.messages.length}/100`;
      
      // Update ocean scene
      updateOceanBottles(currentSession.messages);
    }
  };
  
  onEvent('messageAdded', updateListener);
  onEvent('stateUpdate', updateListener);
}

function startSessionTimer(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.isActive) return;
  
  const endTime = session.createdAt + (session.timeout * 1000);
  
  function updateTimer() {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
    
    const timerEl = document.getElementById('timer');
    if (timerEl) {
      timerEl.textContent = formatTime(remaining);
      
      if (remaining <= 30) {
        timerEl.className = 'timer-display timer-danger';
      } else if (remaining <= 60) {
        timerEl.className = 'timer-display timer-warning';
      }
    }
    
    if (remaining <= 0) {
      handleAutoClose(sessionId);
      return;
    }
    
    setTimeout(updateTimer, 1000);
  }
  
  updateTimer();
}

function handleForceClose(sessionId) {
  if (confirm('Are you sure you want to close this session?')) {
    closeSession(sessionId);
    showToast('Session closed', 'success');
    location.hash = `#/teacher/review/${sessionId}`;
  }
}

function handleAutoClose(sessionId) {
  closeSession(sessionId);
  showToast('Session timeout - moving to review mode', 'info');
  location.hash = `#/teacher/review/${sessionId}`;
}

function renderReview(sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    showToast('Session not found', 'error');
    location.hash = '#/teacher/dashboard';
    return;
  }
  
  const unreadMessages = session.messages.filter(m => !m.isRead);
  const readMessages = session.messages.filter(m => m.isRead);
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>📖 Review Messages</h1>
    </div>
    <div class="container monitor">
      <div class="card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <h3>Session: ${session.id}</h3>
            <p>Click bottles in the ocean to read messages</p>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: bold; color: var(--primary);">
              ${readMessages.length} / ${session.messages.length} Read
            </div>
            <div class="progress-bar" style="width: 200px;">
              <div class="progress-fill" style="width: ${(readMessages.length / session.messages.length * 100) || 0}%"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="ocean-container" style="height: 600px;">
          <canvas id="ocean-canvas"></canvas>
        </div>
        <div style="margin-top: 16px; display: flex; gap: 16px; justify-content: center;">
          <button class="btn btn-secondary" onclick="location.hash='#/teacher/dashboard'">🏠 Back to Dashboard</button>
          <button class="btn btn-primary" onclick="exportMessages('${sessionId}')">📥 Export CSV</button>
        </div>
      </div>
    </div>
  `;
  
  // Initialize ocean scene with click handling
  setTimeout(() => {
    initOceanScene('ocean-canvas', session.messages, true, (message) => {
      showMessageModal(sessionId, message);
    });
  }, 200);
}

function showMessageModal(sessionId, message) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>💌 Message</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="message-detail">
          <div class="message-meta">
            <div class="meta-item">
              <div class="meta-label">From</div>
              <div class="meta-value">${message.isAnonymous ? '🎭 Anonymous' : message.studentName || 'Unknown'}</div>
            </div>
            ${message.selectedOption ? `
              <div class="meta-item">
                <div class="meta-label">Selected</div>
                <div class="meta-value">Option ${message.selectedOption}</div>
              </div>
            ` : ''}
            <div class="meta-item">
              <div class="meta-label">Words</div>
              <div class="meta-value">${message.wordCount}</div>
            </div>
            <div class="meta-item">
              <div class="meta-label">Time</div>
              <div class="meta-value">${new Date(message.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
          <div class="message-text">${message.messageText}</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="markAsRead('${sessionId}', '${message.id}')">✅ Mark as Read</button>
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function markAsRead(sessionId, messageId) {
  const session = getSession(sessionId);
  if (session) {
    const message = session.messages.find(m => m.id === messageId);
    if (message) {
      message.isRead = true;
      saveState();
      
      // Remove modal
      document.querySelector('.modal-overlay')?.remove();
      
      // Update ocean scene to remove bottle
      removeBottle(messageId);
      
      // Refresh review page
      setTimeout(() => {
        renderReview(sessionId);
      }, 500);
    }
  }
}

function exportMessages(sessionId) {
  const session = getSession(sessionId);
  if (!session || session.messages.length === 0) {
    showToast('No messages to export', 'warning');
    return;
  }
  
  let csv = 'Timestamp,Name,Anonymous,Option,Message,Word Count\n';
  
  session.messages.forEach(msg => {
    const timestamp = new Date(msg.timestamp).toISOString();
    const name = msg.isAnonymous ? 'Anonymous' : (msg.studentName || 'Unknown');
    const anonymous = msg.isAnonymous ? 'Yes' : 'No';
    const option = msg.selectedOption || 'N/A';
    const message = '"' + msg.messageText.replace(/"/g, '""') + '"';
    const wordCount = msg.wordCount;
    
    csv += `${timestamp},${name},${anonymous},${option},${message},${wordCount}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-${sessionId}-messages.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('Messages exported successfully', 'success');
}

// Student Views
function renderStudentJoin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>🎓 Join Session</h1>
    </div>
    <div class="container student-join">
      <div class="card">
        <h2 style="text-align: center; margin-bottom: 24px;">Enter Session Code</h2>
        <form onsubmit="handleJoinSession(event)">
          <div class="form-group">
            <input type="text" class="form-control code-input" id="session-code" placeholder="ABC12345" maxlength="8" required>
          </div>
          <button type="submit" class="btn btn-primary btn-full btn-large">Join Session</button>
        </form>
      </div>
    </div>
  `;
}

function handleJoinSession(event) {
  event.preventDefault();
  const code = document.getElementById('session-code').value.toUpperCase();
  location.hash = `#/join/${code}`;
}

function renderStudentLanding(sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    showToast('Session not found', 'error');
    location.hash = '#/join';
    return;
  }
  
  if (!session.isActive) {
    showToast('This session has ended', 'warning');
    location.hash = '#/join';
    return;
  }
  
  if (session.participants.size >= 100) {
    showToast('Session is full (100/100)', 'error');
    location.hash = '#/join';
    return;
  }
  
  // Check if already submitted
  const hasSubmitted = session.messages.some(m => m.participantId === AppState.socketId);
  if (hasSubmitted) {
    location.hash = `#/student/submitted/${sessionId}`;
    return;
  }
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>✨ Welcome!</h1>
    </div>
    <div class="container student-join">
      <div class="card">
        <div style="text-align: center;">
          <div class="mode-badge ${session.mode === 'free' ? 'mode-free' : 'mode-question'}">
            ${session.mode === 'free' ? '✍️ Free Mind Mode' : '❓ A/B Question Mode'}
          </div>
          <h2 style="margin: 24px 0;">${session.question || 'Share Your Thoughts'}</h2>
          <p style="font-size: 18px; opacity: 0.7; margin-bottom: 32px;">
            👥 ${session.participants.size} students already participating
          </p>
          <button class="btn btn-primary btn-large btn-full" onclick="location.hash='#/student/compose/${sessionId}'">🚀 Start Writing</button>
        </div>
      </div>
    </div>
  `;
}

function renderComposer(sessionId) {
  const session = getSession(sessionId);
  if (!session || !session.isActive) {
    showToast('Session not available', 'error');
    location.hash = '#/join';
    return;
  }
  
  const hasSubmitted = session.messages.some(m => m.participantId === AppState.socketId);
  if (hasSubmitted) {
    location.hash = `#/student/submitted/${sessionId}`;
    return;
  }
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>✍️ Compose Message</h1>
    </div>
    <div class="container composer">
      <div class="card">
        <div class="composer-header">
          <div class="mode-badge ${session.mode === 'free' ? 'mode-free' : 'mode-question'}">
            ${session.mode === 'free' ? '✍️ Free Mind Mode' : '❓ A/B Question'}
          </div>
        </div>
        
        ${session.mode === 'question' ? `
          <div class="question-box">
            <h3>${session.question}</h3>
            <div class="options" id="options">
              <div class="option-card" onclick="selectOption('A')" id="option-A">
                <h4>Option A</h4>
                <p>${session.optionA}</p>
              </div>
              <div class="option-card" onclick="selectOption('B')" id="option-B">
                <h4>Option B</h4>
                <p>${session.optionB}</p>
              </div>
            </div>
          </div>
        ` : ''}
        
        <form id="message-form" onsubmit="handleSubmitMessage(event, '${sessionId}')">
          <div class="form-group">
            <label>Your Message (max 100 words)</label>
            <div class="message-input">
              <textarea class="textarea form-control" id="message-text" placeholder="Share your thoughts..." oninput="updateWordCount()"></textarea>
            </div>
            <div class="word-counter valid" id="word-counter">0 / 100 words</div>
          </div>
          
          <div class="emoji-section">
            <button type="button" class="btn btn-secondary" onclick="toggleEmojiPicker()">😊 Add Emoji</button>
            <div class="emoji-picker" id="emoji-picker" style="display: none;">
              <div class="emoji-grid" id="emoji-grid"></div>
            </div>
          </div>
          
          <div class="form-group">
            <label>Your Name (optional)</label>
            <input type="text" class="form-control" id="student-name" placeholder="Enter your name">
            <div class="checkbox-group">
              <input type="checkbox" id="anonymous" onchange="toggleNameField()">
              <label for="anonymous">Submit anonymously</label>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary btn-large btn-full" id="submit-btn">🚀 Send Message</button>
        </form>
      </div>
    </div>
  `;
  
  // Initialize emoji picker
  initEmojiPicker();
  
  // Store selected option
  window.selectedOption = null;
}

function selectOption(option) {
  window.selectedOption = option;
  document.querySelectorAll('.option-card').forEach(card => {
    card.classList.remove('selected');
  });
  document.getElementById(`option-${option}`).classList.add('selected');
}

function updateWordCount() {
  const textarea = document.getElementById('message-text');
  const counter = document.getElementById('word-counter');
  const submitBtn = document.getElementById('submit-btn');
  
  const text = textarea.value;
  const wordCount = countWords(text);
  
  counter.textContent = `${wordCount} / 100 words`;
  
  if (wordCount > 100) {
    counter.className = 'word-counter invalid';
    submitBtn.disabled = true;
  } else if (wordCount > 0) {
    counter.className = 'word-counter valid';
    submitBtn.disabled = false;
  } else {
    counter.className = 'word-counter valid';
    submitBtn.disabled = false;
  }
}

function toggleNameField() {
  const checkbox = document.getElementById('anonymous');
  const nameField = document.getElementById('student-name');
  nameField.disabled = checkbox.checked;
  if (checkbox.checked) {
    nameField.value = '';
  }
}

function initEmojiPicker() {
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
    '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👏', '🙌', '👐',
    '⭐', '✨', '💫', '🌟', '⚡', '💥', '💯', '✅', '❌', '❓', '❗',
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯', '🎪'
  ];
  
  const grid = document.getElementById('emoji-grid');
  emojis.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-item';
    item.textContent = emoji;
    item.onclick = () => insertEmoji(emoji);
    grid.appendChild(item);
  });
}

function toggleEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

function insertEmoji(emoji) {
  const textarea = document.getElementById('message-text');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  textarea.value = text.substring(0, start) + emoji + text.substring(end);
  textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
  textarea.focus();
  
  updateWordCount();
  toggleEmojiPicker();
}

function handleSubmitMessage(event, sessionId) {
  event.preventDefault();
  
  const session = getSession(sessionId);
  const messageText = document.getElementById('message-text').value.trim();
  const studentName = document.getElementById('student-name').value.trim();
  const isAnonymous = document.getElementById('anonymous').checked;
  
  if (!messageText) {
    showToast('Please write a message', 'error');
    return;
  }
  
  const wordCount = countWords(messageText);
  if (wordCount > 100) {
    showToast('Message exceeds 100 words', 'error');
    return;
  }
  
  if (session.mode === 'question' && !window.selectedOption) {
    showToast('Please select an option (A or B)', 'error');
    return;
  }
  
  const message = {
    messageText,
    studentName: isAnonymous ? null : studentName,
    isAnonymous,
    selectedOption: window.selectedOption || null
  };
  
  const success = addMessage(sessionId, message);
  
  if (success) {
    showToast('Message sent! 🎉', 'success');
    location.hash = `#/student/submitted/${sessionId}`;
  } else {
    showToast('Failed to send message', 'error');
  }
}

function renderSubmitted(sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    showToast('Session not found', 'error');
    location.hash = '#/join';
    return;
  }
  
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="header">
      <h1>✅ Message Sent!</h1>
    </div>
    <div class="container monitor">
      <div class="card" style="text-align: center; margin-bottom: 24px;">
        <h2>🎉 Your message is floating in the ocean!</h2>
        <p style="font-size: 18px; opacity: 0.7; margin: 16px 0;">
          Watch as more bottles appear when other students submit their messages.
        </p>
        <p style="font-size: 16px; color: var(--primary); font-weight: 600;">
          💬 ${session.messages.length} messages collected so far
        </p>
      </div>
      
      <div class="card">
        <h3 style="margin-bottom: 16px;">🌊 Ocean View</h3>
        <div class="ocean-container" style="height: 500px;">
          <canvas id="ocean-canvas"></canvas>
        </div>
      </div>
    </div>
  `;
  
  // Initialize ocean scene
  setTimeout(() => {
    initOceanScene('ocean-canvas', session.messages, false);
  }, 200);
  
  // Listen for session close
  onEvent('sessionClosed', (data) => {
    if (data.sessionId === sessionId) {
      showToast('Session has ended. Thank you for participating!', 'info');
    }
  });
}

// Initialize app
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}