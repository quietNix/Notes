require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const { text } = require("body-parser");

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose"); //passport-local will be required by this
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const homeStartingContent = "hello bsbcd nbhscdz ac hkc  hb  cssdbchb cewmbebdkbkcufiabkvfdld fjd,";
const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis et massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


// mongoose.connect('mongodb://localhost:27017/blogWebsiteDB', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connect(process.env.MONGO_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);    //for findOneAndUpdate()
mongoose.set('useCreateIndex', true);

const itemsSchema = ({
  title: String,
  content: String
});

const postsArray = new mongoose.Schema({
  posts: [itemsSchema]
});

postsArray.plugin(passportLocalMongoose);

const Post = mongoose.model("post", postsArray);

const postsArrayGoogle = new mongoose.Schema({
  googleID: String,
  username: String,
  posts: [itemsSchema]
});

const PostGoogle = mongoose.model("postGoogle", postsArrayGoogle);

passport.use(Post.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, { _id: user._id, googleID: user.googleID });
});

passport.deserializeUser(function (id, done) {
  // console.log("user object stored in session: ");    //debug 
  // console.log(id);
  if (id._id && !id.googleID) {
    Post.findOne({ _id: id._id }, function (err, user) {
      done(err, user);
    });
  } else if (id.googleID && id.googleID) {
    PostGoogle.findOne({ googleID: id.googleID }, function (err, user) {
      done(err, { _id: user._id, googleID: user.googleID });
    });
  }
});

//google oAuth 20 strategy
passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_OAUTH_CALLBACK
},
  function (accessToken, refreshToken, profile, cb) {
    PostGoogle.findOne({ googleID: profile.id }, function (err, post) {
      if (err) {
        res.redirect("/auth/register");
      } else {
        if (post) {
          return cb(err, post);

        } else {

          const newItem = ({
            title: profile._json.email,
            content: homeStartingContent
          });

          postGoogle = new PostGoogle({
            googleID: profile.id,
            username: profile._json.email,
            posts: [newItem]
          });

          postGoogle.save({}, function (err, result) {
            if (err) {
              res.redirect("/auth/register");
            } else {
              return cb(err, result);
            }
          });
        }
      }
    });
  }
));


///authentication via simple username and password
app.get("/register", function (req, res) {
  res.render("register");
});

app.get("/login", function (req, res) {
  res.render("login");
});

app.post("/register", function (req, res) {

  const newItem = ({
    title: req.body.username,
    content: homeStartingContent
  });

  Post.register({ username: req.body.username, posts: [newItem] }, req.body.password, function (err, user) {
    if (err) {
      console.log("err" + err);
      res.redirect("/auth/register");
    }
    else {
      passport.authenticate('local')(req, res, function () {      //creating cookie in browser telling this user already authenticated
        res.redirect("/");
        return;
      });
    }
  });
});

app.post("/login", function (req, res) {
  const user = new Post({
    username: req.body.username,
    password: req.body.password
  });
  req.login(user, function (err) {
    if (err) console.log("err: " + err);
    else {
      passport.authenticate('local')(req, res, function () {
        res.redirect("/");
      });
    }
  });
});

//Authenticating via google oauth 20
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] }) //popup for signing in google
);

app.get('/auth/google/notes', passport.authenticate('google', { failureRedirect: "/login" }), function (req, res) {
  res.redirect("/");
});


app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    // console.log("/");                      //debug
    // console.log("req.user");
    // console.log(req.user);
    // console.log("req.session.passport.user");
    // console.log(req.session.passport.user);
    //TODO: difference between req.session.passport.user and req.user
    //      and which to use when.
    if (req.session.passport.user._id && !req.session.passport.user.googleID) {
      Post.findOne({ _id: req.session.passport.user._id }, function (err, foundList) {
        if (err) console.log("err" + err);
        else {
          res.render("home", { posts: foundList.posts, user: "customListName" });
        }
      });
    } else if (req.session.passport.user._id && req.session.passport.user.googleID) {
      PostGoogle.findOne({ googleID: req.session.passport.user.googleID }, function (err, foundList) {
        if (err) console.log("err" + err);
        else {
          if (!foundList) console.log("no user exists" + foundList);
          else {
            res.render("home", { posts: foundList.posts, user: req.session.passport.user.username });
          }
        }
      });
    } else res.redirect("/");
  } else {
    res.render("LoginRegister");
  }
});

app.get("/posts/:postID", function (req, res) {
  if (req.isAuthenticated()) {
    if (req.session.passport.user._id && !req.session.passport.user.googleID) {
      Post.findOne({ _id: req.session.passport.user._id }, function (err, foundList) {
        if (err) console.log(err);
        else {
          if (!foundList) console.log("list not found");
          else {
            foundList.posts.forEach(function (post) {
              if (post._id == req.params.postID) {
                res.render("post", { authorsPost: post });
              }
            });
          }
        }
      });
    } else if (req.session.passport.user._id && req.session.passport.user.googleID) {
      PostGoogle.findOne({ googleID: req.session.passport.user.googleID }, function (err, foundList) {
        if (err) console.log(err);
        else {
          if (!foundList) console.log("list not found");
          else {
            foundList.posts.forEach(function (post) {
              if (post._id == req.params.postID) {
                res.render("post", { authorsPost: post });
              }
            });
          }
        }
      });
    }
  } else {
    res.render("LoginRegister");
  }
});

app.get("/compose", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("compose");
  } else {
    res.render("LoginRegister");
  }
});

app.post("/compose", function (req, res) {
  if (req.isAuthenticated()) {
    const newItem = ({
      title: req.body.postTitle,
      content: req.body.postBody
    });

    if (req.session.passport.user._id && !req.session.passport.user.googleID) {
      Post.findOne({ _id: req.session.passport.user._id }, function (err, foundList) {
        if (err) console.log("fatal error asking element from list which doesnt exist.");
        else {
          if (foundList) {
            foundList.posts.push(newItem);
            foundList.save({}, function (err, result) {
              if (err) console.log("err" + err);
              else {
                res.redirect("/");
              }
            });
          } else {
            res.redirect("/");
          }
        }
      });
    } else if (req.session.passport.user._id && req.session.passport.user.googleID) {
      PostGoogle.findOne({ googleID: req.session.passport.user.googleID }, function (err, foundList) {
        if (err) console.log("fatal error asking element from list which doesnt exist.");
        else {
          if (foundList) {
            foundList.posts.push(newItem);
            foundList.save({}, function (err, result) {
              if (err) console.log("err" + err);
              else {
                res.redirect("/");
              }
            });
          } else {
            res.redirect("/");
          }
        }
      });
    }
  } else {
    res.render("LoginRegister");
  }
});

app.post("/delete", function (req, res) {
  if (req.isAuthenticated()) {
    const checkedPostId = req.body.postID;
    if (req.session.passport.user._id && !req.session.passport.user.googleID) {
      Post.findOneAndUpdate({ _id: req.session.passport.user._id }, { $pull: { posts: { _id: checkedPostId } } }, function (err) {
        if (err) console.log(err);
        else {
          res.redirect("/");
        }
      });
    } else if (req.session.passport.user._id && req.session.passport.user.googleID) {
      PostGoogle.findOneAndUpdate({ googleID: req.session.passport.user.googleID }, { $pull: { posts: { _id: checkedPostId } } }, function (err) {
        if (err) console.log(err);
        else {
          res.redirect("/");
        }
      });
    }
  } else {
    res.render("LoginRegister");
  }
});

app.get("/cc/about", function (req, res) {
  res.render("about", { text: aboutContent });
});

app.get("/cc/contact", function (req, res) {
  res.render("contact");
});

app.get("/cc/logout", function (req, res) {
  req.logOut();
  res.redirect("/");
});



app.listen(3000, function () {
  console.log("Server started on port 3000");
});
