"use strict";
console.log('Server initializing...');

// Loading libraries
const express = require('express');
const responseTime = require('response-time');
const mysql = require('mysql');
const WebSocket = require('ws');
const http = require('http');
const uuidv4 = require('uuid/v4');
const session = require('express-session');
const bodyParser = require('body-parser');

// Creating http server
const app = express();
const server = http.createServer();

// Set up express sessions
const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
});

// Constant declarations
const serverPort = 2001;

//const wss = new WebSocket.Server({
//  verifyClient: (info, done) => {
//    console.log('Parsing session from request...');
//    sessionParser(info.req, {}, () => {
//      console.log('Session is parsed!');
//      // We can reject the connection by returning false to done(). For example, reject here if user is unknown.
//      done(info.req.session.userId);
//    });
//  },server
//});

// Establish connection to MySQL server
var sql = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin',
    dateStrings: true, // Note, when mysql date fields are returned, they are auto-converted by Node from objects into strings using the wrong date function. This converts them before this.
    multipleStatements: true
});

// Bind express to server and set up Pug
server.on('request', app);
app.set('title', 'Revision Manager');
app.set('views', 'site/views');
app.set('view engine', 'pug');

// Establish static directories and middlewares
app.use(express.static('site/static'));
app.use(express.static('site/content'));
app.use(responseTime({digits:0, suffix:false}));
app.use(bodyParser.json());
app.use(sessionParser);

// Query MySQL server to establish tables, auto-create if needed
sql.connect((err)=>{
    if (err) {
        console.log('Error connecting to SQL database: ' + err.stack);
    } else {
        sql.query('CREATE DATABASE IF NOT EXISTS Vitae',(err)=>{
			sql.changeUser({database : 'Vitae'}, function(err) {if (err) throw err;});
			sql.query(`CREATE TABLE IF NOT EXISTS schools (
				schoolID SMALLINT NOT NULL AUTO_INCREMENT,
				nzqaNum SMALLINT NOT NULL,
				title VARCHAR(64) NOT NULL,
				location VARCHAR(255) NOT NULL,
				PRIMARY KEY (schoolID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS users (
				userID INT NOT NULL AUTO_INCREMENT,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
				accountType CHAR(4) NOT NULL,
				schoolID SMALLINT NOT NULL,
				nzqaNum INT NOT NULL,
				fullName VARCHAR(64) NOT NULL,
				yearLevel TINYINT NOT NULL,
				bio VARCHAR(256) NOT NULL,
				PRIMARY KEY (userID),
				FOREIGN KEY (schoolID) REFERENCES schools(schoolID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS posts (
				postID INT NOT NULL AUTO_INCREMENT,
                postUUID VARCHAR(36) UNIQUE NOT NULL,
				postType CHAR(4) NOT NULL,
				userID INT NOT NULL,
				postTime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(),
				privacyLevel TINYINT NOT NULL,
				description VARCHAR(255),
				youTubeURL VARCHAR(11),
				PRIMARY KEY (postID),
				FOREIGN KEY (userID) REFERENCES users(userID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS comments (
				commentID INT NOT NULL AUTO_INCREMENT,
                commentUUID VARCHAR(36) UNIQUE NOT NULL,
				postID INT NOT NULL,
				postTime DATETIME DEFAULT CURRENT_TIMESTAMP(),
				content VARCHAR(256) NOT NULL,
				PRIMARY KEY (commentID),
				FOREIGN KEY (postID) REFERENCES posts(postID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			sql.query(`CREATE TABLE IF NOT EXISTS sessions (
				sessionID INT NOT NULL AUTO_INCREMENT,
				sessionUUID VARCHAR(36)	NOT NULL,
				sessionCreation DATETIME NOT NULL,
				userID INT NOT NULL,
				PRIMARY KEY (sessionID),
				FOREIGN KEY (userID) REFERENCES users(userID)
			)`, (err)=>{
				if (err) {console.log(err)};
			});
			
			console.log('Connected to database...');
			
			// If no data is inside tables, insert test data
			sql.query('SELECT userID FROM users',(error,results,fields)=>{
				if (error) throw error;
				if (results.length == 0) {
					insertTestUserData();
				}
			});
			
			// Activate server to listen on given port
			server.listen(serverPort,()=>{
				console.log(`Online on port ${serverPort}!`);
			});
		});
    }
});

// User requests index page (timeline)
app.get('/', function (req, res) {
	console.log('Index requested...');
	console.log("The session ID for this user is: " + req.session.sessionUUID);
	
	// Query to see if the client has an existing and valid session
    // AND sessionCreation > (NOW()-1) | this seems to be creating an error
	checkExistingAccount(req.session.sessionUUID,true,'login',res,(userData)=>{
		res.render('index', {randVer: createRandomVersion(),userData:userData});
		console.log(`index served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
	});
});

// User requests the login page
app.get('/login', function (req, res) {
	console.log('Login requested...');
	console.log("The session ID for this user is: " + req.session.sessionUUID);
	
	// Query to see if the client has an existing and valid session
	checkExistingAccount(req.session.sessionUUID,false,'',res,()=>{
		res.render('login', {randVer: createRandomVersion()});
		console.log(`login served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
	});
});

// Dynamic address for user pages, sends username to variable
app.get('/user/:username', function (req,res) {
    console.log('Requesting user page: ' + req.params.username);
	
	// Query to see if the client has an existing and valid session
	checkExistingAccount(req.session.sessionUUID,true,'../login',res,(userData)=>{
		res.render('user', {randVer: createRandomVersion(),userData:userData});
		console.log(`user page served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
	});
});

// Page for uploading an article to a user account
app.get('/upload', function (req,res) {
    console.log('Requesting upload page: ' + req.params.username);
	
	console.log("Directory: " + __dirname);
	
	// Query to see if the client has an existing and valid session
	checkExistingAccount(req.session.sessionUUID,true,'../login',res,(userData)=>{
		res.render('upload', {randVer: createRandomVersion(),userData:userData});
		console.log(`upload page served to ${req.ip} in ${res.getHeader("X-Response-Time")}ms`);
	});
});

// AJAX async requests the validate page to check user-entered credentials
app.post('/validate', function (req, res) {
	console.log('Validate requested...');
    console.log("Given details: " + JSON.stringify(req.body));
    
	// Testing to supplement the client side code, prevents database errors from invalid lengths
	if (req.body.username.length > 0 && req.body.username.length <= 256 && req.body.password.length >= 8 && req.body.username.length <= 64) {
		// Query to see if the username and password match a user in the database
		sql.query('SELECT userID FROM users WHERE username = ? AND password = ?', [req.body.username,req.body.password],(error,results,fields)=>{
			if (error) throw error;

			console.log("Checked details against database and found: " + JSON.stringify(results));

			// If no user is found, respond with an invalid details notice. Otherwise, create new session...
			if (results.length == 0) {
				// Send response to let client know server handled successfully, but with no returns
				console.log('Details are invalid.');
				res.json({result:'FAIL',message:'Details are invalid.'});
			} else {
				// Create a new UUID4 for a session
				var newSessionID = uuidv4();

				// Insert this new session ID into the sessions database
				sql.query('INSERT INTO sessions (userID, sessionUUID, sessionCreation) VALUES (?,?,CURRENT_TIMESTAMP())', [results[0].userID,newSessionID],(error,results,fields)=>{
					if (error) throw error;

					// Set this UUID to the session variable, and send success response to client
					req.session.sessionUUID = newSessionID;
					res.json({result:'OK',message:'Session updated.'});
				});
			}
		});
	} else {
		res.json({result:'FAIL',message:'Details are invalid.'});
	}
});

// AJAX async requests an individual article sub-page
app.post('/article', function (req, res) {
    console.log('Article requested: ' + JSON.stringify(req.body));
    
    // Validation check as client data cannot always be trusted
    if (req.body.quantity > 16 || req.body.quantity < 1 || typeof req.body.quantity !== 'number') {
        res.json({result:'FAIL',data:"The client's request was invalid."});
    } else {
        // Query database to select relevant posts
        const queryString = `SELECT postID, postUUID, posts.userID, username, fullName, postTime, description FROM posts JOIN users ON posts.userID = users.userID WHERE postID < IFNULL((SELECT postID FROM posts WHERE postUUID = ?), (SELECT MAX(postID)) + 1) AND postType = ? ORDER BY postTime DESC, postID DESC LIMIT ?`;
        sql.query(queryString,[req.body.fromID,'imge',req.body.quantity],(error,results,fields)=>{
            if (error) throw error;

//            console.log(JSON.stringify(results));

			// If no more articles found, display a message. Else, send the articles' HTML
            if (results.length == 0) {
                res.json({result:'FAIL',data:"There's nothing more to see 😔"});
            } else {
                app.render('article',{'input':results},(err,html)=>{
                    if (err) throw err;
                    res.json({result:'OK',html:html});
                });
            }
        });
    }
});

// Generalized function to check if a user has an existing valid session
function checkExistingAccount(sessionUUID,desire,redirect,res,callback) {
	// Query sessions table to check the session ID
	sql.query('SELECT sessions.userID, username, fullName, accountType, yearLevel, schools.title AS schoolTitle FROM sessions JOIN users ON sessions.userID = users.userID JOIN schools ON schools.schoolID = users.schoolID WHERE sessionUUID = ?', [sessionUUID],(error,results,fields)=>{
		if (error) throw error;
		
		console.log('User data found in database: ' + results[0]);
		
		// If no valid session is found, auto-redirect to login page, otherwise serve index
		if (results.length != desire) {
			console.log(`Requested index, redirecting to ${redirect}.`);
			res.redirect(redirect);
		} else {
			callback(results[0]);
		}
	});
}

// Generalized function to generate a random number to prevent browser caching
function createRandomVersion() {
	return Math.round(Math.random()*1000);
}

// Dev function to insert data into the database for testing
function insertTestUserData() {
	// Values to be inserted
    var users = [
		{
			username: 'roozeno',
			password: 'admin123',
			accountType: 'stdt',
			schoolID: 1,
			nzqaNum: 126555266,
			fullName: 'Ollie Roozen',
			yearLevel: 13,
			bio: 'Hello, world.'
		},
		{
			username: 'freundz',
			password: 'admin123',
			accountType: 'stdt',
			schoolID: 1,
			nzqaNum: 132423194,
			fullName: 'Zac Freund',
			yearLevel: 13,
			bio: '( ͡° ͜ʖ ͡°)'
		}
	];
	
    var school = {
        nzqaNum: 347,
        title: 'Lincoln High School',
        location: 'Lincoln, Christchurch'
    };
	
	// SQL inserting into the database, sequentially because of foreign keys
    sql.query('INSERT INTO schools (nzqaNum,title,location) VALUES (?,?,?)', [school.nzqaNum,school.title,school.location],(error,results,fields)=>{
        if (error) {throw error};
        sql.query('INSERT INTO users (username,password,accountType,schoolID,nzqaNum,fullName,yearLevel,bio) VALUES (?,?,?,?,?,?,?,?)', [user.username,user.password,user.accountType,user.schoolID,user.nzqaNum,user.fullName,user.yearLevel,user.bio],(error,results,fields)=>{
        if (error) {throw error};
        	console.log('Inserted test user data into the database.');
			insertTestPostData();
        });
    });
}

// Another dev function for inserting test data, this is called after the testUserData function
function insertTestPostData() {
	// postType, userID, privacyLevel, description
	var posts = [
		['imge',1,0,"Look at dis cool image!",'23539a2d-6ec1-4dc8-8151-248d1adf7b50'],
		['imge',1,0,"Fleek on point yo",'51f18905-8504-4cfb-8b6e-422079a474a9'],
		['imge',1,0,"Help",'9874db34-3457-4154-907f-e91e04e240ad'],
		['imge',1,0,"'And how can man die better, than facing fearful odds, for the ashes of his fathers, and the temples of his gods?'",'a179e55d-8f46-4611-a5f2-331569636802'],
		['imge',1,0,"XOXOXO Luv u gurls",'eb26258e-61bc-4d7b-b6f2-225fbf9362e2'],
		['imge',1,0,"Rest in piece XXX",'cc40e073-eab4-406c-99a7-9e99940b54ab'],
		['imge',1,0,"Zac the cat is life",'e1aad17e-5440-4188-9651-3f4a2fd4536f'],
		['imge',1,0,"Le kek™",'e4182bc3-e5ea-4d8c-adf6-58b7112b0ee7'],
        ['imge',1,0,"Zoom zoom",'b5528949-6e8b-4f75-9621-3ea957c37585']
	];
	
	sql.query('INSERT INTO posts (postType,userID,privacyLevel,description,postUUID) VALUES ?', [posts],(error,results,fields)=>{
		if (error) {throw error};
		console.log('Inserted test post data into the database.');
	});
}

/*
ALTER USER 'root'@'localhost'
IDENTIFIED BY 'admin' PASSWORD EXPIRE NEVER;
*/