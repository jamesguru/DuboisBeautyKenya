
const express = require("express");
const dotenv = require("dotenv");
const pesapalRoute = require("./routes/pesapal");
const cors = require("cors");
const dbConnection = require("./Database/database.js");

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());


// ROUTES

app.use("/api/", pesapalRoute);


const PORT = process.env.PORT;



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  dbConnection();
});