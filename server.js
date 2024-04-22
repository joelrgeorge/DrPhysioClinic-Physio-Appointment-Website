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
app.set('views', path.join(__dirname)); // Set views directory to current directory

// Serve static files from the 'assets' directory
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Serve static files (CSS, JS, images) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: true }));

// Parse JSON bodies (as sent by API clients)
app.use(bodyParser.json());

// MongoDB connection
const username = 'mern_user';
const password = 'Bluelegion';
const dbName = 'PhysioClinic';

mongoose.connect(`mongodb+srv://${username}:${password}@cluster0.qkrprta.mongodb.net/${dbName}?retryWrites=true&w=majority`, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

const AppointmentSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  address: String,
  phoneNumber: Number, // Assuming phone number is stored as a string
});

const Appointment = mongoose.model('Appointment', AppointmentSchema);

const ContactSchema = new mongoose.Schema({
  username: String,
  email: String,
  phoneNumber: String, // Assuming phone number is stored as a string
  message: String
});

const Contact = mongoose.model('Contact', ContactSchema);

const smtpTransporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 587,
  auth: {
    user: 'support@drphysioclinic.org',
    pass: 'Drphysioclinic@123',
  },
});

// Define route for handling form submissions for appointments
app.post('/submit_form', async (req, res) => {
  try {
    const formData = req.body;

    const appointment = new Appointment(formData);
    await appointment.save();

    const mailOptions = {
      from: 'support@drphysioclinic.org',
      to: 'support@drphysioclinic.org',
      subject: 'New Appointment',
      text: JSON.stringify(formData, null, 2),
    };

    await smtpTransporter.sendMail(mailOptions);

    // Log a success message
    console.log('Appointment form submitted successfully');

    // Read the HTML content from thankyou.html (assuming it's in the root directory)
    const thankyouHtml = fs.readFileSync('./thankyou.html', 'utf8');

    // Send the HTML content as a response
    res.send(thankyouHtml);
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred.');
  }
});

// Define route for handling form submissions for contacts
app.post('/submit_contact', async (req, res) => {
  try {
    const contactData = req.body;

    // Create new contact instance
    const contact = new Contact(contactData);

    // Save contact data to MongoDB
    await contact.save();

    // Send email notification
    const mailOptions = {
      from: 'support@drphysioclinic.org',
      to: 'support@drphysioclinic.org',
      subject: 'New Contact Form Submission',
      text: JSON.stringify(contactData, null, 2),
    };

    await smtpTransporter.sendMail(mailOptions);

    // Log a success message
    console.log('Contact form submitted successfully');

    // Read the HTML content from thankyou.html (assuming it's in the root directory)
    const thankyouHtml = fs.readFileSync('./thankyou.html', 'utf8');

    // Send the HTML content as a response
    res.send(thankyouHtml);
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).send('An error occurred while submitting the contact form.');
  }
});

// Define routes for rendering pages
app.get('/', (req, res) => {
    res.render('pages/index', { title: 'Home' }); // Render the 'index.ejs' file
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

app.listen(port, () => {
    console.log(`Server is listening at http://localhost:${port}`);
});