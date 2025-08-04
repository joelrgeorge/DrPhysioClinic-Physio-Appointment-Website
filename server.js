require('dotenv').config(); // Load env variables

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');

const port = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Set the directory where your views (EJS templates) are located
app.set('views', path.join(__dirname));

// Serve static files from the 'assets' and 'public' directories
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));

// Parse body
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// MongoDB connection
const username = process.env.DB_USERNAME;
const password = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

mongoose.connect(
  `mongodb+srv://${username}:${password}@cluster0.qkrprta.mongodb.net/${dbName}?retryWrites=true&w=majority`,
  { useNewUrlParser: true, useUnifiedTopology: true }
)
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// Mongoose Schemas
const AppointmentSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  address: String,
  phoneNumber: Number,
});
const Appointment = mongoose.model('Appointment', AppointmentSchema);

const ContactSchema = new mongoose.Schema({
  username: String,
  email: String,
  phoneNumber: String,
  message: String,
});
const Contact = mongoose.model('Contact', ContactSchema);

// SMTP Transporter using env
const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Handle appointment form
app.post('/submit_form', async (req, res) => {
  try {
    const formData = req.body;
    const appointment = new Appointment(formData);
    await appointment.save();

    await smtpTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'New Appointment',
      text: JSON.stringify(formData, null, 2),
    });

    console.log('Appointment form submitted successfully');
    const thankyouHtml = fs.readFileSync('./thankyou.html', 'utf8');
    res.send(thankyouHtml);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred.');
  }
});

// Handle contact form
app.post('/submit_contact', async (req, res) => {
  try {
    const contactData = req.body;
    const contact = new Contact(contactData);
    await contact.save();

    await smtpTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: 'New Contact Form Submission',
      text: JSON.stringify(contactData, null, 2),
    });

    console.log('Contact form submitted successfully');
    const thankyouHtml = fs.readFileSync('./thankyou.html', 'utf8');
    res.send(thankyouHtml);
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).send('An error occurred while submitting the contact form.');
  }
});

// Page routes
app.get('/', (req, res) => {
  res.render('pages/index', { title: 'Home' });
});

app.get('/testimonials', (req, res) => {
  res.render('pages/testimonials', { title: 'Testimonials' });
});

app.get('/about', (req, res) => {
  res.render('pages/about', { title: 'About Us' });
});

app.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us' });
});

app.get('/services', (req, res) => {
  res.render('pages/services', { title: 'Our Services' });
});

// Start server
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});
