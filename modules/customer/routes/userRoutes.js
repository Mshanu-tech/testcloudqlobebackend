const express = require('express');
const router = express.Router();
const CustomerController = require('../controllers/userController') 

router.post('/customer', CustomerController.createCustomer);
router.get('/customers', CustomerController.getAllCustomers);
router.get('/customer/:id', CustomerController.getCustomer);
router.delete('/customer/:id', CustomerController.deleteCustomer);
router.post('/login', CustomerController.CustomerLogin);

router.get('/switchips/:id', CustomerController.getSwitchIps);
router.put('/switchips/:id', CustomerController.updateSwitchIps);

router.get('/followups/:id', CustomerController.getCustomerFollowups);
router.post('/followups/:id', CustomerController.createCustomerFollowup);
router.put('/followup/:id', CustomerController.updateFollowups);


module.exports = router;