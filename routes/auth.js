const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const router = express.Router();

// Connect to database
const db = new sqlite3.Database(path.join(__dirname, '../dating.db'), (err) => {
  if (err) console.error('DB connection failed:', err.message);
  else console.log('Connected to dating.db');
});

// Register GET form
router.get('/register', (req, res) => {
  // Fetch genders and orientations to populate the dropdowns
  db.all("SELECT * FROM genders", (err, genders) => {
    if (err) return res.status(500).send("Error loading genders");
    db.all("SELECT * FROM orientations", (err2, orientations) => {
      if (err2) return res.status(500).send("Error loading orientations");
      res.render('register', { genders, orientations });
    });
  });
});

// Register POST
router.post('/register', async (req, res) => {
  const { username, password, gender_id, orientation_id } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);

    db.run(
      `INSERT INTO users (username, password, gender_id, orientation_id)
       VALUES (?, ?, ?, ?)`,
      [username, hash, gender_id, orientation_id],
      function (err) {
        if (err) return res.send("Registration error: " + err.message);
        req.session.userId = this.lastID; // Auto-login
        res.redirect('/');
      }
    );
  } catch (e) {
    res.send("Unexpected error during registration.");
  }
});

// Login GET form
router.get('/login', (req, res) => {
  res.render('login');
});

// Login POST
router.post('/login', (req, res) => {
  console.log("Form data received:", req.body); // Debugging line
  const username = req.body.username;
  const password = req.body.password;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err || !user) {
      console.log("User not found or DB error:", err); // Debugging line
      return res.send("Invalid username or password.");
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log("Password mismatch"); // Debugging line
      return res.send("Invalid username or password.");
    }

    req.session.userId = user.id;
    console.log("Login successful, session userId:", req.session.userId); // Debugging line
    res.redirect('/');
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
