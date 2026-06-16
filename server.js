require('dotenv').config();

const ejs = require("ejs");
const express = require('express');
const app = express();
app.set("trust proxy", 1);
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const axios = require("axios");
const nodemailer = require('nodemailer');
const fs = require('fs');

const port = process.env.PORT || 3000;

const DB_USERNAME = process.env.DB_USERNAME;
const DB_PASSWORD = encodeURIComponent(process.env.DB_PASSWORD);
const DB_NAME = process.env.DB_NAME;

const SKIP_TURNSTILE =
  process.env.SKIP_TURNSTILE === "true";

const rateLimit =
  require("express-rate-limit");

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

  function validateHumanSubmission(req, res) {

  // Honeypot check
  if (req.body.website) {

    console.warn(
      `[BOT] Turnstile failed: ${req.ip}`
    );

    res.status(400).send("Invalid submission");
    return false;
  }

  // Timestamp check
  const loadTime =
    Number(req.body.formLoadedAt);

  if (!loadTime) {

    console.warn(
      "[BOT] Missing timestamp:",
      req.ip
    );

    res.status(400).send("Verification failed");
    return false;
  }

  const elapsed =
    Date.now() - loadTime;

  if (elapsed < 3000) {

    console.warn(
      `[BOT] Submitted too quickly (${elapsed}ms):`,
      req.ip
    );

    res.status(400).send("Verification failed");
    return false;
  }

  return true;
}

async function verifyTurnstile(token) {

  if (SKIP_TURNSTILE) {
    console.log(
      "[DEV] Turnstile verification skipped"
    );
    return true;
  }

  try {

    const response =
      await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        new URLSearchParams({
          secret:
            process.env.TURNSTILE_SECRET,
          response: token,
        }),
        {
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
        }
      );

    return response.data.success;

  } catch (err) {

    console.error(
      "Turnstile verification failed:",
      err.message
    );

    return false;
  }
}

const AppointmentSchema = new mongoose.Schema({
  name: String,
  email: String,
  phoneNumber: String,

  condition: String,
  preferredDate: String,

  painDescription: String,
  treatment: String,
  preferredTime: String,
  additionalNotes: String,
}, {
  timestamps: true
});

  const Appointment = mongoose.model('Appointment', AppointmentSchema);

const ContactSchema = new mongoose.Schema(
{
  name: String,
  email: String,
  phone: String,

  enquiryType: String,
  condition: String,

  message: String,
},
{
  timestamps: true
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

async function emitEvent(payload) {
  try {
    await axios.post(
      process.env.N8N_WEBHOOK_URL,
      payload
    );
  } catch (err) {
    console.error(
      "Event dispatch failed:",
      err.message
    );
  }
}

const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 3,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many submissions. Please try again later."
  },

  handler: (req, res) => {

    console.warn(
      `[RATE LIMIT] ${req.ip}`
    );

    return res.status(429).send(
      "Too many submissions. Please try again later."
    );

  }
});

app.post(
  '/submit_form',
  formLimiter,
  async (req, res) => {

if (!SKIP_TURNSTILE) {

  const turnstileToken =
    req.body["cf-turnstile-response"];

  if (!turnstileToken) {

    console.warn(
      "[BOT] Missing Turnstile token"
    );

    return res
      .status(400)
      .send("Verification failed");
  }

  const verified =
    await verifyTurnstile(
      turnstileToken
    );

  if (!verified) {

    console.warn(
      "[BOT] Turnstile failed"
    );

    return res
      .status(400)
      .send("Verification failed");
  }
}

  try {

    console.log(
      "\n========== APPOINTMENT =========="
    );

    console.log(
      "BODY:",
      JSON.stringify(req.body, null, 2)
    );

    if (!validateHumanSubmission(req, res)) {
      return;
    }

    const appointment =
      new Appointment(req.body);

    await appointment.save();

    console.log(
      "Appointment saved:",
      appointment._id
    );

    emitEvent({
      event: "AppointmentSubmitted",
      timestamp: new Date().toISOString(),
      source: "website",
      version: 1,
      data: {
        name: appointment.name,
        email: appointment.email,
        phoneNumber: appointment.phoneNumber,

        condition:
          appointment.condition,

        preferredDate:
          appointment.preferredDate,

        painDescription:
          appointment.painDescription,

        treatment:
          appointment.treatment,

        preferredTime:
          appointment.preferredTime,

        additionalNotes:
          appointment.additionalNotes,
      },
    });

    const html = await ejs.renderFile(
      path.join(
        __dirname,
        "emails",
        "appointment-email.ejs"
      ),
      {
        appointment,
        receivedAt:
          new Date().toLocaleString(),
        clinicName:
          "Dr. Physio Clinic",
        logoUrl:
          "https://drphysioclinic.org/assets/logo.png"
      }
    );

    await smtpTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject:
        `New Appointment - ${appointment.name}`,
      html
    }).then(() => {

      console.log(
        "Appointment email sent"
      );

    }).catch(err => {

      console.error(
        "Appointment email failed:",
        err
      );

    });

    res.render('thankyou', {
      name: appointment.name,
      pageTitle: 'Appointment Request Received',
      message:
        'We have successfully received your appointment request and will contact you shortly to confirm your consultation.'
    });

  } catch (error) {

    console.error(
      "APPOINTMENT ERROR:",
      error
    );

    res
      .status(500)
      .send('Something went wrong.');

  }

});

// Define route for handling form submissions for contacts
app.post(
  '/submit_contact',
  formLimiter,
  async (req, res) => {

if (!SKIP_TURNSTILE) {

  const turnstileToken =
    req.body["cf-turnstile-response"];

  if (!turnstileToken) {
    return res
      .status(400)
      .send("Verification failed");
  }

  const verified =
    await verifyTurnstile(
      turnstileToken
    );

  if (!verified) {
    return res
      .status(400)
      .send("Verification failed");
  }
}

if (!validateHumanSubmission(req, res)) {
  return;
}

  try {

    console.log("CONTACT ROUTE HIT");

    const contactData = req.body;

    console.log(
      "CONTACT BODY:",
      JSON.stringify(req.body, null, 2)
    );

    // Create new contact instance
    const contact = new Contact(contactData);

    // Save contact data to MongoDB
    await contact.save();

    console.log(
      "Contact saved:",
      contact._id
    );

    console.log(
      "Contact document:",
      contact
    );

    emitEvent({
      event: "ContactFormSubmitted",
      timestamp: new Date().toISOString(),
      source: "website",
      version: 1,
      data: {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,

        enquiryType:
          contact.enquiryType,

        condition:
          contact.condition,

        message:
          contact.message,
      },
    });

    // Send email notification
    const html = await ejs.renderFile(
      path.join(
        __dirname,
        "emails",
        "contact-email.ejs"
      ),
      {
        contact,
        receivedAt:
          new Date().toLocaleString(),
        clinicName:
          "Dr. Physio Clinic",
        logoUrl:
          "https://drphysioclinic.org/assets/logo.png"
      }
    );

    await smtpTransporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject:
        `New Contact Form Submission - ${contact.name}`,
      html
    });

    // Log a success message
    console.log('Contact form submitted successfully');

    // Send the HTML content as a response
    res.render('thankyou', {
      name: contact.name,
      pageTitle: 'Message Received',
      message:
        'Thank you for contacting Dr Physio Clinic. Our team will review your enquiry and get back to you as soon as possible.'
    });
  } catch (error) {

    console.error(
      "CONTACT ERROR:"
    );

    console.error(error);

    console.error(
      error.stack
    );

    res.status(500).send(
      'An error occurred while submitting the contact form.'
    );

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