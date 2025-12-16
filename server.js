// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Pool (Railway-safe)
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



// Test DB connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    return;
  }
  console.log('✅ Connected to MySQL database');
  connection.query('SELECT * FROM users LIMIT 5', (err, results) => {
    if (err) console.error('Query error:', err);
    else console.log('Sample users:', results);
    connection.release();
  });
});


/* =======================
   API ROUTES
======================= */

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email, password); // <- log incoming data

  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    console.log('DB results:', results); // <- log what DB returns
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    res.json(results[0]);
  });
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  const query = `
    SELECT j.*, c.company_name
    FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
  `;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get applicant applications
app.get('/api/applications/:userId', (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT app.*, j.job_title, c.company_name
    FROM applications app
    JOIN applicants a ON app.applicant_id = a.applicant_id
    JOIN jobs j ON app.job_id = j.job_id
    JOIN companies c ON j.company_id = c.company_id
    WHERE a.user_id = ?
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Apply to job
app.post('/api/apply', (req, res) => {
  const { job_id, user_id } = req.body;

  db.query(
    'SELECT applicant_id FROM applicants WHERE user_id = ?',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(404).json({ error: 'Applicant not found' });
      }

      const applicant_id = results[0].applicant_id;

      db.query(
        'INSERT INTO applications (job_id, applicant_id, status) VALUES (?, ?, "Pending")',
        [job_id, applicant_id],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Application submitted successfully', id: result.insertId });
        }
      );
    }
  );
});

// Company jobs + applications
app.get('/api/company-jobs/:userId', (req, res) => {
  const { userId } = req.params;

  const query = `
    SELECT j.*,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'application_id', app.application_id,
          'full_name', a.full_name,
          'skills', a.skills,
          'status', app.status
        )
      ) AS applications
    FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
    LEFT JOIN applications app ON j.job_id = app.job_id
    LEFT JOIN applicants a ON app.applicant_id = a.applicant_id
    WHERE c.user_id = ?
    GROUP BY j.job_id
  `;

  db.query(query, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    const jobs = results.map(job => ({
      ...job,
      applications: job.applications
        ? JSON.parse(job.applications).filter(a => a.application_id)
        : []
    }));

    res.json(jobs);
  });
});

// Post job
app.post('/api/jobs', (req, res) => {
  const { user_id, job_title, required_skills, location } = req.body;

  db.query(
    'SELECT company_id FROM companies WHERE user_id = ?',
    [user_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const company_id = results[0].company_id;

      db.query(
        'INSERT INTO jobs (company_id, job_title, required_skills, location) VALUES (?, ?, ?, ?)',
        [company_id, job_title, required_skills, location],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Job posted successfully', id: result.insertId });
        }
      );
    }
  );
});

// Update application status
app.put('/api/applications/:applicationId', (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;

  db.query(
    'UPDATE applications SET status = ? WHERE application_id = ?',
    [status, applicationId],
    err => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Application status updated' });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});