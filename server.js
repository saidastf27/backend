require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { SessionsClient } = require('@google-cloud/dialogflow');
const cors = require('cors');
const mongoose = require('mongoose');
const uuid = require('uuid');
const path = require('path');

// Initialisation de l'application Express
const app = express();
const port = process.env.PORT || 5000;

// Middleware CORS pour autoriser les requêtes depuis React
app.use(cors({
  origin: 'http://localhost:3000', // Remplace cette adresse si nécessaire
}));

// Middleware pour analyser le corps des requêtes
app.use(bodyParser.json());

// Connexion à MongoDB (version mise à jour sans options dépréciées)
mongoose.connect('mongodb://localhost:27017/chatbotDB')
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur de connexion MongoDB:', err));

// Modèle de Message
const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// Initialisation du client Dialogflow
const sessionClient = new SessionsClient({
  keyFilename: './mychatbot-cilr-255c6808b454.json',  // Remplace par ton chemin exact du fichier JSON
});

// Endpoint pour récupérer l'historique des messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).send({ error: 'Erreur lors de la récupération des messages' });
  }
});

// Endpoint pour envoyer le message au chatbot et le stocker
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).send({ error: 'Message is required' });

  const userMessage = new Message({ role: 'user', content: message });
  await userMessage.save();

  try {
    const responses = await sessionClient.detectIntent({
      session: sessionClient.projectAgentSessionPath('mychatbot-cilr', uuid.v4()),
      queryInput: { text: { text: message, languageCode: 'en' } }
    });

    const botMessage = responses[0].queryResult.fulfillmentText || "Je n'ai pas compris.";
    const botMessageEntry = new Message({ role: 'bot', content: botMessage });
    await botMessageEntry.save();

    res.send({ response: botMessage });
  } catch (error) {
    res.status(500).send({ error: 'Erreur de communication avec Dialogflow' });
  }
});

// Servir les fichiers statiques de la build React
app.use(express.static(path.join(__dirname, 'saida-portfolio/build')));

// Toute autre route de ton API, si tu en as
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'saida-portfolio/build', 'index.html'));
});

// Lancer le serveur
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
