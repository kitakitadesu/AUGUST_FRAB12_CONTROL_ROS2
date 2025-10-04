# ROS2 Publishers

## MinimalPublisher

This node publishes to two topics for robot control:

### Movement Control

**Topic:** `/cmd_vel`
**Datatype:** `geometry_msgs/Twist`
**Publishing Rate:** 20 Hz (0.05s timer)
**Key Mappings:**
- `W`: Move Forward (`linear.x = 0.5`)
- `S`: Move Backward (`linear.x = -0.5`)
- `A`: Turn Left (`angular.z = 0.5`)
- `D`: Turn Right (`angular.z = -0.5`)
- Other keys: Stop (`linear.x = 0.0, angular.z = 0.0`)

**Data Explanation:**
- `linear.x`: Forward/backward velocity (0.5 for forward, -0.5 for backward, 0.0 for stop)
- `angular.z`: Rotational velocity (0.5 for left turn, -0.5 for right turn, 0.0 for straight)
- Other fields (linear.y, linear.z, angular.x, angular.y) are always 0.0

### Servo Control

**Topic:** `/servo_position`
**Datatype:** `std_msgs/Int32`
**Publishing Rate:** On key press event
**Key Mappings:**
- `F`: Toggle servo position between 0° and 180°

**Data Explanation:**
- `data`: Servo angle in degrees (0 or 180)
- Toggle behavior: 0° → 180° → 0° → 180° ...

## Usage

1. Start the publisher: `ros2 run bocchi publisher`
2. Open web interface: `http://localhost:5000`
3. Press WASD keys for movement, F key for servo control
4. Monitor topics:
   - `ros2 topic echo /cmd_vel`
   - `ros2 topic echo /servo_position`

## Socket.IO Keyboard Control

The system now supports real-time keyboard control via Socket.IO for improved responsiveness:

### Features
- **Real-time control**: Lower latency than REST API with automatic reconnection
- **Automatic fallback**: Falls back to REST API if Socket.IO unavailable  
- **Connection status**: Visual indicator shows current input mode
- **Simultaneous keys**: Support for multiple key combinations
- **Debouncing**: Prevents duplicate commands from rapid key presses

### Socket.IO Endpoints
- **Socket.IO Server**: `http://localhost:8080` (or `http://<your-ip>:8080`)
- **Event Types**:
  - `key_down`: Key press event
  - `key_up`: Key release event
  - `keyboard`: Legacy key event with held state
  - `get_status`: Request server status
  - `test_connection`: Test connection latency

### Event Format
```javascript
// Event: 'key_down'
// Data:
{
  "key": "w",
  "key_code": 87,
  "timestamp": 1640995200000
}
```

### Testing Socket.IO Control
Use the web interface directly or connect using Socket.IO client libraries:
```bash
# Open web interface
http://localhost:8080

# Test with Socket.IO client library
# Events: 'key_down', 'key_up', 'get_status', 'test_connection'
```