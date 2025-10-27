const userService = require('../services/userService');

const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.status(200).json(users); // Changed status code for success
  } catch (err) {
    console.error("Error in getAllUsers:", err); // Added error logging
    res.status(500).json({ error: 'Server error' }); // Send JSON response
  }
};

const createUser = async (req, res) => {
  const { name, email, favorite_sport, favorite_team, favorite_player } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  try {
    const newUser = await userService.createUser(
      name,
      email,
      favorite_sport ?? null,
      favorite_team ?? null,
      favorite_player ?? null
    );
    return res.status(201).json(newUser);
  } catch (err) {
    console.error('Error in createUser:', err);

    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'Email already exists' });
    }
    if (err.code === '22001') { // string_data_right_truncation
      return res.status(400).json({ error: 'Field too long' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {

    const updated = await userService.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json( {error: 'User not found'});
    res.status(200).json(updated);
  } catch (err) {
    console.error("Error in updateUser:", err);
    res.status(500).json({ error: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const deleted = await userService.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ message: 'User deleted' });
  } catch(err) {
    console.error("Error in deleteUser:", err);
    res.status(500).json({ error: 'Server error'});
  }
};


module.exports = { getAllUsers, createUser, getUserById, updateUser, deleteUser };
