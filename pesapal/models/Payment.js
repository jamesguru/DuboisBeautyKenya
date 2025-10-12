const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Request data
  email: String,
  reference: String,
  phone: String,
  first_name: String,
  last_name: String,
  amount: Number,
  description: String,
  
  // Payment provider data
  payment_provider: {
    type: String,
    default: "pesapal"
  },
  order_id: String,
  payment_reference: String,
  redirect_url: String,
  error_response: mongoose.Schema.Types.Mixed, // For storing error details
  error_status: Number,
  
  // Payment status
  status: {
    type: String,
    enum: ['initiated', 'completed', 'failed', 'cancelled'],
    default: 'initiated'
  },
  payment_status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Update the updated_at field before saving
paymentSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);