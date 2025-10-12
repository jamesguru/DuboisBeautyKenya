const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const dbConnection = async () => {
  const DB = process.env.DB;
  try {
    await mongoose.connect(DB).then(() => {
      console.log("Database is connected successfully");
    });
  } catch (error) {
    console.log(error);
    setTimeout(dbConnection, 5000);
  }
};

module.exports = dbConnection;