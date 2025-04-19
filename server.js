require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { SessionsClient } = require('@google-cloud/dialogflow');
const cors = require('cors');
const mongoose = require('mongoose');
const uuid = require('uuid');
const path = require('path');

// Initialisation Express
const app = express();
const port = process.env.PORT || 5000;

// CORS pour autoriser React (Vercel)
app.use(cors({
  origin: 'https://saida-stifi.vercel.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware pour parser le corps JSON
app.use(bodyParser.json());  // Ajouté pour que les requêtes POST avec JSON soient correctement traitées

// ✅ Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB:', err));

// ✅ Schéma et modèle MongoDB
const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// ✅ Initialisation du client Dialogflow
const sessionClient = new SessionsClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});


// ✅ Route d'accueil simple pour éviter les erreurs 404
app.get('/', (req, res) => {
  res.send('🚀 Backend opérationnel !');
});

// ✅ Récupérer les anciens messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Erreur récupération messages:', error);
    res.status(500).send({ error: 'Erreur lors de la récupération des messages' });
  }
});

// ✅ Gérer l'envoi d'un message au chatbot
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).send({ error: 'Message requis' });
  }

  try {
    // Sauvegarde du message utilisateur
    await new Message({ role: 'user', content: message }).save();

    const sessionPath = sessionClient.projectAgentSessionPath('mychatbot-cilr', uuid.v4());

    const responses = await sessionClient.detectIntent({
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: 'en',
        },
      },
    });

    const botMessage = responses[0].queryResult.fulfillmentText || "Je n'ai pas compris.";

    // Sauvegarde de la réponse du bot
    await new Message({ role: 'bot', content: botMessage }).save();

    res.send({ response: botMessage });
  } catch (error) {
    console.error('Erreur Dialogflow:', error);
    res.status(500).send({ error: 'Erreur de communication avec Dialogflow' });
  }
});

// ✅ Servir l'application React buildée (optionnel si Railway ne la sert pas)
app.use(express.static(path.join(__dirname, 'saida-portfolio/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'saida-portfolio/build', 'index.html'));
});

// ✅ Lancement du serveur
app.listen(port, () => {
  console.log(`🚀 Serveur backend lancé sur le port ${port}`);
});
