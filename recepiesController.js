const axios = require('axios');
const cheerio = require('cheerio');
const { Pool } = require('pg');
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
        const possibleSelectors = [
          'article', 
          'div.recipe-text', 
          'div#recipe', 
          'div.entry-content', 
          'section.recipe', 
          'div.recipe-container',
          'div.instructions', // Additional common selector
          'div.method', // Instructions might be listed here
          'div#ingredients', // Try more targeted selectors
        ];
  
        for (const selector of possibleSelectors) {
          if ($(selector).length > 0) {
            recipeText = $(selector).text().trim();
            break;
          }
        }
  
        // Look for ingredients section if not found
        if (!ingredients) {
          // Try finding ingredients in common sections or headings
          ingredients = $('h2:contains(Ingredients), h3:contains(Ingredients), h2:contains(Hozzávalók), h3:contains(Hozzávalók)').next().text().trim();
          if (!ingredients) {
            ingredients = $('ul.ingredients, ul.list-ingredients, .ingredients-list').text().trim();
          }
        }
  
        // Look for instructions section if not found
        if (!instructions) {
          // Try looking for instruction headings in both languages
          instructions = $('h2:contains(Instructions), h3:contains(Instructions), h2:contains(Utmutató), h3:contains(Utmutató), h2:contains(Elkészítés), h3:contains(Elkészítés)').next().text().trim();
          if (!instructions) {
            instructions = $('div.instructions, div.method, div.directions, div.preparation').text().trim();
          }
        }
  
        // If no specific sections found, try generic headings
        if (!ingredients || !instructions) {
          const headings = ['Ingredients', 'Instructions', 'Directions', 'Preparation', 'Method', 'Hozzávalók', 'Elkészítés'];
          headings.forEach((heading) => {
            const section = $(`h2:contains(${heading}), h3:contains(${heading})`).next();
            if (section.length > 0) {
              if (heading.toLowerCase().includes('ingredient') || heading.toLowerCase().includes('hozzávaló')) {
                ingredients = section.text().trim();
              } else {
                instructions = section.text().trim();
              }
            }
          });
        }
      }
  
      // Clean up the recipe text
      recipeText = recipeText.replace(/\s+/g, ' ').trim();
  
      // Combine everything into one string
      const recipeString = `
        Title: ${$('h1, h2').first().text().trim() || 'Unknown Recipe Title'}
        Ingredients: ${ingredients || 'Ingredients not found'}
        Instructions: ${instructions || 'Instructions not found'}
        Full Text: ${recipeText || 'Recipe text not found'}
      `;
  
      return recipeString.trim();
  
    } catch (err) {
      console.error('Error scraping the recipe:', err);
      throw new Error('Hiba történt a recept szövegének begyűjtésekor.');
    }
  };
  
  

module.exports = { getRecipes, addRecipe, updateRecipe };
