const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const { getRecipes, addRecipe, updateRecipe } = require('./recipesController');
require('dotenv').config();

const app = express();
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.get('/recipes', getRecipes);
app.post('/recipes', addRecipe);
app.put('/recipes/:id', updateRecipe);

// Server indítása
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
