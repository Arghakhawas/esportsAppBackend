const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const passport = require("passport");
const cookieParser = require("cookie-parser");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const server = http.createServer(app);

const helmet = require("helmet");

const io = new Server(server, {
  cors: {
    origin: "https://master--esportsempires.netlify.app",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: "*",
  },
});



// CORS setup
const allowedOrigins = [
  "https://master--esportsempires.netlify.app",
  "http://localhost:5173",
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


const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  referId: Number,
  number: Number,
  avatar: {
    type: String, // Assuming you store the URL of the avatar image
  },
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
  },
  tournamentMatchesPlayed: {
    type: Number,
    default: 0,
  },
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

// Create a Mongoose model for tournament entry
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


app.get(
  "/api/profile",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    try {
      // Fetch the user's profile
      const userId = req.user._id;
      const user = await User.findById(userId).populate("profile");

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

//Recording Screen
app.get("/api/livestreaming", (req, res) => {
  res.send("<h1>Server is running!</h1>");
});

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

      res.status(200).json({ message: "Avatar saved successfully", avatar });
    } catch (error) {
      console.error("Error saving avatar:", error);
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }
);

io.on("connect", (socket) => {
  console.log("A user connected");

  socket.on("stream", (stream) => {
    socket.broadcast.emit("stream", stream);
  });

  socket.on("stopStream", () => {
    socket.broadcast.emit("stopStream");
  });

  socket.on("shareRoomId", (roomId, team1, team2) => {
    // Broadcast the shared room ID to all connected users
    socket.broadcast.emit("sharedRoomId", { roomId, team1, team2 });

  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
  });
});

// Start the server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
