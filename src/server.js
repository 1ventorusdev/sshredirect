const net = require('net');
const express = require('express');
const app = express();
const port = 8080; // Port pour les requêtes HTTP
const sshPort = 2222; // Port pour les connexions SSH

// Stockage des passerelles
const gateways = {};

// Middleware pour extraire l'adresse IP de l'expéditeur
app.use((req, res, next) => {
    req.clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    next();
});

// Route pour créer une passerelle
app.get('/', (req, res) => {
    const target = req.query.target || req.clientIp;
    const username = req.query.username || 'default';
    const name = req.query.name;

    if (!name) {
        return res.status(400).send('Name is a required parameter.');
    }

    // Stockage des informations de la passerelle
    gateways[name] = { target, username };

    // Répondre avec les informations de la passerelle
    res.send(`Gateway created for ${name} -> ${username}@${target}\nssh command: ssh ${name}@${serverAddress}\n`);
});

// Démarrer le serveur HTTP
const server = app.listen(port, () => {
    const addressInfo = server.address();
    const ip = addressInfo.address === '::' ? 'localhost' : addressInfo.address; // Handle IPv6
    const port = addressInfo.port;
    global.serverAddress = `${ip}:${port}`; // Stocker l'adresse pour utilisation globale
    console.log(`HTTP server listening at http://${ip}:${port}`);
});

// Serveur SSH proxy
const sshServer = net.createServer((clientSocket) => {
    clientSocket.once('data', (data) => {
        const [name] = data.toString().split('\n');

        console.log(`Received SSH connection attempt for gateway: ${name}`);

        if (!gateways[name]) {
            console.log(`No gateway found for ${name}`);
            clientSocket.end('No gateway found for this name.');
            return;
        }

        const { target, username } = gateways[name];
        const [targetHost, targetPort] = target.split(':');

        console.log(`Connecting to target: ${targetHost}:${targetPort} with username: ${username}`);

        // Créer une connexion SSH vers la machine cible
        const serverSocket = net.connect(targetPort, targetHost, () => {
            clientSocket.write(`Connecting to ${username}@${targetHost}\n`);
            clientSocket.pipe(serverSocket);
            serverSocket.pipe(clientSocket);
        });

        serverSocket.on('error', (err) => {
            console.error('Error connecting to target server:', err);
            clientSocket.end('Error connecting to target server.');
        });
    });

    clientSocket.on('error', (err) => {
        console.error('Error with client socket:', err);
    });
});

sshServer.listen(sshPort, () => {
    console.log(`SSH proxy server listening on port ${sshPort}`);
});
