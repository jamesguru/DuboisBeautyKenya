const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const router = express.Router();
const pool = require("../Database/database.js");
const Payment = require('../models/Payment'); 

dotenv.config();

// Fetch auth token
async function getAccessToken() {
  const { data } = await axios.post("https://pay.pesapal.com/v3/api/Auth/RequestToken", {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET
  });
  return data.token;
}

// ✅ Register IPN URL for Pesapal


// Register IPN URL
async function registerIPN(token) {
  const res = await axios.post(
    "https://pay.pesapal.com/v3/api/URLSetup/RegisterIPN",
    {
      url: "https://payment.duboisbeauty.co.ke/api/pesapal/callback",
      ipn_notification_type: "GET"
    },
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  console.log("IPN", res.data.ipn_id);
  return res.data.ipn_id;
}

// ✅ Function to save payment to MongoDB
async function savePaymentToDatabase(paymentData) {
  try {
    // Assuming you have a Payment model
  // Adjust path as needed
    const payment = new Payment(paymentData);
    await payment.save();
    console.log(`✅ Payment record saved with ID: ${payment._id}`);
    return payment;
  } catch (error) {
    console.error("❌ Error saving payment to database:", error);
    throw error;
  }
}

// Check Pesapal payment status
async function checkTransactionStatus(orderTrackingId, token) {
  const { data } = await axios.get(
    `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  return data;
}

// Payment route
router.post("/payment", async (req, res) => {
  const {
    email,
    reference,
    phone,
    first_name,
    last_name,
    amount,
    description
  } = req.body;


  try {
    const token = await getAccessToken();
    const notificationId = await registerIPN(token);
    
    // Use the reference from the request body (order ID) or generate a new one
    const orderId = reference || `DB-${Date.now()}`;

    const orderData = {
      id: orderId,
      currency: "KES",
      amount: amount, // Use the actual amount from request
      description: description || `Payment for order ${orderId}`,
      callback_url: "https://duboisbeauty.co.ke/myorders", // ✅ frontend callback!
      notification_id: notificationId,
      billing_address: {
        email_address: email, // Fixed: use email from req.body
        phone_number: phone,  // Fixed: use phone from req.body
        first_name: first_name, // Fixed: use first_name from req.body
        last_name: last_name   // Fixed: use last_name from req.body
      }
    };


    const response = await axios.post(
      "https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest",
      orderData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );



    // ✅ Create payment record in MongoDB for successful payment initiation
    const paymentRecord = {
      // Data from request
      ...req.body,
      
      // Data from payment provider response
      payment_provider: "pesapal",
      order_id: orderId,
      payment_reference: response.data.order_tracking_id,
      redirect_url: response.data.redirect_url,
      
      // Payment status
      status: "initiated", // Payment initiated, waiting for user action
      payment_status: "pending",
      
      // Timestamps
      created_at: new Date(),
      updated_at: new Date()
    };

    // Save to MongoDB
    await savePaymentToDatabase(paymentRecord);
    res.json(response.data.redirect_url);

  } catch (err) {
    console.error("❌ Pesapal Error:", err.response?.data || err.message);
    
    // Log detailed error information
    if (err.response) {
      console.error("Error response status:", err.response.status);
      console.error("Error response data:", err.response.data);
    }
    
    // ✅ Create failed payment record in MongoDB
    const failedPaymentRecord = {
      // Data from request
      ...req.body,
      
      // Data from payment provider error response
      payment_provider: "pesapal",
      order_id: reference || `DB-${Date.now()}`,
      error_response: err.response?.data || err.message,
      error_status: err.response?.status,
      
      // Payment status
      status: "failed",
      payment_status: "failed",
      
      // Timestamps
      created_at: new Date(),
      updated_at: new Date()
    };

    // Save failed payment to MongoDB
    await savePaymentToDatabase(failedPaymentRecord);
    console.log("💾 Failed payment record saved to database");

    res.status(500).json({ 
      error: err.response?.data || err.message,
      details: "Payment gateway error occurred"
    });
  }
});


// Server-side callback (Pesapal backend hits this to notify you)
router.get("/callback", async (req, res) => {
  const { OrderTrackingId, OrderMerchantReference } = req.query;

  try {
    const token = await getAccessToken();
    const statusInfo = await checkTransactionStatus(OrderTrackingId, token);
    const status = statusInfo.payment_status_description.toUpperCase();

    let action = statusInfo.payment_status_code;

    if (!action) {
      action = "user accepted payment";
    }

    // 1. Update payment record in MongoDB
    const Payment = require('../models/Payment'); // Adjust path as needed
    
    const updatedPayment = await Payment.findOneAndUpdate(
      { order_id: OrderMerchantReference }, // Find by order reference
      { 
        status: status.toLowerCase(),
        payment_status: status === "COMPLETED" ? "success" : "failed",
        payment_reference: OrderTrackingId,
        updated_at: new Date(),
        status_details: statusInfo // Store full status info for reference
      },
      { new: true } // Return updated document
    );

    if (!updatedPayment) {
      return res.status(404).json({ error: "Payment record not found" });
    }

    console.log(`✅ Payment updated: ${OrderMerchantReference} -> ${status}`);

    if (status !== "COMPLETED") {
      return res.status(200).json({
        message: "Payment not completed yet",
        status,
        reference: OrderMerchantReference
      });
    }

    // 2. Find and update the corresponding order
    const Order = require('../models/Order'); // Adjust path as needed
    
    const order = await Order.findOne({ 
      _id: updatedPayment.orderId || OrderMerchantReference 
    });

    if (!order) {
      return res.status(404).json({ 
        error: "Order not found for this payment",
        reference: OrderMerchantReference 
      });
    }

    order.status = 2; // Update this based on your status mapping
    await order.save();

    console.log(`✅ Order updated: ${order._id} -> status ${order.status}`);

    res.status(200).json({
      message: "Callback processed successfully",
      status: status,
      reference: OrderMerchantReference,
      order_id: order._id,
      payment_id: updatedPayment._id
    });

  } catch (err) {
    console.error("❌ Failed to process callback:", err.message);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

// API endpoint to let frontend check payment status
router.get("/status", async (req, res) => {
  const { trackingId, reference } = req.query;

  try {
    const token = await getAccessToken();
    const statusInfo = await checkTransactionStatus(trackingId, token);

    res.json({
      status: statusInfo.payment_status_description,
      reference: reference
    });
  } catch (err) {
    console.error("Status check failed:", err.message);
    res.status(500).json({ error: "Could not retrieve payment status" });
  }
});

module.exports = router;
