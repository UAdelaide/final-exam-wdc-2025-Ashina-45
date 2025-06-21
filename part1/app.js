const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const mysql = require('mysql2/promise');
const fs = require('fs').promises;

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

let db;

(async () => {
  try {
    // Read and execute the SQL file
    const sqlScript = await fs.readFile(path.join(__dirname, 'dogwalks.sql'), 'utf8');

    // Connect to MySQL without database first
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: ''
    });

    // Split the SQL script into individual statements and execute them
    const statements = sqlScript.split(';').filter(stmt => stmt.trim());
    for (let statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement + ';');
      }
    }
    await connection.end();

    // Connect to the created database
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'DogWalkService'
    });

    console.log('Database setup completed successfully');
  } catch (err) {
    console.error('Error setting up database:', err);
  }
})();

// Route 1: Get all dogs with their size and owner's username
app.get('/api/dogs', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        d.name AS dog_name,
        d.size,
        u.username AS owner_username
      FROM Dogs d
      JOIN Users u ON d.owner_id = u.user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching dogs:', err);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Route 2: Get all open walk requests
app.get('/api/walkrequests/open', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        wr.request_id,
        d.name AS dog_name,
        wr.requested_time,
        wr.duration_minutes,
        wr.location,
        u.username AS owner_username
      FROM WalkRequests wr
      JOIN Dogs d ON wr.dog_id = d.dog_id
      JOIN Users u ON d.owner_id = u.user_id
      WHERE wr.status = 'open'
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching walk requests:', err);
    res.status(500).json({ error: 'Failed to fetch walk requests' });
  }
});

// Route 3: Get walker summary with ratings and completed walks
app.get('/api/walkers/summary', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT
        u.username AS walker_username,
        COUNT(DISTINCT wr.rating_id) AS total_ratings,
        AVG(wr.rating) AS average_rating,
        COUNT(DISTINCT CASE WHEN w.status = 'completed' THEN w.request_id END) AS completed_walks
      FROM Users u
      LEFT JOIN WalkApplications wa ON u.user_id = wa.walker_id
      LEFT JOIN WalkRequests w ON wa.request_id = w.request_id
      LEFT JOIN WalkRatings wr ON u.user_id = wr.walker_id
      WHERE u.role = 'walker'
      GROUP BY u.user_id, u.username
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching walker summary:', err);
    res.status(500).json({ error: 'Failed to fetch walker summary' });
  }
});

module.exports = app;