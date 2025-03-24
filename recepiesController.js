const pool = require('./database');
const axios = require('axios');
const cheerio = require('cheerio');

// Recept lista lekérdezése
const getRecipes = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM recipes');
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hiba történt a receptek lekérdezésekor.' });
  }
};

// Recept hozzáadása (link és név)
const addRecipe = async (req, res) => {
  const { link, name } = req.body;

  if (!link || !name) {
    return res.status(400).json({ error: 'Link és név megadása kötelező!' });
  }

  try {
    const recipeText = await scrapeRecipe(link);
    const result = await pool.query(
      'INSERT INTO recipes (name, body, link) VALUES ($1, $2, $3) RETURNING *',
      [name, recipeText, link]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hiba történt a recept hozzáadásakor.' });
  }
};

// Recept frissítése
const updateRecipe = async (req, res) => {
  const { id } = req.params;
  const { body } = req.body;

  try {
    const result = await pool.query(
      'UPDATE recipes SET body = $1 WHERE id = $2 RETURNING *',
      [body, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recept nem található.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Hiba történt a recept frissítésekor.' });
  }
};

// Recept scraping
const scrapeRecipe = async (link) => {
  try {
    const { data } = await axios.get(link);
    const $ = cheerio.load(data);
    const recipeText = $('div.recipe-text').text();  // Ezt a szelektort kell módosítani, hogy megfeleljen a céloldal struktúrájának
    return recipeText;
  } catch (err) {
    throw new Error('Hiba történt a recept szövegének begyűjtésekor.');
  }
};

module.exports = { getRecipes, addRecipe, updateRecipe };
