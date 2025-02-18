const WebSocket = require('ws');
const Device = require('./models/device');

function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });
    const clients = new Map(); // Map device tokens to WebSocket connections

    wss.on('connection', (ws, req) => {
        const token = new URLSearchParams(req.url.slice(1)).get('token');
        if (!token) {
            ws.close();
            return;
        }

        // Store the connection
        clients.set(token, ws);

        ws.on('close', () => {
            clients.delete(token);
            updateDeviceStatus(token, false);
        });

        // Update device status to online
        updateDeviceStatus(token, true);
    });

    // Function to update device online status
    async function updateDeviceStatus(token, online) {
        try {
            await Device.findOneAndUpdate(
                { token },
                { 
                    online,
                    lastPing: online ? Date.now() : undefined
                }
            );
        } catch (error) {
            console.error('Error updating device status:', error);
        }
    }

    // Function to send updates to specific devices
    return {
        notifyDevice: (token, data) => {
            const client = clients.get(token);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        },
        notifyAllDevices: (data) => {
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(data));
                }
            });
        }
    };
}

module.exports = setupWebSocket; 