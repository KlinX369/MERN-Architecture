// utils/sendEmail.js

const nodemailer = require('nodemailer');


// =========================================================
// EMAIL TRANSPORTER
// =========================================================

const transporter = nodemailer.createTransport({
  service: 'gmail',

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});


// =========================================================
// SEND OTP EMAIL
// =========================================================
//
// purpose:
//   'authentication'  -> Login / registration OTP
//   'password-reset'  -> Forgot-password OTP
//
// The third argument is optional so all existing calls such as:
//
//   sendOTPEmail(email, otp)
//
// continue working exactly as before.
// =========================================================

const sendOTPEmail = async (
  email,
  otp,
  purpose = 'authentication'
) => {

  try {

    // Determine which type of email is being sent
    const isPasswordReset = purpose === 'password-reset';


    // =====================================================
    // EMAIL CONTENT
    // =====================================================

    const subject = isPasswordReset
      ? 'Your EduSphere password reset code'
      : 'Your EduSphere verification code';


    const emailTitle = isPasswordReset
      ? 'Reset your EduSphere password'
      : 'Verify your EduSphere account';


    const sectionLabel = isPasswordReset
      ? 'Password reset'
      : 'Account security';


    const description = isPasswordReset
      ? 'Use the verification code below to verify your identity and continue resetting your EduSphere password.'
      : 'Use the verification code below to complete your authentication request.';


    const expiryText = isPasswordReset
      ? 'This password reset code expires in 10 minutes.'
      : 'This verification code expires in 10 minutes.';


    const unexpectedRequestText = isPasswordReset
      ? 'If you did not request a password reset, you can safely ignore this email. Your current password will remain unchanged.'
      : 'If you did not request this code, you can safely ignore this email.';


    // =====================================================
    // MAIL OPTIONS
    // =====================================================

    const mailOptions = {

      from: `"EduSphere" <${process.env.EMAIL_USER}>`,

      to: email,

      subject,


      // ===================================================
      // PLAIN-TEXT FALLBACK
      // ===================================================

      text: isPasswordReset
        ? `Your EduSphere password reset code is: ${otp}.

This code will expire in 10 minutes.

For your security, never share this code with anyone.

If you did not request a password reset, you can safely ignore this email.

EduSphere
Learning technology for every student.`
        : `Your EduSphere verification code is: ${otp}.

This code will expire in 10 minutes.

For your security, never share this code with anyone.

If you did not request this code, you can safely ignore this email.

EduSphere
Learning technology for every student.`,


      // ===================================================
      // HTML EMAIL
      // ===================================================

      html: `
<!DOCTYPE html>
<html lang="en">

<head>

  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="color-scheme"
    content="light"
  >

  <meta
    name="supported-color-schemes"
    content="light"
  >

  <title>${subject}</title>


  <style>

    /* =========================================
       RESPONSIVE EMAIL STYLES
       ========================================= */

    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
    }


    body {
      background: #f4f6f8;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }


    table {
      border-spacing: 0;
      border-collapse: collapse;
    }


    img {
      border: 0;
      display: block;
      max-width: 100%;
    }


    .email-wrapper {
      width: 100%;
      padding: 40px 16px;
      box-sizing: border-box;
    }


    .email-container {
      width: 100%;
      max-width: 560px;
      margin: 0 auto;
    }


    .email-card {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e7eaf0;
      border-radius: 18px;
      overflow: hidden;
    }


    .email-header {
      padding: 28px 36px;
      border-bottom: 1px solid #eef1f5;
    }


    .email-content {
      padding: 38px 36px;
    }


    .email-footer {
      padding: 24px 36px;
      background: #f8fafc;
      border-top: 1px solid #eef1f5;
    }


    .email-title {
      margin: 0 0 14px;
      font-size: 28px;
      line-height: 1.25;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #111827;
    }


    .email-description {
      margin: 0 0 28px;
      font-size: 15px;
      line-height: 1.7;
      color: #526074;
    }


    .otp-container {
      width: 100%;
      box-sizing: border-box;
      padding: 24px 16px;
      margin-bottom: 24px;
      text-align: center;
      background: #f8fafc;
      border: 1px solid #e5eaf1;
      border-radius: 14px;
    }


    .otp-label {
      margin-bottom: 10px;
      font-size: 11px;
      line-height: 1.4;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #64748b;
    }


    .otp-code {
      display: block;
      width: 100%;
      box-sizing: border-box;
      font-size: 32px;
      line-height: 1.2;
      font-weight: 800;
      letter-spacing: 5px;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
    }


    .otp-expiry {
      margin-top: 10px;
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
    }


    .security-box {
      padding: 15px 17px;
      margin-bottom: 24px;
      background: #fff8e8;
      border: 1px solid #f5dfad;
      border-radius: 12px;
    }


    .security-text {
      margin: 0;
      font-size: 13px;
      line-height: 1.65;
      color: #6b5a2a;
    }


    .footer-text {
      margin: 0;
      font-size: 11px;
      line-height: 1.6;
      color: #94a3b8;
    }


    /* =========================================
       TABLETS / SMALLER SCREENS
       ========================================= */

    @media only screen and (max-width: 600px) {

      .email-wrapper {
        padding: 20px 10px !important;
      }


      .email-card {
        border-radius: 14px !important;
      }


      .email-header {
        padding: 23px 22px !important;
      }


      .email-content {
        padding: 29px 22px !important;
      }


      .email-footer {
        padding: 22px !important;
      }


      .email-title {
        font-size: 24px !important;
        line-height: 1.3 !important;
      }


      .email-description {
        font-size: 14px !important;
        line-height: 1.65 !important;
        margin-bottom: 24px !important;
      }


      .otp-container {
        padding: 21px 12px !important;
        border-radius: 12px !important;
      }


      .otp-code {
        font-size: 27px !important;
        letter-spacing: 4px !important;
      }


      .otp-expiry {
        font-size: 12px !important;
      }


      .security-box {
        padding: 14px !important;
      }


      .security-text {
        font-size: 12px !important;
      }

    }


    /* =========================================
       VERY SMALL PHONES
       ========================================= */

    @media only screen and (max-width: 380px) {

      .email-wrapper {
        padding: 12px 7px !important;
      }


      .email-header {
        padding: 21px 18px !important;
      }


      .email-content {
        padding: 25px 18px !important;
      }


      .email-footer {
        padding: 20px 18px !important;
      }


      .email-title {
        font-size: 21px !important;
      }


      .email-description {
        font-size: 13px !important;
      }


      .otp-container {
        padding: 19px 8px !important;
      }


      .otp-code {
        font-size: 23px !important;
        letter-spacing: 3px !important;
      }


      .otp-label {
        font-size: 10px !important;
      }


      .otp-expiry {
        font-size: 11px !important;
      }


      .security-text {
        font-size: 11.5px !important;
      }

    }


    /* =========================================
       EXTREMELY NARROW DEVICES
       ========================================= */

    @media only screen and (max-width: 320px) {

      .email-content {
        padding: 22px 15px !important;
      }


      .otp-container {
        padding-left: 5px !important;
        padding-right: 5px !important;
      }


      .otp-code {
        font-size: 21px !important;
        letter-spacing: 2px !important;
      }


      .email-title {
        font-size: 20px !important;
      }

    }

  </style>

</head>


<body>

  <!-- =========================================
       EMAIL WRAPPER
       ========================================= -->

  <div class="email-wrapper">

    <div class="email-container">

      <!-- =====================================
           EMAIL CARD
           ===================================== -->

      <div class="email-card">


        <!-- ===================================
             HEADER
             =================================== -->

        <div class="email-header">

          <div
            style="
              font-size:24px;
              line-height:1;
              font-weight:800;
              letter-spacing:-0.6px;
              color:#111827;
            "
          >
            Edu<span style="color:#2563eb;">Sphere</span>
          </div>

        </div>


        <!-- ===================================
             MAIN CONTENT
             =================================== -->

        <div class="email-content">


          <!-- Section label -->

          <div
            style="
              margin-bottom:10px;
              font-size:11px;
              line-height:1.4;
              font-weight:700;
              letter-spacing:1.2px;
              text-transform:uppercase;
              color:#64748b;
            "
          >
            ${sectionLabel}
          </div>


          <!-- Heading -->

          <h1 class="email-title">
            ${emailTitle}
          </h1>


          <!-- Description -->

          <p class="email-description">
            ${description}
          </p>


          <!-- =================================
               OTP CONTAINER
               ================================= -->

          <div class="otp-container">

            <div class="otp-label">
              ${isPasswordReset
                ? 'Password reset code'
                : 'Verification code'}
            </div>


            <!-- Responsive OTP -->

            <div class="otp-code">
              ${otp}
            </div>


            <div class="otp-expiry">
              ${expiryText}
            </div>

          </div>


          <!-- =================================
               SECURITY NOTICE
               ================================= -->

          <div class="security-box">

            <p class="security-text">

              <strong>Security reminder:</strong>

              Never share this code with anyone, including someone
              claiming to be EduSphere support.

            </p>

          </div>


          <!-- =================================
               UNEXPECTED REQUEST
               ================================= -->

          <p
            style="
              margin:0;
              font-size:13px;
              line-height:1.7;
              color:#64748b;
            "
          >
            ${unexpectedRequestText}
          </p>


        </div>


        <!-- ===================================
             FOOTER
             =================================== -->

        <div class="email-footer">

          <p
            style="
              margin:0 0 7px;
              font-size:12px;
              line-height:1.6;
              color:#64748b;
            "
          >
            This is an automated security message from EduSphere.
          </p>


          <p class="footer-text">
            Please do not share your verification code with anyone.
          </p>

        </div>


      </div>


      <!-- =====================================
           COPYRIGHT
           ===================================== -->

      <div
        style="
          margin-top:18px;
          text-align:center;
          font-size:11px;
          line-height:1.6;
          color:#94a3b8;
        "
      >
        © ${new Date().getFullYear()} EduSphere.
        All rights reserved.
      </div>


    </div>

  </div>

</body>

</html>
`
    };


    // =====================================================
    // SEND EMAIL
    // =====================================================

    await transporter.sendMail(mailOptions);

    console.log(
      `${isPasswordReset ? 'Password reset' : 'OTP'} email sent to ${email}`
    );

  } catch (error) {

    console.error(
      'Error sending OTP email:',
      error
    );

    throw new Error(
      'Could not send authentication email'
    );
  }
};


module.exports = sendOTPEmail;