const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../../config/db');
const saltRounds = 10;
const { v4: uuidv4 } = require("uuid"); // Import UUID for unique ID generation

exports.createCustomer = async (req, res) => {
  const {
    companyName,
    contactPerson,
    companyEmail,
    companyWebsite,
    country,
    companyPhone,
    address,
    supportEmail,
    username,
    userEmail,
    password,
    status,
    technical_details,
    priority,
    user_type,
  } = req.body;

  const hashedPassword = await bcrypt.hash(password, saltRounds);

  console.log("Received Data:", req.body);

  // Check for duplicate records
  const duplicateCheckQuery = `
    SELECT * FROM customer 
    WHERE companyName = ? OR companyEmail = ? OR companyWebsite = ? OR username = ? OR userEmail = ?
  `;

  pool.query(duplicateCheckQuery, [companyName, companyEmail, companyWebsite, username, userEmail], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length > 0) {
      const duplicateFields = [];
      results.forEach(customer => {
        if (customer.companyName === companyName) duplicateFields.push("companyName");
        if (customer.companyEmail === companyEmail) duplicateFields.push("companyEmail");
        if (customer.companyWebsite === companyWebsite) duplicateFields.push("companyWebsite");
        if (customer.username === username) duplicateFields.push("username");
        if (customer.userEmail === userEmail) duplicateFields.push("userEmail");
      });
console.log(duplicateFields);

      return res.status(400).json({
        error: "Duplicate data found",
        duplicateFields: duplicateFields,
      });
    }

    function generateCustomerId(companyName) {
      const namePart = companyName.slice(0, 4).toUpperCase();
      const numberPart = Math.floor(1000 + Math.random() * 9000);
      return `${namePart}${numberPart}`;
    }

    const customerId = generateCustomerId(companyName);

    console.log("Generated Customer ID:", customerId);

    // Create customer object to store in the database
    const newCustomerData = {
      companyName,
      contactPerson,
      companyEmail,
      companyWebsite,
      country,
      companyPhone,
      address,
      supportEmail,
      username,
      userEmail,
      password: hashedPassword,
      customerId,
      customerStatus: status || "active",
      ipdbid: req.body.ipdbid || "id",
      customerType: req.body.status || "Lead",
      leadStatus: req.body.leadStatus || "new",
      leadType: req.body.leadType || "New lead",
      priority,
      user_type,
      technical_details,
      createdAt: new Date(), // Set the created timestamp manually if needed
    };

    const insertQuery = "INSERT INTO customer SET ?";

    pool.query(insertQuery, newCustomerData, (err, results) => {
      if (err) {
        console.error("Insert error:", err);
        return res.status(500).send(err);
      }

      res.json({ message: "Customer added successfully", id: results.insertId });
    });
  });
};

exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM `customer` WHERE id = ?";
  try {
      const [results] = await pool.promise().query(query, [id]);

      if (results.affectedRows === 0) {
          return res.status(404).json({ message: "Member not found" });
      }

      res.json({ message: " deleted successfully" });

  } catch (error) {
      console.error("Error deleting member:", error);
      res.status(500).json({ error: "Internal server error" });
  }
};


exports.CustomerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(email, password);

    // Check if customer exists in MySQL
    const query = "SELECT * FROM customer WHERE userEmail = ?";

    pool.query(query, [email], async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const customer = results[0];

      // Verify password
      const isMatch = await bcrypt.compare(password, customer.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid password" });
      }

      // Generate JWT token with 24h expiration
      const token = jwt.sign(
        { id: customer.id, email: customer.userEmail },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // Set session (if using express-session)
      req.session.customer = {
        id: customer.id,
        email: customer.userEmail,
        token,
      };

      // Set token in HTTP-only cookie (optional, for better security)
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      res.json({ message: "Login successful", token });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getAllCustomers = async (req, res) => {
  const query = "SELECT * FROM customer";
  try {
      const [results] = await pool.promise().query(query);
      res.status(200).json({ customer: results })
  } catch (error) {
      console.error("Database insert error:", error);
      res.status(500).json({ error: "Internal server error" });
  }
}


exports.getCustomer = (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: "Customer ID is required" });
  }

  const query = "SELECT * FROM customer WHERE id = ?";

  pool.query(query, [id], (err, results) => {
    if (err) {
      console.error("Error fetching customer data:", err);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.status(200).json({ customer: results[0] });
  });
};


exports.updateSwitchIps = async (req, res) => {
  const { id } = req.params;
  let { ip } = req.body; // Extract `ip` from request body

  console.log("Received ID:", id, "New IP(s):", ip);

  // Ensure `ip` is an array (convert string to array if necessary)
  if (typeof ip === "string") {
    ip = [ip]; // Convert single string into an array
  } else if (!Array.isArray(ip)) {
    return res.status(400).json({ error: "Invalid format: switchIps must be an array or a single string" });
  }

  const fetchQuery = "SELECT switchIps FROM customer WHERE id = ?";
  const updateQuery = "UPDATE customer SET switchIps = ? WHERE id = ?";

  try {
    // Fetch existing switchIps
    const [rows] = await pool.promise().query(fetchQuery, [id]);

    // Parse existing switchIps, ensuring it's an array
    let existingIps = rows.length > 0 && rows[0].switchIps ? JSON.parse(rows[0].switchIps) : [];

    if (!Array.isArray(existingIps)) {
      existingIps = [];
    }

    // Merge new IPs, ensuring no duplicates
    const updatedIps = [...new Set([...existingIps, ...ip])];

    // Convert back to JSON and update the database
    await pool.promise().query(updateQuery, [JSON.stringify(updatedIps), id]);

    console.log("Updated switchIps:", updatedIps);
    res.json({ success: true, message: "Switch IPs updated successfully.", switchIps: updatedIps });

  } catch (error) {
    console.error("Database update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getSwitchIps = async (req, res) => {
  const {id} = req.params;
  const query = "SELECT * FROM customer WHERE id = ?";
  
  try {
    const [results] = await pool.promise().query(query,[id])
    const ips = JSON.parse(results[0].switchIps)
    const data = {
      ...results[0],
      switchIps:ips
    }
    res.status(200).json({ips:data})
  } catch (error) {
    res.status(500).json({message:"server issues"})
  }
};


exports.createCustomerFollowup = async (req, res) => {
  const { message } = req.body; // Extract message from request body
  const { id } = req.params; // Extract id from request params

  console.log("Received Data:", { message, companyId: id });

  // Ensure required fields exist
  if (!message || !id) {
    return res.status(400).json({ error: "Message and Company ID are required." });
  }

  // Generate follow-up data
  const newFollowUp = {
    followupId: uuidv4(), // Generate a unique follow-up ID
    companyId: id, // Store company ID
    followupDescription: message, // Store message as followupDescription
    followupStatus: "pending", // Default status
    followupDate: new Date().toISOString().split("T")[0], // Current date (YYYY-MM-DD)
    followupTime: new Date().toLocaleTimeString(), // Current time (HH:MM:SS)
  };
  const insertQuery = "INSERT INTO customerfollowup SET ?";
  try {
    const [results] = await pool.promise().query(insertQuery, [newFollowUp]);
    res.status(200).json({ success: true, followup: newFollowUp });
  } catch (error) {
    console.error("Database insert error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


exports.getCustomerFollowups = async (req, res) => {
  const {id}  = req.params;
  console.log(id);

  const query = "SELECT * FROM customerfollowup WHERE companyId = ?";
  try {
    const [results] = await pool.promise().query(query, [id]);
    console.log(results);
    
    res.status(200).json({ followups: results })
  } catch (error) {
    console.error("Database insert error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateFollowups = async (req, res) => {
  const { message } = req.body; 
  const { id } = req.params; 
  const followupDate = new Date().toISOString().split("T")[0]; // Extract only YYYY-MM-DD
  const followupTime = new Date().toLocaleTimeString(); // Get current time

  // Fixed SQL query (removed extra comma)
  const updateQuery = "UPDATE customerfollowup SET followupDescription = ?, followupDate = ?, followupTime = ? WHERE followupId = ?";

  console.log(message, id, followupDate, followupTime);

  try {
    const [results] = await pool.promise().query(updateQuery, [message, followupDate, followupTime, id]);
    console.log(results);
    
    res.status(200).json({ followup: results });
  } catch (error) {
    console.error("Database update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

