const net = require('net');
const express = require('express');

const app = express();
const port = 8080;  // Port HTTP pour la gestion des passerelles
const sshPort = 2222;  // Port où notre serveur SSH proxy écoute

// Un objet pour stocker les passerelles (nom -> { target, username })
const gateways = {};

// Configuration des routes HTTP pour gérer les passerelles
app.get('/', (req, res) => {
    const target = req.query.target;  // IP cible et port, par exemple "192.168.1.5:22"
    const username = req.query.username || 'default';  // Utilisateur SSH par défaut si non fourni
    const name = req.query.name;  // Nom unique pour la passerelle

    if (!target || !name) {
        return res.status(400).send('Target and name are required parameters.');
    }

    // Stocker la configuration de la passerelle
    gateways[name] = { target, username };
    res.send(`Gateway created for ${name} -> ${username}@${target}`);
});

app.listen(port, () => {
    console.log(`Gateway manager running on http://localhost:${port}`);
});

// Serveur SSH proxy
const sshServer = net.createServer((clientSocket) => {
    // Recevoir le premier paquet de données pour déterminer le nom (name)
    clientSocket.once('data', (data) => {
        const [name] = data.toString().split('\n');

        if (!gateways[name]) {
            clientSocket.end('No gateway found for this name.');
            return;
        }

        const { target, username } = gateways[name];
        const [targetHost, targetPort] = target.split(':');

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
});

sshServer.listen(sshPort, () => {
    console.log(`SSH proxy server listening on port ${sshPort}`);
});
