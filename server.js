require('dotenv').config();  // Charge les variables d'environnement depuis .env
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
  origin: 'https://saida-stifi.vercel.app',  // Remplacez par l'URL de votre frontend si nécessaire
}));

// Middleware pour analyser le corps des requêtes
app.use(bodyParser.json());

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur de connexion MongoDB:', err));

// Modèle de Message
const MessageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

// 🔐 Chargement des credentials Dialogflow depuis le fichier JSON
const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!googleCredentialsPath) {
  console.error("Erreur: La variable d'environnement GOOGLE_APPLICATION_CREDENTIALS n'est pas définie.");
} else {
  console.log("Fichier de credentials trouvé:", googleCredentialsPath);
}

const sessionClient = new SessionsClient({
  keyFilename: googleCredentialsPath  // Utilisation du fichier JSON spécifié dans .env
});

// Endpoint pour récupérer les messages
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).send({ error: 'Erreur lors de la récupération des messages' });
  }
});

// Endpoint de chat
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).send({ error: 'Message is required' });

  const userMessage = new Message({ role: 'user', content: message });
  await userMessage.save();

  try {
    const sessionPath = sessionClient.projectAgentSessionPath('mychatbot-cilr', uuid.v4());
    const responses = await sessionClient.detectIntent({
      session: sessionPath,
      queryInput: {
        text: { text: message, languageCode: 'en' }
      }
    });

    const botMessage = responses[0].queryResult.fulfillmentText || "Je n'ai pas compris.";
    const botMessageEntry = new Message({ role: 'bot', content: botMessage });
    await botMessageEntry.save();

    res.send({ response: botMessage });
  } catch (error) {
    console.error('Erreur Dialogflow:', error);
    res.status(500).send({ error: 'Erreur de communication avec Dialogflow' });
  }
});

// Servir les fichiers statiques (React build)
app.use(express.static(path.join(__dirname, 'saida-portfolio/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'saida-portfolio/build', 'index.html'));
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
