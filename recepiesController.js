const axios = require('axios');
const cheerio = require('cheerio');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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

// Enhanced Recept scraping with dynamic selector and structured data extraction
const scrapeRecipe = async (link) => {
    try {
      const { data } = await axios.get(link);
      const $ = cheerio.load(data);
  
      let recipeText = '';
      let ingredients = '';
      let instructions = '';
  
      // Check for structured data using JSON-LD (schema.org)
      const structuredData = $('script[type="application/ld+json"]').html();
      if (structuredData) {
        const jsonData = JSON.parse(structuredData);
        if (jsonData['@type'] === 'Recipe') {
          // Extract structured data (if available)
          recipeText += `Title: ${jsonData.name}\n`;
          ingredients = jsonData.recipeIngredient.join(', ');
          instructions = jsonData.recipeInstructions.map((step) => step.text).join('\n');
        }
      }
  
      // If no structured data, try scraping using common patterns and selectors
      if (!ingredients || !instructions) {
        // 1. Try using common selectors for recipes
        const possibleSelectors = [
          'article', // General article-based content
          'div.recipe-text', // Common class used for recipe content
          'div#recipe', // Specific div with id "recipe"
          'div.entry-content', // Wordpress often uses this for recipe posts
          'section.recipe', // Section that contains recipe
          'div.recipe-container', // Some websites use a container class for recipes
        ];
  
        for (const selector of possibleSelectors) {
          if ($(selector).length > 0) {
            recipeText = $(selector).text().trim();
            break;
          }
        }
  
        // 2. Look for ingredients section if not found
        if (!ingredients) {
          ingredients = $('h2:contains(Ingredients), h3:contains(Ingredients)').next().text().trim();
        }
  
        // 3. Look for instructions section if not found
        if (!instructions) {
          instructions = $('h2:contains(Instructions), h3:contains(Instructions)').next().text().trim();
        }
  
        // If no specific sections found, try generic headings
        if (!ingredients || !instructions) {
          const headings = ['Ingredients', 'Instructions', 'Directions', 'Preparation', 'Method'];
          headings.forEach((heading) => {
            const section = $(`h2:contains(${heading}), h3:contains(${heading})`).next();
            if (section.length > 0) {
              if (heading.toLowerCase().includes('ingredient')) {
                ingredients = section.text().trim();
              } else {
                instructions = section.text().trim();
              }
            }
          });
        }
      }
  
      // Clean up the recipe text by removing excessive whitespace
      recipeText = recipeText.replace(/\s+/g, ' ').trim();
  
      // Return a combined recipe
      return {
        title: $('h1, h2').first().text().trim() || 'Unknown Recipe Title',
        ingredients: ingredients || 'Ingredients not found',
        instructions: instructions || 'Instructions not found',
        fullText: recipeText || 'Recipe text not found'
      };
  
    } catch (err) {
      console.error('Error scraping the recipe:', err);
      throw new Error('Hiba történt a recept szövegének begyűjtésekor.');
    }
  };

module.exports = { getRecipes, addRecipe, updateRecipe };
