/* ROS2 Keyboard Interface JavaScript - Socket.IO */

class SocketIOKeyboardInterface {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.keysSentCount = 0;
        this.heldKeys = new Map();
        this.pendingRequests = new Map();
        this.requestId = 0;
        
        // Socket.IO configuration
        this.currentHost = window.location.hostname || 'localhost';
        this.socketUrl = window.location.origin;
        this.reconnectDelay = 2000;
        this.maxReconnectAttempts = 15;
        this.reconnectAttempts = 0;
        this.connectionTimeout = 5000;
        
        // Status tracking
        this.serverStatus = {
            running: false,
            connectedClients: 0,
            uptime: 0,
            version: 'unknown'
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeInterface();
        // Connect Socket.IO immediately without waiting for window load
        setTimeout(() => this.connectSocket(), 100);
    }

    initializeInterface() {
        // Initialize UI elements and status display
        this.updateConnectionMode();
        this.addDebugMessage('Initializing Socket.IO keyboard interface...');
        
        // Set initial status
        this.updateStatus({
            running: false,
            connectedClients: 0,
            uptime: 0,
            version: 'connecting...'
        });
    }

    setupEventListeners() {
        // Keyboard events
        document.addEventListener('keydown', (event) => this.handleKeyDown(event));
        document.addEventListener('keyup', (event) => this.handleKeyUp(event));
        
        // Focus management
        document.addEventListener('click', () => document.body.focus());
        
        // Window events
        window.addEventListener('load', () => this.onWindowLoad());
        window.addEventListener('beforeunload', () => this.cleanup());
        
        // Page visibility for connection management
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && !this.connected) {
                this.connectSocket();
            }
        });
    }

    onWindowLoad() {
        this.addDebugMessage('Page loaded, Socket.IO already initializing...');
        
        this.addDebugMessage(`Current host: ${this.currentHost}`);
        this.addDebugMessage(`Socket.IO URL: ${this.socketUrl}`);
        
        // Start periodic status updates once connected
        this.startStatusUpdates();
        
        // If not connected yet, try connecting again
        if (!this.connected) {
            this.addDebugMessage('Page loaded but Socket.IO not connected, attempting immediate connection...');
            this.connectSocket();
        }
    }

    generateRequestId() {
        return ++this.requestId;
    }

    async sendSocketMessage(event, data, expectResponse = false) {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.connected) {
                reject(new Error('Socket.IO not connected'));
                return;
            }

            try {
                if (expectResponse) {
                    const requestId = this.generateRequestId();
                    data.request_id = requestId;
                    
                    // Store promise for response handling
                    this.pendingRequests.set(requestId, { resolve, reject });
                    
                    // Set timeout for request
                    setTimeout(() => {
                        if (this.pendingRequests.has(requestId)) {
                            this.pendingRequests.delete(requestId);
                            reject(new Error('Request timeout'));
                        }
                    }, 5000);
                }

                this.socket.emit(event, data);
                
                if (!expectResponse) {
                    resolve(true);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    async testConnection() {
        try {
            this.addDebugMessage('Testing Socket.IO connection...');
            
            const response = await this.sendSocketMessage('test_connection', {
                timestamp: Date.now()
            }, true);
            
            if (response.success) {
                this.updateStatus(true);
                this.addDebugMessage(`Connection test successful (latency: ${response.latency_ms}ms)`);
            } else {
                this.updateStatus(false, response.error);
                this.addDebugMessage(`Connection test failed: ${response.error}`);
            }
            
            return response.success;
        } catch (error) {
            this.updateStatus(false, error.message);
            this.addDebugMessage(`Connection test error: ${error.message}`);
            return false;
        }
    }

    async getStatus() {
        try {
            this.addDebugMessage('Sending status request to server...');
            const response = await this.sendSocketMessage('get_status', {
                timestamp: Date.now()
            }, true);

            this.addDebugMessage(`Status response received: ${JSON.stringify(response)}`);

            // Update status with the response data (server sends flat structure now)
            this.updateStatus({
                running: response.server_running,
                connectedClients: response.connected_clients,
                uptime: response.uptime,
                version: response.version
            });
            return response;
        } catch (error) {
            this.addDebugMessage(`Status request error: ${error.message}`);
            return null;
        }
    }

    async sendKey(key, keyCode) {
        try {
            const response = await this.sendSocketMessage('send_key', {
                key: key,
                key_code: keyCode,
                timestamp: Date.now()
            }, true);
            
            if (response.success) {
                this.keysSentCount++;
                this.updateKeysSentDisplay();
                this.addDebugMessage(`Key sent: ${key} (${keyCode})`);
            }
            
            return response;
        } catch (error) {
            this.addDebugMessage(`Send key error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async sendKeyBatch(keysInput) {
        try {
            const response = await this.sendSocketMessage('send_key_batch', {
                keys_input: keysInput,
                timestamp: Date.now()
            }, true);
            
            return response;
        } catch (error) {
            this.addDebugMessage(`Send key batch error: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        const keyCode = event.keyCode;
        
        // Prevent default for movement keys
        if (['w', 'a', 's', 'd', 'f', 'l'].includes(key)) {
            event.preventDefault();
        }
        
        this.startKeyHold(key, keyCode);
    }

    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        this.stopKeyHold(key);
    }

    normalizeKeyName(key) {
        const keyMap = {
            'arrowup': 'w',
            'arrowdown': 's',
            'arrowleft': 'a',
            'arrowright': 'd'
        };
        return keyMap[key.toLowerCase()] || key.toLowerCase();
    }

    async startKeyHold(key, keyCode) {
        const normalizedKey = this.normalizeKeyName(key);
        
        if (this.heldKeys.has(normalizedKey)) {
            return; // Key already being held
        }
        
        this.heldKeys.set(normalizedKey, true);
        
        try {
            await this.sendSocketMessage('key_down', {
                key: normalizedKey,
                key_code: keyCode,
                timestamp: Date.now()
            });
            
            this.updateKeyDisplay();
        } catch (error) {
            this.addDebugMessage(`Key down error: ${error.message}`);
        }
    }

    async stopKeyHold(key) {
        const normalizedKey = this.normalizeKeyName(key);
        
        if (!this.heldKeys.has(normalizedKey)) {
            return; // Key not being held
        }
        
        this.heldKeys.delete(normalizedKey);
        
        try {
            await this.sendSocketMessage('key_up', {
                key: normalizedKey,
                timestamp: Date.now()
            });
            
            this.updateKeyDisplay();
        } catch (error) {
            this.addDebugMessage(`Key up error: ${error.message}`);
        }
    }

    connectSocket() {
        if (this.socket && this.connected) {
            return; // Already connected
        }

        try {
            this.addDebugMessage(`Connecting to Socket.IO server at ${this.socketUrl}...`);
            
            // Ensure Socket.IO library is loaded
            if (typeof io === 'undefined') {
                this.addDebugMessage('Socket.IO library not loaded, loading now...');
                this.loadSocketIOLibrary();
                return;
            }

            this.socket = io(this.socketUrl, {
                transports: ['websocket', 'polling'],
                timeout: this.connectionTimeout,
                reconnection: true,
                reconnectionDelay: this.reconnectDelay,
                reconnectionAttempts: this.maxReconnectAttempts
            });

            // Connection event handlers
            this.socket.on('connect', () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                this.addDebugMessage(`✓ Connected to Socket.IO server (ID: ${this.socket.id})`);
                this.updateConnectionMode();
                
                // Test connection after connecting
                setTimeout(() => this.testConnection(), 100);
            });

            this.socket.on('disconnect', (reason) => {
                this.connected = false;
                this.addDebugMessage(`✗ Disconnected from Socket.IO server: ${reason}`);
                this.updateConnectionMode();
            });

            this.socket.on('connect_error', (error) => {
                this.connected = false;
                this.reconnectAttempts++;
                this.addDebugMessage(`✗ Connection error: ${error.message} (attempt ${this.reconnectAttempts})`);
                this.updateConnectionMode();
            });

            // Message event handlers
            this.socket.on('welcome', (data) => {
                this.addDebugMessage(`Welcome message: ${data.message}`);
                this.updateStatus({
                    running: true,
                    version: data.version,
                    uptime: 0
                });
            });

            this.socket.on('pong', (data) => {
                this.addDebugMessage(`Pong received: ${data.timestamp}`);
            });

            // Response handlers
            this.setupResponseHandlers();

        } catch (error) {
            this.addDebugMessage(`Socket.IO connection error: ${error.message}`);
            this.updateConnectionMode();
        }
    }

    loadSocketIOLibrary() {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.onload = () => {
            this.addDebugMessage('Socket.IO library loaded');
            this.connectSocket();
        };
        script.onerror = () => {
            this.addDebugMessage('Failed to load Socket.IO library');
        };
        document.head.appendChild(script);
    }

    setupResponseHandlers() {
        const responseEvents = [
            'test_connection_response',
            'status_response',
            'keyboard_response',
            'key_down_response',
            'key_up_response',
            'send_key_response',
            'send_key_batch_response',
            'routes_response',
            'unknown_message_response'
        ];

        responseEvents.forEach(event => {
            this.socket.on(event, (data) => {
                this.handleSocketResponse(data);
            });
        });
    }

    handleSocketResponse(data) {
        this.addDebugMessage(`[DEBUG] Received Socket.IO response: ${data.type || 'unknown'}`);
        const requestId = data.request_id;

        if (requestId && this.pendingRequests.has(requestId)) {
            this.addDebugMessage(`[DEBUG] Resolving pending request ${requestId}`);
            const { resolve } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            resolve(data);
        } else {
            this.addDebugMessage(`[DEBUG] No pending request found for response (request_id: ${requestId})`);
        }

        // Log the response
        this.addDebugMessage(`Response: ${data.type || 'unknown'} - ${data.success ? 'success' : 'error'}`);
    }

    startStatusUpdates() {
        setInterval(() => {
            if (this.connected) {
                this.getStatus();
            }
        }, 5000); // Update every 5 seconds
    }

    updateStatus(status) {
        if (typeof status === 'boolean') {
            status = { running: status };
        }
        
        Object.assign(this.serverStatus, status);
        this.updateStats();
    }

    updateStats() {
        const elements = {
            'serverStatus': this.serverStatus.running ? 'Running' : 'Stopped',
            'connectedClients': this.serverStatus.connectedClients || 0,
            'serverUptime': this.serverStatus.uptime || 0,
            'serverVersion': this.serverStatus.version || 'unknown'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateKeyDisplay() {
        const keys = Array.from(this.heldKeys.keys());
        const keysText = keys.length > 0 ? keys.join(', ') : 'None';

        // Update the main key display
        const keyDisplayElement = document.getElementById('keyDisplay');
        if (keyDisplayElement) {
            const p = keyDisplayElement.querySelector('p');
            if (p) {
                p.innerHTML = keys.length > 0 ?
                    `<strong>Held Keys: ${keysText}</strong>` :
                    '<strong>Press and hold any key...</strong>';
            }
        }

        // Update the held keys count in statistics
        const heldKeysElement = document.getElementById('keysHeld');
        if (heldKeysElement) {
            heldKeysElement.textContent = keys.length;
        }
    }

    getKeyAction(key) {
        const actions = {
            'w': 'Move Forward',
            's': 'Move Backward', 
            'a': 'Turn Left',
            'd': 'Turn Right',
            'f': 'Toggle Servo',
            'l': 'Toggle LED'
        };
        return actions[key] || 'Unknown';
    }

    updateKeysSentDisplay() {
        const element = document.getElementById('keysSent');
        if (element) {
            element.textContent = this.keysSentCount;
        }
    }

    updateConnectionMode() {
        const statusElement = document.getElementById('status-content');
        if (statusElement) {
            const status = this.connected ? 'Connected' : 'Disconnected';
            const color = this.connected ? '#008000' : '#FF0000';
            statusElement.innerHTML = `<p><strong>Status:</strong> <span style="color: ${color};">${status}</span></p>`;
        }
    }

    addDebugMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] ${message}`;

        const debugElement = document.getElementById('debugMessages');
        if (debugElement) {
            const messageDiv = document.createElement('div');
            messageDiv.textContent = formattedMessage;
            debugElement.appendChild(messageDiv);

            // Keep only last 50 messages
            while (debugElement.children.length > 50) {
                debugElement.removeChild(debugElement.firstChild);
            }

            // Scroll to bottom
            debugElement.scrollTop = debugElement.scrollHeight;
        }

        console.log(formattedMessage);
    }

    clearMessages() {
        const debugElement = document.getElementById('debugMessages');
        if (debugElement) {
            debugElement.innerHTML = '';
        }
    }

    async sendTestKeys() {
        const testKeys = ['w', 'a', 's', 'd'];
        for (const key of testKeys) {
            await this.sendKey(key, key.charCodeAt(0));
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    async toggleLED() {
        return await this.sendKey('l', 108);
    }

    cleanup() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
        }
        
        // Clear any pending requests
        this.pendingRequests.clear();
        this.heldKeys.clear();
    }

    async submitManualKeyForm(event) {
        event.preventDefault();
        const key = document.getElementById('manual-key')?.value || '';
        const keyCode = parseInt(document.getElementById('manual-key-code')?.value) || key.charCodeAt(0);
        
        const result = await this.sendKey(key, keyCode);
        this.addDebugMessage(`Manual key result: ${JSON.stringify(result)}`);
    }

    async submitBatchKeyForm(event) {
        event.preventDefault();
        const keysInput = document.getElementById('batch-keys')?.value || '';
        
        const result = await this.sendKeyBatch(keysInput);
        this.addDebugMessage(`Batch keys result: ${JSON.stringify(result)}`);
    }
}

// Make class globally available
window.SocketIOKeyboardInterface = SocketIOKeyboardInterface;