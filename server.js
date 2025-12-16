require('dotenv').config(); // To handle environment variables
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT
});

// Handle MySQL connection error
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    process.exit(1);  // Exit the process if DB connection fails
  }
  console.log('Connected to MySQL database');
});

// Routes

// Get all jobs with company details
app.get('/api/jobs', (req, res) => {
  const query = `
    SELECT j.*, c.company_name 
    FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
  `;
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Get all companies
app.get('/api/companies', (req, res) => {
  db.query('SELECT * FROM companies', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Register user
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      'INSERT INTO users (email, pass, role) VALUES (?, ?, ?)',
      [email, hashedPassword, role],
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          message: 'User registered successfully',
          userId: result.insertId
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.query(
    'SELECT * FROM users WHERE email = ?',
    [email],
    async (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (results.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const user = results[0];
      const validPassword = await bcrypt.compare(password, user.pass);

      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      res.json({
        message: 'Login successful',
        user: {
          user_id: user.user_id,
          email: user.email,
          role: user.role
        }
      });
    }
  );
});

// Get applicants
app.get('/api/applicants', (req, res) => {
  const query = `
    SELECT a.*, u.email 
    FROM applicants a
    JOIN users u ON a.user_id = u.user_id
  `;
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Submit application
app.post('/api/applications', (req, res) => {
  const { applicantId, jobId, status } = req.body;

  if (!applicantId || !jobId) {
    return res.status(400).json({ error: 'Applicant ID and Job ID are required.' });
  }

  db.query(
    'INSERT INTO applications (applicant_id, job_id, application_id, status) VALUES (?, ?, UUID(), ?)',
    [applicantId, jobId, status || 'pending'],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        message: 'Application submitted successfully',
        applicationId: result.insertId
      });
    }
  );
});

// Get applications by user
app.get('/api/applications/:userId', (req, res) => {
  const query = `
    SELECT ap.*, j.job_title, c.company_name
    FROM applications ap
    JOIN jobs j ON ap.job_id = j.job_id
    JOIN companies c ON j.company_id = c.company_id
    WHERE ap.applicant_id = ?
  `;
  db.query(query, [req.params.userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});