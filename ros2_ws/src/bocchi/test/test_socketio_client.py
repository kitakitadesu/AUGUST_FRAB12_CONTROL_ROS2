#!/usr/bin/env python3
"""
Socket.IO Test Client for bocchi robot controller

This script tests the Socket.IO implementation by connecting to the server
and sending various events to verify functionality.
"""

import socketio
import time
import json
import argparse
import sys

class SocketIOTestClient:
    def __init__(self, server_url='http://localhost:8080'):
        self.server_url = server_url
        self.sio = socketio.Client()
        self.connected = False
        self.responses = {}
        
        # Setup event handlers
        self.setup_event_handlers()
    
    def setup_event_handlers(self):
        """Setup Socket.IO event handlers"""
        
        @self.sio.event
        def connect():
            print(f"✓ Connected to Socket.IO server at {self.server_url}")
            self.connected = True
        
        @self.sio.event
        def disconnect():
            print("✗ Disconnected from Socket.IO server")
            self.connected = False
        
        @self.sio.event
        def connect_error(data):
            print(f"✗ Connection error: {data}")
            self.connected = False
        
        @self.sio.event
        def welcome(data):
            print(f"Welcome message received: {data.get('message', 'No message')}")
            print(f"  Client ID: {data.get('client_id', 'Unknown')}")
            print(f"  Server version: {data.get('version', 'Unknown')}")
            print(f"  Features: {data.get('features', [])}")
        
        @self.sio.event
        def pong(data):
            print(f"Pong received: {data}")
        
        # Response handlers
        response_events = [
            'test_connection_response',
            'status_response', 
            'keyboard_response',
            'key_down_response',
            'key_up_response',
            'send_key_response',
            'send_key_batch_response'
        ]
        
        for event in response_events:
            self.sio.on(event, self.handle_response)
    
    def handle_response(self, data):
        """Handle response events"""
        event_type = data.get('type', 'unknown')
        request_id = data.get('request_id')
        
        if request_id:
            self.responses[request_id] = data
        
        print(f"Response received - Type: {event_type}, Success: {data.get('success', False)}")
        if not data.get('success', False):
            print(f"  Error: {data.get('error', 'Unknown error')}")
    
    def connect_to_server(self):
        """Connect to the Socket.IO server"""
        try:
            print(f"Connecting to Socket.IO server at {self.server_url}...")
            self.sio.connect(self.server_url)
            
            # Wait for connection
            timeout = 10
            start_time = time.time()
            while not self.connected and (time.time() - start_time) < timeout:
                time.sleep(0.1)
            
            if not self.connected:
                print("✗ Failed to connect within timeout")
                return False
            
            return True
            
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            return False
    
    def disconnect_from_server(self):
        """Disconnect from the Socket.IO server"""
        if self.connected:
            self.sio.disconnect()
            print("Disconnected from server")
    
    def send_ping(self):
        """Send a ping event"""
        print("Sending ping...")
        self.sio.emit('ping', {'timestamp': int(time.time() * 1000)})
        time.sleep(0.5)
    
    def test_connection(self):
        """Test connection with latency measurement"""
        print("Testing connection...")
        request_id = int(time.time() * 1000)
        start_time = time.time()
        
        self.sio.emit('test_connection', {
            'timestamp': int(time.time() * 1000),
            'request_id': request_id
        })
        
        # Wait for response
        timeout = 5
        while request_id not in self.responses and (time.time() - start_time) < timeout:
            time.sleep(0.1)
        
        if request_id in self.responses:
            response = self.responses[request_id]
            latency = (time.time() - start_time) * 1000
            print(f"✓ Connection test successful - Latency: {latency:.2f}ms")
            return True
        else:
            print("✗ Connection test failed - No response")
            return False
    
    def get_status(self):
        """Get server status"""
        print("Requesting server status...")
        request_id = int(time.time() * 1000)
        start_time = time.time()
        
        self.sio.emit('get_status', {
            'timestamp': int(time.time() * 1000),
            'request_id': request_id
        })
        
        # Wait for response
        timeout = 5
        while request_id not in self.responses and (time.time() - start_time) < timeout:
            time.sleep(0.1)
        
        if request_id in self.responses:
            response = self.responses[request_id]
            print(f"✓ Server status received:")
            print(f"  Running: {response.get('server_running', 'Unknown')}")
            print(f"  Connected clients: {response.get('connected_clients', 'Unknown')}")
            print(f"  Uptime: {response.get('uptime', 'Unknown')} seconds")
            return True
        else:
            print("✗ Status request failed - No response")
            return False
    
    def send_key(self, key, key_code):
        """Send a key event"""
        print(f"Sending key: {key} (code: {key_code})")
        
        self.sio.emit('send_key', {
            'key': key,
            'key_code': key_code,
            'timestamp': int(time.time() * 1000)
        })
        time.sleep(0.2)
    
    def send_key_sequence(self, keys):
        """Send a sequence of key down/up events"""
        print(f"Sending key sequence: {keys}")
        
        for key in keys:
            key_code = ord(key.upper())
            
            # Key down
            self.sio.emit('key_down', {
                'key': key.lower(),
                'key_code': key_code,
                'timestamp': int(time.time() * 1000)
            })
            time.sleep(0.1)
            
            # Key up
            self.sio.emit('key_up', {
                'key': key.lower(),
                'timestamp': int(time.time() * 1000)
            })
            time.sleep(0.1)
    
    def run_comprehensive_test(self):
        """Run a comprehensive test suite"""
        print("=" * 60)
        print("Socket.IO Comprehensive Test Suite")
        print("=" * 60)
        
        # Connect
        if not self.connect_to_server():
            print("✗ Failed to connect to server")
            return False
        
        time.sleep(1)
        
        # Test connection
        print("\n1. Testing connection...")
        if not self.test_connection():
            print("✗ Connection test failed")
        
        time.sleep(1)
        
        # Get status
        print("\n2. Getting server status...")
        if not self.get_status():
            print("✗ Status request failed")
        
        time.sleep(1)
        
        # Send ping
        print("\n3. Sending ping...")
        self.send_ping()
        
        time.sleep(1)
        
        # Send individual keys
        print("\n4. Testing individual key sending...")
        test_keys = [('w', 87), ('a', 65), ('s', 83), ('d', 68), ('f', 70), ('l', 76)]
        for key, code in test_keys:
            self.send_key(key, code)
        
        time.sleep(1)
        
        # Send key sequence
        print("\n5. Testing key sequence...")
        self.send_key_sequence("wasd")
        
        time.sleep(1)
        
        # Test batch send
        print("\n6. Testing batch key send...")
        request_id = int(time.time() * 1000)
        self.sio.emit('send_key_batch', {
            'keys_input': 'w a s d f l',
            'timestamp': int(time.time() * 1000),
            'request_id': request_id
        })
        
        time.sleep(2)
        
        print("\n✓ Comprehensive test completed")
        
        # Disconnect
        self.disconnect_from_server()
        return True

def main():
    parser = argparse.ArgumentParser(description='Socket.IO Test Client for bocchi robot controller')
    parser.add_argument('--url', default='http://localhost:8080', 
                       help='Socket.IO server URL (default: http://localhost:8080)')
    parser.add_argument('--test', choices=['ping', 'connection', 'status', 'keys', 'comprehensive'],
                       default='comprehensive', help='Test type to run')
    parser.add_argument('--interactive', action='store_true',
                       help='Run in interactive mode')
    
    args = parser.parse_args()
    
    client = SocketIOTestClient(args.url)
    
    try:
        if args.interactive:
            print("Interactive Socket.IO Test Client")
            print("Commands: connect, disconnect, ping, test, status, key <key>, sequence <keys>, quit")
            
            while True:
                cmd = input(">> ").strip().split()
                if not cmd:
                    continue
                
                if cmd[0] == 'quit':
                    break
                elif cmd[0] == 'connect':
                    client.connect_to_server()
                elif cmd[0] == 'disconnect':
                    client.disconnect_from_server()
                elif cmd[0] == 'ping':
                    client.send_ping()
                elif cmd[0] == 'test':
                    client.test_connection()
                elif cmd[0] == 'status':
                    client.get_status()
                elif cmd[0] == 'key' and len(cmd) > 1:
                    key = cmd[1].lower()
                    client.send_key(key, ord(key.upper()))
                elif cmd[0] == 'sequence' and len(cmd) > 1:
                    keys = cmd[1]
                    client.send_key_sequence(keys)
                else:
                    print("Unknown command. Available: connect, disconnect, ping, test, status, key <key>, sequence <keys>, quit")
        
        else:
            # Run specific test
            if args.test == 'comprehensive':
                success = client.run_comprehensive_test()
            else:
                if not client.connect_to_server():
                    print("Failed to connect")
                    return 1
                
                time.sleep(1)
                
                if args.test == 'ping':
                    client.send_ping()
                elif args.test == 'connection':
                    success = client.test_connection()
                elif args.test == 'status':
                    success = client.get_status()
                elif args.test == 'keys':
                    client.send_key_sequence("wasd")
                
                client.disconnect_from_server()
        
        return 0
        
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        client.disconnect_from_server()
        return 1
    except Exception as e:
        print(f"Test failed with error: {e}")
        client.disconnect_from_server()
        return 1

if __name__ == "__main__":
    sys.exit(main())