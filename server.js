// server.js
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MySQL Connection
const db = mysql.createConnection({
  host: 'caboose.proxy.rlwy.net',
  user: 'root',
  password: 'hQEeGuNYwfelcUZXxKRgduRGAuFMVZjN', // Change this to your MySQL password
  database: 'nagajobs_db',
  port: 13750
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// API Routes

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  const query = 'SELECT * FROM users WHERE email = ? AND password = ?';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    res.json(results[0]);
  });
});

// Get all jobs with company info
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

// Get applicant's applications
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
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Apply to a job
app.post('/api/apply', (req, res) => {
  const { job_id, user_id } = req.body;
  
  // Get applicant_id from user_id
  const getApplicantQuery = 'SELECT applicant_id FROM applicants WHERE user_id = ?';
  
  db.query(getApplicantQuery, [user_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    
    const applicant_id = results[0].applicant_id;
    
    // Insert application
    const insertQuery = 'INSERT INTO applications (job_id, applicant_id, status) VALUES (?, ?, "Pending")';
    
    db.query(insertQuery, [job_id, applicant_id], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Application submitted successfully', id: results.insertId });
    });
  });
});

// Get company's jobs with applications
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
      ) as applications
    FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
    LEFT JOIN applications app ON j.job_id = app.job_id
    LEFT JOIN applicants a ON app.applicant_id = a.applicant_id
    WHERE c.user_id = ?
    GROUP BY j.job_id
  `;
  
  db.query(query, [userId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Parse JSON and filter out null applications
    const jobs = results.map(job => ({
      ...job,
      applications: job.applications ? 
        JSON.parse(job.applications).filter(app => app.application_id !== null) : 
        []
    }));
    
    res.json(jobs);
  });
});

// Post a new job
app.post('/api/jobs', (req, res) => {
  const { user_id, job_title, required_skills, location } = req.body;
  
  // Get company_id from user_id
  const getCompanyQuery = 'SELECT company_id FROM companies WHERE user_id = ?';
  
  db.query(getCompanyQuery, [user_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    
    const company_id = results[0].company_id;
    
    // Insert job
    const insertQuery = 'INSERT INTO jobs (company_id, job_title, required_skills, location) VALUES (?, ?, ?, ?)';
    
    db.query(insertQuery, [company_id, job_title, required_skills, location], (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Job posted successfully', id: results.insertId });
    });
  });
});

// Update application status
app.put('/api/applications/:applicationId', (req, res) => {
  const { applicationId } = req.params;
  const { status } = req.body;
  
  const query = 'UPDATE applications SET status = ? WHERE application_id = ?';
  
  db.query(query, [status, applicationId], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Application status updated' });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});