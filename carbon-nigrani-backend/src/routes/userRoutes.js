const express = require("express");
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser ,deactivateUser,

    toggleUserStatus } = require("../controllers/userController");


router.get("/view-data", getUsers);
router.post("/update", updateUser);
router.delete("/:id", deleteUser);
router.put('/toggle-status/:id', toggleUserStatus);

module.exports = router;
