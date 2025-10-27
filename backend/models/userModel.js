const pool = require('../config/db');

// Get all users
const getAllUsers = async () => {
  try {
    console.log('[model] getAllUsers: querying...');
    const result = await pool.query('SELECT * FROM public.users');
    console.log('[model] getAllUsers: rowCount=', result.rowCount);
    return result.rows;
  } catch (e) {
    console.error('Error in getAllUsers (model):', e);
    throw e;
  }
};

// Create a new user
const createUser = async (name, email, favorite_sport, favorite_team, favorite_player) => {
  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, favorite_sport, favorite_team, favorite_player)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email, favorite_sport ?? null, favorite_team ?? null, favorite_player ?? null]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in createUser (model):', error);
    throw error;
  }
};

// Get user by ID
const getUserById = async (id) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Update user by ID
const updateUser = async (id, data) => {
  const { name, email, favorite_sport, favorite_team, favorite_player } = data;
  const result = await pool.query(
    `UPDATE users
       SET name            = COALESCE($1, name),
           email           = COALESCE($2, email),
           favorite_sport  = COALESCE($3, favorite_sport),
           favorite_team   = COALESCE($4, favorite_team),
           favorite_player = COALESCE($5, favorite_player)
     WHERE id = $6
     RETURNING *`,
    [name ?? null, email ?? null, favorite_sport ?? null, favorite_team ?? null, favorite_player ?? null, id]
  );
  return result.rows[0];
};

// Delete user by ID
const deleteUser = async (id) => {
  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

module.exports = { getAllUsers, createUser, getUserById, updateUser, deleteUser };