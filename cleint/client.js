const dotenv = require('dotenv');

dotenv.config({ path: './.env' });
const { Pool } = require('pg')

const client = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
});
client.on("error", (err) => {
  console.error("Unexpected DB error", err);
  // Optional: you can attempt reconnection here
});

module.exports = {client};