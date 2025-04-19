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
const sessionClient = new SessionsClient({
  credentials: {
    client_email: "mychatbot@mychatbot-cilr.iam.gserviceaccount.com",
    private_key : "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCqyjkMuKWauoWj\nxXunNr90ROyD7kZVwmYPWlZnlcWJ2HEQXziBVvNbiA/ERFAlrmNCi3JGQ31S15HY\n+jXGvMbumlLKWyawhXP1uglj+qDXQOia37bwOSBWDn45Ogf2YpqYsM5Mc1PNNMPD\nxbbxp9ST3vrrwapOpPeYiFKqIqHEM/L5tOBnXtauqlHASivWl61QBSTlQQps+EpJ\nPk7bBCnu4GkeGtTH7L6yJDoK1NwYHu2aqCjIfwKnT4g6E44p1sxkDgcm2qbibP8M\n6MALHO4/c2FGMvZsP5i479NHYq4zgRzew9c+nusXuY1AVibBHe/y17HP6XtmAfc9\nhQ2a/E8zAgMBAAECggEACajhYo8cMrmpyFicxOYR6XOvUUqMD0ETZuF/Pi5lToWy\n5pZ0JDPOSApUiSj4XYE7aC6dGoAQgDuxqi0dfVP9CAH4SWCv05xHGD1a8NAvaHoc\np3HPleh6Cm2ZOKEuUejdNJVypALopcd+HdfUOcVgmEwSzHwwjT0p+D/kz25t0G9G\nBG0NtPZzq20PChPq8LrjW3SHyosC76tyRjS2ED+5RSr6YQSWQgy3fATG/+yr1VML\nS0Jfjch7AMwI3kDQP0yQ3dxKqYWmuJeC0lvTkE06xL+DdDMlcpvISe61NyESHO91\nfVwKJxIEEDJgG27EZz3+mweysWxNi9VydPtz/Q8hRQKBgQDjNsIJJrvc+wdUFGuC\np2uUSlT2PVjZWZ6HRz9TNR6tsw2ViVWyfwcXKFKGjNhJb1ClQtf2+04UZSP0t1/q\nmHLuvwQxaiWRlfU4uJdhT7ZFBBP9BY5UIG2TxmyS1vDf4j8msUw8v5HCocV/NGo6\n4TkS18tnA8y1vfgqHObaWad/JwKBgQDAbXaJdSDSYpE3WCOuq+u7GVLxRgWwv7OM\nikuK7mTYWhyavdvQ9Y8kcf6iC+GArqu/z1aArP97UtGoOUYlBxvnQa+GbEY7d6wT\neBxHZnWi32ayzh0yKO1XXg9BVaKDkaJfmIdEMzGLrWqDbWoM+7hXdwGz+wOdOUYR\nOP1xERa3FQKBgQCIpKS6hi3SrrDwkrs5PuBGtRE1aR1m0SuyZVmi+74wbg8MUCRW\njWhBOAGxY0CroSMZ0AI7SVTilRSzlhg76GSuSfgGk7R2Qn3QF8sKPbr69IHk15OJ\n6lqb1Wf0QwlnSxP5fATCP98z8r/oSShdspb1SwvLLxDMd6un/+uhgutlXwKBgQDA\nGIaNEnCBlgSBy2tTpCzfypgSZGSp3bXQRv7C4tmpYcvMblxSbdFIAMTB4Dpty/GI\nueMQ8aLZ6gOCfCqaLE6eveQLvWsfUohlpzIT1ST6QyqytTBQMqs83Jk+D878qRX/\neLUQUErVtXjvWvrTmzabmiIJGjyxZ8uaxdm8VeLnQQKBgQCqn2VfdLWdjNrbKp62\nbYz8oALeZ8mEOZGncNckJL36ZAD2ImLGkIcl4lZq3Gr7wynLGgaKeC6PPo6ZE6Ku\nOtfvGTUFBq57brSZJ+T0/O6U2MNicVli33TPrnxdWSFYMCLHJdehab1XjrjHRIhG\nZ0VM4H1lANBSA7M2Ip4q6sbaeA==\n-----END PRIVATE KEY-----\n",
  }
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
