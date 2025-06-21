const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 8080;

// Replace with your own DB credentials
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // fill in as needed
  database: 'DogWalkService',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Sample insert data function (run once on startup)
  try {
    const conn = await pool.getConnection();

    // Insert users
    await conn.query(`
      INSERT IGNORE INTO Users (username, email, password_hash, role) VALUES
        ('alice123', 'alice@example.com', 'hashed123', 'owner'),
        ('bobwalker', 'bob@example.com', 'hashed456', 'walker'),
        ('carol123', 'carol@example.com', 'hashed789', 'owner'),
        ('davidwalks', 'david@example.com', 'hashed101', 'walker'),
        ('emma_pet', 'emma@example.com', 'hashed202', 'owner')
    `);

    // Insert dogs
    await conn.query(`
      INSERT IGNORE INTO Dogs (owner_id, name, size) VALUES
        ((SELECT user_id FROM Users WHERE username='alice123'), 'Max', 'medium'),
        ((SELECT user_id FROM Users WHERE username='carol123'), 'Bella', 'small'),
        ((SELECT user_id FROM Users WHERE username='emma_pet'), 'Rocky', 'large'),
        ((SELECT user_id FROM Users WHERE username='alice123'), 'Luna', 'small'),
        ((SELECT user_id FROM Users WHERE username='carol123'), 'Charlie', 'medium')
    `);

    // Insert walk requests
    await conn.query(`
      INSERT IGNORE INTO WalkRequests (dog_id, requested_time, duration_minutes, location, status) VALUES
        ((SELECT dog_id FROM Dogs WHERE name='Max'), '2025-06-10 08:00:00', 30, 'Parklands', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name='Bella'), '2025-06-10 09:30:00', 45, 'Beachside Ave', 'accepted'),
        ((SELECT dog_id FROM Dogs WHERE name='Rocky'), '2025-06-11 14:00:00', 60, 'Central Park', 'open'),
        ((SELECT dog_id FROM Dogs WHERE name='Luna'), '2025-06-12 16:30:00', 40, 'River Walk', 'accepted'),
        ((SELECT dog_id FROM Dogs WHERE name='Charlie'), '2025-06-13 10:00:00', 50, 'Mountain Trail', 'open')
    `);

    conn.release();
  } catch (error) {
    console.error('Error inserting sample data:', error);
  }
}

// Call insertSampleData on startup
insertSampleData();

// /api/dogs
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.name AS dog_name, d.size, u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dogs', details: err.message });
  }
});

// /api/walkrequests/open
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT wr.request_id, d.name AS dog_name, wr.requested_time, wr.duration_minutes, wr.location, u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walk requests', details: err.message });
  }
});

// /api/walkers/summary
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        u.username AS walker_username,
        COUNT(r.rating_id) AS total_ratings,
        ROUND(AVG(r.rating), 2) AS average_rating,
        (
          SELECT COUNT(*)
          FROM WalkRequests wr
          JOIN WalkApplications wa ON wa.request_id = wr.request_id
          WHERE wa.walker_id = u.user_id AND wr.status = 'completed' AND wa.status = 'accepted'
        ) AS completed_walks
      FROM Users u
      LEFT JOIN WalkRatings r ON r.walker_id = u.user_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch walker summary', details: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
