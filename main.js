const express = require ('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const passport = require('passport');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
// const FacebookStrategy = require('passport-facebook').Strategy;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io')

const app = express();
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const server = http.createServer(app);
const io = new Server(server);

// CORS setup
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? 'https://master--esportsempires.netlify.app' : '*',
  methods: 'GET,PUT,POST,DELETE',
  credentials: true,
};


app.use(cors(corsOptions));

// MongoDB connection
const atlasURI = 'mongodb+srv://1234:1234@atlascluster.hflwol3.mongodb.net/test';
mongoose.connect(atlasURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,

});


const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB Atlas');
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
    ref: 'Profile',
  },
  tournamentMatchesPlayed: {
    type: Number,
    default: 0,
  },
});




const User = mongoose.model('User', userSchema);

const profileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  balance: {
    type: Number,
    default: 0,
  },
  entryFeePaid: Number,
  paymentStatus: String,

 
}); 
const Profile = mongoose.model('Profile', profileSchema);
const tournamentEntrySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  gameId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  userUpi: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    default: 'Pending',
  },
  utrNo: String,
});


const TournamentEntry = mongoose.model('TournamentEntry', tournamentEntrySchema);

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Passport setup
app.use(passport.initialize());
// Use environment variable for the secret key
const secretKey = process.env.JWT_SECRET || 'your_secret_key';



const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: secretKey,
};

passport.use(new JwtStrategy(jwtOptions, async (jwtPayload, done) => {
  try {
    const user = await User.findById(jwtPayload.userId).populate('profile');
    if (user) {
      return done(null, user);
    } else {
      return done(null, false);
    }
  } catch (error) {
    return done(error, false);
  }
}));

const generateToken = (user) => {
  return jwt.sign({ userId: user._id }, secretKey, { expiresIn: '24h' });
};
// // Google OAuth strategy
// passport.use(new GoogleStrategy({
//   clientID: 'your-google-client-id',
//   clientSecret: 'your-google-client-secret',
//   callbackURL: 'http://localhost:5173/auth/google/callback',
// }, async (accessToken, refreshToken, profile, done) => {
//   try {
//     let user = await User.findOne({ googleId: profile.id });

//     if (!user) {
//       // Create a new user if not found
//       user = new User({ googleId: profile.id, username: profile.displayName, email: profile.emails[0].value });
//       await user.save();
//     }

//     return done(null, user);
//   } catch (error) {
//     return done(error, null);
//   }
// }));

// // Facebook OAuth strategy
// passport.use(new FacebookStrategy({
//   clientID: 'your-facebook-client-id',
//   clientSecret: 'your-facebook-client-secret',
//   callbackURL: 'http://localhost:5174/auth/facebook/callback',
// }, async (accessToken, refreshToken, profile, done) => {
//   // Implement Facebook login logic
//   // Create or find a user in your database
//   // Call done(null, user);
// }));

app.post('/api/signup', async (req, res) => {
  const { username, email, password, referId, number } = req.body;

  try {
    // Check if the email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user
    const newUser = new User({ username, email, password: hashedPassword, referId, number });
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
    res.status(500).json({ message: 'Server Error' });
  }
});

// Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email, include profile information
    const user = await User.findOne({ email }).populate('profile');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Respond with the token and user profile
    res.status(200).json({ token, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// // Google authentication route
// app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// // Facebook authentication route
// app.get('/auth/facebook', passport.authenticate('facebook'));

// // Callback routes for Google and Facebook
// app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
//   res.redirect('/');
// });

// app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/' }), (req, res) => {
//   res.redirect('/');
// });

app.get('/api/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    // Fetch the user's profile
    const userId = req.user._id;
    const user = await User.findById(userId).populate('profile');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});


// ... (your existing code)

app.post('/api/tournament/join', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { gameId, userName, phoneNumber, userUpi } = req.body;

  if (!gameId || !userName || !phoneNumber || !userUpi) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const tournamentEntry = new TournamentEntry({
      user: req.user._id,
      gameId,
      userName,
      phoneNumber,
      userUpi,
      paymentStatus: 'Pending',
    });

    await tournamentEntry.save();

    res.status(201).json({ message: 'Form submitted successfully', tournamentEntry });
  } catch (error) {
    console.error('Tournament join error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

app.post('/api/tournament/submitpayment', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { utrNo } = req.body;

    const tournamentEntry = await TournamentEntry.findOneAndUpdate(
      { user: req.user._id, paymentStatus: 'Pending' },
      { $set: { utrNo, paymentStatus: 'Paid' } },
      { new: true }
    );

    if (!tournamentEntry) {
      return res.status(400).json({ message: 'No pending entry found for payment' });
    }

    res.status(200).json({ message: 'Payment submitted successfully' });
  } catch (error) {
    console.error('Payment submission error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

//Recording Screen
app.get('/api/livestreming', (req, res) => {
  res.send('<h1>Server is running!</h1>');
});



io.on('connect', (socket) => {
  console.log('A user connected');

  socket.on('stream', (stream) => {
    socket.broadcast.emit('stream', stream);
  });

  socket.on('stopStream', () => {
    socket.broadcast.emit('stopStream');
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});





app.post('/api/change-password', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid old password' });
    }

    // Update the password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

app.post('/api/profile/avatar', passport.authenticate('jwt', { session: false }), async (req, res) => {
  const { avatar } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.avatar = avatar;
    await user.save();

    res.status(200).json({ message: 'Avatar saved successfully' });
  } catch (error) {
    console.error('Error saving avatar:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
