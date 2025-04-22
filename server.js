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

const cors = require('cors');

// CORS pour autoriser React (Vercel)
const corsOptions = {
  origin: 'https://saida-stifi.vercel.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));

// Middleware pour parser le corps JSON
app.use(bodyParser.json());

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
/*
const sessionClient = new SessionsClient();
const projectId = 'mychatbot-cilr';
*/
const sessionClient = new SessionsClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
});
// ✅ Route d'accueil simple
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
// Route de chat
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  const sessionId = uuidv4();
  const sessionPath = sessionClient.projectAgentSessionPath(process.env.GOOGLE_PROJECT_ID, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: 'fr', // ou 'en' selon ton agent Dialogflow
      },
    },
  };

  try {
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    res.json({ reply: result.fulfillmentText });
  } catch (error) {
    console.error('Erreur de communication avec Dialogflow:', error);
    res.status(500).json({ error: 'Erreur de communication avec Dialogflow' });
  }
});


/*
// ✅ Gérer l'envoi d'un message au chatbot
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).send({ error: 'Message requis' });
  }

  try {
    // Sauvegarde du message utilisateur
    await new Message({ role: 'user', content: message }).save();

    const sessionPath = sessionClient.projectAgentSessionPath(projectId, uuid.v4());

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
});*/

// ✅ Servir l'application React buildée (optionnel si Railway ne la sert pas)
app.use(express.static(path.join(__dirname, 'saida-portfolio/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'saida-portfolio/build', 'index.html'));
});

// ✅ Lancement du serveur
app.listen(port, () => {
  console.log(`🚀 Serveur backend lancé sur le port ${port}`);
});
