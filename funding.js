const express = require('express');
const nodemailer = require('nodemailer');

module.exports = function mountFundingRoutes(app, { db, save, auth, admin }) {
  db.fundingProfiles ||= [];
  db.fundingProjects ||= [];
  db.fundingConversations ||= [];
  db.fundingMessages ||= [];

  const today = () => new Date().toISOString().slice(0, 10);
  const safeUser = u => { const profile = db.fundingProfiles.find(p => p.userId === u.id); return { id: u.id, name: u.name, country: u.country || '', publicEmail: profile?.publicEmail || '' }; };
  const mailer = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT || 587) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  };
  async function notify(email, subject, text) {
    const transport = mailer();
    if (!transport || !email) return false;
    try {
      await transport.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email, subject, text });
      return true;
    } catch (error) {
      console.error('GlobalWork email notification failed:', error.message);
      return false;
    }
  }
  const clean = (value, max = 2000) => String(value || '').replace(/<[^>]*>/g, ' ').trim().slice(0, max);
  const profileFor = id => db.fundingProfiles.find(p => p.userId === id);

  app.get('/api/funding/overview', (req, res) => {
    const funders = db.fundingProfiles.filter(p => p.availableToday && p.confirmedDate === today())
      .map(p => ({ ...p, user: safeUser(db.users.find(u => u.id === p.userId) || {}) }))
      .filter(p => p.user.id);
    const projects = db.fundingProjects.filter(p => p.status === 'open').slice().reverse();
    res.json({ funders, projects, activeFunderCount: funders.length, projectCount: projects.length,
      targetActiveFunders: 100, lastAvailabilityCheck: today(),
      note: 'Only self-declared funders who reconfirmed today appear as available today. Listings are not guarantees of funding.' });
  });

  app.get('/api/funding/profile', auth, (req, res) => {
    res.json({ profile: profileFor(req.user.id) || null });
  });
  app.post('/api/funding/profile', auth, (req, res) => {
    const body = req.body || {};
    const role = ['investor', 'donor', 'both'].includes(body.role) ? body.role : 'investor';
    const existing = profileFor(req.user.id);
    const profile = {
      userId: req.user.id, role, sectors: Array.isArray(body.sectors) ? body.sectors.map(x => clean(x, 60)).slice(0, 20) : [],
      countries: clean(body.countries, 300), publicEmail: clean(body.publicEmail, 180), fundingMin: clean(body.fundingMin, 40),
      fundingMax: clean(body.fundingMax, 40), currency: clean(body.currency || 'USD', 8),
      fundingType: clean(body.fundingType || 'Investment and/or donation', 100),
      bio: clean(body.bio, 1200), availableToday: Boolean(body.availableToday),
      confirmedDate: today(), updatedAt: new Date().toISOString(),
      verificationStatus: existing?.verificationStatus || 'unverified'
    };
    if (existing) Object.assign(existing, profile); else db.fundingProfiles.push(profile);
    save();
    res.json({ profile });
  });

  app.get('/api/funding/projects', (req, res) => {
    const q = clean(req.query.q, 100).toLowerCase();
    const country = clean(req.query.country, 80).toLowerCase();
    const projects = db.fundingProjects.filter(p => p.status === 'open' &&
      (!q || [p.title, p.sector, p.description, p.country].join(' ').toLowerCase().includes(q)) &&
      (!country || p.country.toLowerCase().includes(country)))
      .slice().reverse().map(p => ({ ...p, owner: safeUser(db.users.find(u => u.id === p.ownerId) || {}) }));
    res.json({ projects });
  });
  app.post('/api/funding/projects', auth, (req, res) => {
    const b = req.body || {};
    if (!clean(b.title, 120) || !clean(b.description, 3000) || !clean(b.country, 80))
      return res.status(400).json({ error: 'Project title, country and description are required' });
    const project = {
      id: 'fp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      ownerId: req.user.id, title: clean(b.title, 120), sector: clean(b.sector || 'Other', 80),
      country: clean(b.country, 80), amount: clean(b.amount, 60), currency: clean(b.currency || 'USD', 8),
      fundingType: clean(b.fundingType || 'Grant or investment', 100),
      description: clean(b.description, 3000), status: 'open', verificationStatus: 'unverified',
      createdAt: new Date().toISOString()
    };
    db.fundingProjects.push(project); save();
    res.status(201).json({ project });
  });

  app.post('/api/funding/contact/:userId', auth, async (req, res) => {
    const target = db.users.find(u => u.id === req.params.userId);
    if (!target || target.id === req.user.id) return res.status(404).json({ error: 'Contact not found' });
    const body = clean(req.body?.message, 2000);
    if (!body) return res.status(400).json({ error: 'Write a message first' });
    let conversation = db.fundingConversations.find(c => c.participants.includes(req.user.id) && c.participants.includes(target.id));
    if (!conversation) {
      conversation = { id: 'fc_' + Date.now().toString(36), participants: [req.user.id, target.id], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.fundingConversations.push(conversation);
    }
    const message = { id: 'fm_' + Date.now().toString(36), conversationId: conversation.id, senderId: req.user.id, body, createdAt: new Date().toISOString() };
    db.fundingMessages.push(message); conversation.updatedAt = message.createdAt; save();
    const sender = db.users.find(u => u.id === req.user.id);
    const emailSent = await notify(target.email, 'New GlobalWork funding message',
      (sender?.name || 'A GlobalWork member') + ' sent you a message on GlobalWork. Sign in to your account to read and reply. Do not send money or sensitive documents before verifying the other party.');
    res.status(201).json({ conversationId: conversation.id, message, emailNotificationSent: emailSent });
  });

  app.get('/api/funding/conversations', auth, (req, res) => {
    const conversations = db.fundingConversations.filter(c => c.participants.includes(req.user.id)).map(c => {
      const otherId = c.participants.find(id => id !== req.user.id);
      const other = db.users.find(u => u.id === otherId);
      const last = db.fundingMessages.filter(m => m.conversationId === c.id).slice(-1)[0];
      return { id: c.id, other: other ? safeUser(other) : null, lastMessage: last?.body || '', updatedAt: c.updatedAt };
    }).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ conversations });
  });
  app.get('/api/funding/conversations/:id/messages', auth, (req, res) => {
    const c = db.fundingConversations.find(x => x.id === req.params.id && x.participants.includes(req.user.id));
    if (!c) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ messages: db.fundingMessages.filter(m => m.conversationId === c.id) });
  });
  app.post('/api/funding/conversations/:id/messages', auth, async (req, res) => {
    const c = db.fundingConversations.find(x => x.id === req.params.id && x.participants.includes(req.user.id));
    if (!c) return res.status(404).json({ error: 'Conversation not found' });
    const body = clean(req.body?.message, 2000);
    if (!body) return res.status(400).json({ error: 'Write a message first' });
    const message = { id: 'fm_' + Date.now().toString(36), conversationId: c.id, senderId: req.user.id, body, createdAt: new Date().toISOString() };
    db.fundingMessages.push(message); c.updatedAt = message.createdAt; save();
    const recipientId = c.participants.find(id => id !== req.user.id);
    const recipient = db.users.find(u => u.id === recipientId);
    const sender = db.users.find(u => u.id === req.user.id);
    const emailSent = await notify(recipient?.email, 'New GlobalWork funding message',
      (sender?.name || 'A GlobalWork member') + ' sent you a new message. Sign in to GlobalWork to reply.');
    res.status(201).json({ message, emailNotificationSent: emailSent });
  });

  app.get('/api/admin/funding', auth, admin, (req, res) => res.json({
    profiles: db.fundingProfiles.length, projects: db.fundingProjects.length,
    activeToday: db.fundingProfiles.filter(p => p.availableToday && p.confirmedDate === today()).length,
    conversations: db.fundingConversations.length,
    latestProjects: db.fundingProjects.slice(-10).reverse(),
    latestFunders: db.fundingProfiles.slice(-10).reverse()
  }));
  app.post('/api/admin/funding/verify', auth, admin, (req, res) => {
    const { type, id, status } = req.body || {};
    if (!['verified', 'rejected', 'unverified'].includes(status)) return res.status(400).json({ error: 'Invalid verification status' });
    const item = type === 'project' ? db.fundingProjects.find(p => p.id === id) : db.fundingProfiles.find(p => p.userId === id);
    if (!item) return res.status(404).json({ error: 'Funding record not found' });
    item.verificationStatus = status; item.reviewedAt = new Date().toISOString(); save();
    res.json({ ok: true, status });
  });
};
