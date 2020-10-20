require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const { text } = require("body-parser");

const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose"); //passport-local will be required by this

const homeStartingContent = "hello bsbcd nbhscdz ac hkc  hb  cssdbchb cewmbebdkbkcufiabkvfdld fjd,";
const aboutContent = "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis et massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
  secret: "Thisisasecret",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


// mongoose.connect('mongodb://localhost:27017/blogWebsiteDB', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.connect(process.env.MONGOCONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);    //for findOneAndUpdate()
mongoose.set('useCreateIndex', true);

const itemsSchema = ({
  title: String,
  content: String
});

const postsArray = new mongoose.Schema({
  // name: String,
  posts: [itemsSchema]
});

postsArray.plugin(passportLocalMongoose);

const Post = mongoose.model("post", postsArray);

passport.use(Post.createStrategy());
passport.serializeUser(Post.serializeUser());
passport.deserializeUser(Post.deserializeUser());

app.get("/", function (req, res) {
  if (req.isAuthenticated()) {
    console.log(req.user.username);
    res.redirect("/" + req.user.username);
  } else {
    res.render("LoginRegister");
  }
});


///authentication
app.get("/auth/register", function (req, res) {
  res.render("register");
});

app.get("/auth/login", function (req, res) {
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
      console.log(", NotExist.");
      passport.authenticate('local')(req, res, function () {      //creating cookie in browser telling this user already authenticated
        console.log("authenticated");
        res.redirect("/" + req.body.username);
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
        res.redirect("/" + req.user.username);
      });
    }
  });
});

app.get("/:customRoute", function (req, res) {
  if (req.isAuthenticated()) {
    console.log(req.user.username);
    const customListName = req.params.customRoute;
    if (customListName.toLowerCase() == "favicon.ico") return;
    console.log(customListName);
    if (customListName != req.user.username) {
      res.redirect("/" + req.user.username);
      return;
    }
    if (customListName == "compose") {
      res.redirect("/compose/home");
      return;
    }
    Post.findOne({ username: customListName }, function (err, foundList) {
      if (err) console.log("err" + err);
      else {
        console.log(", Exists.");
        res.render("home", { posts: foundList.posts, user: customListName });
      }
    });
  } else {
    res.redirect("/auth/login");
  }
});

app.get("/posts/:user/:postID", function (req, res) {
  if (req.isAuthenticated()) {
    console.log(req.user.username);
    if (req.params.user != req.user.username) {
      res.redirect("/" + req.user.username);
      return;
    }
    const postAuthor = req.params.user;
    Post.findOne({ username: postAuthor }, function (err, foundList) {
      if (err) console.log(err);
      else {
        if (!foundList) console.log("list not found");
        else {
          foundList.posts.forEach(function (post) {
            if (post._id == req.params.postID) {
              res.render("post", { user: postAuthor, authorsPost: post });
            }
          });
        }
      }
    });
  } else {
    res.render("LoginRegister");
  }
});

app.get("/compose/:user", function (req, res) {
  if (req.isAuthenticated()) {
    console.log(req.user.username);
    authUser = req.user.username;
    if (req.params.user == authUser) {
      res.render("compose", { user: authUser });
    } else {
      res.redirect("/compose/" + authUser);
      return;
    }
  } else {
    res.render("LoginRegister");
  }
});

app.post("/compose/:user", function (req, res) {
  if (req.isAuthenticated()) {
    console.log(req.user.username);
    if (req.params.user != req.user.username) {
      res.redirect("/" + req.user.username);
      return;
    }
    const customListName = req.params.user;
    const newItem = ({
      title: req.body.postTitle,
      content: req.body.postBody
    });
    Post.findOne({ username: customListName }, function (err, foundList) {
      if (err) console.log("fatal error asking element from list which doesnt exist.");
      else {
        if (foundList) {
          foundList.posts.push(newItem);
          foundList.save({}, function (err, result) {
            if (err) console.log("err" + err);
            else {
              res.redirect("/" + customListName);
            }
          });
        } else {
          res.redirect("/" + customListName);
        }
      }
    });
  } else {
    res.render("LoginRegister");
  }
});

app.post("/delete", function (req, res) {
  const customListName = req.body.user;
  const checkedPostId = req.body.postID;
  Post.findOneAndUpdate({ username: customListName }, { $pull: { posts: { _id: checkedPostId } } }, function (err) {
    if (err) console.log(err);
    else {
      res.redirect("/" + customListName);
    }
  });
});

app.get("/cc/about", function (req, res) {
  res.render("about", { text: aboutContent });
});

app.get("/cc/contact", function (req, res) {
  res.render("contact", { text: contactContent });
});

app.get("/cc/logout", function (req, res) {
  req.logOut();
  res.redirect("/");
});



app.listen(3000, function () {
  console.log("Server started on port 3000");
});
