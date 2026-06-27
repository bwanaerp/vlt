// src/ui/server.js
// Optional: `vlt ui` — spins up a local web dashboard on http://localhost:6174
// All data stays local. No network calls.

const express = require('express');
const path = require('path');
const {
  listProjects,
  listProjectKeys,
  exportProject,
  deleteSecret,
  deleteProject,
  setSecret,
  vaultExists
} = require('../store/vault');

const PORT = 6174; // Vinci's number, for the cryptographically-inclined

function startUI(password) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  // API Routes
  app.get('/api/projects', (req, res) => {
    try {
      const projects = listProjects(password);
      res.json({ success: true, projects });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/projects/:project/keys', (req, res) => {
    try {
      const keys = listProjectKeys(password, req.params.project);
      res.json({ success: true, keys });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/projects/:project/export', (req, res) => {
    try {
      const secrets = exportProject(password, req.params.project);
      res.json({ success: true, secrets });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/projects/:project/keys', (req, res) => {
    try {
      const { key, value } = req.body;
      if (!key || !value) {
        return res.status(400).json({ success: false, error: 'Key and value required.' });
      }
      setSecret(password, req.params.project, key, value);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/projects/:project/keys/:key', (req, res) => {
    try {
      deleteSecret(password, req.params.project, req.params.key);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/projects/:project', (req, res) => {
    try {
      deleteProject(password, req.params.project);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve UI
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app.listen(PORT, 'localhost', () => {});
}

module.exports = { startUI, PORT };
