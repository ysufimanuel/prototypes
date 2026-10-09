const express = require('express');
const router = express.Router();
const { db, admin } = require('./firebase-admin');
const { requireChurchAdmin } = require('./auth-middleware');

function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

router.post('/publish-groups', requireChurchAdmin, async (req, res) => {
  try {
    const churchId = req.user.churchId;
    const groupsSnap = await db.collection(`churches/${churchId}/groups`).limit(300).get();
    const membersSnap = await db.collection(`churches/${churchId}/members`).limit(1000).get();

    const members = new Map(membersSnap.docs.map((doc) => [String(doc.id), { id: doc.id, ...doc.data() }]));
    const publicGroups = groupsSnap.docs.map((doc) => {
      const group = doc.data() || {};
      const leader = group.leaderId != null ? members.get(String(group.leaderId)) : null;
      const leaderData = leader ? {
        name: cleanText(leader.nama, 120),
      } : null;

      if (leader && group.showPhone === true && leader.telepon) {
        leaderData.phone = cleanText(leader.telepon, 50);
      }

      return {
        id: doc.id,
        name: cleanText(group.nama, 120),
        description: cleanText(group.deskripsi, 1000),
        schedule: cleanText(group.jadwal, 300),
        leader: leaderData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    });

    const existingSnap = await db.collection(`publicSites/${churchId}/ministries`).get();
    const batch = db.batch();
    existingSnap.docs.forEach((doc) => batch.delete(doc.ref));

    publicGroups.forEach((group) => {
      const ref = db.doc(`publicSites/${churchId}/ministries/${group.id}`);
      batch.set(ref, group);
    });

    await batch.commit();
    res.json({ success: true, ministryCount: publicGroups.length });
  } catch (error) {
    console.error('[WEBSITE GROUPS] publish failed:', error);
    res.status(500).json({ success: false, message: 'Gagal mempublikasikan Groups / Ministry.' });
  }
});

module.exports = router;
