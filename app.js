const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const favicon = require('serve-favicon');

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
  
// View engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

const authRoutes = require('./routes/auth');
app.use(authRoutes);

app.use((req, res, next) => {
  console.log("Session data:", req.session); // Debugging line
  res.locals.userId = req.session.userId || null;
  next();
});

app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

// Routes
app.get("/", (req, res) => {
    res.render("index");
});

app.get("/users", (req, res) => {
  const me = req.session.userId;
  if (!me) return res.redirect("/login");

  db.all(
    `SELECT id, username FROM users WHERE id != ?`,
    [me],
    (err, users) => {
      if (err) return res.status(500).send("Error loading users");
      res.render("users", { users });
    }
  );
});

app.get("/users/:id", (req, res) => {
  const me = req.session.userId;
  const targetId = req.params.id;
  if (!me) return res.redirect("/login");
  if (me == targetId) return res.redirect("/profile"); // don't view yourself

  const sql = `
    SELECT u.id, u.username, u.bio, g.label AS gender, o.label AS orientation
    FROM users u
    JOIN genders g ON u.gender_id = g.id
    JOIN orientations o ON u.orientation_id = o.id
    WHERE u.id = ?`;

  db.get(sql, [targetId], (err, user) => {
    if (err || !user) return res.status(404).send("User not found");
    res.render("view-profile", { user });
  });
});

app.post("/like/:id", (req, res) => {
  const liker = req.session.userId;
  const liked = req.params.id;

  if (!liker) return res.redirect("/login");
  if (liker == liked) return res.redirect("/users");

  db.run(
    `INSERT OR IGNORE INTO likes (liker_id, liked_id) VALUES (?, ?)`,
    [liker, liked],
    (err) => {
      if (err) return res.status(500).send("Like failed");
      res.redirect("/users/" + liked);
    }
  );
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
  const me = req.session.userId;
  if (!me) return res.redirect("/login");

  const sql = `
    SELECT u.id, u.username
    FROM likes l1
    JOIN likes l2 ON l1.liker_id = l2.liked_id AND l1.liked_id = l2.liker_id
    JOIN users u ON u.id = l1.liked_id
    WHERE l1.liker_id = ?`;

  db.all(sql, [me], (err, matches) => {
    if (err) return res.status(500).send("Could not load matches");
    res.render("matches", { matches });
  });
});


  app.get("/profile", (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect("/login");

  const sql = `
    SELECT u.username, u.bio, g.label AS gender, o.label AS orientation
    FROM users u
    JOIN genders g ON u.gender_id = g.id
    JOIN orientations o ON u.orientation_id = o.id
    WHERE u.id = ?`;

  db.get(sql, [userId], (err, user) => {
    if (err || !user) return res.status(500).send("Error loading profile.");
    res.render("profile", { user });
  });
});


  app.get("/profile/edit", (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.redirect("/login");

  db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err || !user) return res.status(500).send("User not found");

    db.all(`SELECT * FROM genders`, (err2, genders) => {
      db.all(`SELECT * FROM orientations`, (err3, orientations) => {
        res.render("edit-profile", { user, genders, orientations });
      });
    });
  });
});

app.post("/profile/edit", (req, res) => {
  const userId = req.session.userId;
  const { bio, gender_id, orientation_id } = req.body;

  db.run(
    `UPDATE users SET bio = ?, gender_id = ?, orientation_id = ? WHERE id = ?`,
    [bio, gender_id, orientation_id, userId],
    (err) => {
      if (err) return res.status(500).send("Failed to update profile");
      res.redirect("/profile/edit");
    }
  );
});


// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dating site running on http://localhost:${PORT}`);
});
