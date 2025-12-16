// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection
const db = mysql.createConnection({
  host: 'caboose.proxy.rlwy.net',
  user: 'root',
  password: 'hQEeGuNYwfelcUZXxKRgduRGAuFMVZjN', // Change this to your MySQL password
  database: 'naga_jobs',
  port: 13570
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
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
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Get all companies
app.get('/api/companies', (req, res) => {
  db.query('SELECT * FROM companies', (err, results) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Register user
app.post('/api/register', async (req, res) => {
  const { email, password, role } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.query(
      'INSERT INTO users (email, pass, role) VALUES (?, ?, ?)',
      [email, hashedPassword, role],
      (err, result) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
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
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (results.length === 0) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
      }
      
      const user = results[0];
      const validPassword = await bcrypt.compare(password, user.pass);
      
      if (!validPassword) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
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
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

// Submit application
app.post('/api/applications', (req, res) => {
  const { applicantId, jobId, status } = req.body;
  
  db.query(
    'INSERT INTO applications (applicant_id, job_id, application_id, status) VALUES (?, ?, UUID(), ?)',
    [applicantId, jobId, status || 'pending'],
    (err, result) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
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
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(results);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});