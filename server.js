require('dotenv').config();
const express = require('express');
const path = require('path');
const basicAuth = require('express-basic-auth');

const { verifyWebhook, sendPrivateReply, replyToCommentPublicly, verifySignature } = require('./src/instagram');
const { notifyGabrielNewLead } = require('./src/whatsapp');
const { addLead, getLeads } = require('./src/store');

const app = express();
const PORT = process.env.PORT || 3000;

// Conserve le corps brut de la requête pour vérifier la signature Meta
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// 1) Page de contact générique (celle commentée/DM renvoie ici)
// ---------------------------------------------------------------------------
app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// ---------------------------------------------------------------------------
// 2) Réception du formulaire -> stockage + notification WhatsApp à Gabriel
// ---------------------------------------------------------------------------
app.post('/api/leads', async (req, res) => {
  const { name, phone, email, source } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nom et téléphone requis.' });
  }

  const lead = addLead({ name, phone, email: email || '', source: source || 'page de contact' });

  try {
    await notifyGabrielNewLead(lead);
  } catch (err) {
    console.error('Erreur notification WhatsApp :', err);
    // On ne bloque pas la réponse au client pour autant : le lead est déjà enregistré.
  }

  res.json({ ok: true, lead });
});

// ---------------------------------------------------------------------------
// 3) Webhook Instagram : vérification (GET) + réception des commentaires (POST)
// ---------------------------------------------------------------------------
app.get('/webhook/instagram', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = verifyWebhook(mode, token, challenge, process.env.META_VERIFY_TOKEN);
  if (result) {
    return res.status(200).send(result);
  }
  res.sendStatus(403);
});

app.post('/webhook/instagram', async (req, res) => {
  // Vérifie que la requête vient bien de Meta (recommandé en production)
  if (process.env.META_APP_SECRET) {
    const signature = req.get('x-hub-signature-256');
    const valid = verifySignature(req.rawBody, signature, process.env.META_APP_SECRET);
    if (!valid) {
      console.warn('Signature webhook invalide, requête ignorée.');
      return res.sendStatus(401);
    }
  }

  // On répond tout de suite à Meta (il attend un 200 rapide), puis on traite.
  res.sendStatus(200);

  try {
    const entries = req.body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'comments') continue;

        const comment = change.value || {};
        const commentId = comment.id;
        const commenterUsername = comment.from && comment.from.username;

        if (!commentId) continue;

        const link = `${process.env.PUBLIC_BASE_URL}/contact?src=comment_${commentId}`;

        const dmMessage =
          `Bonjour ! Merci pour votre intérêt 🙏\n\n` +
          `Pour recevoir les informations sur ce bien et être recontacté(e) directement par Gabriel, cliquez ici :\n${link}`;

        await sendPrivateReply(commentId, dmMessage, process.env.META_PAGE_ACCESS_TOKEN);

        const publicMessage = `Merci pour votre intérêt${commenterUsername ? ' @' + commenterUsername : ''} ! Je viens de vous envoyer les informations en message privé 📩`;
        await replyToCommentPublicly(commentId, publicMessage, process.env.META_PAGE_ACCESS_TOKEN);
      }
    }
  } catch (err) {
    console.error('Erreur traitement webhook Instagram :', err);
  }
});

// ---------------------------------------------------------------------------
// 4) Tableau de bord (protégé par mot de passe)
// ---------------------------------------------------------------------------
app.use(
  '/dashboard',
  basicAuth({
    users: { [process.env.DASHBOARD_USER || 'gabriel']: process.env.DASHBOARD_PASSWORD || 'change_moi' },
    challenge: true
  })
);

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/api/leads', basicAuth({
  users: { [process.env.DASHBOARD_USER || 'gabriel']: process.env.DASHBOARD_PASSWORD || 'change_moi' }
}), (req, res) => {
  res.json(getLeads());
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
