require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { SessionsClient } = require('@google-cloud/dialogflow');
const cors = require('cors');
const mongoose = require('mongoose');
const uuid = require('uuid');
const path = require('path');

// ✅ Définir le chemin vers le fichier d'identifiants Dialogflow
//process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'mychatbot-cilr-255c6808b454.json');

// Initialisation Express
const app = express();

// ✅ Middleware CORS
const corsOptions = {
  origin: 'https://saida-stifi.vercel.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
};
app.use(cors(corsOptions));

// ✅ Middleware JSON
app.use(bodyParser.json());

// ✅ Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connexion à MongoDB réussie'))
.catch((err) => console.error('❌ Erreur MongoDB:', err));

// ✅ Schéma de messages
const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

// ✅ Client Dialogflow
const sessionClient = new SessionsClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  projectId: process.env.GOOGLE_PROJECT_ID,
});
console.log(process.env.GOOGLE_CLIENT_EMAIL);
console.log(process.env.GOOGLE_PROJECT_ID);
console.log(process.env.GOOGLE_PRIVATE_KEY);

// ✅ Test route
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
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

// ✅ Envoyer un message à Dialogflow
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message vide' });
  }

  const sessionId = uuid.v4();
  const sessionPath = sessionClient.projectAgentSessionPath(
    process.env.GOOGLE_PROJECT_ID,
    sessionId
  );

  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: message,
        languageCode: 'en-fr',
      },
    },
  };

  try {
    await new Message({ role: 'user', content: message }).save();

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    const botReply = result.fulfillmentText || "Je n'ai pas compris.";

    await new Message({ role: 'bot', content: botReply }).save();

    res.json({ reply: botReply });
  } catch (error) {
    console.error('❌ Erreur Dialogflow:', error);
    res.status(500).json({ error: 'Erreur de communication avec Dialogflow' });
  }
});

// ✅ Servir le build React
app.use(express.static(path.join(__dirname, 'saida-portfolio/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'saida-portfolio/build', 'index.html'));
});

// ✅ Démarrer le serveur
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${port}`);
});
