const userModel = require('../models/userModel');

const getAllUsers = async () => {
    try{
        return await userModel.getAllUsers();
    } catch (error) {
        console.error("Error in getAllUsers (service):", error);
        throw error;
    }
};

const createUser = async (name, email, favorite_team, favorite_player) => {
    try {
        return await userModel.createUser(name, email, favorite_team, favorite_player);
    } catch (error) {
        console.error("Error in createUser (service):", error);
        throw error;
    }
};

const getUserById = async (id) => {
    try {
        return await userModel.getUserById(id);
    } catch (error) {
        console.error("Error in getUserById (Service):", error);
        throw error;
    }
};

const updateUser = async (id, data) => {
    try {
        return await userModel.updateUser(id, data);
    } catch (error) {
        console.error("Error in updateUser (service):", error);
        throw error;
    }
}

const deleteUser = async (id) => {
    try{
        return await userModel.deleteUser(id);
    } catch(error) {
        console.error("Error in deleteUser (service):", error);
        throw error;
    }
};


module.exports = { getAllUsers, createUser, getUserById, updateUser, deleteUser };

