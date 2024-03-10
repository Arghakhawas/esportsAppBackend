const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const passport = require("passport");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const { ExpressPeerServer } = require("peer");
const { v4: uuidv4 } = require('uuid');


const peerServer = ExpressPeerServer(app, {
  debug: true,
});
app.use("/peerjs", peerServer);

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;


const helmet = require("helmet");




const allowedOrigins = [
  "https://dev--esportsempires.netlify.app",

];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,PUT,POST,DELETE",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(helmet());





// MongoDB connection
const atlasURI =
  "mongodb+srv://1234:1234@atlascluster.hflwol3.mongodb.net/test";
mongoose.connect(atlasURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
});
const db = mongoose.connection;

db.on("error", (error) => {
  console.error("MongoDB connection error:", error);
});

db.once("open", () => {
  console.log("Connected to MongoDB Atlas");
});

const tournamentSchema = new mongoose.Schema({
  gameCategory: String,
  gameMode: String,
  map: String,
  entryFee: String,
  prizeDistribution: String,
  registrationDeadline: String,
  image: String,
});

const Tournament = mongoose.model("Tournament", tournamentSchema);

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  referId: Number,
  number: Number,
  avatar: String,
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  tournamentMatchesPlayed: {
    type: Number,
    default: 0,
  },
  avatar: String,
  isAdmin: {
    type: Boolean,
    default: false,
  } // Add isAdmin field
});


const User = mongoose.model("User", userSchema);

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  entryFeePaid: Number,
  paymentStatus: String,
});
const Profile = mongoose.model("Profile", profileSchema);
// Define a Mongoose schema for tournament entry
const tournamentEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  gameId: {
    type: String,
    
  },
  userName: {
    type: String,
  
  },
  phoneNumber: {
    type: String,
   
  },
  formData: {
   
    player1: String,
    player2: String,
    player3: String,
    player4: String,
    player5: String,
    teamName: String,
    // Add more fields as needed
  },
  paymentStatus: {
    type: String,
    default: "Pending",
  },
  utrNo: String,
});


const TournamentEntry = mongoose.model("TournamentEntry", tournamentEntrySchema);
const productSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  imageUrl: String,
});

const Product = mongoose.model("Product", productSchema);

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
  },
  quantity: Number,
});

const shoppingCartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  items: [cartItemSchema],
});

const ShoppingCart = mongoose.model("ShoppingCart", shoppingCartSchema);


// Define a Mongoose schema for fixtures
const fixtureSchema = new mongoose.Schema({
  team1: String,
  team2: String,
  date: Date,
  time: String,
  venue: String,
});

// Create a Mongoose model for fixtures
const Fixture = mongoose.model("Fixture", fixtureSchema);

// Define a Mongoose schema for point tables
const pointTableSchema = new mongoose.Schema({
  team: String,
  points: Number,
});

// Create a Mongoose model for point tables
const PointTable = mongoose.model("PointTable", pointTableSchema);

// Define a Mongoose schema for battle grounds
const battleGroundSchema = new mongoose.Schema({
  name: String,
  rules: String,
  timing: String,
  prizePool: String,
});

// Create a Mongoose model for battle grounds
const BattleGround = mongoose.model("BattleGround", battleGroundSchema);

// Define a Mongoose schema for leagues
const leagueSchema = new mongoose.Schema({
  name: String,
  startDate: Date,
  endDate: Date,
});

// Create a Mongoose model for leagues
const League = mongoose.model("League", leagueSchema);
// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Passport setup
app.use(passport.initialize());
// Use environment variable for the secret key
const secretKey = process.env.JWT_SECRET || "your_secret_key";

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: secretKey,
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
    try {
      const user = await User.findById(jwtPayload.userId).populate("profile");
      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    } catch (error) {
      return done(error, false);
    }
  })
);

const generateToken = (user) => {
  return jwt.sign({ userId: user._id }, secretKey, { expiresIn: "24h" });
};

app.post("/api/signup", async (req, res) => {
  const { username, email, password, referId, number } = req.body;

  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      referId,
      number,
    });
    await newUser.save();

    // Create a profile for the user
    const newProfile = new Profile({ user: newUser._id });
    await newProfile.save();

    // Generate JWT token
    const token = generateToken(newUser);

    // Respond with the token
    res.status(201).json({ token, user: newUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email, include profile information
    const user = await User.findOne({ email }).populate("profile");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const authToken = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: "24h",
    });

    // Respond with the token and user profile
    console.log(`Login success: ${authToken}`);
    res.cookie("authToken", authToken, {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      path: "/",
    });
    res.status(200).json({ token: authToken, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});


app.post("/api/tournament/save-results", async (req, res) => {
  try {
    const { team1, team2, roomId, gameResult } = req.body;

    // Validate inputs
    if (!team1 || !team2 || !roomId || !gameResult) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    const updatedEntry = await TournamentEntry.findOneAndUpdate(
      { roomId },
      { $set: { team1, team2, gameResult } },
      { new: true }
    );

    if (!updatedEntry) {
      return res.status(404).json({ message: "Tournament entry not found" });
    }

    // Emit an event to notify connected clients about the updated results
    io.emit("tournamentResults", {
      roomId,
      team1,
      team2,
      gameResult,
    });

    res.status(200).json({ message: "Game results saved successfully" });
  } catch (error) {
    console.error("Error saving game results:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});


app.get(
  "/api/profile",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const userId = req.user._id;
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ user });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error" });
    }
  }
);

app.post(
  "/api/profile/avatar",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { avatar } = req.body;

    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.avatar = avatar;
      await user.save();

      res.status(200).json({ message: "Avatar saved successfully" });
    } catch (error) {
      console.error("Error saving avatar:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// cart routes
app.post("/api/cart/add", passport.authenticate("jwt", { session: false }), async (req, res) => {
  const { productId, quantity } = req.body;
  try {
    // Check if the product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Check if the user has a shopping cart
    let cart = await ShoppingCart.findOne({ user: req.user._id });

    if (!cart) {
      cart = new ShoppingCart({ user: req.user._id, items: [] });
    }

    // Check if the product is already in the cart
    const existingItem = cart.items.find(item => item.productId.equals(productId));

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    await cart.save();

    res.status(200).json({ message: "Item added to the cart", cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});




// ... (Products Shoop)
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});// Endpoint to handle tournament creation
const tournaments = [];  // Assuming you have a tournaments array

app.post('/api/tournament/create', async (req, res) => {
  try {
    // Extract form data
    const {
      gameCategory,
      gameMode,
      map,
      entryFee,
      prizeDistribution,
      registrationDeadline,
    } = req.body;

    // Extract image file from FormData
    const imageFile = req.files && req.files.image;

    // Validate the incoming data (you may add more validations)
    if (!gameCategory || !gameMode || !map || !entryFee || !prizeDistribution || !registrationDeadline || !imageFile) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Process the image file as needed (save to storage, etc.)
    const imagePath = '/path/to/store/image'; // Replace with your image storage path

 // Create a new tournament object with the image path
 const newTournament = new Tournament({
  gameCategory,
  gameMode,
  map,
  entryFee,
  prizeDistribution,
  registrationDeadline,
  image: imagePath,
});

// Save the new tournament to the database
await newTournament.save();

    // Respond with the created tournament
    res.status(201).json(newTournament);
  } catch (error) {
    console.error('Error creating tournament:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post(
  "/api/tournament/join",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { gameId, userName, phoneNumber, formData } = req.body;

    try {
      // Create a new tournament entry document
      const tournamentEntry = new TournamentEntry({
        user: req.user._id,
        gameId,
        userName,
        phoneNumber,
        formData,
        paymentStatus: "Pending",
      });

      // Save the tournament entry to the database
      await tournamentEntry.save();

      res
        .status(201)
        .json({ message: "Form submitted successfully", tournamentEntry });
    } catch (error) {
      console.error("Tournament join error:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Handle payment submission
app.post(
  "/api/tournament/submitpayment",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      const { utrNo } = req.body;

      // Find the corresponding tournament entry document and update its payment status
      const tournamentEntry = await TournamentEntry.findOneAndUpdate(
        { user: req.user._id, paymentStatus: "Pending" },
        { $set: { utrNo, paymentStatus: "Paid" } },
        { new: true }
      );

      if (!tournamentEntry) {
        return res
          .status(400)
          .json({ message: "No pending entry found for payment" });
      }

      res.status(200).json({ message: "Payment submitted successfully" });
    } catch (error) {
      console.error("Payment submission error:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);



app.post(
  "/api/change-password",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;

    try {
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid old password" });
      }

      // Update the password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedNewPassword;
      await user.save();

      res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

// Handle socket.io connections
io.on("connect", (socket) => {
  console.log("User connected:", socket.id);

  // Handle WebRTC signaling
  socket.on("offer", (offer, targetSocketId) => {
    io.to(targetSocketId).emit("offer", offer, socket.id);
  });

  socket.on("answer", (answer, targetSocketId) => {
    io.to(targetSocketId).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate, targetSocketId) => {
    io.to(targetSocketId).emit("ice-candidate", candidate);
  });

  // Handle live streaming
  socket.on("stream", (stream) => {
    io.emit("stream", stream);
  });

  socket.on("stopStream", () => {
    io.emit("stopStream");
  });

  // Handle disconnect event
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  } else {
    return res.status(403).json({ message: "Access denied: Admin privileges required" });
  }
};



app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find admin user by email
    const adminUser = await User.findOne({ email });

    // Check if user exists and is an admin
    if (!adminUser || !adminUser.isAdmin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, adminUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const authToken = jwt.sign(
      { userId: adminUser._id, isAdmin: true },
      secretKey,
      { expiresIn: "24h" }
    );

    // Respond with the token
    res.status(200).json({ token: authToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.get(
  "/api/admin",
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    res.status(200).json({ message: "Welcome to the admin panel" });
  }
);


// Fixtures CRUD
app.get("/api/fixtures", async (req, res) => {
  try {
    const fixtures = await Fixture.find();
    res.status(200).json(fixtures);
  } catch (error) {
    console.error(error);aa
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/api/fixtures", async (req, res) => {
  const { team1, team2, date, time, venue } = req.body;

  try {
    const newFixture = new Fixture({ team1, team2, date, time, venue });
    await newFixture.save();
    res.status(201).json({ message: "Fixture added successfully", fixture: newFixture });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.put("/api/fixtures/:id", async (req, res) => {
  const { team1, team2, date, time, venue } = req.body;

  try {
    const updatedFixture = await Fixture.findByIdAndUpdate(
      req.params.id,
      { team1, team2, date, time, venue },
      { new: true }
    );
    res.status(200).json({ message: "Fixture updated successfully", fixture: updatedFixture });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete("/api/fixtures/:id", async (req, res) => {
  try {
    await Fixture.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Fixture deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Fetch all point tables
app.get("/api/point-table", async (req, res) => {
  try {
    const pointTables = await PointTable.find();
    res.status(200).json(pointTables);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Add a new point table entry
app.post("/api/point-table", async (req, res) => {
  const { team, points } = req.body;

  try {
    const newPointTableEntry = new PointTable({ team, points });
    await newPointTableEntry.save();
    res.status(201).json({ message: "Point table entry added successfully", entry: newPointTableEntry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Update a point table entry
app.put("/api/point-table/:id", async (req, res) => {
  const { team, points } = req.body;

  try {
    const updatedPointTableEntry = await PointTable.findByIdAndUpdate(
      req.params.id,
      { team, points },
      { new: true }
    );
    res.status(200).json({ message: "Point table entry updated successfully", entry: updatedPointTableEntry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Delete a point table entry
app.delete("/api/point-table/:id", async (req, res) => {
  try {
    await PointTable.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Point table entry deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});



// Fetch all leagues
app.get("/api/leagues", async (req, res) => {
  try {
    const leagues = await League.find();
    res.status(200).json(leagues);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Add a new league
app.post("/api/leagues", async (req, res) => {
  const { name, startDate, endDate } = req.body;

  try {
    const newLeague = new League({ name, startDate, endDate });
    await newLeague.save();
    res.status(201).json({ message: "League added successfully", league: newLeague });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Update a league
app.put("/api/leagues/:id", async (req, res) => {
  const { name, startDate, endDate } = req.body;

  try {
    const updatedLeague = await League.findByIdAndUpdate(
      req.params.id,
      { name, startDate, endDate },
      { new: true }
    );
    res.status(200).json({ message: "League updated successfully", league: updatedLeague });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Delete a league
app.delete("/api/leagues/:id", async (req, res) => {
  try {
    await League.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "League deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});


// Fetch all battle grounds
app.get("/api/battle-grounds", async (req, res) => {
  try {
    const battleGrounds = await BattleGround.find();
    res.status(200).json(battleGrounds);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Add a new battle ground
app.post("/api/battle-grounds", async (req, res) => {
  const { name, rules, timing, prizePool } = req.body;

  try {
    const newBattleGround = new BattleGround({ name, rules, timing, prizePool });
    await newBattleGround.save();
    res.status(201).json({ message: "Battle ground added successfully", battleGround: newBattleGround });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Update a battle ground
app.put("/api/battle-grounds/:id", async (req, res) => {
  const { name, rules, timing, prizePool } = req.body;

  try {
    const updatedBattleGround = await BattleGround.findByIdAndUpdate(
      req.params.id,
      { name, rules, timing, prizePool },
      { new: true }
    );
    res.status(200).json({ message: "Battle ground updated successfully", battleGround: updatedBattleGround });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Delete a battle ground
app.delete("/api/battle-grounds/:id", async (req, res) => {
  try {
    await BattleGround.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Battle ground deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});


// Start the server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
