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
      let directions = ''; // A directions szekció elkülönítése
  
      // Megpróbáljuk a szokásos JSON-LD adatokat először, ha léteznek
      const structuredData = $('script[type="application/ld+json"]').html();
      if (structuredData) {
        const jsonData = JSON.parse(structuredData);
        if (jsonData['@type'] === 'Recipe') {
          recipeText += `Title: ${jsonData.name}\n`;
          ingredients = jsonData.recipeIngredient.join(', ');
          instructions = jsonData.recipeInstructions.map((step) => step.text).join('\n');
          directions = jsonData.recipeInstructions.map((step) => step.text).join('\n'); // Structured data directions
        }
      }
  
      // Ha nincs strukturált adat, próbálkozzunk a manuális szűréssel
      if (!ingredients || !instructions || !directions) {
        // Szelektorok a különböző részletekhez
        const directionsSelector = '.p-recipe__directions .m-list__list';  // Az új struktúra
  
        // Directions (Elkészítés) kinyerése
        if ($(directionsSelector).length > 0) {
          directions = $(directionsSelector).map((i, el) => $(el).text().trim()).get().join('\n');
        }
  
        // Ingredients (Hozzávalók) keresése
        const ingredientsSelector = '.recipe-ingredients, .ingredients-list, .ingredients';
        if ($(ingredientsSelector).length > 0) {
          ingredients = $(ingredientsSelector).map((i, el) => $(el).text().trim()).get().join(', ');
        }
  
        // Instructions (Elkészítési utasítások) keresése
        const instructionsSelector = '.recipe-instructions, .instructions, .method';
        if ($(instructionsSelector).length > 0) {
          instructions = $(instructionsSelector).map((i, el) => $(el).text().trim()).get().join('\n');
        }
      }
  
      // Ha semmit nem találtunk, próbáljuk meg a közönséges szöveget
      if (!directions) {
        directions = $('.p-recipe__directions').text().trim();
      }
  
      if (!ingredients) {
        ingredients = $('h2:contains(Hozzávalók), h3:contains(Hozzávalók)').next().text().trim();
        if (!ingredients) {
          ingredients = $('ul.ingredients, ul.list-ingredients').text().trim();
        }
      }
  
      if (!instructions) {
        instructions = $('h2:contains(Elkészítés), h3:contains(Elkészítés)').next().text().trim();
      }
  
      // Ha nem találunk semmit, próbáljuk meg a teljes szöveget kinyerni
      if (!recipeText) {
        recipeText = $('article, .recipe-text, .entry-content').text().trim();
      }
  
      // A végső eredmény összefűzése
      const recipeString = `
        Title: ${$('h1, h2').first().text().trim() || 'Unknown Recipe Title'}
        Ingredients: ${ingredients || 'Ingredients not found'}
        Instructions: ${instructions || 'Instructions not found'}
        Directions: ${directions || 'Directions not found'}
        Full Text: ${recipeText || 'Recipe text not found'}
      `;
  
      return recipeString.trim();
  
    } catch (err) {
      console.error('Error scraping the recipe:', err);
      throw new Error('Hiba történt a recept szövegének begyűjtésekor.');
    }
  };
  

module.exports = { getRecipes, addRecipe, updateRecipe };
