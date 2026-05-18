require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const fs = require('fs');

const port = process.env.PORT || 3000;

const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = encodeURIComponent(process.env.DB_PASSWORD);
const DB_NAME = process.env.DB_NAME;

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

mongoose.connect(
  `mongodb://${DB_USERNAME}:${DB_PASSWORD}@ac-5fiicoe-shard-00-00.qkrprta.mongodb.net:27017,ac-5fiicoe-shard-00-01.qkrprta.mongodb.net:27017,ac-5fiicoe-shard-00-02.qkrprta.mongodb.net:27017/${DB_NAME}?ssl=true&replicaSet=atlas-q8hcx9-shard-0&authSource=admin&retryWrites=true&w=majority`
)
.then(() => {
  console.log("Connected to MongoDB");
})
.catch((error) => {
  console.error("Error connecting to MongoDB:", error);
});

  const AppointmentSchema = new mongoose.Schema(
    {
      firstName: String,
      lastName: String,
      email: String,
      address: String,
      phoneNumber: String,
    },
    {
      timestamps: true
    }
  );

const Appointment = mongoose.model('Appointment', AppointmentSchema);

  const ContactSchema = new mongoose.Schema(
    {
    username: String,
    email: String,
    phoneNumber: String,
    message: String,
    },
    {
      timestamps:true
    }
  );
  
const Contact = mongoose.model('Contact', ContactSchema);

const smtpTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),  
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Define route for handling form submissions for appointments
  app.post('/submit_form', async (req, res) => {
  try {
  const appointment = new Appointment(req.body);
  await appointment.save();
  
  console.log('Saved to MongoDB');
  
  // Send email but don't crash if it fails
  smtpTransporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.SMTP_USER,
    subject: 'New Appointment',
    text: JSON.stringify(req.body, null, 2),
  }).catch(err => {
    console.error("Email failed:", err);
  });
  
  const thankyouHtml = fs.readFileSync(
    path.join(__dirname, 'thankyou.html'),
    'utf8'
  );
  
  res.send(thankyouHtml);
  
  } catch (error) {
  console.error("REAL ERROR:", error);
  res.status(500).send('Something went wrong.');
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
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
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