const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const { getRecipes, addRecipe, updateRecipe } = require('./recepiesController');
require('dotenv').config();

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors({
    origin: 'https://makoveimiron.github.io', // Adjust this based on your frontend's URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));

app.options('*', cors()); // Engedélyez minden preflight kérést

app.use(express.json());

// Routes
app.get('/recipes', getRecipes);
app.post('/recipes', addRecipe);
app.put('/recipes/:id', updateRecipe);

// Server indítása
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


module.exports = {pool}
