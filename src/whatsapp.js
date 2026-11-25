// Envoi de notifications via l'API WhatsApp Cloud (Meta), gratuite jusqu'à
// un certain volume de conversations par mois.
// Doc : https://developers.facebook.com/docs/whatsapp/cloud-api/

const fetch = require('node-fetch');

const GRAPH_VERSION = 'v21.0';

async function notifyGabrielNewLead(lead) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = process.env.GABRIEL_WHATSAPP_NUMBER;

  if (!phoneNumberId || !token || !to) {
    console.warn('WhatsApp non configuré (variables manquantes) — notification ignorée.');
    return null;
  }

  const text =
    `Nouveau prospect Instagram\n\n` +
    `Nom : ${lead.name}\n` +
    `Téléphone : ${lead.phone}\n` +
    `Email : ${lead.email}\n` +
    (lead.source ? `Source : ${lead.source}\n` : '') +
    `Reçu le : ${new Date(lead.createdAt).toLocaleString('fr-FR')}`;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Échec envoi notification WhatsApp :', data);
  }
  return data;
}

module.exports = { notifyGabrielNewLead };
