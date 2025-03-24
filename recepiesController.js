const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Replace with your actual Gemini API key
const GEMINI_API_KEY = 'AIzaSyCRnM8rw3UqAi9IU2zKpsOH08oKVM2-MJs';

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Function to generate text with Google Gemini API
const generateTextWithGemini = async (text) => {
  try {
    const prompt = `Extract ONLY the recipe-related information from the following text:

1. Recipe Title
2. Ingredients List
3. Instructions (Steps)

Return ONLY the extracted recipe text. DO NOT include anything else. NO filler, NO extra commentary, NO explanations—ONLY the relevant recipe text.

Text:
${text}
`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Error generating text with Gemini:', error);
    throw new Error('Failed to generate text with Google Gemini.');
  }
};

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
    const processedText = await generateTextWithGemini(recipeText);
    
    const result = await pool.query(
      'INSERT INTO recipes (name, body, link) VALUES ($1, $2, $3) RETURNING *',
      [name, processedText, link]
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

// Enhanced Recept scraping with dynamic selector and structured data extraction
const scrapeRecipe = async (link) => {
    try {
      const { data } = await axios.get(link);
      const $ = cheerio.load(data);
  
      // Initialize a variable to store all the text on the page
      let fullPageText = '';
  
      // Scrape all visible text from the page by selecting the body content
      // This will grab all text nodes in the body element, you can tweak the selector if needed
      $('body').each((i, el) => {
        fullPageText += $(el).text().trim() + ' ';
      });
  
      // Return all the text collected from the page
      return fullPageText.trim();
  
    } catch (err) {
      console.error('Error scraping the recipe:', err);
      throw new Error('Error occurred while scraping the recipe text.');
    }
  };
  

module.exports = { getRecipes, addRecipe, updateRecipe };
