const express = require('express');
const { db, admin } = require('./firebase-admin');
const { requireChurchAdmin } = require('./auth-middleware');

const router = express.Router();

function cleanString(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function now() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function sanitizeEvent(event) {
  const website = event.website && typeof event.website === 'object' ? event.website : {};
  return {
    nama: cleanString(event.nama, 160),
    tipe: cleanString(event.tipe, 80),
    customType: cleanString(event.customType, 120),
    start: cleanString(event.start, 80),
    end: cleanString(event.end, 80),
    lokasi: cleanString(event.lokasi, 240),
    deskripsi: cleanString(event.deskripsi, 1000),
    kapasitas: Number.isFinite(Number(event.kapasitas)) ? Number(event.kapasitas) : 0,
    status: cleanString(event.status, 40),
    featured: website.featured === true,
    publishedAt: now(),
  };
}

router.post('/publish-events', requireChurchAdmin, async (req, res) => {
  try {
    const churchId = req.user.churchId;
    const source = await db.collection('churches').doc(churchId).collection('events').get();
    const publicRef = db.collection('publicSites').doc(churchId).collection('events');
    const existing = await publicRef.get();

    const publicEvents = source.docs
      .filter((snap) => {
        const event = snap.data() || {};
        return event.website?.published !== false;
      })
      .slice(0, 300);

    const operations = [];
    existing.docs.forEach((snap) => operations.push({ type: 'delete', ref: snap.ref }));
    publicEvents.forEach((snap) => operations.push({
      type: 'set',
      ref: publicRef.doc(snap.id),
      data: sanitizeEvent(snap.data() || {}),
    }));

    for (let i = 0; i < operations.length; i += 450) {
      const batch = db.batch();
      operations.slice(i, i + 450).forEach((operation) => {
        if (operation.type === 'delete') batch.delete(operation.ref);
        else batch.set(operation.ref, operation.data);
      });
      await batch.commit();
    }

    res.json({ success: true, eventCount: publicEvents.length });
  } catch (error) {
    console.error('[WEBSITE EVENTS] publish:', error);
    res.status(500).json({ success: false, message: 'Gagal mempublikasikan event website' });
  }
});

module.exports = router;
