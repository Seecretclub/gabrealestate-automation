// Intégration Instagram Graph API : vérification du webhook + réponse privée
// à un commentaire. Documentation de référence :
// https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies

const fetch = require('node-fetch');
const crypto = require('crypto');

const GRAPH_VERSION = 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Vérifie que la requête webhook provient bien de Meta (signature HMAC
 * calculée avec le App Secret). À utiliser avant de traiter le corps
 * de toute requête POST /webhook/instagram en production.
 */
function verifySignature(rawBody, signatureHeader, appSecret) {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Vérifie le challenge envoyé par Meta quand tu configures l'URL du webhook
 * dans l'App Dashboard (GET /webhook/instagram).
 */
function verifyWebhook(mode, token, challenge, expectedToken) {
  if (mode === 'subscribe' && token === expectedToken) {
    return challenge;
  }
  return null;
}

/**
 * Envoie une réponse privée (DM) en réaction à un commentaire précis.
 * Règle Meta importante : cette réponse doit être envoyée dans les 7 jours
 * suivant le commentaire, et une seule réponse privée est possible par
 * commentaire. Si la personne ne répond pas à ce DM, aucun autre message
 * automatique ne pourra lui être envoyé (fenêtre de conversation fermée).
 */
async function sendPrivateReply(commentId, messageText, pageAccessToken) {
  const url = `${GRAPH_URL}/${commentId}/private_replies`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageText,
      access_token: pageAccessToken
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Échec envoi réponse privée Instagram :', data);
  }
  return data;
}

/**
 * Publie une réponse publique sous le commentaire (visible par tous).
 * Utile comme filet de sécurité si le DM n'est jamais ouvert.
 */
async function replyToCommentPublicly(commentId, messageText, pageAccessToken) {
  const url = `${GRAPH_URL}/${commentId}/replies`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageText,
      access_token: pageAccessToken
    })
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Échec réponse publique Instagram :', data);
  }
  return data;
}

module.exports = { verifyWebhook, sendPrivateReply, replyToCommentPublicly, verifySignature };
