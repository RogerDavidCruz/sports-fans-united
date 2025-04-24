const pool = require('../config/db');

// Get all users
const getAllUsers = async () => {
  try {
    const result = await pool.query('SELECT * FROM users');
    return result.rows;
  } catch (error) {
    console.error("Error in getAllUsers (model):", error);
    throw error; // Re-throw to be caught by service/controller
  }
};

// Create a new user
const createUser = async (name, email, favorite_team, favorite_player) => {
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email, favorite_team, favorite_player) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, favorite_team, favorite_player]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error in createUser (model):", error);
    throw error; // Re-throw to be caught by service/controller
  }
};

// Get user by ID
const getUserById = async (id) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Update user by ID
const updateUser = async (id, data) => {
  const { name, email, favorite_team, favorite_player } = data;
  const result = await pool.query(
    `UPDATE users
     SET name = $1,
         email = $2, 
         favorite_team = $3,
         favorite_player = $4
     WHERE id = $5
     RETURNING *`,
     [name, email, favorite_team, favorite_player, id]
  );
  return result.rows[0];
}

// Delete user by ID
const deleteUser = async (id) => {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

module.exports = { getAllUsers, createUser, getUserById, updateUser, deleteUser };