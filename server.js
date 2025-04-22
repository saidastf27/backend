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

// ✅ Configuration CORS (placé en haut pour éviter les erreurs)
const corsOptions = {
  origin: 'https://saida-stifi.vercel.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // pour gérer les requêtes OPTIONS

// Middleware pour parser le corps JSON
app.use(bodyParser.json());

// Port
const port = process.env.PORT || 5000;

// ✅ Connexion MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie'))
  .catch((err) => console.error('❌ Erreur de connexion MongoDB:', err));

// ✅ Schéma et modèle MongoDB
const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

// ✅ Initialisation du client Dialogflow
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

// ✅ Route de chat
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  const sessionId = uuid.v4();
  const sessionPath = sessionClient.projectAgentSessionPath(process.env.GOOGLE_PROJECT_ID, sessionId);

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: 'fr',
      },
    },
  };

  try {
    // Sauvegarde du message utilisateur
    await new Message({ role: 'user', content: message }).save();

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    const botReply = result.fulfillmentText || "Je n'ai pas compris.";

    // Sauvegarde de la réponse du bot
    await new Message({ role: 'bot', content: botReply }).save();

    res.json({ reply: botReply });
  } catch (error) {
    console.error('Erreur de communication avec Dialogflow:', error);
    res.status(500).json({ error: 'Erreur de communication avec Dialogflow' });
  }
});

// ✅ Servir l'application React (build statique)
app.use(express.static(path.join(__dirname, 'saida-portfolio/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'saida-portfolio/build', 'index.html'));
});

// ✅ Lancement du serveur
app.listen(port, () => {
  console.log(`🚀 Serveur backend lancé sur le port ${port}`);
});
