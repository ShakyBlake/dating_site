const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const db = new sqlite3.Database('./dating.db', (err) => {
    if (err) {
      console.error('Could not open database', err.message);
      return;
    }
    console.log('Connected to the SQLite database.');
  });

const session = require('express-session');

app.use(session({
  secret: 'aVerySecretKey',
  resave: false,
  saveUninitialized: false
}));

const authRoutes = require('./routes/auth');
app.use(authRoutes);
  
// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log("Session data:", req.session); // Debugging line
  res.locals.userId = req.session.userId || null;
  next();
});

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/users", (req, res) => {
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) return res.status(500).send("DB error");
        res.render("users", { users: rows });
    });
});

// show preferences for current user (hard‑coded id=1 for now)
app.get("/preferences", (req, res) => {
    db.all(
      `SELECT g.label 
         FROM genders g 
         JOIN preferences p ON g.id=p.preference_id 
        WHERE p.user_id = ?`,
      [1],
      (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.render("preferences", { prefs: rows });
      }
    );
  });
  
  // show who user 1 likes
  app.get("/likes", (req, res) => {
    db.all(
      `SELECT u2.username 
         FROM users u1 
         JOIN likes l ON u1.id=l.liker_id 
         JOIN users u2 ON l.liked_id=u2.id 
        WHERE u1.id = ?`,
      [1],
      (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.render("likes", { likes: rows });
      }
    );
  });
  
  // show mutual matches
  app.get("/matches", (req, res) => {
    db.all(
      `SELECT u2.username 
         FROM likes l1
         JOIN likes l2
           ON l1.liker_id = l2.liked_id
          AND l1.liked_id = l2.liker_id
         JOIN users u2
           ON u2.id = l1.liked_id
        WHERE l1.liker_id = ?`,
      [1],
      (err, rows) => {
        if (err) return res.status(500).send(err.message);
        res.render("matches", { matches: rows });
      }
    );
  });

  app.get("/profile", (req, res) => {
    res.render("profile");
  });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Dating site running on http://localhost:${PORT}`);
});
